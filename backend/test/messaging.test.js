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

let uniA, uniB;
let studentA, studentB, studentC, studentFromUniB;
const cleanupUserIds = [];
const cleanupUniIds = [];

async function apiRequest(endpoint, { method = "GET", headers = {}, body } = {}) {
  const url = `${baseUrl}${endpoint}`;
  const reqHeaders = { ...headers };
  let payload = "";

  if (body) {
    payload = JSON.stringify(body);
    reqHeaders["Content-Type"] = "application/json";
    reqHeaders["Content-Length"] = Buffer.byteLength(payload);
  }

  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        let parsed = raw;
        try {
          parsed = JSON.parse(raw);
        } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
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
  // Start test server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  const ts = Date.now();

  // Universities
  const uniResA = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{}')
     RETURNING *`,
    ["Msg Uni A", `msg-uni-a-${ts}`, `msg-a-${ts}.edu.et`, [`msg-a-${ts}.edu.et`]]
  );
  uniA = uniResA.rows[0];
  cleanupUniIds.push(uniA.id);

  const uniResB = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{}')
     RETURNING *`,
    ["Msg Uni B", `msg-uni-b-${ts}`, `msg-b-${ts}.edu.et`, [`msg-b-${ts}.edu.et`]]
  );
  uniB = uniResB.rows[0];
  cleanupUniIds.push(uniB.id);

  // Users
  studentA = await createTestUser({
    name: "Student A",
    email: `studentA_${ts}@msg-a.edu`,
    role: "student",
    universityId: uniA.id,
  });

  studentB = await createTestUser({
    name: "Student B",
    email: `studentB_${ts}@msg-a.edu`,
    role: "student",
    universityId: uniA.id,
  });

  studentC = await createTestUser({
    name: "Student C",
    email: `studentC_${ts}@msg-a.edu`,
    role: "student",
    universityId: uniA.id,
  });

  studentFromUniB = await createTestUser({
    name: "Student UniB",
    email: `studentB_${ts}@msg-b.edu`,
    role: "student",
    universityId: uniB.id,
  });
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (cleanupUserIds.length) {
    await db.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [cleanupUserIds]).catch(() => {});
  }
  if (cleanupUniIds.length) {
    await db.query(`DELETE FROM universities WHERE id = ANY($1::uuid[])`, [cleanupUniIds]).catch(() => {});
  }
  await db.pool.end().catch(() => {});
});

