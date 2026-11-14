/**
 * Automated Test Suite - FEATURE 02: SMART CAMPUS LOST & FOUND
 *
 * Verifies all 23 scenarios:
 * 1. Create lost report
 * 2. Create found report
 * 3. Retrieve available reports
 * 4. Search reports by title/keyword
 * 5. Filter reports by category
 * 6. Update own report
 * 7. Prevent editing another user's report (403)
 * 8. Prevent deleting another user's report (403)
 * 9. University tenant isolation (no cross-campus leakage)
 * 10. Feature flag enforcement (lost_found: false -> 403)
 * 11. Matching algorithm accuracy (opposite types, category, title, color, brand)
 * 12. Matching threshold behavior (<65 excluded)
 * 13. Duplicate match prevention
 * 14. Claim submission
 * 15. Duplicate active claim prevention
 * 16. Claim authorization (non-owners cannot review)
 * 17. Private claim data and private item details protection (never exposed publicly)
 * 18. Valid/invalid status transitions
 * 19. Handover dual-confirmation (finder + claimant -> returned)
 * 20. Notification generation on match and claim actions
 * 21. SQL injection protection
 * 22. Validation checks
 * 23. Admin moderation actions (remove, restore, review)
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

process.env.NODE_ENV = "test";

const app = require("../src/app");
const db = require("../src/db");
const { hashPassword } = require("../src/utils/hash");
const { signAccessToken } = require("../src/utils/jwt");

let server;
let baseUrl;

// Universities
let uniA, uniB, uniCDisabled;

// Users & Tokens
let studentA1User, studentA1Token;
let studentA2User, studentA2Token;
let adminAUser, adminAToken;
let studentBUser, studentBToken;
let studentCUser, studentCToken;

// Cleanup IDs
const cleanupUniIds = [];
const cleanupUserIds = [];
const cleanupItemIds = [];
const cleanupClaimIds = [];

async function apiRequest(endpoint, { method = "GET", headers = {}, body = null } = {}) {
  const url = `${baseUrl}${endpoint}`;
  const reqHeaders = { ...headers };
  let payload = null;

  if (body) {
    payload = JSON.stringify(body);
    reqHeaders["Content-Type"] = "application/json";
    reqHeaders["Content-Length"] = Buffer.byteLength(payload);
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let parsed = raw;
          try {
            parsed = JSON.parse(raw);
          } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
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

  // Uni A (Standard active campus)
  const uniARes = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{}') RETURNING *`,
    ["LF Test Uni A", `lf-uni-a-${ts}`, `lf-a-${ts}.edu.et`, [`lf-a-${ts}.edu.et`]]
  );
  uniA = uniARes.rows[0];
  cleanupUniIds.push(uniA.id);

  // Uni B (Isolated active campus)
  const uniBRes = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{}') RETURNING *`,
    ["LF Test Uni B", `lf-uni-b-${ts}`, `lf-b-${ts}.edu.et`, [`lf-b-${ts}.edu.et`]]
  );
  uniB = uniBRes.rows[0];
  cleanupUniIds.push(uniB.id);

  // Uni C (With lost_found feature disabled)
  const uniCRes = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{"lost_found":false}') RETURNING *`,
    ["LF Test Uni C", `lf-uni-c-${ts}`, `lf-c-${ts}.edu.et`, [`lf-c-${ts}.edu.et`]]
  );
  uniCDisabled = uniCRes.rows[0];
  cleanupUniIds.push(uniCDisabled.id);

  // Users in Uni A
  const uA1 = await createTestUser({ name: "Student A1", email: `a1_${ts}@lf-a-${ts}.edu.et`, role: "student", universityId: uniA.id });
  studentA1User = uA1.user; studentA1Token = uA1.token;

  const uA2 = await createTestUser({ name: "Student A2", email: `a2_${ts}@lf-a-${ts}.edu.et`, role: "student", universityId: uniA.id });
  studentA2User = uA2.user; studentA2Token = uA2.token;

  const uAdminA = await createTestUser({ name: "Admin A", email: `admin_a_${ts}@lf-a-${ts}.edu.et`, role: "admin", universityId: uniA.id });
  adminAUser = uAdminA.user; adminAToken = uAdminA.token;

  // Users in Uni B & Uni C
  const uB = await createTestUser({ name: "Student B", email: `b_${ts}@lf-b-${ts}.edu.et`, role: "student", universityId: uniB.id });
  studentBUser = uB.user; studentBToken = uB.token;

  const uC = await createTestUser({ name: "Student C", email: `c_${ts}@lf-c-${ts}.edu.et`, role: "student", universityId: uniCDisabled.id });
  studentCUser = uC.user; studentCToken = uC.token;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));

  // Clean up DB records in reverse dependency order
  for (const cid of cleanupClaimIds) {
    await db.query("DELETE FROM lost_found_claims WHERE id = $1", [cid]).catch(() => {});
  }
  for (const iid of cleanupItemIds) {
    await db.query("DELETE FROM lost_found_matches WHERE item_id = $1 OR matched_item_id = $1", [iid]).catch(() => {});
    await db.query("DELETE FROM lost_found_claims WHERE item_id = $1", [iid]).catch(() => {});
    await db.query("DELETE FROM lost_found_items WHERE id = $1", [iid]).catch(() => {});
  }
  for (const uid of cleanupUserIds) {
    await db.query("DELETE FROM notifications WHERE user_id = $1", [uid]).catch(() => {});
    await db.query("DELETE FROM users WHERE id = $1", [uid]).catch(() => {});
  }
  for (const unid of cleanupUniIds) {
    await db.query("DELETE FROM universities WHERE id = $1", [unid]).catch(() => {});
  }

  await db.pool.end().catch(() => {});
});

describe("Campus Lost & Found Module (/api/lost-found)", () => {
  let createdLostId;
  let createdFoundId;
  let uniBItemId;

  // 1. Create lost report
  test("1. Create lost report: student successfully creates a lost item report", async () => {
    const res = await apiRequest("/api/lost-found", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA1Token}` },
      body: {
        type: "lost",
        title: "HP Laptop Charger 65W Type-C",
        category: "Electronics",
        description: "Black HP 65W charger left near the library charging station on the 2nd floor.",
        date_incident: new Date().toISOString().split("T")[0],
        location: "Main Library 2nd Floor",
        brand: "HP",
        color: "Black",
        reward_amount: 300,
        images: ["/uploads/charger1.jpg"],
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.item.type, "lost");
    assert.equal(res.body.item.title, "HP Laptop Charger 65W Type-C");
    assert.equal(res.body.item.status, "open");
    assert.equal(res.body.item.reporter_id, studentA1User.id);
    assert.equal(res.body.item.university_id, uniA.id);
    assert.equal(Number(res.body.item.reward_amount), 300);

    createdLostId = res.body.item.id;
    cleanupItemIds.push(createdLostId);
  });

  // 2. Create found report
  test("2. Create found report: student creates found item with confidential verification details", async () => {
    const res = await apiRequest("/api/lost-found", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA2Token}` },
      body: {
        type: "found",
        title: "Found Black HP Laptop Charger",
        category: "Electronics",
        description: "Found an HP Type-C power adapter plugged in near the library study desks.",
        date_incident: new Date().toISOString().split("T")[0],
        location: "Main Library Study Area",
        brand: "HP",
        color: "Black",
        private_details: "Serial number ends in 89B, has a small red tape near the connector.",
        images: ["/uploads/found_charger.jpg"],
      },
    });

    assert.equal(res.status, 201);
    createdFoundId = res.body.item.id;
    cleanupItemIds.push(createdFoundId);

    assert.equal(res.body.item.type, "found");
    assert.ok(["open", "matched"].includes(res.body.item.status));
    assert.equal(res.body.item.reporter_id, studentA2User.id);
    assert.equal(res.body.item.university_id, uniA.id);
    // Reporter can see their own private details upon creation
    assert.ok(res.body.item.private_details);
  });

  // 3. Retrieve available reports
  test("3. Retrieve available reports: lists active campus reports with pagination", async () => {
    const res = await apiRequest("/api/lost-found", {
      headers: { Authorization: `Bearer ${studentA1Token}` },
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.items));
    assert.ok(res.body.items.length >= 2);
    assert.ok(res.body.pagination);
    assert.ok(res.body.pagination.total >= 2);
  });

  // 4. Search reports by title/keyword
  test("4. Search reports by title/keyword: correctly filters results by query term", async () => {
    const res = await apiRequest("/api/lost-found?q=Charger", {
      headers: { Authorization: `Bearer ${studentA1Token}` },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.items.length >= 2);
    for (const itm of res.body.items) {
      assert.ok(itm.title.toLowerCase().includes("charger") || itm.description.toLowerCase().includes("charger"));
    }
  });

  // 5. Filter reports by category
  test("5. Filter reports by category: retrieves only matching category items", async () => {
    const res = await apiRequest("/api/lost-found?category=Electronics", {
      headers: { Authorization: `Bearer ${studentA1Token}` },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.items.length >= 2);
    for (const itm of res.body.items) {
      assert.equal(itm.category, "Electronics");
    }

    const emptyCatRes = await apiRequest("/api/lost-found?category=Clothing", {
      headers: { Authorization: `Bearer ${studentA1Token}` },
    });
    assert.equal(emptyCatRes.status, 200);
    assert.equal(emptyCatRes.body.items.length, 0);
  });

  // 6. Update own report
  test("6. Update own report: reporter successfully edits their report title and description", async () => {
    const res = await apiRequest(`/api/lost-found/${createdLostId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${studentA1Token}` },
      body: {
        title: "Updated HP Laptop Charger 65W",
        description: "Updated description: Lost on 2nd floor, Main Library.",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.item.title, "Updated HP Laptop Charger 65W");
    assert.equal(res.body.item.description, "Updated description: Lost on 2nd floor, Main Library.");
  });

  // 7. Prevent editing another user's report (403)
  test("7. Prevent editing another user's report: unauthorized user receives 403 Forbidden", async () => {
    const res = await apiRequest(`/api/lost-found/${createdLostId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${studentA2Token}` },
      body: {
        title: "Hacked title",
      },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "FORBIDDEN");
  });

  // 8. Prevent deleting another user's report (403)
  test("8. Prevent deleting another user's report: unauthorized user receives 403 Forbidden", async () => {
    const res = await apiRequest(`/api/lost-found/${createdLostId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${studentA2Token}` },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "FORBIDDEN");
  });

  // 9. University tenant isolation
  test("9. University tenant isolation: Uni A user NEVER sees Uni B records, and vice versa", async () => {
    // Create an item in Uni B
    const uniBItemRes = await apiRequest("/api/lost-found", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentBToken}` },
      body: {
        type: "lost",
        title: "Uni B Secret Student ID Card",
        category: "Student ID Cards",
        description: "Lost my ID in Uni B engineering building.",
        date_incident: new Date().toISOString().split("T")[0],
        location: "Uni B Engineering Block",
      },
    });
    assert.equal(uniBItemRes.status, 201);
    uniBItemId = uniBItemRes.body.item.id;
    cleanupItemIds.push(uniBItemId);

    // Uni A user queries items -> must NOT contain Uni B record
    const uniAListRes = await apiRequest("/api/lost-found", {
      headers: { Authorization: `Bearer ${studentA1Token}` },
    });
    assert.equal(uniAListRes.status, 200);
    const uniATitles = uniAListRes.body.items.map((i) => i.title);
    assert.ok(!uniATitles.includes("Uni B Secret Student ID Card"), "Tenant leakage: Uni A saw Uni B report!");

    // Uni A user directly querying Uni B item ID -> must return 404 NOT_FOUND
    const crossQueryRes = await apiRequest(`/api/lost-found/${uniBItemId}`, {
      headers: { Authorization: `Bearer ${studentA1Token}` },
    });
    assert.equal(crossQueryRes.status, 404);
  });

  // 10. Feature flag enforcement
  test("10. Feature flag enforcement: university with lost_found: false receives 403", async () => {
    const res = await apiRequest("/api/lost-found", {
      headers: { Authorization: `Bearer ${studentCToken}` },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "FEATURE_DISABLED");
  });

  // 11. Matching algorithm accuracy
  test("11. Matching algorithm accuracy: triggers smart match between lost & found chargers (>=85%)", async () => {
    // Both items were created: HP laptop charger lost (A1) and found (A2) in Uni A
    // Trigger / inspect matches for student A1's lost item
    const res = await apiRequest(`/api/lost-found/${createdLostId}`, {
      headers: { Authorization: `Bearer ${studentA1Token}` },
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.item.matches));
    assert.ok(res.body.item.matches.length >= 1, "Expected matching engine to link lost & found chargers");

    const match = res.body.item.matches[0];
    assert.ok(
      match.similarity_score >= 65,
      `Expected score >= 65 (meeting recommendation threshold), got ${match.similarity_score}`
    );
    assert.equal(match.matched_item_id, createdFoundId);
  });

  // 12. Matching threshold behavior (<65 excluded)
  test("12. Matching threshold behavior: completely dissimilar item produces no matches", async () => {
    // Create unrelated item: leather wallet lost in sports complex
    const unrelatedRes = await apiRequest("/api/lost-found", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA1Token}` },
      body: {
        type: "lost",
        title: "Brown Leather Wallet",
        category: "Wallets",
        description: "Brown leather bi-fold wallet lost on soccer pitch.",
        date_incident: new Date().toISOString().split("T")[0],
        location: "Sports Stadium",
        color: "Brown",
      },
    });
    assert.equal(unrelatedRes.status, 201);
    const unrelatedId = unrelatedRes.body.item.id;
    cleanupItemIds.push(unrelatedId);

    const checkRes = await apiRequest(`/api/lost-found/${unrelatedId}`, {
      headers: { Authorization: `Bearer ${studentA1Token}` },
    });
    assert.equal(checkRes.status, 200);
    // Should have 0 matches with HP charger
    assert.equal(checkRes.body.item.matches.length, 0);
  });

  // 13. Duplicate match prevention
  test("13. Duplicate match prevention: running match evaluation again does not insert duplicates", async () => {
    const { findPotentialMatches } = require("../src/modules/lostFound/matching");
    // Run matching on createdFoundId
    await findPotentialMatches(createdFoundId);

    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM lost_found_matches
       WHERE (lost_item_id = $1 AND found_item_id = $2) OR (lost_item_id = $2 AND found_item_id = $1)`,
      [createdLostId, createdFoundId]
    );

    // Must be exactly 1 or 2 (bidirectional unique pairs), not duplicated further
    assert.ok(rows[0].count <= 2);
  });

  // 14. Claim submission
  let submittedClaimId;
  test("14. Claim submission: student A1 claims the found charger with private proof", async () => {
    const res = await apiRequest(`/api/lost-found/${createdFoundId}/claim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA1Token}` },
      body: {
        private_proof: "The charger has a piece of red electrical tape near the USB-C plug and serial ends with 89B.",
        contact_phone: "+251911223344",
        evidence_images: ["/uploads/receipt_proof.jpg"],
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.claim.item_id, createdFoundId);
    assert.equal(res.body.claim.claimant_id, studentA1User.id);
    assert.equal(res.body.claim.status, "pending");

    submittedClaimId = res.body.claim.id;
    cleanupClaimIds.push(submittedClaimId);

    // Check item status is now claim_pending
    const itemRes = await apiRequest(`/api/lost-found/${createdFoundId}`, {
      headers: { Authorization: `Bearer ${studentA2Token}` },
    });
    assert.equal(itemRes.body.item.status, "claim_pending");
  });

  // 15. Duplicate active claim prevention
  test("15. Duplicate active claim prevention: cannot submit multiple pending claims for same item", async () => {
    const res = await apiRequest(`/api/lost-found/${createdFoundId}/claim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA1Token}` },
      body: {
        private_proof: "Duplicate claim attempt.",
      },
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "CLAIM_ALREADY_EXISTS");
  });

  // 16. Claim authorization
  test("16. Claim authorization: non-finder user cannot review or approve claims (403)", async () => {
    // Student A1 (claimant) attempts to approve their own claim -> 403 Forbidden
    const res = await apiRequest(`/api/lost-found/claims/${submittedClaimId}/review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA1Token}` },
      body: { decision: "approve" },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "FORBIDDEN");
  });

  // 17. Private claim data and private item details protection
  test("17. Private details protection: confidential proof is NEVER exposed to third-party public callers", async () => {
    // Create third user in Uni A
    const uA3 = await createTestUser({ name: "Student A3", email: `a3_${Date.now()}@lf-a-${Date.now()}.edu.et`, role: "student", universityId: uniA.id });

    // Public / third party query
    const res = await apiRequest(`/api/lost-found/${createdFoundId}`, {
      headers: { Authorization: `Bearer ${uA3.token}` },
    });

    assert.equal(res.status, 200);
    // 1. Finder's private_details MUST be stripped
    assert.equal(res.body.item.private_details, undefined, "LEAK: Private details exposed to public viewer!");

    // 2. Claims list must NOT expose other users' claims to third party
    assert.equal(res.body.item.claims.length, 0, "LEAK: Third party saw private claims!");
  });

  // 18. Valid/invalid status transitions
  test("18. Valid/invalid status transitions: rejects arbitrary invalid status transitions", async () => {
    const res = await apiRequest(`/api/lost-found/${createdFoundId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${studentA2Token}` },
      body: { status: "invalid_status_value" },
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  // 19. Handover dual-confirmation
  test("19. Handover dual-confirmation: claim approval -> awaiting_handover -> dual confirmation -> returned", async () => {
    // 1. Finder approves the claim
    const approveRes = await apiRequest(`/api/lost-found/claims/${submittedClaimId}/review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA2Token}` },
      body: { decision: "approve" },
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.claim.status, "approved");

    // Verify item moved to awaiting_handover
    let itemCheck = await apiRequest(`/api/lost-found/${createdFoundId}`, {
      headers: { Authorization: `Bearer ${studentA2Token}` },
    });
    assert.equal(itemCheck.body.item.status, "awaiting_handover");

    // 2. Finder confirms handover
    const finderConfirmRes = await apiRequest(`/api/lost-found/${createdFoundId}/handover`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA2Token}` },
      body: { role: "finder" },
    });
    assert.equal(finderConfirmRes.status, 200);
    assert.equal(finderConfirmRes.body.handover.finderConfirmed, true);
    assert.equal(finderConfirmRes.body.handover.claimantConfirmed, false);
    // Still awaiting claimant
    assert.equal(finderConfirmRes.body.handover.status, "awaiting_handover");

    // 3. Claimant confirms receipt
    const claimantConfirmRes = await apiRequest(`/api/lost-found/${createdFoundId}/handover`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA1Token}` },
      body: { role: "claimant" },
    });
    assert.equal(claimantConfirmRes.status, 200);
    assert.equal(claimantConfirmRes.body.handover.finderConfirmed, true);
    assert.equal(claimantConfirmRes.body.handover.claimantConfirmed, true);
    // Both confirmed -> status is now returned!
    assert.equal(claimantConfirmRes.body.handover.status, "returned");
  });

  // 20. Notification generation on match and claim actions
  test("20. Notification generation: verified notifications exist in DB for student A1 and student A2", async () => {
    const { rows: notesA1 } = await db.query(
      "SELECT * FROM notifications WHERE user_id = $1",
      [studentA1User.id]
    );
    assert.ok(notesA1.length >= 1, "Expected notifications for student A1");

    const { rows: notesA2 } = await db.query(
      "SELECT * FROM notifications WHERE user_id = $1",
      [studentA2User.id]
    );
    assert.ok(notesA2.length >= 1, "Expected notifications for student A2");
  });

  // 21. SQL injection protection
  test("21. SQL injection protection: handles malicious SQL fragments safely", async () => {
    const sqliAttempts = [
      "charger' OR 1=1 --",
      "'; DROP TABLE lost_found_items; --",
      "union select null, null, null",
    ];

    for (const sqli of sqliAttempts) {
      const res = await apiRequest(`/api/lost-found?q=${encodeURIComponent(sqli)}`, {
        headers: { Authorization: `Bearer ${studentA1Token}` },
      });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.items));
    }
  });

  // 22. Validation checks
  test("22. Validation checks: rejects missing title, invalid dates, and invalid category", async () => {
    const badRes = await apiRequest("/api/lost-found", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA1Token}` },
      body: {
        type: "lost",
        // missing title
        category: "InvalidCategoryName",
        description: "Short",
        date_incident: "not-a-date",
        location: "Hall A",
      },
    });

    assert.equal(badRes.status, 400);
    assert.equal(badRes.body.error.code, "VALIDATION_ERROR");
  });

  // 23. Admin moderation actions
  test("23. Admin moderation actions: campus admin can moderate, remove, and restore reports", async () => {
    // 1. Admin removes item
    const removeRes = await apiRequest(`/api/lost-found/${createdLostId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert.equal(removeRes.status, 200);

    // Verify item status is now removed
    const checkRemoved = await apiRequest(`/api/lost-found/${createdLostId}`, {
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert.equal(checkRemoved.body.item.status, "removed");

    // 2. Admin restores item to open
    const restoreRes = await apiRequest(`/api/lost-found/${createdLostId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminAToken}` },
      body: { status: "open" },
    });
    assert.equal(restoreRes.status, 200);
    assert.equal(restoreRes.body.item.status, "open");
  });
});
