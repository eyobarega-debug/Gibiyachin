const express = require("express");
const controller = require("./controller");
const { requireAuth, requireRole, optionalAuth } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const { requireFeature } = require("../../middleware/tenant");
const { rateLimit } = require("../../middleware/rateLimit");
const {
  createItemSchema,
  updateItemSchema,
  queryItemsSchema,
  claimSchema,
  reviewClaimSchema,
  disputeClaimSchema,
  adminModerateSchema,
} = require("./validation");

const router = express.Router();

// General rate limiting: 120 req/min
router.use(rateLimit({ windowMs: 60_000, max: 120 }));

// University Feature Flag: default enabled unless explicitly set to false
router.use(requireFeature("lost_found"));

// ------------------------------------------------------------------
// Item Discovery & CRUD
// ------------------------------------------------------------------

// Browse / search lost & found catalog
router.get("/", optionalAuth(), validate({ query: queryItemsSchema }), controller.listItems);

// Personal dashboard (my lost, my found, matches, claims)
router.get("/my-items", requireAuth(), controller.getMyItems);

// Campus Admin moderation listing
router.get("/admin", requireAuth(), requireRole("admin", "super_admin"), controller.adminListItems);

// Admin moderation action (remove, restore, close)
router.patch("/admin/:id", requireAuth(), requireRole("admin", "super_admin"), validate({ body: adminModerateSchema }), controller.adminModerateItem);

// Single item details
router.get("/:id", optionalAuth(), controller.getItem);

// Report a lost or found item
router.post("/", requireAuth(), validate({ body: createItemSchema }), controller.createItem);

// Update a report
router.put("/:id", requireAuth(), validate({ body: updateItemSchema }), controller.updateItem);
router.patch("/:id", requireAuth(), validate({ body: updateItemSchema }), controller.updateItem);
router.patch("/:id/status", requireAuth(), validate({ body: updateItemSchema }), controller.updateItem);

// Delete / remove a report
router.delete("/:id", requireAuth(), controller.deleteItem);

// Match recommendations for a specific report
router.get("/:id/matches", requireAuth(), controller.getItemMatches);

// ------------------------------------------------------------------
// Claim & Verification Workflow
// ------------------------------------------------------------------

// Submit a claim on an item
router.post("/:id/claims", requireAuth(), validate({ body: claimSchema }), controller.submitClaim);
router.post("/:id/claim", requireAuth(), validate({ body: claimSchema }), controller.submitClaim);

// View claims on an item
router.get("/:id/claims", requireAuth(), controller.getItemClaims);

// Review claim (approve or reject)
router.put("/claims/:claimId/review", requireAuth(), validate({ body: reviewClaimSchema }), controller.reviewClaim);
router.post("/claims/:claimId/review", requireAuth(), validate({ body: reviewClaimSchema }), controller.reviewClaim);
router.put("/claims/:claimId/approve", requireAuth(), (req, res, next) => {
  req.body.action = "approve";
  controller.reviewClaim(req, res, next);
});
router.put("/claims/:claimId/reject", requireAuth(), (req, res, next) => {
  req.body.action = "reject";
  controller.reviewClaim(req, res, next);
});

// Handover confirmation
router.post("/:id/handover", requireAuth(), controller.confirmHandoverByItem);
router.put("/claims/:claimId/confirm-handover", requireAuth(), controller.confirmHandover);

// Dispute claim
router.put("/claims/:claimId/dispute", requireAuth(), validate({ body: disputeClaimSchema }), controller.disputeClaim);

module.exports = router;