describe("Gibiyachin Messenger - Backend Integration Test Suite", () => {
  let conversationId;
  let sentMessageId;

  test("1. Create a 1-on-1 conversation between Student A and Student B", async () => {
    const res = await apiRequest("/api/messages/conversations", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: {
        recipientId: studentB.user.id,
        type: "general",
      },
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.equal(res.body.participant.id, studentB.user.id);
    assert.equal(res.body.participant.name, "Student B");
    conversationId = res.body.id;
  });

  test("2. Re-creating conversation with same recipient returns existing conversation", async () => {
    const res = await apiRequest("/api/messages/conversations", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: {
        recipientId: studentB.user.id,
        type: "general",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.id, conversationId);
  });

  test("3. Reject conversation with self", async () => {
    const res = await apiRequest("/api/messages/conversations", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: {
        recipientId: studentA.user.id,
      },
    });

    assert.equal(res.status, 400);
  });

  test("4. Prevent cross-university messaging (tenant boundary)", async () => {
    const res = await apiRequest("/api/messages/conversations", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: {
        recipientId: studentFromUniB.user.id,
      },
    });

    assert.equal(res.status, 403);
  });

  test("5. Student A sends a text message to Student B", async () => {
    const res = await apiRequest(`/api/messages/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: {
        content: "Hello Student B! Do you still have the calculus notes?",
      },
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.equal(res.body.content, "Hello Student B! Do you still have the calculus notes?");
    assert.equal(res.body.senderId, studentA.user.id);
    assert.equal(res.body.isEdited, false);
    assert.equal(res.body.isDeleted, false);
    sentMessageId = res.body.id;
  });

  test("6. Student B checks unread messages count (must be 1)", async () => {
    const res = await apiRequest("/api/messages/unread-count", {
      headers: { Authorization: `Bearer ${studentB.token}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
  });

  test("7. Student B fetches messages inside the conversation", async () => {
    const res = await apiRequest(`/api/messages/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${studentB.token}` },
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, sentMessageId);
    assert.equal(res.body[0].senderName, "Student A");
  });

  test("8. Student B marks conversation as read, unread count drops to 0", async () => {
    const readRes = await apiRequest(`/api/messages/conversations/${conversationId}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentB.token}` },
    });
    assert.equal(readRes.status, 200);

    const countRes = await apiRequest("/api/messages/unread-count", {
      headers: { Authorization: `Bearer ${studentB.token}` },
    });
    assert.equal(countRes.status, 200);
    assert.equal(countRes.body.total, 0);
  });

  test("9. Non-participant (Student C) cannot read messages (403 Forbidden)", async () => {
    const res = await apiRequest(`/api/messages/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${studentC.token}` },
    });

    assert.equal(res.status, 403);
  });

  test("10. Non-participant (Student C) cannot send message to conversation (403 Forbidden)", async () => {
    const res = await apiRequest(`/api/messages/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentC.token}` },
      body: { content: "Sneaky message" },
    });

    assert.equal(res.status, 403);
  });

  test("11. Student A edits their own message", async () => {
    const res = await apiRequest(`/api/messages/messages/${sentMessageId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: { content: "Updated: Do you have calculus and physics notes?" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.content, "Updated: Do you have calculus and physics notes?");
    assert.equal(res.body.isEdited, true);
  });

  test("12. Student B cannot edit Student A's message (403 Forbidden)", async () => {
    const res = await apiRequest(`/api/messages/messages/${sentMessageId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${studentB.token}` },
      body: { content: "Tampered content" },
    });

    assert.equal(res.status, 403);
  });

  test("13. Student A sends a reply to their previous message", async () => {
    const res = await apiRequest(`/api/messages/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: {
        content: "Also let me know if we can meet at the library.",
        replyToId: sentMessageId,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.replyToId, sentMessageId);
    assert.ok(res.body.reply);
    assert.equal(res.body.reply.senderName, "Student A");
  });

  test("14. Student A soft-deletes their message", async () => {
    const res = await apiRequest(`/api/messages/messages/${sentMessageId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${studentA.token}` },
    });

    assert.equal(res.status, 200);

    // Verify content is sanitized in message thread
    const fetchRes = await apiRequest(`/api/messages/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${studentA.token}` },
    });
    const deletedMsg = fetchRes.body.find((m) => m.id === sentMessageId);
    assert.ok(deletedMsg);
    assert.equal(deletedMsg.isDeleted, true);
    assert.equal(deletedMsg.content, "This message was deleted");
  });

  test("15. Toggle conversation pin and archive settings", async () => {
    const res = await apiRequest(`/api/messages/conversations/${conversationId}/settings`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: { isPinned: true, isArchived: false },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.isPinned, true);
    assert.equal(res.body.isArchived, false);
  });

  test("16. User Blocking: Student B blocks Student A", async () => {
    const blockRes = await apiRequest("/api/messages/block", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentB.token}` },
      body: {
        targetUserId: studentA.user.id,
        reason: "Unwanted messages",
      },
    });

    assert.equal(blockRes.status, 200);
    assert.equal(blockRes.body.blockedUserId, studentA.user.id);

    // List blocked users
    const listRes = await apiRequest("/api/messages/blocks", {
      headers: { Authorization: `Bearer ${studentB.token}` },
    });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.length, 1);
    assert.equal(listRes.body[0].id, studentA.user.id);
  });

  test("17. Blocked communication is prevented (403 Forbidden)", async () => {
    const sendRes = await apiRequest(`/api/messages/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: { content: "Trying to reach you after block" },
    });

    assert.equal(sendRes.status, 403);
  });

  test("18. Unblock: Student B unblocks Student A", async () => {
    const unblockRes = await apiRequest("/api/messages/unblock", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentB.token}` },
      body: { targetUserId: studentA.user.id },
    });

    assert.equal(unblockRes.status, 200);

    // Now message sending works again
    const sendRes = await apiRequest(`/api/messages/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: { content: "Message after unblock" },
    });

    assert.equal(sendRes.status, 201);
  });
});
