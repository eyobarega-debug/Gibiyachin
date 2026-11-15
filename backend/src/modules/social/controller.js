const { asyncHandler } = require("../../utils/errors");
const service = require("./service");

const getEffectiveUniId = (req) =>
  req.tenant?.universityId || req.user?.universityId || req.user?.university_id || null;

const getFeed = asyncHandler(async (req, res) => {
  const feed = await service.getFeed(req.user?.id, getEffectiveUniId(req), req.query);
  res.json(feed);
});

const getPostById = asyncHandler(async (req, res) => {
  const post = await service.getPostById(req.params.id, req.user?.id, getEffectiveUniId(req));
  res.json({ post });
});

const createPost = asyncHandler(async (req, res) => {
  const post = await service.createPost(req.user.id, getEffectiveUniId(req), req.user.role, req.body);
  res.status(201).json({ post });
});

const updatePost = asyncHandler(async (req, res) => {
  const post = await service.updatePost(req.params.id, req.user.id, req.user.role, req.body);
  res.json({ post });
});

const deletePost = asyncHandler(async (req, res) => {
  const result = await service.deletePost(req.params.id, req.user.id, req.user.role);
  res.json(result);
});

const toggleLike = asyncHandler(async (req, res) => {
  const result = await service.toggleLikePost(req.params.id, req.user.id);
  res.json(result);
});

const getPostLikes = asyncHandler(async (req, res) => {
  const result = await service.getPostLikes(req.params.id, getEffectiveUniId(req));
  res.json(result);
});

const getMyIdentity = asyncHandler(async (req, res) => {
  const identity = await service.getMyAnonymousIdentity(req.user.id, getEffectiveUniId(req));
  res.json({ success: true, ...identity });
});

const toggleBookmark = asyncHandler(async (req, res) => {
  const result = await service.toggleBookmarkPost(req.params.id, req.user.id);
  res.json(result);
});

const recordShare = asyncHandler(async (req, res) => {
  const result = await service.recordShare(req.params.id);
  res.json(result);
});

const votePoll = asyncHandler(async (req, res) => {
  const poll = await service.votePoll(req.params.id, req.user.id, req.body.optionId);
  res.json({ poll });
});

const getComments = asyncHandler(async (req, res) => {
  const comments = await service.getComments(req.params.id, req.user?.id, req.query);
  res.json({ comments });
});

const createComment = asyncHandler(async (req, res) => {
  const comment = await service.createComment(req.params.id, req.user.id, req.body);
  res.status(201).json({ comment });
});

const updateComment = asyncHandler(async (req, res) => {
  const comment = await service.updateComment(req.params.id, req.user.id, req.body);
  res.json({ comment });
});

const deleteComment = asyncHandler(async (req, res) => {
  const result = await service.deleteComment(req.params.id, req.user.id, req.user.role);
  res.json(result);
});

const toggleLikeComment = asyncHandler(async (req, res) => {
  const result = await service.toggleLikeComment(req.params.id, req.user.id);
  res.json(result);
});

const getCommunities = asyncHandler(async (req, res) => {
  const communities = await service.getCommunities(getEffectiveUniId(req), req.user?.id, req.query);
  res.json({ communities });
});

const getCommunityById = asyncHandler(async (req, res) => {
  const community = await service.getCommunityById(req.params.id, getEffectiveUniId(req), req.user?.id);
  res.json({ community });
});

const createCommunity = asyncHandler(async (req, res) => {
  const community = await service.createCommunity(req.user.id, getEffectiveUniId(req), req.user.role, req.body);
  res.status(201).json({ community });
});

const updateCommunity = asyncHandler(async (req, res) => {
  const community = await service.updateCommunity(req.params.id, req.user.id, req.user.role, req.body);
  res.json({ community });
});

const joinCommunity = asyncHandler(async (req, res) => {
  const result = await service.joinCommunity(req.params.id, req.user.id, getEffectiveUniId(req));
  res.json(result);
});

const leaveCommunity = asyncHandler(async (req, res) => {
  const result = await service.leaveCommunity(req.params.id, req.user.id);
  res.json(result);
});

