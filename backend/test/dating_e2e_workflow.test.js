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
let studentA, studentB, studentFromUniB, studentX, studentY;
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

async function createTestUser({ name, email, role = "student", universityId }) {
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
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  const ts = Date.now();

  const uniResA = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{}')
     RETURNING *`,
    ["Workflow Uni A", `wf-uni-a-${ts}`, `wf-a-${ts}.edu.et`, [`wf-a-${ts}.edu.et`]]
  );
  uniA = uniResA.rows[0];
  cleanupUniIds.push(uniA.id);

  const uniResB = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{}')
     RETURNING *`,
    ["Workflow Uni B", `wf-uni-b-${ts}`, `wf-b-${ts}.edu.et`, [`wf-b-${ts}.edu.et`]]
  );
  uniB = uniResB.rows[0];
  cleanupUniIds.push(uniB.id);

  studentA = await createTestUser({
    name: "Almaz Workflow",
    email: `almaz_${ts}@wf-a.edu`,
    universityId: uniA.id,
  });

  studentB = await createTestUser({
    name: "Bekele Workflow",
    email: `bekele_${ts}@wf-a.edu`,
    universityId: uniA.id,
  });

  studentFromUniB = await createTestUser({
    name: "Chala UniB",
    email: `chala_${ts}@wf-b.edu`,
    universityId: uniB.id,
  });

  studentX = await createTestUser({
    name: "User X Reporter",
    email: `userx_${ts}@wf-a.edu`,
    universityId: uniA.id,
  });

  studentY = await createTestUser({
    name: "User Y Target",
    email: `usery_${ts}@wf-a.edu`,
    universityId: uniA.id,
  });
});

after(async () => {
  await new Promise((resolve) => setTimeout(resolve, 60));
  if (cleanupUserIds.length > 0) {
    await db.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [cleanupUserIds]).catch(() => {});
  }
  if (cleanupUniIds.length > 0) {
    await db.query("DELETE FROM universities WHERE id = ANY($1::uuid[])", [cleanupUniIds]).catch(() => {});
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await db.pool.end().catch(() => {});
});

