const express = require("express");
const { optionalAuth } = require("../../middleware/auth");
const { getEvidenceFile } = require("./controller");

const router = express.Router();

// Direct streaming of private claim evidence with safe headers
// Authorization is verified via short-lived HMAC token or user session in controller
router.get("/:filename", optionalAuth(), getEvidenceFile);

module.exports = router;
