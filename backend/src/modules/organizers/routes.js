// Event organizer onboarding — the organizer-side twin of the merchant
// application flow (src/modules/merchants/routes.js). An authenticated user
// applies, the campus admin reviews, and approval grants the organizer
// capability (users.role = 'organizer') plus the club record that the events
// module requires before an organizer can create events.
const express = require("express");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const { asyncHandler, badRequest, notFound, forbidden, conflict } = require("../../utils/errors");
const { notify, audit } = require("../../utils/notify");
const { assertSameTenant } = require("../../middleware/tenant");
const { requireActiveTermsAcceptance, recordAgreement } = require("../../services/terms");

const router = express.Router();

const ORGANIZER_TYPES = ["club", "association", "department", "individual", "other"];

const termsAcceptance = z.object({
  accepted: z.literal(true),
  version: z.string().min(1),
});

const applySchema = z.object({
  organizerName: z.string().trim().min(2).max(120),
  organizationName: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  phone: z.string().trim().max(40).optional(),
  organizerType: z.enum(ORGANIZER_TYPES).default("individual"),
  documentUrls: z.array(z.string()).max(10).optional(),
  terms: termsAcceptance,
});

function appOut(a) {
  return {
    id: a.id,
    organizerName: a.organizer_name,
    organizationName: a.organization_name,
    description: a.description,
    phone: a.phone,
    organizerType: a.organizer_type,
    status: a.status,
    reason: a.reason,
    createdAt: a.created_at,
    submittedAt: a.submitted_at,
    decidedAt: a.decided_at,
    reviewedAt: a.reviewed_at,
    universityId: a.university_id,
    universityName: a.university_name || null,
    applicantName: a.applicant_name || null,
    applicantEmail: a.applicant_email || null,
    agreementVersion: a.agreement_version || null,
  };
}

