/**
 * Merchant & Event Organizer Onboarding — end-to-end flow suite.
 *
 * Covers the complete apply → terms agreement → pending → campus admin
 * approve/reject → capability flow for both application types:
 *  1. Active terms delivery + commission snapshot (GET /api/onboarding/terms)
 *  2. Merchant apply validation, terms enforcement, agreement records
 *  3. Merchant approve → role flip + store creation; reject requires reason
 *  4. Organizer apply, reject → re-apply, approve → role flip + club creation
 *  5. Tenant isolation: campus admins scoped, super admin cross-campus
 *  6. Super admin terms versioning (publish → active switch → restore)
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

process.env.NODE_ENV = "test";

const app = require("../src/app");
const db = require("../src/db");
const { hashPassword } = require("../src/utils/hash");
const { signAccessToken } = require("../src/utils/jwt");

let server;
let baseUrl;

let uniA, uniB;
let superAdminToken;
let adminAToken, adminAUser;
let adminBToken;
let studentToken, studentUser; // merchant flow
let orgToken, orgUser; // organizer flow
let rejectToken, rejectUser; // rejected merchant, re-apply path
let merchantToken; // already-merchant (role gate)

const cleanupUniIds = [];
const cleanupUserIds = [];

async function apiRequest(path, { method = "GET", headers = {}, body } = {}) {
  const reqHeaders = { ...headers };
  let reqBody;
  if (body !== undefined) {
    reqHeaders["Content-Type"] = "application/json";
    reqBody = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, { method, headers: reqHeaders, body: reqBody });
  const contentType = res.headers.get("content-content-type") || res.headers.get("content-type") || "";
  let data = null;
  if (contentType.includes("application/json")) data = await res.json();
  else data = await res.text();
  return { status: res.status, data, headers: res.headers };
}

async function createUser({ name, email, role, universityId }) {
  const hash = await hashPassword("Password123!");
  const { rows } = await db.query(
    `INSERT INTO users (name, email, role, university_id, verified, verification_method, password_hash, department, year, email_verified)
     VALUES ($1,$2,$3,$4,true,'domain',$5,'CS',3,true) RETURNING *`,
    [name, email, role, universityId, hash]
  );
  cleanupUserIds.push(rows[0].id);
  return { user: rows[0], token: signAccessToken(rows[0]) };
}

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const ts = Date.now();
  const uniARes = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status)
     VALUES ($1,$2,$3,$4,'active') RETURNING *`,
    ["Onboarding Uni A", `onb-a-${ts}`, `onba-${ts}.edu.et`, [`onba-${ts}.edu.et`]]
  );
  uniA = uniARes.rows[0];
  cleanupUniIds.push(uniA.id);

  const uniBRes = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status)
     VALUES ($1,$2,$3,$4,'active') RETURNING *`,
    ["Onboarding Uni B", `onb-b-${ts}`, `onbb-${ts}.edu.et`, [`onbb-${ts}.edu.et`]]
  );
  uniB = uniBRes.rows[0];
  cleanupUniIds.push(uniB.id);

  const superA = await createUser({ name: "Onb Super", email: `onb_super_${ts}@platform.local`, role: "super_admin", universityId: null });
  superAdminToken = superA.token;

  ({ user: adminAUser, token: adminAToken } = await createUser({ name: "Onb Admin A", email: `onb_admin_${ts}@onba-${ts}.edu.et`, role: "admin", universityId: uniA.id }));
  ({ token: adminBToken } = await createUser({ name: "Onb Admin B", email: `onb_adminb_${ts}@onbb-${ts}.edu.et`, role: "admin", universityId: uniB.id }));

  ({ user: studentUser, token: studentToken } = await createUser({ name: "Onb Student", email: `onb_stu_${ts}@onba-${ts}.edu.et`, role: "student", universityId: uniA.id }));
  ({ user: orgUser, token: orgToken } = await createUser({ name: "Onb Organizer", email: `onb_org_${ts}@onba-${ts}.edu.et`, role: "student", universityId: uniA.id }));
  ({ user: rejectUser, token: rejectToken } = await createUser({ name: "Onb Rejected", email: `onb_rej_${ts}@onba-${ts}.edu.et`, role: "student", universityId: uniA.id }));
  ({ token: merchantToken } = await createUser({ name: "Onb Merchant", email: `onb_mer_${ts}@onba-${ts}.edu.et`, role: "merchant", universityId: uniA.id }));
});

after(async () => {
  try {
    for (const unid of cleanupUniIds) {
      await db.query("DELETE FROM application_agreements WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM organizer_applications WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM merchant_applications WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM clubs WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM stores WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE university_id = $1)", [unid]).catch(() => {});
      await db.query("DELETE FROM audit_logs WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM users WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM universities WHERE id = $1", [unid]).catch(() => {});
    }
    await db.query("DELETE FROM notifications WHERE user_id = ANY($1)", [cleanupUserIds]).catch(() => {});
    await db.query("DELETE FROM audit_logs WHERE actor_id = ANY($1)", [cleanupUserIds]).catch(() => {});
    await db.query("DELETE FROM users WHERE id = ANY($1)", [cleanupUserIds]).catch(() => {});
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.pool.end();
  }
});

describe("1. Active terms delivery", () => {
  test("GET /api/onboarding/terms?type=merchant returns versioned terms with commission", async () => {
    const res = await apiRequest("/api/onboarding/terms?type=merchant", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 200);
    const t = res.data.terms;
    assert.ok(t.version, "terms must expose a version");
    assert.equal(t.agreementType, "merchant_terms");
    assert.ok(Array.isArray(t.content) && t.content.length > 0, "terms must include sections");
    assert.ok(typeof t.commission.rate === "number" && t.commission.rate >= 0, "commission rate must be numeric");
    assert.ok(t.commission.example && typeof t.commission.example.commissionAmount === "number", "worked example required");
    assert.equal(t.commission.example.currency, "ETB");
  });

  test("GET /api/onboarding/terms?type=organizer returns organizer terms", async () => {
    const res = await apiRequest("/api/onboarding/terms?type=organizer", {
      headers: { Authorization: `Bearer ${orgToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.terms.agreementType, "organizer_terms");
    assert.ok(res.data.terms.version);
  });

  test("invalid type is rejected", async () => {
    const res = await apiRequest("/api/onboarding/terms?type=bogus", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 400);
  });

  test("unauthenticated terms request is rejected", async () => {
    const res = await apiRequest("/api/onboarding/terms?type=merchant");
    // 401 from requireAuth, or 400 TENANT_REQUIRED from the tenant middleware
    // when the request carries no university and several campuses exist.
    assert.ok(res.status === 401 || res.status === 400, `expected 401/400, got ${res.status}`);
  });
});

describe("2. Merchant application flow", () => {
  let merchantTermsVersion;
  let applicationId;

  test("apply without terms acceptance is rejected", async () => {
    const res = await apiRequest("/api/merchants/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { businessName: "No Terms Shop", category: "Books" },
    });
    assert.equal(res.status, 400);
  });

  test("apply with a stale terms version is rejected (TERMS_VERSION_MISMATCH)", async () => {
    const { data } = await apiRequest("/api/onboarding/terms?type=merchant", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    merchantTermsVersion = data.terms.version;

    const res = await apiRequest("/api/merchants/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        businessName: "Stale Terms Shop",
        category: "Books",
        terms: { accepted: true, version: `${merchantTermsVersion}-stale` },
      },
    });
    assert.equal(res.status, 400);
    assert.equal(res.data?.error?.code, "TERMS_VERSION_MISMATCH");
  });

  test("apply with accepted active terms succeeds and records the agreement", async () => {
    const res = await apiRequest("/api/merchants/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        businessName: "Onb Books",
        category: "Books",
        contactInfo: "Addis, 0900000000",
        terms: { accepted: true, version: merchantTermsVersion },
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.application.status, "pending_review");
    applicationId = res.data.application.id;

    const { rows } = await db.query(
      "SELECT * FROM application_agreements WHERE application_type = 'merchant' AND application_id = $1",
      [applicationId]
    );
    assert.equal(rows.length, 1, "one agreement row per application");
    assert.equal(rows[0].agreement_version, merchantTermsVersion);
    assert.equal(rows[0].user_id, studentUser.id);
    assert.ok(rows[0].commission_rate !== null, "commission rate must be snapshotted");
  });

  test("applicant and campus admins are notified", async () => {
    const applicant = await db.query(
      "SELECT * FROM notifications WHERE user_id = $1 AND type = 'merchant_application'", [studentUser.id]
    );
    assert.equal(applicant.rows.length, 1, "applicant gets a notification");
    const adminNotifs = await db.query(
      "SELECT * FROM notifications WHERE user_id = $1 AND type = 'merchant_application'", [adminAUser.id]
    );
    assert.ok(adminNotifs.rows.length >= 1, "campus admin gets a notification");
  });

  test("status endpoint reports the pending application", async () => {
    const res = await apiRequest("/api/onboarding/status", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.merchant.status, "pending_review");
    assert.equal(res.data.role, "student");
  });

  test("second pending application is blocked with 409", async () => {
    const res = await apiRequest("/api/merchants/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        businessName: "Duplicate Shop",
        terms: { accepted: true, version: merchantTermsVersion },
      },
    });
    assert.equal(res.status, 409);
  });

  test("non-student accounts cannot apply (403)", async () => {
    const res = await apiRequest("/api/merchants/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: {
        businessName: "Admin Shop",
        terms: { accepted: true, version: merchantTermsVersion },
      },
    });
    assert.equal(res.status, 403);

    const already = await apiRequest("/api/merchants/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${merchantToken}` },
      body: {
        businessName: "Merchant Again",
        terms: { accepted: true, version: merchantTermsVersion },
      },
    });
    assert.equal(already.status, 409, "existing merchants are told they already have access");
  });

  test("campus admin list includes applicant, campus and agreement version", async () => {
    const res = await apiRequest("/api/merchants/applications?status=pending_review", {
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert.equal(res.status, 200);
    const row = res.data.applications.find((a) => a.id === applicationId);
    assert.ok(row, "application visible to same-campus admin");
    assert.equal(row.applicant_email, studentUser.email);
    assert.equal(row.university_name, uniA.name);
    assert.equal(row.agreement_version, merchantTermsVersion);
  });

  test("cross-campus admin cannot see or decide the application", async () => {
    const list = await apiRequest("/api/merchants/applications?status=pending_review", {
      headers: { Authorization: `Bearer ${adminBToken}` },
    });
    assert.equal(list.status, 200);
    assert.ok(!list.data.applications.some((a) => a.id === applicationId), "Uni B admin must not see Uni A applications");

    const decide = await apiRequest(`/api/merchants/${applicationId}/decision`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminBToken}` },
      body: { decision: "approve" },
    });
    assert.equal(decide.status, 404, "cross-campus decision must 404");
  });

  test("reject without a reason is rejected by validation", async () => {
    const res = await apiRequest(`/api/merchants/${applicationId}/decision`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: { decision: "reject" },
    });
    assert.equal(res.status, 400);
  });

  test("campus admin approval flips role and creates the store", async () => {
    const res = await apiRequest(`/api/merchants/${applicationId}/decision`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: { decision: "approve" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.application.status, "approved");
    assert.ok(res.data.store && res.data.store.id, "store created on approval");
    assert.equal(res.data.store.name, "Onb Books");

    const user = await db.query("SELECT role FROM users WHERE id = $1", [studentUser.id]);
    assert.equal(user.rows[0].role, "merchant", "student becomes merchant on approval");
    const appRow = await db.query("SELECT status, reviewed_by, reviewed_at FROM merchant_applications WHERE id = $1", [applicationId]);
    assert.equal(appRow.rows[0].status, "approved");
    assert.equal(appRow.rows[0].reviewed_by, adminAUser.id, "reviewer recorded");
    assert.ok(appRow.rows[0].reviewed_at, "review timestamp recorded");
  });

  test("deciding an already-decided application returns 409", async () => {
    const res = await apiRequest(`/api/merchants/${applicationId}/decision`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: { decision: "reject", reason: "No longer needed" },
    });
    assert.equal(res.status, 409);
  });
});

describe("3. Organizer application flow", () => {
  let orgTermsVersion;
  let orgAppId;
  let rejectedAppId;

  test("apply without terms is rejected", async () => {
    const res = await apiRequest("/api/organizers/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${orgToken}` },
      body: { organizerName: "Robot Club" },
    });
    assert.equal(res.status, 400);
  });

  test("apply with accepted terms succeeds", async () => {
    const { data } = await apiRequest("/api/onboarding/terms?type=organizer", {
      headers: { Authorization: `Bearer ${orgToken}` },
    });
    orgTermsVersion = data.terms.version;

    const res = await apiRequest("/api/organizers/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${orgToken}` },
      body: {
        organizerName: "Robotics Club",
        organizationName: "Robotics Club",
        organizerType: "club",
        phone: "0911111111",
        description: "Weekly robotics workshops",
        terms: { accepted: true, version: orgTermsVersion },
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.application.status, "pending_review");
    orgAppId = res.data.application.id;

    const { rows } = await db.query(
      "SELECT * FROM application_agreements WHERE application_type = 'organizer' AND application_id = $1", [orgAppId]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].agreement_version, orgTermsVersion);
  });

  test("duplicate pending organizer application is blocked", async () => {
    const res = await apiRequest("/api/organizers/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${orgToken}` },
      body: {
        organizerName: "Robotics Club Again",
        terms: { accepted: true, version: orgTermsVersion },
      },
    });
    assert.equal(res.status, 409);
  });

  test("campus admin can list organizer applications for their campus only", async () => {
    const mine = await apiRequest("/api/organizers/applications?status=pending_review", {
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert.equal(mine.status, 200);
    const row = mine.data.applications.find((a) => a.id === orgAppId);
    assert.ok(row, "same-campus admin sees the application");
    assert.equal(row.applicant_email, orgUser.email);
    assert.equal(row.agreement_version, orgTermsVersion);

    const other = await apiRequest("/api/organizers/applications?status=pending_review", {
      headers: { Authorization: `Bearer ${adminBToken}` },
    });
    assert.equal(other.status, 200);
    assert.ok(!other.data.applications.some((a) => a.id === orgAppId), "other-campus admin does not");
  });

  test("reject requires a reason", async () => {
    const res = await apiRequest(`/api/organizers/applications/${orgAppId}/decision`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: { decision: "reject" },
    });
    assert.equal(res.status, 400);
  });

  test("rejection stores the reason and lets the student re-apply", async () => {
    const res = await apiRequest(`/api/organizers/applications/${orgAppId}/decision`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: { decision: "reject", reason: "Need more details about the club" },
    });
    assert.equal(res.status, 200);

    const status = await apiRequest("/api/onboarding/status", {
      headers: { Authorization: `Bearer ${orgToken}` },
    });
    assert.equal(status.data.organizer.status, "rejected");
    assert.equal(status.data.organizer.reason, "Need more details about the club");

    const reapplied = await apiRequest("/api/organizers/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${orgToken}` },
      body: {
        organizerName: "Robotics Club",
        organizationName: "Robotics Club",
        organizerType: "club",
        terms: { accepted: true, version: orgTermsVersion },
      },
    });
    assert.equal(reapplied.status, 201, "re-apply allowed after rejection");
    rejectedAppId = orgAppId;
    orgAppId = reapplied.data.application.id;
  });

  test("approval flips role and creates the lead club for events", async () => {
    const res = await apiRequest(`/api/organizers/applications/${orgAppId}/decision`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: { decision: "approve" },
    });
    assert.equal(res.status, 200);
    assert.ok(res.data.club && res.data.club.id, "club created on approval");

    const user = await db.query("SELECT role FROM users WHERE id = $1", [orgUser.id]);
    assert.equal(user.rows[0].role, "organizer");

    const club = await db.query("SELECT * FROM clubs WHERE id = $1", [res.data.club.id]);
    assert.equal(club.rows[0].lead_user_id, orgUser.id, "applicant leads the club");
    assert.equal(club.rows[0].university_id, uniA.id);
    assert.equal(club.rows[0].status, "active");

    void rejectedAppId;
  });
});

describe("4. Super admin — cross-campus review and terms versioning", () => {
  let rejectAppId;
  let newTermsVersionId;

  test("super admin sees applications across campuses and can filter by campus", async () => {
    const all = await apiRequest("/api/merchants/applications?status=all", {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(all.status, 200);
    assert.ok(all.data.applications.length >= 1, "super admin sees applications platform-wide");

    const filtered = await apiRequest(`/api/merchants/applications?status=all&universityId=${uniB.id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(filtered.status, 200);
    assert.ok(filtered.data.applications.every((a) => a.university_id === uniB.id), "campus filter narrows results");
  });

  test("super admin can reject an application with a reason", async () => {
    const { data } = await apiRequest("/api/onboarding/terms?type=merchant", {
      headers: { Authorization: `Bearer ${rejectToken}` },
    });
    const applied = await apiRequest("/api/merchants/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${rejectToken}` },
      body: {
        businessName: "To Be Rejected Shop",
        terms: { accepted: true, version: data.terms.version },
      },
    });
    assert.equal(applied.status, 201);
    rejectAppId = applied.data.application.id;

    const res = await apiRequest(`/api/merchants/${rejectAppId}/decision`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { decision: "reject", reason: "Unable to verify business details" },
    });
    assert.equal(res.status, 200);

    const { rows } = await db.query("SELECT status, reason FROM merchant_applications WHERE id = $1", [rejectAppId]);
    assert.equal(rows[0].status, "rejected");
    assert.equal(rows[0].reason, "Unable to verify business details");

    const user = await db.query("SELECT role FROM users WHERE id = $1", [rejectUser.id]);
    assert.equal(user.rows[0].role, "student", "rejected applicants keep the student role");
  });

  test("published terms version becomes active; historical agreement keeps its version", async () => {
    const create = await apiRequest("/api/super/terms", {
      method: "POST",
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: {
        agreementType: "merchant_terms",
        version: "99.0-test",
        title: "Test Merchant Terms v99.0",
        intro: "Temporary version created by the onboarding test suite.",
        content: [{ heading: "Testing", items: ["This version exists only for automated tests."] }],
      },
    });
    assert.equal(create.status, 201);
    newTermsVersionId = create.data.version.id;

    const active = await apiRequest("/api/onboarding/terms?type=merchant", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(active.data.terms.version, "99.0-test", "new version is active for new applicants");

    // Previously accepted agreements still point at the version they signed.
    const { rows } = await db.query(
      "SELECT agreement_version FROM application_agreements WHERE application_type = 'merchant' AND application_id = $1",
      [(await db.query("SELECT id FROM merchant_applications WHERE user_id = $1 ORDER BY created_at LIMIT 1", [studentUser.id])).rows[0].id]
    );
    assert.notEqual(rows[0].agreement_version, "99.0-test", "historical agreements are immutable");

    const versions = await apiRequest("/api/super/terms", { headers: { Authorization: `Bearer ${superAdminToken}` } });
    assert.equal(versions.status, 200);
    const activeOnes = versions.data.versions.filter((v) => v.agreement_type === "merchant_terms" && v.is_active);
    assert.equal(activeOnes.length, 1, "exactly one active version per type");
    assert.equal(activeOnes[0].version, "99.0-test");
  });

  after(async () => {
    // Restore the platform's real active merchant terms after the versioning test.
    if (newTermsVersionId) {
      await db.query("DELETE FROM agreement_versions WHERE id = $1", [newTermsVersionId]).catch(() => {});
      await db.query(
        "UPDATE agreement_versions SET is_active = true WHERE agreement_type = 'merchant_terms' AND version = '1.0'"
      ).catch(() => {});
    }
  });
});
