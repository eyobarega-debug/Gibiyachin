const service = require("./service");
const { asyncHandler } = require("../../utils/errors");

const createItem = asyncHandler(async (req, res) => {
  const item = await service.createItem(req.body, req.user, req.tenant);
  res.status(201).json({ item });
});

const getItem = asyncHandler(async (req, res) => {
  const item = await service.getItemById(req.params.id, req.user, req.tenant);
  res.json({ item });
});

const listItems = asyncHandler(async (req, res) => {
  const result = await service.listItems(req.query, req.user, req.tenant);
  res.json(result);
});

const updateItem = asyncHandler(async (req, res) => {
  const item = await service.updateItem(req.params.id, req.body, req.user, req.tenant);
  res.json({ item });
});

const deleteItem = asyncHandler(async (req, res) => {
  const result = await service.deleteItem(req.params.id, req.user, req.tenant);
  res.json(result);
});

const getMyItems = asyncHandler(async (req, res) => {
  const result = await service.getMyItems(req.user, req.tenant);
  res.json(result);
});

const getItemMatches = asyncHandler(async (req, res) => {
  const matches = await service.getItemMatches(req.params.id, req.user, req.tenant);
  res.json({ matches });
});

const submitClaim = asyncHandler(async (req, res) => {
  const claim = await service.submitClaim(req.params.id, req.body, req.user, req.tenant);
  res.status(201).json({ claim });
});

const getItemClaims = asyncHandler(async (req, res) => {
  const claims = await service.getItemClaims(req.params.id, req.user, req.tenant);
  res.json({ claims });
});

const reviewClaim = asyncHandler(async (req, res) => {
  const claim = await service.reviewClaim(req.params.claimId, req.body, req.user, req.tenant);
  res.json({ claim });
});

const confirmHandover = asyncHandler(async (req, res) => {
  const claim = await service.confirmHandover(req.params.claimId, req.user, req.tenant);
  res.json({ claim });
});

const confirmHandoverByItem = asyncHandler(async (req, res) => {
  const result = await service.confirmHandoverByItem(req.params.id, req.user, req.tenant);
  res.json(result);
});

const disputeClaim = asyncHandler(async (req, res) => {
  const claim = await service.disputeClaim(req.params.claimId, req.body.reason, req.user, req.tenant);
  res.json({ claim });
});

const adminListItems = asyncHandler(async (req, res) => {
  const result = await service.adminListItems(req.query, req.user, req.tenant);
  res.json(result);
});

const adminModerateItem = asyncHandler(async (req, res) => {
  const item = await service.adminModerateItem(req.params.id, req.body, req.user, req.tenant);
  res.json({ item });
});

module.exports = {
  createItem,
  getItem,
  listItems,
  updateItem,
  deleteItem,
  getMyItems,
  getItemMatches,
  submitClaim,
  getItemClaims,
  reviewClaim,
  confirmHandover,
  confirmHandoverByItem,
  disputeClaim,
  adminListItems,
  adminModerateItem,
};