// FR-style — apply to become an event organizer. Campus/tenant comes from the
// authenticated user, never from the request body.
router.post(
  "/apply",
  requireAuth(),
  validate({ body: applySchema }),
  asyncHandler(async (req, res) => {
    if (req.user.role === "organizer") throw conflict("You are already an organizer", "ALREADY_ORGANIZER");
    if (req.user.role !== "student") {
      throw forbidden("Only student accounts can submit an organizer application");
    }
    if (!req.user.university_id) throw forbidden("Your account is not attached to a university");

    const result = await db.withTransaction(async (client) => {
      const existing = await client.query(
        "SELECT id FROM organizer_applications WHERE user_id = $1 AND status = 'pending_review'",
        [req.user.id]
      );
      if (existing.rows.length) throw conflict("You already have a pending organizer application");

      const terms = await requireActiveTermsAcceptance(client, {
        agreementType: "organizer_terms",
        terms: req.body.terms,
        universityId: req.user.university_id,
      });

      const { rows } = await client.query(
        `INSERT INTO organizer_applications
           (user_id, university_id, organizer_name, organization_name, description,
            phone, organizer_type, document_urls)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          req.user.id,
          req.user.university_id,
          req.body.organizerName,
          req.body.organizationName || null,
          req.body.description || null,
          req.body.phone || req.user.phone || null,
          req.body.organizerType,
          req.body.documentUrls || [],
        ]
      );
      const application = rows[0];

      await recordAgreement(client, {
        userId: req.user.id,
        universityId: req.user.university_id,
        applicationType: "organizer",
        applicationId: application.id,
        agreementType: "organizer_terms",
        agreementVersion: terms.version,
        commissionRate: terms.commission.rate,
      });

      return application;
    });

    await notify(
      req.user.id,
      "organizer_application",
      "Your Gibiychin organizer application is waiting for review",
      "A campus administrator will review it. You'll be notified once it's decided."
    );
    const admins = await db.query("SELECT id FROM users WHERE role = 'admin' AND university_id = $1", [
      req.user.university_id,
    ]);
    await Promise.all(
      admins.rows.map((a) =>
        notify(a.id, "organizer_application", "New organizer application", `${req.body.organizerName} applied to host events on ግቢያችን.`)
      )
    );
    await audit(req.user.id, "organizer.apply", "organizer_application", result.id, {
      organizerName: req.body.organizerName,
      termsVersion: req.body.terms.version,
    });

    res.status(201).json({ application: appOut(result) });
  })
);

// Applicant: latest own application (for the apply page status view).
router.get(
  "/applications/mine",
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      "SELECT * FROM organizer_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5",
      [req.user.id]
    );
    res.json({ applications: rows.map(appOut) });
  })
);

// Campus admin: review queue for their campus. super_admin without a campus
// header sees every campus (same convention as /merchants/applications).
router.get(
  "/applications",
  requireAuth(),
  requireRole("admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const status = req.query.status || "pending_review";
    const { rows } = await db.query(
      `SELECT oa.*, u.name AS applicant_name, u.email AS applicant_email, un.name AS university_name,
              (SELECT agreement_version FROM application_agreements ag
                WHERE ag.application_type = 'organizer' AND ag.application_id = oa.id
                ORDER BY ag.agreed_at DESC LIMIT 1) AS agreement_version
         FROM organizer_applications oa
         JOIN users u ON u.id = oa.user_id
         LEFT JOIN universities un ON un.id = oa.university_id
        WHERE ($1::text IS NULL OR oa.status = $1) AND ($2::uuid IS NULL OR oa.university_id = $2)
        ORDER BY oa.created_at DESC
        LIMIT 200`,
      [status === "all" ? null : status, req.tenant.universityId]
    );
    // Raw rows (with joined applicant/university aliases) — same shape as the
    // merchant applications list so the admin console renders both uniformly.
    res.json({ applications: rows });
  })
);

// Campus admin / super admin: approve or rejection. Approval grants the
// organizer capability and creates the lead club the events module expects.
router.patch(
  "/applications/:id/decision",
  requireAuth(),
  requireRole("admin", "super_admin"),
  validate({
    body: z
      .object({
        decision: z.enum(["approve", "reject"]),
        reason: z.string().trim().max(1000).optional(),
      })
      .superRefine((val, ctx) => {
        if (val.decision === "reject" && (!val.reason || val.reason.trim().length < 2)) {
          ctx.addIssue({ code: "custom", message: "A rejection reason is required", path: ["reason"] });
        }
      }),
  }),
  asyncHandler(async (req, res) => {
    const result = await db.withTransaction(async (client) => {
      const { rows } = await client.query("SELECT * FROM organizer_applications WHERE id = $1 FOR UPDATE", [
        req.params.id,
      ]);
      const app = rows[0];
      if (!app) throw notFound("Application not found");
      assertSameTenant(req, app.university_id, "Application");
      if (app.status !== "pending_review") throw conflict("This application has already been decided");

      const status = req.body.decision === "approve" ? "approved" : "rejected";
      await client.query(
        `UPDATE organizer_applications
            SET status = $1, reason = $2, decided_at = now(), reviewed_at = now(), reviewed_by = $3
          WHERE id = $4`,
        [status, req.body.decision === "reject" ? req.body.reason : null, req.user.id, app.id]
      );

      let club = null;
      if (status === "approved") {
        await client.query("UPDATE users SET role = 'organizer' WHERE id = $1", [app.user_id]);
        const clubName = (app.organization_name || app.organizer_name || "").trim();
        const clubRes = await client.query(
          `INSERT INTO clubs (university_id, name, lead_user_id, status)
           VALUES ($1,$2,$3,'active') RETURNING *`,
          [app.university_id, clubName || "Organizer Club", app.user_id]
        );
        club = clubRes.rows[0];
      }

      await notify(
        app.user_id,
        "organizer_decision",
        status === "approved" ? "Your Gibiychin organizer application was approved!" : "Your Gibiychin organizer application was rejected",
        status === "approved" ? "You can now create and manage events." : req.body.reason
      );
      await audit(req.user.id, "organizer.decision", "organizer_application", app.id, {
        status,
        reason: req.body.reason || null,
      });

      return { application: { ...app, status, reason: req.body.reason || null }, club };
    });
    res.json(result);
  })
);

module.exports = router;
