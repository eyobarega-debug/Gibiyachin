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
let adultUser1, adultUser2, underageUser, userFromUniB;
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
    ["Dating Uni A", `dating-uni-a-${ts}`, `dating-a-${ts}.edu.et`, [`dating-a-${ts}.edu.et`]]
  );
  uniA = uniResA.rows[0];
  cleanupUniIds.push(uniA.id);

  const uniResB = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{}')
     RETURNING *`,
    ["Dating Uni B", `dating-uni-b-${ts}`, `dating-b-${ts}.edu.et`, [`dating-b-${ts}.edu.et`]]
  );
  uniB = uniResB.rows[0];
  cleanupUniIds.push(uniB.id);

  // Users
  adultUser1 = await createTestUser({
    name: "Helen Adult",
    email: `helen_${ts}@dating-a.edu`,
    role: "student",
    universityId: uniA.id,
  });

  adultUser2 = await createTestUser({
    name: "Yonas Adult",
    email: `yonas_${ts}@dating-a.edu`,
    role: "student",
    universityId: uniA.id,
  });

  underageUser = await createTestUser({
    name: "Kid Student",
    email: `kid_${ts}@dating-a.edu`,
    role: "student",
    universityId: uniA.id,
  });

  userFromUniB = await createTestUser({
    name: "Bethlehem UniB",
    email: `beth_${ts}@dating-b.edu`,
    role: "student",
    universityId: uniB.id,
  });
});

after(async () => {
  await new Promise((resolve) => setTimeout(resolve, 60));
  if (server) await new Promise((resolve) => server.close(resolve));
  if (cleanupUserIds.length) {
    await db.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [cleanupUserIds]).catch(() => {});
  }
  if (cleanupUniIds.length) {
    await db.query(`DELETE FROM universities WHERE id = ANY($1::uuid[])`, [cleanupUniIds]).catch(() => {});
  }
  await db.pool.end().catch(() => {});
});

describe("Campus Dating (Gibiyachin Connect ❤️) - Backend Integration Test Suite", () => {
  let createdMatchId;
  let datingConversationId;

  test("1. Reject profile creation for underage user (age < 18)", async () => {
    // 16 years old
    const underAgeBirthDate = new Date();
    underAgeBirthDate.setFullYear(underAgeBirthDate.getFullYear() - 16);
    const birthDateStr = underAgeBirthDate.toISOString().slice(0, 10);

    const res = await apiRequest("/api/dating/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${underageUser.token}` },
      body: {
        birthDate: birthDateStr,
        adultConfirmed: true,
        displayName: "Kid",
        gender: "male",
      },
    });

    assert.equal(res.status, 400);
    assert.match(JSON.stringify(res.body), /18/);
  });

  test("2. Reject profile creation without explicit adult confirmation checkbox", async () => {
    const res = await apiRequest("/api/dating/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${adultUser1.token}` },
      body: {
        birthDate: "2002-05-15",
        adultConfirmed: false,
        displayName: "Helen",
        gender: "female",
      },
    });

    assert.equal(res.status, 400);
  });

  test("3. Successfully create dating profile for adult user (Helen, 24)", async () => {
    const res = await apiRequest("/api/dating/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${adultUser1.token}` },
      body: {
        birthDate: "2002-05-15",
        adultConfirmed: true,
        displayName: "Helen",
        gender: "female",
        department: "Software Engineering",
        academicYear: "4th Year",
        bio: "Love building AI tools, hiking and coffee walks.",
        interests: ["Tech & Coding", "AI & Robotics", "Coffee Walks"],
      },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.profile);
    assert.equal(res.body.profile.displayName, "Helen");
    assert.ok(res.body.profile.age >= 18);
    // Strict privacy: birth_date must NEVER be exposed in public profile response
    assert.equal(res.body.profile.birth_date, undefined);
    assert.equal(res.body.profile.birthDate, undefined);
  });

  test("4. Create dating profile for second adult user (Yonas, 23)", async () => {
    const res = await apiRequest("/api/dating/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${adultUser2.token}` },
      body: {
        birthDate: "2003-08-20",
        adultConfirmed: true,
        displayName: "Yonas",
        gender: "male",
        department: "Electrical Engineering",
        academicYear: "3rd Year",
        bio: "Avid reader, tech enthusiast and basketball player.",
        interests: ["Tech & Coding", "Basketball", "Reading"],
      },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.profile);
    assert.equal(res.body.profile.displayName, "Yonas");
  });

  test("5. Helen discovers Yonas in candidate feed with shared interests", async () => {
    const res = await apiRequest("/api/dating/discover", {
      headers: { Authorization: `Bearer ${adultUser1.token}` },
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);

    const yonasCandidate = res.body.find((c) => c.userId === adultUser2.user.id);
    assert.ok(yonasCandidate);
    assert.equal(yonasCandidate.displayName, "Yonas");
    assert.ok(yonasCandidate.age >= 18);
    assert.equal(yonasCandidate.birth_date, undefined);
    assert.equal(yonasCandidate.email, undefined);
    assert.equal(yonasCandidate.phone, undefined);
    assert.ok(yonasCandidate.sharedInterestsCount >= 1); // Both share "Tech & Coding"
  });

  test("6. Non-opt-in student (underageUser) does not appear in discovery", async () => {
    const res = await apiRequest("/api/dating/discover", {
      headers: { Authorization: `Bearer ${adultUser1.token}` },
    });

    assert.equal(res.status, 200);
    const kidCandidate = res.body.find((c) => c.userId === underageUser.user.id);
    assert.equal(kidCandidate, undefined);
  });

  test("7. Helen swipes 'like' on Yonas (not yet mutual)", async () => {
    const res = await apiRequest("/api/dating/swipe", {
      method: "POST",
      headers: { Authorization: `Bearer ${adultUser1.token}` },
      body: {
        targetId: adultUser2.user.id,
        action: "like",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.matched, false);
  });

  test("8. Yonas swipes 'like' on Helen -> IT'S A MATCH!", async () => {
    const res = await apiRequest("/api/dating/swipe", {
      method: "POST",
      headers: { Authorization: `Bearer ${adultUser2.token}` },
      body: {
        targetId: adultUser1.user.id,
        action: "like",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.matched, true);
    assert.ok(res.body.matchId);
    assert.ok(res.body.conversationId);
    assert.equal(res.body.partner.displayName, "Helen");

    createdMatchId = res.body.matchId;
    datingConversationId = res.body.conversationId;
  });

  test("9. Both Helen and Yonas see each other in GET /api/dating/matches", async () => {
    const helenMatches = await apiRequest("/api/dating/matches", {
      headers: { Authorization: `Bearer ${adultUser1.token}` },
    });

    assert.equal(helenMatches.status, 200);
    assert.equal(helenMatches.body.length, 1);
    assert.equal(helenMatches.body[0].partner.displayName, "Yonas");
    assert.equal(helenMatches.body[0].conversationId, datingConversationId);

    const yonasMatches = await apiRequest("/api/dating/matches", {
      headers: { Authorization: `Bearer ${adultUser2.token}` },
    });

    assert.equal(yonasMatches.status, 200);
    assert.equal(yonasMatches.body.length, 1);
    assert.equal(yonasMatches.body[0].partner.displayName, "Helen");
    assert.equal(yonasMatches.body[0].conversationId, datingConversationId);
  });

  test("10. Dating conversation is created and usable in Messaging", async () => {
    const res = await apiRequest(`/api/messages/conversations/${datingConversationId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adultUser1.token}` },
      body: {
        content: "Hey Yonas! Saw you also like tech & basketball. Nice to meet you! 😊",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.content, "Hey Yonas! Saw you also like tech & basketball. Nice to meet you! 😊");
  });

  test("11. Pause Profile: Pausing hides user from discovery", async () => {
    const pauseRes = await apiRequest("/api/dating/profile/status", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adultUser2.token}` },
      body: { status: "paused" },
    });

    assert.equal(pauseRes.status, 200);
    assert.equal(pauseRes.body.status, "paused");
  });

  test("12. Unmatching ends the active match", async () => {
    const res = await apiRequest(`/api/dating/matches/${createdMatchId}/unmatch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adultUser1.token}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const matchesRes = await apiRequest("/api/dating/matches", {
      headers: { Authorization: `Bearer ${adultUser1.token}` },
    });
    assert.equal(matchesRes.status, 200);
    assert.equal(matchesRes.body.length, 0);
  });

  test("13. Creating profile with null bio and empty photo array succeeds gracefully", async () => {
    const dawit = await createTestUser({
      name: "Dawit",
      email: `dawit_${Date.now()}@dating-a.edu`,
      role: "student",
      universityId: uniA.id,
    });

    const res = await apiRequest("/api/dating/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${dawit.token}` },
      body: {
        birthDate: "2001-03-10",
        adultConfirmed: true,
        displayName: "Dawit",
        gender: "male",
        department: null,
        academicYear: "2nd Year",
        bio: null, // Null bio from empty form must not trigger 400
        interests: [],
        avatarUrl: null,
        photos: [],
      },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.profile);
    assert.equal(res.body.profile.displayName, "Dawit");
    assert.equal(res.body.profile.bio, "");
    assert.ok(res.body.profile.avatarUrl); // Falls back to default avatar
  });

  test("14. GET /api/dating/profile loads persisted profile correctly", async () => {
    const res = await apiRequest("/api/dating/profile", {
      headers: { Authorization: `Bearer ${adultUser1.token}` },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.profile);
    assert.equal(res.body.profile.displayName, "Helen");
    assert.equal(res.body.profile.department, "Software Engineering");
    assert.equal(res.body.profile.academicYear, "4th Year");
  });

  test("15. Editing profile via PUT /api/dating/profile updates and persists in PostgreSQL", async () => {
    const res = await apiRequest("/api/dating/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${adultUser1.token}` },
      body: {
        birthDate: "2002-05-15",
        adultConfirmed: true,
        displayName: "Helen Updated",
        gender: "female",
        department: "Computer Science",
        academicYear: "5th Year",
        bio: "Updated bio with new research interests.",
        interests: ["Tech & Coding", "Reading", "Travel"],
      },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.profile);
    assert.equal(res.body.profile.displayName, "Helen Updated");
    assert.equal(res.body.profile.department, "Computer Science");
    assert.equal(res.body.profile.bio, "Updated bio with new research interests.");

    // Direct DB verification
    const dbCheck = await db.query(
      "SELECT display_name, department, bio FROM dating_profiles WHERE user_id = $1",
      [adultUser1.user.id]
    );
    assert.equal(dbCheck.rows[0].display_name, "Helen Updated");
    assert.equal(dbCheck.rows[0].department, "Computer Science");
    assert.equal(dbCheck.rows[0].bio, "Updated bio with new research interests.");
  });

  test("16. Re-verifies underage account remains strictly blocked (age < 18)", async () => {
    const res = await apiRequest("/api/dating/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${underageUser.token}` },
      body: {
        birthDate: "2010-01-01", // 16 years old
        adultConfirmed: true,
        displayName: "Underage Student",
        gender: "male",
      },
    });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes("at least 18"));
  });
});
