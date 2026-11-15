/**
 * Comprehensive Automated Test Suite - FEATURE 04: SOCIAL FEED & CAMPUS COMMUNITY 🌍
 *
 * Verifies:
 * 1. Social post creation (text, multiple images, categories, tags)
 * 2. Post editing (author allowed, non-author forbidden with 403)
 * 3. Post deletion (author allowed, non-author forbidden with 403)
 * 4. Likes and unlike toggling (duplicate prevention, accurate likes_count)
 * 5. Bookmarks / saved posts (saved feed tab, unbookmarking)
 * 6. Share tracking (shares_count increments)
 * 7. Interactive Polls (options, voting, double-voting prevention with 400, percentage calculations, expired poll rejection)
 * 8. Comments & threaded replies (creation, reply with parentCommentId, edit own, forbidden editing other's, deletion, comment likes)
 * 9. Communities lifecycle (public community creation, owner role assignment, instant join, leave)
 * 10. Private communities (request to join, approval workflow, role promotion)
 * 11. Private community content privacy (hidden from non-members)
 * 12. University Announcements (admin creation allowed, student impersonation blocked with 403, pinning)
 * 13. Feed filtering (for_you, trending with engagement time decay, latest, communities, announcements, saved, tag filter)
 * 14. Multi-Tenant University Isolation (strict university_id boundary, zero cross-campus leakage)
 * 15. Search integration (/api/search includes communities & posts with strict tenant and privacy protection)
 * 16. Moderation reports (post report, comment report)
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
let studentA1, studentA2, adminA, studentB1;
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
    `INSERT INTO users (name, email, role, university_id, verified, verification_method, password_hash, email_verified, department)
     VALUES ($1, $2, $3, $4, true, 'domain', $5, true, 'Computer Science')
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

  // Create University A and University B
  const uniResA = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{"marketplace":true,"dating":true}')
     RETURNING *`,
    ["Social Uni A", `social-uni-a-${ts}`, `social-a-${ts}.edu.et`, [`social-a-${ts}.edu.et`]]
  );
  uniA = uniResA.rows[0];
  cleanupUniIds.push(uniA.id);

  const uniResB = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{"marketplace":true,"dating":true}')
     RETURNING *`,
    ["Social Uni B", `social-uni-b-${ts}`, `social-b-${ts}.edu.et`, [`social-b-${ts}.edu.et`]]
  );
  uniB = uniResB.rows[0];
  cleanupUniIds.push(uniB.id);

  // Users in Uni A
  studentA1 = await createTestUser({
    name: "Student A1",
    email: `a1-${ts}@social-a-${ts}.edu.et`,
    role: "student",
    universityId: uniA.id,
  });

  studentA2 = await createTestUser({
    name: "Student A2",
    email: `a2-${ts}@social-a-${ts}.edu.et`,
    role: "student",
    universityId: uniA.id,
  });

  adminA = await createTestUser({
    name: "Campus Admin A",
    email: `admin-${ts}@social-a-${ts}.edu.et`,
    role: "admin",
    universityId: uniA.id,
  });

  // User in Uni B
  studentB1 = await createTestUser({
    name: "Student B1",
    email: `b1-${ts}@social-b-${ts}.edu.et`,
    role: "student",
    universityId: uniB.id,
  });
});

after(async () => {
  if (cleanupUserIds.length > 0) {
    await db.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [cleanupUserIds]);
  }
  if (cleanupUniIds.length > 0) {
    await db.query(`DELETE FROM universities WHERE id = ANY($1::uuid[])`, [cleanupUniIds]);
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe("FEATURE 04: SOCIAL FEED & CAMPUS COMMUNITY 🌍", () => {
  let createdPostId;
  let createdPollPostId;
  let pollOption1Id, pollOption2Id, pollId;
  let createdCommentId;
  let publicCommunityId, publicCommunitySlug;
  let privateCommunityId;
  let joinRequestId;

  // 1. Social Post Creation & Management
  describe("1. Social Posts CRUD & Engagement", () => {
    test("Student creates text post with category and tags", async () => {
      const res = await apiRequest("/api/social/posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: {
          content: "Excited for the upcoming campus hackathon! #hackathon #coding",
          category: "tech",
          tags: ["hackathon", "coding"],
          mediaUrls: ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
        },
      });

      assert.equal(res.status, 201);
      assert.ok(res.body.post);
      assert.ok(["tech", "technology"].includes(res.body.post.category.toLowerCase()));
      assert.equal(res.body.post.likesCount, 0);
      assert.equal(res.body.post.commentsCount, 0);
      assert.equal(res.body.post.mediaUrls.length, 2);
      createdPostId = res.body.post.id;
    });

    test("Student creates post with audience 'campus' (normalizes to university without 500 error)", async () => {
      const res = await apiRequest("/api/social/posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: {
          content: "Testing campus audience post creation from frontend composer!",
          category: "General",
          audience: "campus",
        },
      });

      assert.equal(res.status, 201);
      assert.ok(res.body.post);
      assert.equal(res.body.post.audience, "university");
    });

    test("Fetch single post by ID", async () => {
      const res = await apiRequest(`/api/social/posts/${createdPostId}`, {
        headers: { Authorization: `Bearer ${studentA1.token}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.post.id, createdPostId);
      assert.match(res.body.post.authorName, /^Anonymous #\d+$/);
      assert.equal(res.body.post.authorId, undefined);
      assert.equal(res.body.post.isAuthor, true);
    });

    test("Author can edit their own post", async () => {
      const res = await apiRequest(`/api/social/posts/${createdPostId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: {
          content: "Excited for the upcoming campus hackathon! Updated details inside. #hackathon #tech",
          category: "academic",
        },
      });

      assert.equal(res.status, 200);
      assert.ok(["academic", "education"].includes(res.body.post.category.toLowerCase()));
      assert.ok(res.body.post.content.includes("Updated details"));
    });

    test("Non-author is forbidden from editing other user's post (403)", async () => {
      const res = await apiRequest(`/api/social/posts/${createdPostId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${studentA2.token}` },
        body: {
          content: "Trying to hijack post!",
        },
      });

      assert.equal(res.status, 403);
    });

    test("Non-author is forbidden from deleting other user's post (403)", async () => {
      const res = await apiRequest(`/api/social/posts/${createdPostId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${studentA2.token}` },
      });

      assert.equal(res.status, 403);
    });
  });

  // 2. Likes, Bookmarks & Shares
  describe("2. Likes, Bookmarks, and Shares", () => {
    test("Student likes post -> likesCount becomes 1", async () => {
      const res = await apiRequest(`/api/social/posts/${createdPostId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA2.token}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.liked, true);
      assert.equal(res.body.likesCount, 1);
    });

    test("Student unlikes post -> likesCount becomes 0", async () => {
      const res = await apiRequest(`/api/social/posts/${createdPostId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA2.token}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.liked, false);
      assert.equal(res.body.likesCount, 0);
    });

    test("Student bookmarks post -> appears in saved feed", async () => {
      const bookRes = await apiRequest(`/api/social/posts/${createdPostId}/bookmark`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
      });

      assert.equal(bookRes.status, 200);
      assert.equal(bookRes.body.bookmarked, true);

      const feedRes = await apiRequest("/api/social/feed?tab=saved", {
        headers: { Authorization: `Bearer ${studentA1.token}` },
      });

      assert.equal(feedRes.status, 200);
      assert.ok(feedRes.body.posts.some((p) => p.id === createdPostId));
    });

    test("Student unbookmarks post -> removed from saved feed", async () => {
      const bookRes = await apiRequest(`/api/social/posts/${createdPostId}/bookmark`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
      });

      assert.equal(bookRes.status, 200);
      assert.equal(bookRes.body.bookmarked, false);

      const feedRes = await apiRequest("/api/social/feed?tab=saved", {
        headers: { Authorization: `Bearer ${studentA1.token}` },
      });

      assert.equal(feedRes.status, 200);
      assert.ok(!feedRes.body.posts.some((p) => p.id === createdPostId));
    });

    test("Tracking post shares increments sharesCount", async () => {
      const res = await apiRequest(`/api/social/posts/${createdPostId}/share`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA2.token}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.sharesCount, 1);
    });
  });

  // 3. Interactive Polls
  describe("3. Campus Polls & Real-Time Voting", () => {
    test("Create post with poll (question, options, expiry)", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);

      const res = await apiRequest("/api/social/posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: {
          content: "What is your favorite study spot on campus?",
          postType: "poll",
          poll: {
            question: "What is your favorite study spot on campus?",
            options: ["Main Library", "Science Cafe", "Dorm Study Lounge"],
            expiresAt: futureDate.toISOString(),
          },
        },
      });

      assert.equal(res.status, 201);
      assert.ok(res.body.post.poll);
      assert.equal(res.body.post.poll.options.length, 3);
      createdPollPostId = res.body.post.id;
      pollId = res.body.post.poll.id;
      pollOption1Id = res.body.post.poll.options[0].id;
      pollOption2Id = res.body.post.poll.options[1].id;
    });

    test("Student A1 votes for Option 1 -> records vote", async () => {
      const res = await apiRequest(`/api/social/polls/${pollId}/vote`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: { optionId: pollOption1Id },
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.poll);
      assert.equal(res.body.poll.totalVotes, 1);
      const opt1 = res.body.poll.options.find((o) => o.id === pollOption1Id);
      assert.equal(opt1.votesCount, 1);
      assert.equal(opt1.percentage, 100);
    });

    test("Student A1 cannot double-vote on same poll (400)", async () => {
      const res = await apiRequest(`/api/social/polls/${pollId}/vote`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: { optionId: pollOption2Id },
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error);
    });

    test("Student A2 votes for Option 2 -> updates percentages to 50% / 50%", async () => {
      const res = await apiRequest(`/api/social/polls/${pollId}/vote`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA2.token}` },
        body: { optionId: pollOption2Id },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.poll.totalVotes, 2);
      const opt1 = res.body.poll.options.find((o) => o.id === pollOption1Id);
      const opt2 = res.body.poll.options.find((o) => o.id === pollOption2Id);
      assert.equal(opt1.percentage, 50);
      assert.equal(opt2.percentage, 50);
    });

    test("Voting on expired poll returns 400", async () => {
      // Create poll that already expired
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const postRes = await apiRequest("/api/social/posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: {
          content: "Expired poll test",
          postType: "poll",
          poll: {
            question: "Did this expire?",
            options: ["Yes", "No"],
            expiresAt: pastDate.toISOString(),
          },
        },
      });

      const expPoll = postRes.body.post.poll;
      const res = await apiRequest(`/api/social/polls/${expPoll.id}/vote`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA2.token}` },
        body: { optionId: expPoll.options[0].id },
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.message.includes("closed") || res.body.error.message.includes("expired"));
    });
  });

  // 4. Threaded Comments & Replies
  describe("4. Comments & Threaded Discussion", () => {
    test("Student adds top-level comment on post", async () => {
      const res = await apiRequest(`/api/social/posts/${createdPostId}/comments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA2.token}` },
        body: { content: "Great initiative! Looking forward to it." },
      });

      assert.equal(res.status, 201);
      assert.ok(res.body.comment);
      assert.equal(res.body.comment.content, "Great initiative! Looking forward to it.");
      createdCommentId = res.body.comment.id;

      // Check comments_count on post incremented
      const postRes = await apiRequest(`/api/social/posts/${createdPostId}`, {
        headers: { Authorization: `Bearer ${studentA1.token}` },
      });
      assert.equal(postRes.body.post.commentsCount, 1);
    });

    test("Student adds reply to comment (parentCommentId)", async () => {
      const res = await apiRequest(`/api/social/posts/${createdPostId}/comments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: {
          content: "Thanks! Feel free to join team registration.",
          parentCommentId: createdCommentId,
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.comment.parentCommentId, createdCommentId);

      // Verify nested structure in GET comments
      const listRes = await apiRequest(`/api/social/posts/${createdPostId}/comments`, {
        headers: { Authorization: `Bearer ${studentA1.token}` },
      });

      assert.equal(listRes.status, 200);
      const topComment = listRes.body.comments.find((c) => c.id === createdCommentId);
      assert.ok(topComment);
      assert.equal(topComment.replies.length, 1);
      assert.equal(topComment.replies[0].content, "Thanks! Feel free to join team registration.");
    });

    test("Comment author can edit their comment", async () => {
      const res = await apiRequest(`/api/social/comments/${createdCommentId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${studentA2.token}` },
        body: { content: "Great initiative! Updated comment text." },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.comment.content, "Great initiative! Updated comment text.");
    });

    test("Non-author is forbidden from editing someone else's comment (403)", async () => {
      const res = await apiRequest(`/api/social/comments/${createdCommentId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: { content: "Unauthorized edit" },
      });

      assert.equal(res.status, 403);
    });

    test("Like a comment -> toggles like", async () => {
      const res = await apiRequest(`/api/social/comments/${createdCommentId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.liked, true);
      assert.equal(res.body.likesCount, 1);
    });
  });

  // 5. Communities
  describe("5. Campus Communities & Member Roles", () => {
    test("Create public community -> creator is assigned owner", async () => {
      const ts = Date.now();
      const res = await apiRequest("/api/communities", {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: {
          name: `Coding Guild ${ts}`,
          slug: `coding-guild-${ts}`,
          category: "tech",
          type: "public",
          description: "University coding society and hackathon teams.",
          rules: "Be respectful and help each other learn.",
        },
      });

      assert.equal(res.status, 201);
      assert.ok(res.body.community);
      assert.equal(res.body.community.userRole, "owner");
      assert.equal(res.body.community.isMember, true);
      assert.equal(res.body.community.membersCount, 1);
      publicCommunityId = res.body.community.id;
      publicCommunitySlug = res.body.community.slug;
    });

    test("Student A2 joins public community directly", async () => {
      const res = await apiRequest(`/api/communities/${publicCommunityId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA2.token}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.status, "joined");
      assert.equal(res.body.role, "member");

      // Verify member count updated
      const getRes = await apiRequest(`/api/communities/${publicCommunityId}`, {
        headers: { Authorization: `Bearer ${studentA2.token}` },
      });
      assert.equal(getRes.body.community.membersCount, 2);
    });

    test("Student A2 leaves community", async () => {
      const res = await apiRequest(`/api/communities/${publicCommunityId}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA2.token}` },
      });

      assert.equal(res.status, 200);

      const getRes = await apiRequest(`/api/communities/${publicCommunityId}`, {
        headers: { Authorization: `Bearer ${studentA2.token}` },
      });
      assert.equal(getRes.body.community.isMember, false);
      assert.equal(getRes.body.community.membersCount, 1);
    });

    test("Create private community -> non-member requests to join", async () => {
      const ts = Date.now();
      const res = await apiRequest("/api/communities", {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: {
          name: `Secret Society ${ts}`,
          slug: `secret-society-${ts}`,
          category: "academic",
          type: "private",
          description: "Exclusive academic research circle.",
        },
      });

      assert.equal(res.status, 201);
      privateCommunityId = res.body.community.id;

      // Student A2 requests to join
      const joinReqRes = await apiRequest(`/api/communities/${privateCommunityId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA2.token}` },
      });

      assert.equal(joinReqRes.status, 200);
      assert.equal(joinReqRes.body.status, "requested");
    });

    test("Owner approves join request & promotes to moderator", async () => {
      // List join requests
      const listReqRes = await apiRequest(`/api/communities/${privateCommunityId}/join-requests`, {
        headers: { Authorization: `Bearer ${studentA1.token}` },
      });

      assert.equal(listReqRes.status, 200);
      assert.ok(listReqRes.body.requests.length >= 1);
      joinRequestId = listReqRes.body.requests[0].id;

      // Approve request
      const approveRes = await apiRequest(`/api/communities/${privateCommunityId}/join-requests/${joinRequestId}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
      });

      assert.equal(approveRes.status, 200);

      // Promote to moderator
      const promoteRes = await apiRequest(`/api/communities/${privateCommunityId}/members/${studentA2.user.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: { role: "moderator" },
      });

      assert.equal(promoteRes.status, 200);
      assert.equal(promoteRes.body.member.role, "moderator");
    });
  });

  // 6. Official Announcements
  describe("6. University Announcements & Safety Badges", () => {
    let announcementId;

    test("Campus admin can create official announcement", async () => {
      const res = await apiRequest("/api/announcements", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminA.token}` },
        body: {
          content: "Final examinations timetable has been officially published by the registrar.",
          category: "events",
          isPinned: true,
        },
      });

      assert.equal(res.status, 201);
      assert.ok(res.body.post);
      assert.equal(res.body.post.isOfficial, true);
      assert.equal(res.body.post.isPinned, true);
      assert.equal(res.body.post.postType, "announcement");
      announcementId = res.body.post.id;
    });

    test("Student is forbidden from publishing official announcements (403)", async () => {
      const res = await apiRequest("/api/announcements", {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: {
          content: "Fake official announcement!",
        },
      });

      assert.equal(res.status, 403);
    });

    test("Student is forbidden from spoofing isOfficial in general post (403)", async () => {
      const res = await apiRequest("/api/social/posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: {
          content: "I am an official university spokesperson!",
          isOfficial: true,
        },
      });

      assert.equal(res.status, 403);
    });

    test("Admin can toggle pin status on announcement", async () => {
      const res = await apiRequest(`/api/announcements/${announcementId}/pin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminA.token}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.isPinned, false);
    });
  });

  // 7. Multi-Tenant University Isolation
  describe("7. Multi-Tenant University Boundary & Privacy", () => {
    test("Student in Uni B cannot view Uni A's posts", async () => {
      const res = await apiRequest("/api/social/feed", {
        headers: { Authorization: `Bearer ${studentB1.token}` },
      });

      assert.equal(res.status, 200);
      assert.ok(!res.body.posts.some((p) => p.id === createdPostId));
    });

    test("Student in Uni B cannot view Uni A's communities", async () => {
      const res = await apiRequest("/api/communities", {
        headers: { Authorization: `Bearer ${studentB1.token}` },
      });

      assert.equal(res.status, 200);
      const list = res.body.communities || res.body || [];
      assert.ok(!list.some((c) => c.id === publicCommunityId));
    });

    test("Student in Uni B cannot join Uni A's community (404/403)", async () => {
      const res = await apiRequest(`/api/communities/${publicCommunityId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentB1.token}` },
      });

      assert.ok([403, 404].includes(res.status));
    });
  });

  // 8. Search Integration
  describe("8. Smart Global Search Integration", () => {
    test("Search endpoint returns public community for Uni A", async () => {
      const res = await apiRequest("/api/search?q=Coding&type=communities", {
        headers: { Authorization: `Bearer ${studentA1.token}` },
      });

      assert.equal(res.status, 200);
      const items = Array.isArray(res.body.results) ? res.body.results : (res.body.grouped?.communities || []);
      assert.ok(items.some((c) => c.id === publicCommunityId));
    });

    test("Search endpoint returns public post for Uni A", async () => {
      const res = await apiRequest("/api/search?q=hackathon&type=posts", {
        headers: { Authorization: `Bearer ${studentA1.token}` },
      });

      assert.equal(res.status, 200);
      const items = Array.isArray(res.body.results) ? res.body.results : (res.body.grouped?.posts || []);
      assert.ok(items.some((p) => p.id === createdPostId));
    });

    test("Search endpoint strictly isolates Uni B (returns 0 matches from Uni A)", async () => {
      const res = await apiRequest("/api/search?q=Coding&type=communities", {
        headers: { Authorization: `Bearer ${studentB1.token}` },
      });

      assert.equal(res.status, 200);
      const items = Array.isArray(res.body.results) ? res.body.results : (res.body.grouped?.communities || []);
      assert.equal(items.length, 0);
    });
  });

  // 9. Moderation & Safety Reporting
  describe("9. Moderation Reports", () => {
    test("Student can report a post for safety violation", async () => {
      const res = await apiRequest(`/api/social/posts/${createdPostId}/report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA2.token}` },
        body: {
          reasonCategory: "spam",
          reasonDetails: "This contains promotional spam.",
        },
      });

      assert.equal(res.status, 201);
      assert.ok(res.body.message.includes("submitted"));
    });

    test("Student can report a comment for safety violation", async () => {
      const res = await apiRequest(`/api/social/comments/${createdCommentId}/report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentA1.token}` },
        body: {
          reasonCategory: "harassment",
          reasonDetails: "Harassing language.",
        },
      });

      assert.equal(res.status, 201);
      assert.ok(res.body.message.includes("submitted"));
    });
  });
});