describe("Campus Dating (Gibiyachin Connect ❤️) - Full Two-Student Lifecycle", () => {
  let matchId = null;
  let datingConversationId = null;

  test("1. Profile Creation: Student A and Student B opt in with valid adult profiles", async () => {
    // Student A (woman, 22)
    const resA = await apiRequest("/api/dating/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: {
        birthDate: "2002-04-12",
        adultConfirmed: true,
        displayName: "Almaz",
        gender: "woman",
        department: "Software Engineering",
        academicYear: "4th Year",
        bio: "Passionate about full-stack web and open source. Love coffee & hiking.",
        interests: ["Tech & Coding", "Coffee Culture", "Hiking & Outdoors"],
        hobbies: ["Photography", "Running"],
        favoriteMusic: "Ethio-Jazz",
      },
    });
    assert.equal(resA.status, 200);
    assert.equal(resA.body.profile.displayName, "Almaz");
    assert.equal(resA.body.profile.status, "active");

    // Student B (man, 23)
    const resB = await apiRequest("/api/dating/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentB.token}` },
      body: {
        birthDate: "2001-08-20",
        adultConfirmed: true,
        displayName: "Bekele",
        gender: "man",
        department: "Electrical Engineering",
        academicYear: "5th Year",
        bio: "Robotics builder and coffee lover.",
        interests: ["Tech & Coding", "Coffee Culture", "Live Music"],
        hobbies: ["Chess", "Badminton"],
        favoriteMusic: "Lo-Fi Beats",
      },
    });
    assert.equal(resB.status, 200);
    assert.equal(resB.body.profile.displayName, "Bekele");
    assert.equal(resB.body.profile.status, "active");

    // Student From Uni B (man, 24)
    const resUniB = await apiRequest("/api/dating/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentFromUniB.token}` },
      body: {
        birthDate: "2000-01-15",
        adultConfirmed: true,
        displayName: "Chala",
        gender: "man",
        department: "Medicine",
        academicYear: "6th Year",
        bio: "Medical student at Uni B.",
        interests: ["Tech & Coding", "Reading"],
      },
    });
    assert.equal(resUniB.status, 200);
  });

  test("2. Discovery Feed: Student A discovers Student B, strict tenant isolation and privacy enforced", async () => {
    const res = await apiRequest("/api/dating/discover", {
      headers: { Authorization: `Bearer ${studentA.token}` },
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));

    // Must find Student B
    const candidateB = res.body.find((c) => c.userId === studentB.user.id);
    assert.ok(candidateB, "Student B must appear in Student A's discovery feed");
    assert.equal(candidateB.displayName, "Bekele");
    assert.equal(candidateB.sharedInterestsCount, 2); // Tech & Coding, Coffee Culture

    // STRICT PRIVACY: Verify sensitive columns are never returned in candidate payload
    assert.equal(candidateB.birthDate, undefined);
    assert.equal(candidateB.birth_date, undefined);
    assert.equal(candidateB.email, undefined);
    assert.equal(candidateB.phone, undefined);
    assert.equal(candidateB.studentId, undefined);

    // Tenant Isolation: Student from Uni B must NOT appear (same_university_only = true)
    const candidateUniB = res.body.find((c) => c.userId === studentFromUniB.user.id);
    assert.equal(candidateUniB, undefined, "Student from Uni B must not appear across university boundaries");

    // Self Exclusion: Student A must NOT appear in their own feed
    const candidateA = res.body.find((c) => c.userId === studentA.user.id);
    assert.equal(candidateA, undefined, "Current user must never discover themselves");
  });

  test("3. Single Swipe: Student A swipes 'like' on Student B -> Persisted in DB, no match yet", async () => {
    const res = await apiRequest("/api/dating/swipe", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: {
        targetId: studentB.user.id,
        action: "like",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.matched, false);
    assert.equal(res.body.targetId, studentB.user.id);

    // Verify persisted like in database
    const dbSwipe = await db.query(
      "SELECT action FROM dating_swipes WHERE swiper_id = $1 AND target_id = $2",
      [studentA.user.id, studentB.user.id]
    );
    assert.equal(dbSwipe.rows.length, 1);
    assert.equal(dbSwipe.rows[0].action, "like");

    // Verify no match in dating_matches
    const dbMatch = await db.query(
      "SELECT * FROM dating_matches WHERE (user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1)",
      [studentA.user.id, studentB.user.id]
    );
    assert.equal(dbMatch.rows.length, 0);

    // Neither user has active matches yet
    const matchesA = await apiRequest("/api/dating/matches", {
      headers: { Authorization: `Bearer ${studentA.token}` },
    });
    assert.equal(matchesA.status, 200);
    assert.equal(matchesA.body.length, 0);
  });

  test("4. Duplicate swipe protection: Re-swiping 'like' updates without duplicate records", async () => {
    const res = await apiRequest("/api/dating/swipe", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: {
        targetId: studentB.user.id,
        action: "like",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.matched, false);

    const dbSwipe = await db.query(
      "SELECT COUNT(*) FROM dating_swipes WHERE swiper_id = $1 AND target_id = $2",
      [studentA.user.id, studentB.user.id]
    );
    assert.equal(parseInt(dbSwipe.rows[0].count, 10), 1);
  });

  test("5. Mutual Liking: Student B swipes 'like' on Student A -> Triggers IT'S A MATCH!", async () => {
    const res = await apiRequest("/api/dating/swipe", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentB.token}` },
      body: {
        targetId: studentA.user.id,
        action: "like",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.matched, true);
    assert.ok(res.body.matchId);
    assert.ok(res.body.conversationId);
    assert.equal(res.body.partner.displayName, "Almaz");

    matchId = res.body.matchId;
    datingConversationId = res.body.conversationId;

    // Direct database validation: Exactly 1 match record in active status
    const dbMatch = await db.query("SELECT * FROM dating_matches WHERE id = $1", [matchId]);
    assert.equal(dbMatch.rows.length, 1);
    assert.equal(dbMatch.rows[0].status, "active");
    assert.equal(dbMatch.rows[0].conversation_id, datingConversationId);
  });

  test("6. Active Match Management: Both students see each other in GET /api/dating/matches", async () => {
    // Check Student A
    const resA = await apiRequest("/api/dating/matches", {
      headers: { Authorization: `Bearer ${studentA.token}` },
    });
    assert.equal(resA.status, 200);
    assert.equal(resA.body.length, 1);
    assert.equal(resA.body[0].matchId, matchId);
    assert.equal(resA.body[0].conversationId, datingConversationId);
    assert.equal(resA.body[0].partner.displayName, "Bekele");

    // Check Student B
    const resB = await apiRequest("/api/dating/matches", {
      headers: { Authorization: `Bearer ${studentB.token}` },
    });
    assert.equal(resB.status, 200);
    assert.equal(resB.body.length, 1);
    assert.equal(resB.body[0].matchId, matchId);
    assert.equal(resB.body[0].conversationId, datingConversationId);
    assert.equal(resB.body[0].partner.displayName, "Almaz");
  });

  test("7. Dating Conversation: Verified private communication between matched students", async () => {
    // 1. Student A sends message to the dating conversation
    const sendResA = await apiRequest(`/api/messages/conversations/${datingConversationId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: {
        content: "Hi Bekele! It's a match! What kind of coffee do you like?",
      },
    });
    assert.equal(sendResA.status, 201);
    assert.equal(sendResA.body.content, "Hi Bekele! It's a match! What kind of coffee do you like?");
    assert.equal(sendResA.body.senderName, "Almaz Workflow");

    // 2. Student B reads messages
    const readResB = await apiRequest(`/api/messages/conversations/${datingConversationId}/messages`, {
      headers: { Authorization: `Bearer ${studentB.token}` },
    });
    assert.equal(readResB.status, 200);
    assert.equal(readResB.body.length, 1);
    assert.equal(readResB.body[0].content, "Hi Bekele! It's a match! What kind of coffee do you like?");

    // 3. Student B replies
    const sendResB = await apiRequest(`/api/messages/conversations/${datingConversationId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentB.token}` },
      body: {
        content: "Hey Almaz! Big fan of Yirgacheffe pour-over. Let's grab a cup on campus!",
      },
    });
    assert.equal(sendResB.status, 201);
    assert.equal(sendResB.body.content, "Hey Almaz! Big fan of Yirgacheffe pour-over. Let's grab a cup on campus!");

    // 4. Cross-university student cannot view or post in this conversation
    const snooperRead = await apiRequest(`/api/messages/conversations/${datingConversationId}/messages`, {
      headers: { Authorization: `Bearer ${studentFromUniB.token}` },
    });
    assert.equal(snooperRead.status, 403);

    const snooperPost = await apiRequest(`/api/messages/conversations/${datingConversationId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentFromUniB.token}` },
      body: { content: "Intruder message" },
    });
    assert.equal(snooperPost.status, 403);
  });

  test("8. Unmatching: Student A unmatches -> match status updated and future messages strictly blocked", async () => {
    const unmatchRes = await apiRequest(`/api/dating/matches/${matchId}/unmatch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA.token}` },
    });
    assert.equal(unmatchRes.status, 200);
    assert.equal(unmatchRes.body.success, true);

    // Verify DB match status is 'unmatched'
    const dbCheck = await db.query("SELECT status, unmatched_by FROM dating_matches WHERE id = $1", [matchId]);
    assert.equal(dbCheck.rows[0].status, "unmatched");
    assert.equal(dbCheck.rows[0].unmatched_by, studentA.user.id);

    // Matches list is now empty for both
    const matchesA = await apiRequest("/api/dating/matches", {
      headers: { Authorization: `Bearer ${studentA.token}` },
    });
    assert.equal(matchesA.body.length, 0);

    const matchesB = await apiRequest("/api/dating/matches", {
      headers: { Authorization: `Bearer ${studentB.token}` },
    });
    assert.equal(matchesB.body.length, 0);

    // CRITICAL SECURITY: Sending a message after unmatching MUST be rejected with HTTP 403
    const blockedMsgRes = await apiRequest(`/api/messages/conversations/${datingConversationId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentB.token}` },
      body: {
        content: "Are you still there?",
      },
    });
    assert.equal(blockedMsgRes.status, 403);
    assert.ok(blockedMsgRes.body.error.message.includes("match has ended"));

    // Student A also cannot send message
    const blockedMsgResA = await apiRequest(`/api/messages/conversations/${datingConversationId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentA.token}` },
      body: {
        content: "Trying to reach out again",
      },
    });
    assert.equal(blockedMsgResA.status, 403);
    assert.ok(blockedMsgResA.body.error.message.includes("match has ended"));

    // Verify conversation details report isDatingUnmatched: true
    const convDetail = await apiRequest(`/api/messages/conversations/${datingConversationId}`, {
      headers: { Authorization: `Bearer ${studentA.token}` },
    });
    assert.equal(convDetail.status, 200);
    assert.equal(convDetail.body.isDatingUnmatched, true);
    assert.equal(convDetail.body.lastMessagePreview, "[Match ended]");
  });

  test("9. Discovery exclusion after unmatch: Neither student reappears in discovery", async () => {
    const resA = await apiRequest("/api/dating/discover", {
      headers: { Authorization: `Bearer ${studentA.token}` },
    });
    assert.equal(resA.status, 200);
    assert.equal(resA.body.some((c) => c.userId === studentB.user.id), false);

    const resB = await apiRequest("/api/dating/discover", {
      headers: { Authorization: `Bearer ${studentB.token}` },
    });
    assert.equal(resB.status, 200);
    assert.equal(resB.body.some((c) => c.userId === studentA.user.id), false);
  });

  test("10. Reporting & Safety: Reporting a dating profile creates block and isolates communication", async () => {
    // Create profiles for X and Y
    await apiRequest("/api/dating/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentX.token}` },
      body: {
        birthDate: "2001-01-01",
        adultConfirmed: true,
        displayName: "User X",
        gender: "woman",
      },
    });

    await apiRequest("/api/dating/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentY.token}` },
      body: {
        birthDate: "2001-02-02",
        adultConfirmed: true,
        displayName: "User Y",
        gender: "man",
      },
    });

    // Student X reports Student Y
    const reportRes = await apiRequest("/api/dating/report", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentX.token}` },
      body: {
        targetId: studentY.user.id,
        category: "harassment",
        reason: "Sent inappropriate messages",
      },
    });

    assert.equal(reportRes.status, 201);
    assert.equal(reportRes.body.success, true);
    assert.ok(reportRes.body.reportId);

    // Verify report stored in dating_reports
    const dbReport = await db.query("SELECT * FROM dating_reports WHERE id = $1", [reportRes.body.reportId]);
    assert.equal(dbReport.rows.length, 1);
    assert.equal(dbReport.rows[0].category, "harassment");

    // Verify block in user_blocks
    const dbBlock = await db.query(
      "SELECT * FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2",
      [studentX.user.id, studentY.user.id]
    );
    assert.equal(dbBlock.rows.length, 1);

    // Verify Student Y cannot swipe on Student X -> 403 Forbidden
    const swipeBlocked = await apiRequest("/api/dating/swipe", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentY.token}` },
      body: {
        targetId: studentX.user.id,
        action: "like",
      },
    });
    assert.equal(swipeBlocked.status, 403);
    assert.ok(swipeBlocked.body.error.message.includes("blocked"));
  });

  test("11. Cross-University Isolation: Student from Uni B cannot swipe on Uni A student", async () => {
    const crossSwipe = await apiRequest("/api/dating/swipe", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentFromUniB.token}` },
      body: {
        targetId: studentA.user.id,
        action: "like",
      },
    });

    assert.equal(crossSwipe.status, 403);
    assert.ok(crossSwipe.body.error.message.includes("other universities"));
  });
});
