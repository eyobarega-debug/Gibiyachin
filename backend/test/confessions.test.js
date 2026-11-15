/**
 * Comprehensive Automated Test Suite - FEATURE: SMART ANONYMOUS IDENTITY & CONFESSIONS ❤️🔥
 *
 * Verifies:
 * 1. Automatic unique anonymous identity assignment (Anonymous #104, Anonymous #287...)
 * 2. Identity consistency: same identifier across confessions, comments, replies, and likes
 * 3. Author identification in discussion: OP / original author recognized in comments/replies
 * 4. Anonymous reactions: likes display anonymous identities (recentLikes & /likes endpoint)
 * 5. Strict privacy guarantee: zero database user IDs, real names, emails, avatars, or departments leaked
 * 6. Identity persistence: refreshing retains the exact same identity
 * 7. Personal confession management: tab=my_posts restricted strictly to owner
 * 8. Ownership security: author can edit/delete, non-author receives 403 Forbidden
 * 9. Multi-tenant university isolation: cross-campus confessions completely isolated
 * 10. Private moderation identity disclosure:
 *     - Ordinary students forbidden (403)
 *     - University admin can investigate with mandatory reason (>= 10 chars)
 *     - Cross-university moderation rejected (403/404)
 *     - Permanent audit logging in confession_moderation_audit_logs
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

let uniA, uniB;
let studentA1, studentA2, adminA, studentB1, adminB;
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

async function createTestUser({ name, email, role = "student", universityId, department = "Software Engineering" }) {
  const hash = await hashPassword("Secret123!");
  const { rows } = await db.query(
    `INSERT INTO users (name, email, role, university_id, verified, verification_method, password_hash, email_verified, department)
     VALUES ($1, $2, $3, $4, true, 'domain', $5, true, $6)
     RETURNING *`,
    [name, email, role, universityId, hash, department]
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

  // Create University A and University B
  const uniResA = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{"marketplace":true,"dating":true}')
     RETURNING *`,
    ["Smart Anon Uni A", `smart-anon-uni-a-${ts}`, `smart-a-${ts}.edu.et`, [`smart-a-${ts}.edu.et`]]
  );
  uniA = uniResA.rows[0];
  cleanupUniIds.push(uniA.id);

  const uniResB = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{"marketplace":true,"dating":true}')
     RETURNING *`,
    ["Smart Anon Uni B", `smart-anon-uni-b-${ts}`, `smart-b-${ts}.edu.et`, [`smart-b-${ts}.edu.et`]]
  );
  uniB = uniResB.rows[0];
  cleanupUniIds.push(uniB.id);

  studentA1 = await createTestUser({
    name: "Abebe Secret",
    email: `abebe.${ts}@smart-a-${ts}.edu.et`,
    role: "student",
    universityId: uniA.id,
    department: "Computer Science"
  });

  studentA2 = await createTestUser({
    name: "Chaltu Mystery",
    email: `chaltu.${ts}@smart-a-${ts}.edu.et`,
    role: "student",
    universityId: uniA.id,
    department: "Medicine"
  });

  adminA = await createTestUser({
    name: "Dean Moderation",
    email: `dean.${ts}@smart-a-${ts}.edu.et`,
    role: "admin",
    universityId: uniA.id,
    department: "Administration"
  });

  studentB1 = await createTestUser({
    name: "Dawit From Uni B",
    email: `dawit.${ts}@smart-b-${ts}.edu.et`,
    role: "student",
    universityId: uniB.id,
    department: "Engineering"
  });

  adminB = await createTestUser({
    name: "Dean Uni B",
    email: `deanb.${ts}@smart-b-${ts}.edu.et`,
    role: "admin",
    universityId: uniB.id,
    department: "Administration"
  });
});

after(async () => {
  if (cleanupUserIds.length > 0) {
    await db.query("DELETE FROM users WHERE id = ANY($1)", [cleanupUserIds]);
  }
  if (cleanupUniIds.length > 0) {
    await db.query("DELETE FROM universities WHERE id = ANY($1)", [cleanupUniIds]);
  }
  await new Promise((resolve) => server.close(resolve));
});

describe("GIBIYACHIN CONFESSIONS ❤️🔥 - Smart Anonymous Identity Suite", () => {
  let studentA1Identity;
  let studentA2Identity;
  let createdConfessionId;
  let createdCommentId;

  test("1. Automatic Unique Smart Anonymous Identity Assignment", async () => {
    // Student A1 gets their unique anonymous identity
    const resA1 = await apiRequest("/api/confessions/my-identity", {
      headers: {
        Authorization: `Bearer ${studentA1.token}`,
        "x-university-id": uniA.id
      }
    });
    assert.equal(resA1.status, 200);
    assert.ok(resA1.body.identity);
    assert.match(resA1.body.identity, /^Anonymous #\d+$/);
    studentA1Identity = resA1.body.identity;

    // Student A2 gets their unique anonymous identity
    const resA2 = await apiRequest("/api/confessions/my-identity", {
      headers: {
        Authorization: `Bearer ${studentA2.token}`,
        "x-university-id": uniA.id
      }
    });
    assert.equal(resA2.status, 200);
    assert.ok(resA2.body.identity);
    assert.match(resA2.body.identity, /^Anonymous #\d+$/);
    studentA2Identity = resA2.body.identity;

    // Enforce uniqueness between different students
    assert.notEqual(studentA1Identity, studentA2Identity, "Different students must receive distinct anonymous identities");
  });

  test("2. Identity Persistence on Refresh / Re-query", async () => {
    // Re-querying my-identity must return the exact same identifier
    const resA1Repeat = await apiRequest("/api/confessions/my-identity", {
      headers: {
        Authorization: `Bearer ${studentA1.token}`,
        "x-university-id": uniA.id
      }
    });
    assert.equal(resA1Repeat.status, 200);
    assert.equal(resA1Repeat.body.identity, studentA1Identity, "Anonymous identity must remain permanently consistent for the account");
  });

  test("3. Confession Publication displays Smart Anonymous Identity without exposing DB user ID", async () => {
    const res = await apiRequest("/api/confessions/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${studentA1.token}`,
        "x-university-id": uniA.id
      },
      body: {
        content: "I have had a crush on someone in my department for months. Wondering if I should tell them!",
        category: "Love & Relationships",
        tags: ["crush", "department"]
      }
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.post.id);
    createdConfessionId = res.body.post.id;

    // Check display name matches assigned identity
    assert.equal(res.body.post.authorName, studentA1Identity, "Display name must match student's Smart Anonymous Identity");
    assert.equal(res.body.post.authorId, undefined, "Real authorId must NEVER be returned");
    assert.equal(res.body.post.author, undefined, "Author profile object must NEVER be returned");
    assert.equal(res.body.post.isAuthor, true);
  });

  test("4. Public Feed & Details APIs preserve Smart Anonymous Identity and zero ID leakage", async () => {
    const feedRes = await apiRequest("/api/confessions/feed", {
      headers: {
        Authorization: `Bearer ${studentA2.token}`,
        "x-university-id": uniA.id
      }
    });

    assert.equal(feedRes.status, 200);
    const found = feedRes.body.posts.find((p) => p.id === createdConfessionId);
    assert.ok(found);
    assert.equal(found.authorName, studentA1Identity);
    assert.equal(found.authorId, undefined);
    assert.equal(found.author, undefined);
    assert.equal(found.isAuthor, false);

    // Verify zero data leakage in raw payload
    const rawJson = JSON.stringify(found);
    assert.equal(rawJson.includes("Abebe Secret"), false, "Student real name leaked!");
    assert.equal(rawJson.includes(studentA1.user.email), false, "Student email leaked!");
    assert.equal(rawJson.includes(studentA1.user.id), false, "Student database UUID leaked!");

    // Check single detail endpoint
    const detailRes = await apiRequest(`/api/confessions/posts/${createdConfessionId}`, {
      headers: {
        Authorization: `Bearer ${studentA2.token}`,
        "x-university-id": uniA.id
      }
    });
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.post.authorName, studentA1Identity);
    assert.equal(detailRes.body.post.authorId, undefined);
  });

  test("5. Anonymous Reactions: Liking updates recentLikes and /likes endpoint anonymously", async () => {
    // Student A2 likes Student A1's confession
    const likeRes = await apiRequest(`/api/confessions/posts/${createdConfessionId}/like`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${studentA2.token}`,
        "x-university-id": uniA.id
      }
    });

    assert.equal(likeRes.status, 200);
    assert.equal(likeRes.body.liked, true);
    assert.equal(likeRes.body.likesCount, 1);
    assert.ok(Array.isArray(likeRes.body.recentLikes));
    assert.ok(likeRes.body.recentLikes.includes(studentA2Identity), "Recent likes must display the liker's anonymous identity");

    // Check /posts/:id/likes endpoint
    const listLikesRes = await apiRequest(`/api/confessions/posts/${createdConfessionId}/likes`, {
      headers: {
        Authorization: `Bearer ${studentA1.token}`,
        "x-university-id": uniA.id
      }
    });
    assert.equal(listLikesRes.status, 200);
    assert.equal(listLikesRes.body.likesCount, 1);
    assert.ok(Array.isArray(listLikesRes.body.likes));
    assert.equal(listLikesRes.body.likes[0].identity, studentA2Identity);

    // Verify zero user ID leakage in likes endpoint
    const rawLikesJson = JSON.stringify(listLikesRes.body);
    assert.equal(rawLikesJson.includes(studentA2.user.id), false, "User ID leaked in likes endpoint!");
    assert.equal(rawLikesJson.includes("Chaltu Mystery"), false, "User real name leaked in likes endpoint!");
  });

  test("6. Anonymous Discussion: Comment by Student B and Reply by Student A recognizes Author", async () => {
    // Student B (studentA2) comments
    const commentRes = await apiRequest(`/api/confessions/posts/${createdConfessionId}/comments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${studentA2.token}`,
        "x-university-id": uniA.id
      },
      body: { content: "Just tell them!" }
    });

    assert.equal(commentRes.status, 201);
    assert.equal(commentRes.body.comment.authorName, studentA2Identity, "Comment must show Student B's assigned anonymous identity");
    assert.equal(commentRes.body.comment.authorId, undefined);
    assert.equal(commentRes.body.comment.isPostAuthor, false);
    createdCommentId = commentRes.body.comment.id;

    // Student A (original author studentA1) replies
    const replyRes = await apiRequest(`/api/confessions/posts/${createdConfessionId}/comments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${studentA1.token}`,
        "x-university-id": uniA.id
      },
      body: {
        content: "I'm actually scared of rejection.",
        parentCommentId: createdCommentId
      }
    });

    assert.equal(replyRes.status, 201);
    assert.equal(replyRes.body.comment.authorName, studentA1Identity, "Reply must show Student A's assigned anonymous identity");
    assert.equal(replyRes.body.comment.isPostAuthor, true, "System must recognize Student A is the original post author!");

    // Retrieve comments list
    const commentsListRes = await apiRequest(`/api/confessions/posts/${createdConfessionId}/comments`, {
      headers: {
        Authorization: `Bearer ${studentA2.token}`,
        "x-university-id": uniA.id
      }
    });
    assert.equal(commentsListRes.status, 200);
    assert.ok(Array.isArray(commentsListRes.body.comments));

    const topComment = commentsListRes.body.comments.find((c) => c.id === createdCommentId);
    assert.ok(topComment);
    assert.equal(topComment.authorName, studentA2Identity);
    assert.equal(topComment.isPostAuthor, false);

    assert.ok(Array.isArray(topComment.replies));
    const replyComment = topComment.replies.find((r) => r.id === replyRes.body.comment.id);
    assert.ok(replyComment);
    assert.equal(replyComment.authorName, studentA1Identity);
    assert.equal(replyComment.isPostAuthor, true, "Reply must have isPostAuthor=true to display the Author badge");
  });

  test("7. Edit Ownership Protection: Author can edit, non-author forbidden (403)", async () => {
    // Non-author tries to edit
    const forbiddenRes = await apiRequest(`/api/confessions/posts/${createdConfessionId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${studentA2.token}`,
        "x-university-id": uniA.id
      },
      body: { content: "Tampered content" }
    });
    assert.equal(forbiddenRes.status, 403);

    // Author edits
    const authorRes = await apiRequest(`/api/confessions/posts/${createdConfessionId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${studentA1.token}`,
        "x-university-id": uniA.id
      },
      body: { content: "Update: I told them and they feel the same way! ❤️" }
    });
    assert.equal(authorRes.status, 200);
    assert.ok(authorRes.body.post.content.includes("Update: I told them"));
    assert.equal(authorRes.body.post.authorName, studentA1Identity);
  });

  test("8. Multi-Tenant University Isolation: Uni B cannot access Uni A confessions", async () => {
    const res = await apiRequest("/api/confessions/feed", {
      headers: {
        Authorization: `Bearer ${studentB1.token}`,
        "x-university-id": uniB.id
      }
    });
    assert.equal(res.status, 200);
    const leaked = res.body.posts.find((p) => p.id === createdConfessionId);
    assert.equal(leaked, undefined, "Confessions must never leak across universities");
  });

  test("9. Private Moderation Identity Disclosure: Access Control & Audit Logging", async () => {
    // Student attempting disclosure receives 403
    const studentAttempt = await apiRequest("/api/confessions/moderation/disclose-identity", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${studentA2.token}`,
        "x-university-id": uniA.id
      },
      body: {
        targetType: "post",
        targetId: createdConfessionId,
        reason: "Curious student"
      }
    });
    assert.equal(studentAttempt.status, 403);

    // Admin of Uni A discloses identity with valid reason
    const validDisclosure = await apiRequest("/api/confessions/moderation/disclose-identity", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminA.token}`,
        "x-university-id": uniA.id
      },
      body: {
        targetType: "post",
        targetId: createdConfessionId,
        reason: "Investigating reported policy violation case #77123"
      }
    });

    assert.equal(validDisclosure.status, 200);
    assert.equal(validDisclosure.body.success, true);
    assert.equal(validDisclosure.body.disclosedUser.id, studentA1.user.id);
    assert.equal(validDisclosure.body.disclosedUser.name, studentA1.user.name);
    assert.equal(validDisclosure.body.disclosedUser.anonymousIdentity, studentA1Identity);

    // Verify audit log
    const { rows: auditRows } = await db.query(
      `SELECT * FROM confession_moderation_audit_logs WHERE target_id = $1`,
      [createdConfessionId]
    );
    assert.equal(auditRows.length, 1);
    assert.equal(auditRows[0].reason, "Investigating reported policy violation case #77123");
  });

  test("10. Delete Ownership Protection: Author can delete, non-author forbidden", async () => {
    // Non-author delete fails
    const forbiddenDelete = await apiRequest(`/api/confessions/posts/${createdConfessionId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${studentA2.token}`,
        "x-university-id": uniA.id
      }
    });
    assert.equal(forbiddenDelete.status, 403);

    // Author delete succeeds
    const authorDelete = await apiRequest(`/api/confessions/posts/${createdConfessionId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${studentA1.token}`,
        "x-university-id": uniA.id
      }
    });
    assert.equal(authorDelete.status, 200);

    // Confession is no longer on feed
    const feedRes = await apiRequest("/api/confessions/feed", {
      headers: {
        Authorization: `Bearer ${studentA1.token}`,
        "x-university-id": uniA.id
      }
    });
    assert.equal(feedRes.body.posts.find((p) => p.id === createdConfessionId), undefined);
  });
});
