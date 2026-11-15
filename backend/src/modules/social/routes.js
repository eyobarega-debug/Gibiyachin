const express = require("express");
const controller = require("./controller");
const { requireAuth, requireRole, optionalAuth } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const { rateLimit } = require("../../middleware/rateLimit");
const {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
  votePollSchema,
  createReportSchema,
  auditDisclosureSchema,
} = require("./validation");

const router = express.Router();

// General social rate limiter: 120 req/min
router.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Post creation & voting rate limiters
const postLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyFn: (req) => `${req.user?.id || req.ip}:post_create`,
});

const voteLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyFn: (req) => `${req.user?.id || req.ip}:poll_vote`,
});

// ------------------------------------------------------------------
// 1. Social Feed & Posts
// ------------------------------------------------------------------
router.get("/my-identity", requireAuth(), controller.getMyIdentity);
router.get("/feed", optionalAuth(), controller.getFeed);
router.get("/trending", optionalAuth(), controller.getTrending);
router.get("/bookmarks", requireAuth(), (req, res, next) => {
  req.query.tab = "saved";
  controller.getFeed(req, res, next);
});
router.get("/posts/:id/likes", optionalAuth(), controller.getPostLikes);
router.get("/posts/:id", optionalAuth(), controller.getPostById);
router.post("/posts", requireAuth(), postLimiter, validate({ body: createPostSchema }), controller.createPost);
router.patch("/posts/:id", requireAuth(), validate({ body: updatePostSchema }), controller.updatePost);
router.delete("/posts/:id", requireAuth(), controller.deletePost);

// ------------------------------------------------------------------
// 2. Interactions (Likes, Bookmarks, Shares)
// ------------------------------------------------------------------
router.post("/posts/:id/like", requireAuth(), controller.toggleLike);
router.post("/posts/:id/bookmark", requireAuth(), controller.toggleBookmark);
router.post("/posts/:id/share", requireAuth(), controller.recordShare);

// ------------------------------------------------------------------
// 3. Polls
// ------------------------------------------------------------------
router.post("/polls/:id/vote", requireAuth(), voteLimiter, validate({ body: votePollSchema }), controller.votePoll);
router.post("/posts/:id/vote", requireAuth(), voteLimiter, validate({ body: votePollSchema }), controller.votePoll);

// ------------------------------------------------------------------
// 4. Comments & Replies
// ------------------------------------------------------------------
router.get("/posts/:id/comments", optionalAuth(), controller.getComments);
router.post("/posts/:id/comments", requireAuth(), validate({ body: createCommentSchema }), controller.createComment);
router.patch("/comments/:id", requireAuth(), validate({ body: updateCommentSchema }), controller.updateComment);
router.delete("/comments/:id", requireAuth(), controller.deleteComment);
router.post("/comments/:id/like", requireAuth(), controller.toggleLikeComment);

// ------------------------------------------------------------------
// 5. Moderation & Safety Reporting
// ------------------------------------------------------------------
router.post("/posts/:id/report", requireAuth(), controller.reportPost);
router.post("/comments/:id/report", requireAuth(), controller.reportComment);
router.post("/report", requireAuth(), validate({ body: createReportSchema }), controller.reportContent);
router.get("/reports", requireAuth(), requireRole("admin", "super_admin"), controller.getReports);

// ------------------------------------------------------------------
// 6. Moderation Identity Investigation & Audit Trail
// ------------------------------------------------------------------
router.post(
  "/moderation/disclose-identity",
  requireAuth(),
  requireRole("admin", "super_admin"),
  validate({ body: auditDisclosureSchema }),
  controller.discloseIdentity
);
router.get(
  "/moderation/audit-logs",
  requireAuth(),
  requireRole("admin", "super_admin"),
  controller.getAuditLogs
);

module.exports = router;
