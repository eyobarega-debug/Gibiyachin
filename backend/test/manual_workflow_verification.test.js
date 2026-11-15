/**
 * Comprehensive Manual Workflow Verification Test
 * FEATURE 02: CAMPUS LOST & FOUND LIFECYCLE & SECURITY
 *
 * Simulates and verifies the full 10-step lifecycle and security boundaries:
 * 1. Student A reports a lost phone.
 * 2. Student B reports finding a similar phone (with confidential details).
 * 3. Matching engine automatically detects potential match.
 * 4. Both students receive notifications.
 * 5. Student A submits ownership claim with private proof & evidence image.
 * 6. Student B reviews private verification info (unauthorized students blocked).
 * 7. Student B approves claim (item -> awaiting_handover, other claims rejected).
 * 8. Student A & B independently confirm handover.
 * 9. Item becomes returned (resolved_at set, recovery notifications sent).
 * 10. Both students see completed transaction in dashboards.
 * + Unauthorized access attempts at every single stage.
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

process.env.NODE_ENV = "test";

const app = require("../src/app");
const db = require("../src/db");
const { hashPassword } = require("../src/utils/hash");
const { signAccessToken } = require("../src/utils/jwt");
const { EVIDENCE_DIR } = require("../src/modules/lostFound/evidence");

let server;
let baseUrl;

let uniA, uniB;
let studentAUser, studentAToken;
let studentBUser, studentBToken;
let studentCUser, studentCToken; // Unauthorized student in same university
let studentDUser, studentDToken; // Unauthorized student in different university

const cleanupUniIds = [];
const cleanupUserIds = [];
const cleanupItemIds = [];
const cleanupClaimIds = [];
const cleanupFiles = [];

async function apiRequest(endpoint, { method = "GET", headers = {}, body = null } = {}) {
  const url = `${baseUrl}${endpoint}`;
  const reqHeaders = { ...headers };
  let payload = null;

  if (body !== null && body !== undefined) {
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      payload = body;
    } else {
      payload = JSON.stringify(body);
      reqHeaders["Content-Type"] = "application/json";
    }
  }

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: payload,
  });

  const contentType = res.headers.get("content-type") || "";
  let parsed = null;
  if (contentType.includes("application/json")) {
    parsed = await res.json();
  } else {
    parsed = await res.text();
  }

  return { status: res.status, headers: res.headers, body: parsed };
}

async function createTestUser({ name, email, role, universityId }) {
  const hash = await hashPassword("Password123!");
  const { rows } = await db.query(
    `INSERT INTO users (name, email, role, university_id, verified, verification_method, password_hash, email_verified)
     VALUES ($1, $2, $3, $4, true, 'domain', $5, true)
     RETURNING *`,
    [name, email, role, universityId, hash]
  );
  cleanupUserIds.push(rows[0].id);
  const token = signAccessToken(rows[0]);
  return { user: rows[0], token };
}

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const ts = Date.now();

  const uniARes = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{}') RETURNING *`,
    ["Workflow Uni A", `flow-uni-a-${ts}`, `flow-a-${ts}.edu.et`, [`flow-a-${ts}.edu.et`]]
  );
  uniA = uniARes.rows[0];
  cleanupUniIds.push(uniA.id);

  const uniBRes = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{}') RETURNING *`,
    ["Workflow Uni B", `flow-uni-b-${ts}`, `flow-b-${ts}.edu.et`, [`flow-b-${ts}.edu.et`]]
  );
  uniB = uniBRes.rows[0];
  cleanupUniIds.push(uniB.id);

  const uA = await createTestUser({ name: "Student A (Loser)", email: `st_a_${ts}@flow-a-${ts}.edu.et`, role: "student", universityId: uniA.id });
  studentAUser = uA.user; studentAToken = uA.token;

  const uB = await createTestUser({ name: "Student B (Finder)", email: `st_b_${ts}@flow-a-${ts}.edu.et`, role: "student", universityId: uniA.id });
  studentBUser = uB.user; studentBToken = uB.token;

  const uC = await createTestUser({ name: "Student C (Attacker)", email: `st_c_${ts}@flow-a-${ts}.edu.et`, role: "student", universityId: uniA.id });
  studentCUser = uC.user; studentCToken = uC.token;

  const uD = await createTestUser({ name: "Student D (Cross Campus)", email: `st_d_${ts}@flow-b-${ts}.edu.et`, role: "student", universityId: uniB.id });
  studentDUser = uD.user; studentDToken = uD.token;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));

  for (const f of cleanupFiles) {
    try { fs.unlinkSync(f); } catch (_) {}
  }
  for (const cid of cleanupClaimIds) {
    await db.query("DELETE FROM lost_found_claims WHERE id = $1", [cid]).catch(() => {});
  }
  for (const iid of cleanupItemIds) {
    await db.query("DELETE FROM lost_found_items WHERE id = $1", [iid]).catch(() => {});
  }
  for (const uid of cleanupUserIds) {
    await db.query("DELETE FROM users WHERE id = $1", [uid]).catch(() => {});
  }
  for (const unid of cleanupUniIds) {
    await db.query("DELETE FROM universities WHERE id = $1", [unid]).catch(() => {});
  }
  await db.pool.end().catch(() => {});
});

describe("Campus Lost & Found: 10-Step Lifecycle & Security Workflow", () => {
  let lostItemId;
  let foundItemId;
  let evidenceFilename;
  let evidenceUrl;
  let claimId;
  let competingClaimId;

  // ------------------------------------------------------------------
  // Step 1: Student A reports lost phone
  // ------------------------------------------------------------------
  test("Step 1: Student A reports a lost iPhone 14 Pro", async () => {
    const res = await apiRequest("/api/lost-found", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentAToken}` },
      body: {
        type: "lost",
        title: "Lost iPhone 14 Pro Space Black",
        category: "Phones",
        description: "Left my phone on the table near the Student Union Cafeteria.",
        date_incident: new Date().toISOString().slice(0, 10),
        location: "Student Union Cafeteria",
        brand: "Apple",
        color: "Space Black",
        reward_amount: 300,
        private_details: "Serial number ending in 8899",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.item.type, "lost");
    assert.equal(res.body.item.status, "open");
    assert.equal(res.body.item.reporter_id, studentAUser.id);
    lostItemId = res.body.item.id;
    cleanupItemIds.push(lostItemId);

    // Security Check: Unauthorized Student C cannot modify Student A's report
    const unauthorizedEdit = await apiRequest(`/api/lost-found/${lostItemId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${studentCToken}` },
      body: { title: "Tampered Title" },
    });
    assert.equal(unauthorizedEdit.status, 403);
  });

  // ------------------------------------------------------------------
  // Step 2: Student B reports finding a similar phone
  // ------------------------------------------------------------------
  test("Step 2: Student B reports finding a similar phone with private details", async () => {
    const res = await apiRequest("/api/lost-found", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentBToken}` },
      body: {
        type: "found",
        title: "Found Black iPhone near Cafeteria",
        category: "Phones",
        description: "Found an iPhone with a black silicon case on a cafe chair.",
        date_incident: new Date().toISOString().slice(0, 10),
        location: "Student Union Cafeteria",
        brand: "Apple",
        color: "Space Black",
        private_details: "Lock screen shows golden retriever dog photo; IMEI ends in 8899",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.item.type, "found");
    foundItemId = res.body.item.id;
    cleanupItemIds.push(foundItemId);

    // Security Check: Finder sees private_details
    assert.equal(res.body.item.private_details, "Lock screen shows golden retriever dog photo; IMEI ends in 8899");

    // Security Check: Student A and Student C viewing public item do NOT see private_details
    const viewByA = await apiRequest(`/api/lost-found/${foundItemId}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(viewByA.status, 200);
    assert.equal(viewByA.body.item.private_details, undefined);

    const viewByC = await apiRequest(`/api/lost-found/${foundItemId}`, {
      headers: { Authorization: `Bearer ${studentCToken}` },
    });
    assert.equal(viewByC.body.item.private_details, undefined);
  });

  // ------------------------------------------------------------------
  // Step 3: Matching engine automatically detects potential match
  // ------------------------------------------------------------------
  test("Step 3: Matching engine detects high-confidence potential match", async () => {
    const { rows } = await db.query(
      `SELECT * FROM lost_found_matches WHERE lost_item_id = $1 AND found_item_id = $2`,
      [lostItemId, foundItemId]
    );

    assert.equal(rows.length, 1, "Match record must be generated automatically");
    assert.ok(rows[0].score >= 65, `Expected score >= 65, got ${rows[0].score}`);
    assert.equal(rows[0].status, "suggested");

    // Priority 3 check: Item remains active and browsable (NOT returned or closed)
    const lostCheck = await apiRequest(`/api/lost-found/${lostItemId}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.ok(["open", "matched"].includes(lostCheck.body.item.status));
    assert.notEqual(lostCheck.body.item.status, "returned");
    assert.notEqual(lostCheck.body.item.status, "closed");
  });

  // ------------------------------------------------------------------
  // Step 4: Both students receive notifications
  // ------------------------------------------------------------------
  test("Step 4: Both Student A and Student B receive match notifications", async () => {
    const notifsA = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 AND type = 'lost_found_match' ORDER BY created_at DESC`,
      [studentAUser.id]
    );
    assert.ok(notifsA.rows.length >= 1, "Student A must receive match notification");
    assert.ok(notifsA.rows[0].target_route.includes(foundItemId));

    const notifsB = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 AND type = 'lost_found_match' ORDER BY created_at DESC`,
      [studentBUser.id]
    );
    assert.ok(notifsB.rows.length >= 1, "Student B must receive match notification");
    assert.ok(notifsB.rows[0].target_route.includes(lostItemId));
  });

  // ------------------------------------------------------------------
  // Step 5: Student A submits an ownership claim with private evidence
  // ------------------------------------------------------------------
  test("Step 5: Student A uploads private proof image and submits claim", async () => {
    // 1. Upload private image
    const imgBuffer = await sharp({
      create: { width: 40, height: 40, channels: 3, background: { r: 10, g: 120, b: 200 } },
    }).jpeg().toBuffer();

    const formData = new FormData();
    formData.append("file", new Blob([imgBuffer], { type: "image/jpeg" }), "phone_receipt.jpg");

    const uploadRes = await apiRequest("/api/lost-found/upload-evidence", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentAToken}` },
      body: formData,
    });
    assert.equal(uploadRes.status, 201);
    evidenceUrl = uploadRes.body.url;
    evidenceFilename = uploadRes.body.filename;
    cleanupFiles.push(path.join(EVIDENCE_DIR, evidenceFilename));

    // 2. Submit Claim
    const claimRes = await apiRequest(`/api/lost-found/${foundItemId}/claim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentAToken}` },
      body: {
        message: "This is my iPhone! The lock screen has my dog Buster.",
        private_proof: "Lock screen photo is my golden retriever dog Buster; serial number ends in 8899; space black 256GB.",
        evidence_images: [evidenceUrl],
      },
    });
    assert.equal(claimRes.status, 201);
    claimId = claimRes.body.claim.id;
    cleanupClaimIds.push(claimId);

    // 3. Student C (competing/false claim) also submits a claim
    const competingRes = await apiRequest(`/api/lost-found/${foundItemId}/claim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentCToken}` },
      body: {
        message: "I lost my iPhone too.",
        private_proof: "Plain black phone with scratches.",
      },
    });
    assert.equal(competingRes.status, 201);
    competingClaimId = competingRes.body.claim.id;
    cleanupClaimIds.push(competingClaimId);

    // Security Check: Unauthorized Student C viewing claims does NOT see Student A's private proof or evidence
    const cClaimsView = await apiRequest(`/api/lost-found/${foundItemId}/claims`, {
      headers: { Authorization: `Bearer ${studentCToken}` },
    });
    assert.equal(cClaimsView.status, 200);
    // Student C should only see their own claim, never Student A's claim
    assert.ok(cClaimsView.body.claims.every((c) => c.claimant_id === studentCUser.id));
  });

  // ------------------------------------------------------------------
  // Step 6: Student B reviews private verification info
  // ------------------------------------------------------------------
  test("Step 6: Student B reviews claim with signed evidence URLs", async () => {
    const finderItemView = await apiRequest(`/api/lost-found/${foundItemId}`, {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    assert.equal(finderItemView.status, 200);

    const claims = finderItemView.body.item.claims;
    const aClaim = claims.find((c) => c.id === claimId);
    assert.ok(aClaim, "Finder must see Student A's claim");
    assert.ok(aClaim.private_proof.includes("golden retriever"));
    assert.ok(Array.isArray(aClaim.evidence_images));
    assert.ok(aClaim.evidence_images[0].includes("?token="));

    const signedUrl = aClaim.evidence_images[0];
    const tokenMatch = signedUrl.match(/token=([a-zA-Z0-9._-]+)/);
    assert.ok(tokenMatch);

    // Finder accesses evidence via signed URL
    const imgAccess = await apiRequest(signedUrl);
    assert.equal(imgAccess.status, 200);

    // Security Check: Unauthorized user without signed token cannot access evidence
    const unauthAccess = await apiRequest(`/api/lost-found/evidence/${evidenceFilename}`);
    assert.equal(unauthAccess.status, 401);

    const attackerAccess = await apiRequest(`/api/lost-found/evidence/${evidenceFilename}`, {
      headers: { Authorization: `Bearer ${studentCToken}` },
    });
    assert.equal(attackerAccess.status, 403);
  });

  // ------------------------------------------------------------------
  // Step 7: Student B approves the claim
  // ------------------------------------------------------------------
  test("Step 7: Student B approves Student A's claim, rejecting competing claim", async () => {
    // Security Check: Unauthorized Student C cannot approve claims
    const attackApprove = await apiRequest(`/api/lost-found/claims/${claimId}/review`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${studentCToken}` },
      body: { action: "approve" },
    });
    assert.equal(attackApprove.status, 403);

    // Student B approves Student A's claim
    const approveRes = await apiRequest(`/api/lost-found/claims/${claimId}/review`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${studentBToken}` },
      body: { action: "approve", reviewNotes: "Lock screen photo and serial match perfectly." },
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.claim.status, "approved");

    // Item transitioned to awaiting_handover
    const itemCheck = await apiRequest(`/api/lost-found/${foundItemId}`, {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    assert.equal(itemCheck.body.item.status, "awaiting_handover");

    // Competing Claim from Student C was automatically rejected
    const claimsCheck = await apiRequest(`/api/lost-found/${foundItemId}/claims`, {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    const cClaim = claimsCheck.body.claims.find((c) => c.id === competingClaimId);
    assert.equal(cClaim.status, "rejected");

    // Concurrency Check: Attempting to approve rejected claim throws 400 or 409
    const secondApprove = await apiRequest(`/api/lost-found/claims/${competingClaimId}/review`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${studentBToken}` },
      body: { action: "approve" },
    });
    assert.ok(secondApprove.status === 400 || secondApprove.status === 409);
  });

  // ------------------------------------------------------------------
  // Step 8: Student A and Student B independently confirm handover
  // ------------------------------------------------------------------
  test("Step 8: Student A and Student B independently confirm handover", async () => {
    // Security Check: Unauthorized Student C cannot confirm handover
    const unauthHandover = await apiRequest(`/api/lost-found/claims/${claimId}/confirm-handover`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${studentCToken}` },
    });
    assert.equal(unauthHandover.status, 403);

    // 1. Finder (Student B) confirms handover
    const finderConfirm = await apiRequest(`/api/lost-found/claims/${claimId}/confirm-handover`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    assert.equal(finderConfirm.status, 200);
    assert.equal(finderConfirm.body.claim.handover_confirmed_by_finder, true);
    assert.equal(finderConfirm.body.claim.handover_confirmed_by_claimant, false);
    assert.equal(finderConfirm.body.claim.status, "approved"); // Still approved pending second confirmation

    // 2. Claimant (Student A) confirms handover
    const claimantConfirm = await apiRequest(`/api/lost-found/claims/${claimId}/confirm-handover`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(claimantConfirm.status, 200);
    assert.equal(claimantConfirm.body.claim.handover_confirmed_by_finder, true);
    assert.equal(claimantConfirm.body.claim.handover_confirmed_by_claimant, true);
    assert.equal(claimantConfirm.body.claim.status, "completed");
  });

  // ------------------------------------------------------------------
  // Step 9: Item becomes returned
  // ------------------------------------------------------------------
  test("Step 9: Item status updates to returned and resolved_at timestamp is populated", async () => {
    const finalItemRes = await apiRequest(`/api/lost-found/${foundItemId}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(finalItemRes.status, 200);
    assert.equal(finalItemRes.body.item.status, "returned");
    assert.ok(finalItemRes.body.item.resolved_at, "resolved_at must be set");

    // Notifications check: both received recovery celebration notifications
    const recoveryA = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 AND type = 'lost_found_returned'`,
      [studentAUser.id]
    );
    assert.ok(recoveryA.rows.length >= 1, "Student A must receive recovery notification");

    const recoveryB = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 AND type = 'lost_found_returned'`,
      [studentBUser.id]
    );
    assert.ok(recoveryB.rows.length >= 1, "Student B must receive return gratitude notification");
  });

  // ------------------------------------------------------------------
  // Step 10: Both students see completed transaction in their dashboards
  // ------------------------------------------------------------------
  test("Step 10: Both students see completed transaction in personal dashboards", async () => {
    // Student A dashboard
    const dashA = await apiRequest("/api/lost-found/my-items", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(dashA.status, 200);
    assert.ok(dashA.body.returned.some((it) => it.id === foundItemId));
    assert.ok(dashA.body.myClaims.some((c) => c.id === claimId && c.status === "completed"));

    // Student B dashboard
    const dashB = await apiRequest("/api/lost-found/my-items", {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    assert.equal(dashB.status, 200);
    assert.ok(dashB.body.returned.some((it) => it.id === foundItemId));
    assert.ok(dashB.body.receivedClaims.some((c) => c.id === claimId && c.status === "completed"));

    // Security Check: Student D in another university sees 0 items from University A
    const dashD = await apiRequest("/api/lost-found/my-items", {
      headers: { Authorization: `Bearer ${studentDToken}` },
    });
    assert.equal(dashD.status, 200);
    assert.equal(dashD.body.counts.myLost, 0);
    assert.equal(dashD.body.counts.myFound, 0);
    assert.equal(dashD.body.returned.length, 0);
  });
});
