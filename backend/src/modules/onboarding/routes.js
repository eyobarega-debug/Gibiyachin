// Gibiychin onboarding — shared endpoints for the "Become a Merchant" /
// "Become an Organizer" flows: the versioned terms (with the currently
// configured commission) and the applicant's own application status.
const express = require("express");
const { z } = require("zod");
const db = require("../../db");
const { requireAuth } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const { asyncHandler, badRequest } = require("../../utils/errors");
const { getActiveTerms } = require("../../services/terms");

const router = express.Router();

const TYPE_TO_AGREEMENT = { merchant: "merchant_terms", organizer: "organizer_terms" };

function applicationOut(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    reason: row.reason || null,
    name: row.business_name || row.organizer_name,
    createdAt: row.created_at,
    submittedAt: row.submitted_at || row.created_at,
    decidedAt: row.decided_at || null,
    reviewedAt: row.reviewed_at || null,
  };
}

// Full active terms for an onboarding flow, including the campus-resolved
// commission rate and a worked example so applicants see the real numbers.
router.get(
  "/terms",
  requireAuth(),
  validate({ query: z.object({ type: z.enum(["merchant", "organizer"]) }) }),
  asyncHandler(async (req, res) => {
    const agreementType = TYPE_TO_AGREEMENT[req.query.type];
    const terms = await getActiveTerms(agreementType, req.user.university_id);
    res.json({ terms });
  })
);

// The signed-in user's latest merchant + organizer application state.
// Consumed by the account menu to render "Become a …" / "· Pending" /
// "· Rejected" / "… Dashboard" entries.
router.get(
  "/status",
  requireAuth(),
  asyncHandler(async (req, res) => {
    const merchant = await db.query(
      `SELECT * FROM merchant_applications WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    const organizer = await db.query(
      `SELECT * FROM organizer_applications WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    res.json({
      merchant: applicationOut(merchant.rows[0]),
      organizer: applicationOut(organizer.rows[0]),
      role: req.user.role,
    });
  })
);

module.exports = router;
