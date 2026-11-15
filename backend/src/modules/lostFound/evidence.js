const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const db = require("../../db");
const { badRequest, forbidden, notFound, unauthorized } = require("../../utils/errors");
const { createTempUpload, processUpload, removeTempFile, sendFileSafely, IMAGE_TYPES } = require("../../services/fileUpload");

const EVIDENCE_DIR = path.join(__dirname, "..", "..", "..", "private_uploads", "claim_evidence");
const PUBLIC_UPLOADS_DIR = path.join(__dirname, "..", "..", "..", "uploads");

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const SIGNING_SECRET = process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

const uploadEvidence = createTempUpload({ maxBytes: MAX_BYTES });

/**
 * Generates an HMAC-signed short-lived token for private evidence access.
 */
function generateEvidenceToken(filename, expiresInSeconds = 900) {
  const safeName = path.basename(filename);
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = `${safeName}:${expiresAt}`;
  const sig = crypto.createHmac("sha256", SIGNING_SECRET).update(payload).digest("hex");
  return `${expiresAt}.${sig}`;
}

/**
 * Verifies an HMAC-signed short-lived evidence token.
 */
function verifyEvidenceToken(filename, token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [expiresAtStr, sig] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) return false;

  const safeName = path.basename(filename);
  const payload = `${safeName}:${expiresAt}`;
  const expectedSig = crypto.createHmac("sha256", SIGNING_SECRET).update(payload).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"));
  } catch (_) {
    return false;
  }
}

/**
 * Transforms an evidence filename or URL into a signed access URL for authorized consumers.
 */
function signEvidenceUrl(rawUrl, expiresInSeconds = 900) {
  if (!rawUrl || typeof rawUrl !== "string") return rawUrl;
  const safeName = path.basename(rawUrl.split("?")[0]);
  const token = generateEvidenceToken(safeName, expiresInSeconds);
  return `/api/lost-found/evidence/${safeName}?token=${token}`;
}

/**
 * Upload handler for private claim evidence.
 */
async function processEvidenceUpload(file) {
  try {
    return await processUpload({
      tempPath: file.path,
      destDir: EVIDENCE_DIR,
      allowedTypes: IMAGE_TYPES,
      maxBytes: MAX_BYTES,
      reencodeImages: true,
    });
  } catch (err) {
    if (err.uploadError) throw badRequest(err.message);
    throw err;
  } finally {
    await removeTempFile(file.path);
  }
}

/**
 * Serves an evidence image if authorized (via valid token OR user ownership/admin check).
 */
async function serveEvidenceFile(req, res) {
  const filename = path.basename(req.params.filename || "");
  if (!filename) throw notFound("Evidence file not found");

  const token = req.query.token;
  let isAuthorized = false;

  // 1. Verify short-lived signed URL token if present
  if (token && verifyEvidenceToken(filename, token)) {
    isAuthorized = true;
  }

  // 2. Fall back to user session authorization if token not provided or expired
  if (!isAuthorized && req.user) {
    const user = req.user;
    const isAdmin = user.role === "admin" || user.role === "super_admin";

    // Query claim containing this evidence image
    const { rows } = await db.query(
      `SELECT c.id, c.claimant_id, c.university_id, i.reporter_id AS item_reporter_id
       FROM lost_found_claims c
       JOIN lost_found_items i ON i.id = c.item_id
       WHERE $1 = ANY(c.evidence_images)
          OR c.evidence_images::text LIKE $2
       LIMIT 1`,
      [filename, `%"${filename}"%`]
    );

    if (rows.length > 0) {
      const claim = rows[0];
      const isClaimant = user.id === claim.claimant_id;
      const isFinder = user.id === claim.item_reporter_id;

      if (isClaimant || isFinder || isAdmin) {
        // Enforce tenant boundary unless super_admin
        if (user.role !== "super_admin" && req.tenant?.universityId && req.tenant.universityId !== claim.university_id) {
          throw forbidden("Access denied to cross-campus claim evidence");
        }
        isAuthorized = true;
      }
    } else if (isAdmin) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    if (!req.user && !token) {
      throw unauthorized("Authentication required to view claim evidence");
    }
    throw forbidden("You are not authorized to access this claim evidence");
  }

  // First try private evidence directory
  let sent = sendFileSafely(res, EVIDENCE_DIR, filename);
  if (!sent) {
    // Check legacy uploads directory for backward compatibility
    sent = sendFileSafely(res, PUBLIC_UPLOADS_DIR, filename);
  }

  if (!sent) {
    throw notFound("Evidence image is no longer available");
  }
}

module.exports = {
  uploadEvidence,
  processEvidenceUpload,
  generateEvidenceToken,
  verifyEvidenceToken,
  signEvidenceUrl,
  serveEvidenceFile,
  EVIDENCE_DIR,
};
