const express = require("express");
const controller = require("./controller");
const { requireAuth } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const { requireFeature } = require("../../middleware/tenant");
const { rateLimit } = require("../../middleware/rateLimit");
const { notFound } = require("../../utils/errors");
const {
  createConversationSchema,
  sendMessageSchema,
  editMessageSchema,
  queryConversationsSchema,
  queryMessagesSchema,
  toggleSettingSchema,
  blockUserSchema,
  reportUserSchema,
} = require("./validation");

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Strict UUID parameter validation to prevent dynamic route collisions
router.param("id", (req, res, next, id) => {
  if (!UUID_REGEX.test(id)) {
    return next(notFound("Conversation not found"));
  }
  next();
});

router.param("messageId", (req, res, next, messageId) => {
  if (!UUID_REGEX.test(messageId)) {
    return next(notFound("Message not found"));
  }
  next();
});

// Rate limiting: 120 req/min
router.use(rateLimit({ windowMs: 60_000, max: 120 }));

// University Feature Flag: default enabled unless explicitly turned off
router.use(requireFeature("messaging"));

// Require authenticated user for all messaging endpoints
router.use(requireAuth());

// ------------------------------------------------------------------
// 1. Static and Global Utility Routes (Priority 1)
// ------------------------------------------------------------------

// Badge count: total unread messages
router.get("/unread-count", controller.getUnreadCount);

// Block management
router.get("/blocks", controller.listBlocked);
router.post("/block", validate({ body: blockUserSchema }), controller.blockUser);
router.post("/unblock", validate({ body: blockUserSchema.pick({ targetUserId: true }) }), controller.unblockUser);

// Moderation / reporting
router.post("/report", validate({ body: reportUserSchema }), controller.reportUser);

// ------------------------------------------------------------------
// 2. Message Modification Routes (Registered BEFORE /:id dynamic router)
// ------------------------------------------------------------------

router.patch("/messages/:messageId", validate({ body: editMessageSchema }), controller.editMessage);
router.delete("/messages/:messageId", controller.deleteMessage);

// ------------------------------------------------------------------
// 3. Conversations Catalog & Creation
// ------------------------------------------------------------------

router.get("/conversations", validate({ query: queryConversationsSchema }), controller.listConversations);
router.post("/conversations", validate({ body: createConversationSchema }), controller.createConversation);

// ------------------------------------------------------------------
// 4. Single Conversation & Nested Messages
// ------------------------------------------------------------------

router.get("/conversations/:id", controller.getConversation);
router.get("/conversations/:id/messages", validate({ query: queryMessagesSchema }), controller.listMessages);
router.post("/conversations/:id/messages", validate({ body: sendMessageSchema }), controller.postMessage);
router.post("/conversations/:id/read", controller.markRead);
router.patch("/conversations/:id/settings", validate({ body: toggleSettingSchema }), controller.updateSettings);

module.exports = router;
