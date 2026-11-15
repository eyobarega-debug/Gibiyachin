const { asyncHandler } = require("../../utils/errors");
const service = require("./service");

const getMyProfile = asyncHandler(async (req, res) => {
  const data = await service.getMyProfile(req.user.id);
  res.json(data);
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const profile = await service.createOrUpdateProfile(
    req.user.id,
    req.tenant?.universityId,
    req.body
  );
  res.json(profile);
});

const getPreferences = asyncHandler(async (req, res) => {
  const data = await service.getMyProfile(req.user.id);
  res.json(data.preferences);
});

const updatePreferences = asyncHandler(async (req, res) => {
  const prefs = await service.updatePreferences(req.user.id, req.body);
  res.json(prefs);
});

const updateStatus = asyncHandler(async (req, res) => {
  const result = await service.updateStatus(req.user.id, req.body.status);
  res.json(result);
});

const getDiscovery = asyncHandler(async (req, res) => {
  const candidates = await service.getDiscovery(
    req.user.id,
    req.tenant?.universityId
  );
  res.json(candidates);
});

const swipe = asyncHandler(async (req, res) => {
  const result = await service.swipe(
    req.user.id,
    req.tenant?.universityId,
    req.body
  );
  res.json(result);
});

const getMatches = asyncHandler(async (req, res) => {
  const matches = await service.getMatches(req.user.id);
  res.json(matches);
});

const unmatch = asyncHandler(async (req, res) => {
  const result = await service.unmatch(req.user.id, req.params.matchId);
  res.json(result);
});

const report = asyncHandler(async (req, res) => {
  const result = await service.reportDatingProfile(
    req.user.id,
    req.tenant?.universityId,
    req.body
  );
  res.status(201).json(result);
});

module.exports = {
  getMyProfile,
  updateMyProfile,
  getPreferences,
  updatePreferences,
  updateStatus,
  getDiscovery,
  swipe,
  getMatches,
  unmatch,
  report,
};
