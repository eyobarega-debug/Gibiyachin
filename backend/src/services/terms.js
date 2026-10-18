// Versioned platform terms (Merchant Terms / Organizer Terms) and the
// agreement records that capture which version a user accepted.
//
// Terms content is stored per version in agreement_versions — publishing a
// new version never overwrites an old one, so historical agreements keep
// pointing at the exact text that was accepted.
const db = require("../db");
const { getFees } = require("./fees");
const { RATES, rateFor } = require("./commissions");
const { notFound, badRequest } = require("../utils/errors");

const AGREEMENT_TYPES = ["merchant_terms", "organizer_terms"];

// Transaction type whose commission rate applies to each onboarding flow.
const COMMISSION_TYPE_BY_AGREEMENT = {
  merchant_terms: "order",
  organizer_terms: "ticket",
};

// Sample amounts used for the "how the fee works" example shown to
// applicants. Purely illustrative — the percentage comes from config.
const EXAMPLE_AMOUNTS = { merchant_terms: 1000, organizer_terms: 500 };

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Effective commission exactly as the payments pipeline resolves it
// (see src/services/payments.js): per-type env rate first, fee-schedule
// rate as fallback.
async function effectiveCommission(universityId, agreementType, client = db) {
  const txnType = COMMISSION_TYPE_BY_AGREEMENT[agreementType];
  const fees = await getFees(universityId, client);
  const rate = rateFor(txnType, fees.commissionRate);
  const exampleAmount = EXAMPLE_AMOUNTS[agreementType];
  const commissionAmount = round2(exampleAmount * rate);
  return {
    rate,
    percent: round2(rate * 100),
    source: RATES[txnType] !== undefined ? "platform" : "fee_schedule",
    example: {
      amountLabel: agreementType === "merchant_terms" ? "Sale amount" : "Ticket price",
      amount: exampleAmount,
      commissionAmount,
      sellerAmount: round2(exampleAmount - commissionAmount),
      currency: "ETB",
    },
  };
}

async function getActiveTerms(agreementType, universityId, client = db) {
  if (!AGREEMENT_TYPES.includes(agreementType)) throw badRequest("Unknown agreement type", "BAD_AGREEMENT_TYPE");
  const { rows } = await client.query(
    `SELECT * FROM agreement_versions
      WHERE agreement_type = $1 AND is_active AND effective_from <= now()
      ORDER BY effective_from DESC LIMIT 1`,
    [agreementType]
  );
  const terms = rows[0];
  if (!terms) throw notFound("No active terms are configured for this application type");
  const commission = await effectiveCommission(universityId, terms.agreement_type, client);
  return {
    id: terms.id,
    agreementType: terms.agreement_type,
    version: terms.version,
    title: terms.title,
    intro: terms.intro,
    content: terms.content,
    effectiveFrom: terms.effective_from,
    commission,
  };
}

// Verify the applicant accepted the ACTIVE version of the given terms.
// Returns the terms row (with the campus-resolved commission) so the caller
// can snapshot version/rate into the agreement record.
async function requireActiveTermsAcceptance(client, { agreementType, terms, universityId }) {
  if (!terms || terms.accepted !== true) {
    throw badRequest("You must read and accept the Gibiychen terms before applying", "TERMS_REQUIRED");
  }
  const active = await getActiveTerms(agreementType, universityId, client);
  const submittedVersion = String(terms.version || "").trim();
  if (submittedVersion !== active.version) {
    throw badRequest(
      `The terms have changed (now v${active.version}). Please review and accept the latest version.`,
      "TERMS_VERSION_MISMATCH"
    );
  }
  return active;
}

// Immutable record of an agreement acceptance, tied to its application.
async function recordAgreement(client, {
  userId,
  universityId,
  applicationType,
  applicationId,
  agreementType,
  agreementVersion,
  commissionRate,
}) {
  const { rows } = await client.query(
    `INSERT INTO application_agreements
       (user_id, university_id, application_type, application_id,
        agreement_type, agreement_version, commission_rate)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      userId,
      universityId || null,
      applicationType,
      applicationId,
      agreementType,
      agreementVersion,
      commissionRate ?? null,
    ]
  );
  return rows[0];
}

async function listVersions() {
  const { rows } = await db.query(
    `SELECT av.*, u.name AS created_by_name
       FROM agreement_versions av
       LEFT JOIN users u ON u.id = av.created_by
      ORDER BY av.agreement_type, av.effective_from DESC, av.created_at DESC`
  );
  return rows;
}

// Publishing a new version deactivates the previous active one for the same
// agreement type (partial unique index enforces one active version per type).
async function createVersion(client, { agreementType, version, title, intro, content, effectiveFrom, createdBy }) {
  if (!AGREEMENT_TYPES.includes(agreementType)) throw badRequest("Unknown agreement type", "BAD_AGREEMENT_TYPE");
  if (!Array.isArray(content) || content.length === 0) {
    throw badRequest("Terms content must contain at least one section", "TERMS_CONTENT_EMPTY");
  }
  for (const section of content) {
    if (!section || typeof section.heading !== "string" || !section.heading.trim()) {
      throw badRequest("Every terms section needs a heading", "TERMS_SECTION_INVALID");
    }
    if (!Array.isArray(section.items) || section.items.length === 0) {
      throw badRequest(`Section "${section.heading}" needs at least one item`, "TERMS_SECTION_INVALID");
    }
  }
  try {
    await client.query(
      "UPDATE agreement_versions SET is_active = false WHERE agreement_type = $1 AND is_active",
      [agreementType]
    );
    const { rows } = await client.query(
      `INSERT INTO agreement_versions
         (agreement_type, version, title, intro, content, effective_from, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz, now()),true,$7)
       RETURNING *`,
      [agreementType, version, title, intro || "", JSON.stringify(content), effectiveFrom || null, createdBy || null]
    );
    return rows[0];
  } catch (err) {
    if (err.code === "23505") {
      throw badRequest(`Version "${version}" already exists for ${agreementType}`, "TERMS_VERSION_EXISTS");
    }
    throw err;
  }
}

module.exports = {
  AGREEMENT_TYPES,
  COMMISSION_TYPE_BY_AGREEMENT,
  effectiveCommission,
  getActiveTerms,
  requireActiveTermsAcceptance,
  recordAgreement,
  listVersions,
  createVersion,
};