const reviewJoinRequest = asyncHandler(async (req, res) => {
  const status = req.body?.status || (req.path.endsWith("/approve") ? "approved" : "rejected");
  const result = await service.reviewJoinRequest(
    req.params.id,
    req.params.requestId,
    req.user.id,
    req.user.role,
    status
  );
  res.json(result);
});

const updateMemberRole = asyncHandler(async (req, res) => {
  const result = await service.updateMemberRole(
    req.params.id,
    req.params.userId,
    req.body.role,
    req.user.id,
    req.user.role
  );
  res.json({ member: result });
});

const removeMember = asyncHandler(async (req, res) => {
  const result = await service.removeMember(
    req.params.id,
    req.params.userId,
    req.user.id,
    req.user.role
  );
  res.json(result);
});

const getCommunityMembers = asyncHandler(async (req, res) => {
  const members = await service.getCommunityMembers(req.params.id, getEffectiveUniId(req));
  res.json({ members });
});

const getJoinRequests = asyncHandler(async (req, res) => {
  const requests = await service.getJoinRequests(req.params.id, req.user.id, req.user.role, getEffectiveUniId(req));
  res.json({ requests });
});

const getAnnouncements = asyncHandler(async (req, res) => {
  const result = await service.getAnnouncements(getEffectiveUniId(req), req.query);
  res.json({ announcements: result.posts || [], pagination: result.pagination });
});

const createAnnouncement = asyncHandler(async (req, res) => {
  const post = await service.createPost(req.user.id, getEffectiveUniId(req), req.user.role, {
    ...req.body,
    isOfficial: true,
    postType: "announcement",
  });
  res.status(201).json({ post });
});

const togglePinAnnouncement = asyncHandler(async (req, res) => {
  const result = await service.togglePinAnnouncement(req.params.id, req.user.role, getEffectiveUniId(req));
  res.json(result);
});

const reportContent = asyncHandler(async (req, res) => {
  const result = await service.reportContent(req.user.id, getEffectiveUniId(req), req.body);
  res.status(201).json(result);
});

const reportPost = asyncHandler(async (req, res) => {
  const result = await service.reportContent(req.user.id, getEffectiveUniId(req), {
    targetType: "post",
    targetId: req.params.id,
    ...req.body,
  });
  res.status(201).json(result);
});

const reportComment = asyncHandler(async (req, res) => {
  const result = await service.reportContent(req.user.id, getEffectiveUniId(req), {
    targetType: "comment",
    targetId: req.params.id,
    ...req.body,
  });
  res.status(201).json(result);
});

const getTrending = asyncHandler(async (req, res) => {
  const trendingTags = await service.getTrendingTags(getEffectiveUniId(req));
  res.json({ trendingTags });
});

const getReports = asyncHandler(async (req, res) => {
  const reports = await service.getReports(getEffectiveUniId(req), req.user.role, req.query);
  res.json(reports);
});

const discloseIdentity = asyncHandler(async (req, res) => {
  const result = await service.discloseModerationIdentity(
    req.user.id,
    req.user.role,
    getEffectiveUniId(req),
    {
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    }
  );
  res.json(result);
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const logs = await service.getModerationAuditLogs(
    req.user.role,
    getEffectiveUniId(req),
    req.query
  );
  res.json({ logs });
});

module.exports = {
  getFeed,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  toggleBookmark,
  recordShare,
  votePoll,
  getComments,
  createComment,
  updateComment,
  deleteComment,
  toggleLikeComment,
  getCommunities,
  getCommunityById,
  createCommunity,
  updateCommunity,
  joinCommunity,
  leaveCommunity,
  reviewJoinRequest,
  updateMemberRole,
  removeMember,
  getCommunityMembers,
  getJoinRequests,
  getAnnouncements,
  createAnnouncement,
  togglePinAnnouncement,
  reportContent,
  reportPost,
  reportComment,
  getTrending,
  getReports,
  discloseIdentity,
  getAuditLogs,
  getPostLikes,
  getMyIdentity,
};
