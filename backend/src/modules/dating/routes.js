const express = require("express");
const controller = require("./controller");
const { requireAuth } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const { requireFeature } = require("../../middleware/tenant");
const { rateLimit } = require("../../middleware/rateLimit");
const { notFound } = require("../../utils/errors");
const {
  profileSchema,
  preferencesSchema,
  swipeSchema,
  statusSchema,
  reportDatingSchema,
} = require("./validation");

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.param("matchId", (req, res, next, matchId) => {
  if (!UUID_REGEX.test(matchId)) {
    return next(notFound("Match not found"));
  }
  next();
});

// Rate limiting: 120 req/min
router.use(rateLimit({ windowMs: 60_000, max: 120 }));

// University Feature Flag: default enabled unless explicitly turned off
router.use(requireFeature("dating"));

// Require authentication for all dating endpoints
router.use(requireAuth());

// ------------------------------------------------------------------
// 1. Profile & Preferences Management
// ------------------------------------------------------------------

router.get("/profile", controller.getMyProfile);
router.post("/profile", validate({ body: profileSchema }), controller.updateMyProfile);
router.put("/profile", validate({ body: profileSchema }), controller.updateMyProfile);
router.patch("/profile/status", validate({ body: statusSchema }), controller.updateStatus);

router.get("/preferences", controller.getPreferences);
router.put("/preferences", validate({ body: preferencesSchema }), controller.updatePreferences);

// ------------------------------------------------------------------
// 2. Discovery & Swiping
// ------------------------------------------------------------------

router.get("/discover", controller.getDiscovery);
router.post("/swipe", validate({ body: swipeSchema }), controller.swipe);

// ------------------------------------------------------------------
// 3. Matches & Unmatching
// ------------------------------------------------------------------

router.get("/matches", controller.getMatches);
router.post("/matches/:matchId/unmatch", controller.unmatch);

// ------------------------------------------------------------------
// 4. Safety & Reporting
// ------------------------------------------------------------------

router.post("/report", validate({ body: reportDatingSchema }), controller.report);

module.exports = router;
