const express = require("express");
const controller = require("../social/controller");
const { requireAuth, optionalAuth } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const { rateLimit } = require("../../middleware/rateLimit");
const {
  createCommunitySchema,
  updateCommunitySchema,
  createPostSchema,
  reviewJoinRequestSchema,
  updateMemberRoleSchema,
} = require("../social/validation");

const router = express.Router();

router.use(rateLimit({ windowMs: 60_000, max: 120 }));

// List & details
router.get("/", optionalAuth(), controller.getCommunities);
router.post("/", requireAuth(), validate({ body: createCommunitySchema }), controller.createCommunity);
router.get("/:id", optionalAuth(), controller.getCommunityById);
router.patch("/:id", requireAuth(), validate({ body: updateCommunitySchema }), controller.updateCommunity);

// Join & leave
router.post("/:id/join", requireAuth(), controller.joinCommunity);
router.post("/:id/leave", requireAuth(), controller.leaveCommunity);

// Community posts
router.get("/:id/posts", optionalAuth(), (req, res, next) => {
  req.query.communityId = req.params.id;
  controller.getFeed(req, res, next);
});
router.post("/:id/posts", requireAuth(), validate({ body: createPostSchema }), (req, res, next) => {
  req.body.communityId = req.params.id;
  controller.createPost(req, res, next);
});

// Member moderation & join requests
router.get("/:id/members", optionalAuth(), controller.getCommunityMembers);
router.get("/:id/join-requests", requireAuth(), controller.getJoinRequests);
router.post("/:id/join-requests/:requestId/approve", requireAuth(), controller.reviewJoinRequest);
router.post("/:id/join-requests/:requestId/reject", requireAuth(), controller.reviewJoinRequest);
router.post(
  "/:id/join-requests/:requestId",
  requireAuth(),
  validate({ body: reviewJoinRequestSchema }),
  controller.reviewJoinRequest
);
router.patch(
  "/:id/members/:userId",
  requireAuth(),
  validate({ body: updateMemberRoleSchema }),
  controller.updateMemberRole
);
router.delete("/:id/members/:userId", requireAuth(), controller.removeMember);

module.exports = router;
