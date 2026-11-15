const express = require("express");
const controller = require("../social/controller");
const { requireAuth, optionalAuth } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const { rateLimit } = require("../../middleware/rateLimit");
const { createPostSchema, updatePostSchema } = require("../social/validation");

const router = express.Router();

router.use(rateLimit({ windowMs: 60_000, max: 120 }));

router.get("/", optionalAuth(), controller.getAnnouncements);
router.post(
  "/",
  requireAuth(["admin", "super_admin"]),
  validate({ body: createPostSchema }),
  controller.createAnnouncement
);
router.patch(
  "/:id",
  requireAuth(["admin", "super_admin"]),
  validate({ body: updatePostSchema }),
  controller.updatePost
);
router.delete(
  "/:id",
  requireAuth(["admin", "super_admin"]),
  controller.deletePost
);
router.post(
  "/:id/pin",
  requireAuth(["admin", "super_admin"]),
  controller.togglePinAnnouncement
);

module.exports = router;
