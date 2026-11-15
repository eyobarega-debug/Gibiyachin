const { asyncHandler } = require("../../utils/errors");
const service = require("./service");

const listConversations = asyncHandler(async (req, res) => {
  const conversations = await service.getConversations(
    req.user.id,
    req.tenant?.universityId,
    req.query
  );
  res.json(conversations);
});

const createConversation = asyncHandler(async (req, res) => {
  const conversation = await service.getOrCreateConversation(
    req.body,
    req.user.id,
    req.tenant?.universityId
  );
  res.status(201).json(conversation);
});

const getConversation = asyncHandler(async (req, res) => {
  const conversation = await service.getConversationById(
    req.params.id,
    req.user.id,
    req.tenant?.universityId
  );
  res.json(conversation);
});

const listMessages = asyncHandler(async (req, res) => {
  const messages = await service.getMessages(
    req.params.id,
    req.user.id,
    req.query
  );
  res.json(messages);
});

const postMessage = asyncHandler(async (req, res) => {
  const message = await service.sendMessage(
    req.params.id,
    req.body,
    req.user.id
  );
  res.status(201).json(message);
});

const editMessage = asyncHandler(async (req, res) => {
  const result = await service.editMessage(
    req.params.messageId,
    req.body.content,
    req.user.id
  );
  res.json(result);
});

const deleteMessage = asyncHandler(async (req, res) => {
  const isAdmin = ["admin", "super_admin"].includes(req.user.role);
  const result = await service.deleteMessage(
    req.params.messageId,
    req.user.id,
    isAdmin
  );
  res.json(result);
});

const markRead = asyncHandler(async (req, res) => {
  const result = await service.markAsRead(req.params.id, req.user.id);
  res.json(result);
});

const updateSettings = asyncHandler(async (req, res) => {
  const result = await service.toggleSetting(
    req.params.id,
    req.user.id,
    req.body
  );
  res.json(result);
});

const blockUser = asyncHandler(async (req, res) => {
  const result = await service.blockUser(
    req.user.id,
    req.body.targetUserId,
    req.body.reason
  );
  res.json(result);
});

const unblockUser = asyncHandler(async (req, res) => {
  const result = await service.unblockUser(
    req.user.id,
    req.body.targetUserId
  );
  res.json(result);
});

const listBlocked = asyncHandler(async (req, res) => {
  const blocked = await service.getBlockedUsers(req.user.id);
  res.json(blocked);
});

const reportUser = asyncHandler(async (req, res) => {
  const result = await service.reportUser(
    req.user.id,
    req.tenant?.universityId,
    req.body
  );
  res.status(201).json(result);
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await service.getUnreadCount(req.user.id);
  res.json(count);
});

module.exports = {
  listConversations,
  createConversation,
  getConversation,
  listMessages,
  postMessage,
  editMessage,
  deleteMessage,
  markRead,
  updateSettings,
  blockUser,
  unblockUser,
  listBlocked,
  reportUser,
  getUnreadCount,
};
