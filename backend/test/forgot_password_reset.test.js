const { describe, test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const crypto = require("crypto");

require("dotenv").config();

const app = require("../src/app");
const db = require("../src/db");
const mailer = require("../src/utils/mailer");
const { hashPassword } = require("../src/utils/hash");
const { hashToken, generateRefreshToken } = require("../src/utils/jwt");

let server;
let baseUrl;
let capturedEmails = [];
const originalSendMail = mailer.sendMail;

let testUniversityId;
let testUser;

async function apiRequest(endpoint, { method = "GET", headers = {}, body } = {}) {
  const reqHeaders = { ...headers };
  let payload = undefined;

  if (body !== undefined) {
    payload = JSON.stringify(body);
    reqHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: reqHeaders,
    body: payload,
  });

  const contentType = res.headers.get("content-type") || "";
  let data = null;
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, headers: res.headers, data };
}

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Capture emails during test execution
  mailer.sendMail = async (opts) => {
    capturedEmails.push(opts);
    return { delivered: true, messageId: `msg-${Date.now()}` };
  };

  const { rows: uRows } = await db.query(
    "SELECT id FROM universities WHERE domain = 'aastu.edu.et' LIMIT 1"
  );
  assert.ok(uRows[0], "AASTU university must exist");
  testUniversityId = uRows[0].id;

  // Clean old test records
  await db.query(
    "DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email = 'pw_reset_test@aastu.edu.et')"
  );
  await db.query("DELETE FROM users WHERE email = 'pw_reset_test@aastu.edu.et'");

  const pwHash = await hashPassword("InitialPassword123!");
  const { rows } = await db.query(
    `INSERT INTO users (university_id, name, email, password_hash, role, verified, email_verified)
     VALUES ($1, 'Reset Test Student', 'pw_reset_test@aastu.edu.et', $2, 'student', true, true)
     RETURNING *`,
    [testUniversityId, pwHash]
  );
  testUser = rows[0];
});

after(async () => {
  mailer.sendMail = originalSendMail;
  if (testUser) {
    await db.query("DELETE FROM refresh_tokens WHERE user_id = $1", [testUser.id]);
    await db.query("DELETE FROM users WHERE id = $1", [testUser.id]);
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await db.pool.end();
});

beforeEach(async () => {
  capturedEmails = [];
  if (testUser) {
    const pwHash = await hashPassword("InitialPassword123!");
    await db.query(
      "UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2",
      [pwHash, testUser.id]
    );
  }
});

describe("Forgot Password & Password Reset — Full Verification Suite", () => {
  test("Test 1: Existing user enters their email -> Generic success response & reset email generated", async () => {
    const res = await apiRequest("/api/auth/forgot-password", {
      method: "POST",
      body: { email: "pw_reset_test@aastu.edu.et" },
    });

    assert.equal(res.status, 200);
    assert.equal(
      res.data.message,
      "If that email is registered, a password reset link has been sent."
    );
    // Raw token must never be in JSON response
    assert.equal(res.data.resetToken, undefined);
    assert.equal(res.data.devResetToken, undefined);

    // Verify email was generated
    assert.equal(capturedEmails.length, 1);
    const mail = capturedEmails[0];
    assert.equal(mail.to, "pw_reset_test@aastu.edu.et");
    assert.match(mail.subject, /Reset your Gibiyachin password/i);
    assert.match(mail.text, /reset-password\?token=([a-f0-9]{64})/);

    // Verify hashed token in database
    const tokenMatch = mail.text.match(/token=([a-f0-9]{64})/);
    const rawToken = tokenMatch[1];
    const { rows } = await db.query(
      "SELECT password_reset_token, password_reset_expires FROM users WHERE id = $1",
      [testUser.id]
    );
    assert.equal(rows[0].password_reset_token, hashToken(rawToken));
    assert.ok(new Date(rows[0].password_reset_expires) > new Date());
  });

  test("Test 2: Non-existing email -> Same generic response & no account information leaked", async () => {
    const res = await apiRequest("/api/auth/forgot-password", {
      method: "POST",
      body: { email: "totally_unknown_ghost_account_xyz@aastu.edu.et" },
    });

    assert.equal(res.status, 200);
    assert.equal(
      res.data.message,
      "If that email is registered, a password reset link has been sent."
    );
    assert.equal(capturedEmails.length, 0, "No email dispatched for unknown user");
  });

  test("Test 3: Valid reset link -> Password successfully changed", async () => {
    await apiRequest("/api/auth/forgot-password", {
      method: "POST",
      body: { email: testUser.email },
    });

    const rawToken = capturedEmails[0].text.match(/token=([a-f0-9]{64})/)[1];
    const newPassword = "NewlyUpdatedPassword2026!";

    const resetRes = await apiRequest("/api/auth/reset-password", {
      method: "POST",
      body: { token: rawToken, newPassword },
    });

    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.data.success, true);
    assert.match(resetRes.data.message, /Password updated successfully/i);

    // Verify old password fails
    const oldLogin = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: testUser.email, password: "InitialPassword123!" },
    });
    assert.equal(oldLogin.status, 401);

    // Verify new password succeeds
    const newLogin = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: testUser.email, password: newPassword },
    });
    assert.equal(newLogin.status, 200);
    assert.ok(newLogin.data.accessToken);
  });

  test("Test 4: Expired token -> Reset rejected with HTTP 400", async () => {
    const expiredToken = crypto.randomBytes(32).toString("hex");
    await db.query(
      "UPDATE users SET password_reset_token = $1, password_reset_expires = now() - interval '5 minutes' WHERE id = $2",
      [hashToken(expiredToken), testUser.id]
    );

    const res = await apiRequest("/api/auth/reset-password", {
      method: "POST",
      body: { token: expiredToken, newPassword: "SomeValidPassword123!" },
    });

    assert.equal(res.status, 400);
    assert.match(res.data.error.message, /invalid or expired reset token/i);
  });

  test("Test 5: Invalid / forged token -> Reset rejected with HTTP 400", async () => {
    const res = await apiRequest("/api/auth/reset-password", {
      method: "POST",
      body: { token: "forged_non_existent_token_1234567890", newPassword: "SomeValidPassword123!" },
    });

    assert.equal(res.status, 400);
    assert.match(res.data.error.message, /invalid or expired reset token/i);
  });

  test("Test 6: Reuse the same token after successful reset -> Rejected (single-use enforced)", async () => {
    await apiRequest("/api/auth/forgot-password", {
      method: "POST",
      body: { email: testUser.email },
    });

    const rawToken = capturedEmails[0].text.match(/token=([a-f0-9]{64})/)[1];

    // First reset: succeeds
    const res1 = await apiRequest("/api/auth/reset-password", {
      method: "POST",
      body: { token: rawToken, newPassword: "FirstNewPassword123!" },
    });
    assert.equal(res1.status, 200);

    // Second reset using the same token: must be rejected
    const res2 = await apiRequest("/api/auth/reset-password", {
      method: "POST",
      body: { token: rawToken, newPassword: "SecondNewPassword123!" },
    });
    assert.equal(res2.status, 400);
    assert.match(res2.data.error.message, /invalid or expired reset token/i);
  });

  test("Test 7: Missing token -> Rejected with validation error", async () => {
    const res = await apiRequest("/api/auth/reset-password", {
      method: "POST",
      body: { token: "", newPassword: "ValidPassword123!" },
    });

    assert.equal(res.status, 400);
    assert.match(res.data.error.message, /Reset token is required/i);
  });

  test("Test 8: Weak password (< 8 chars) -> Rejected with validation error", async () => {
    const res = await apiRequest("/api/auth/reset-password", {
      method: "POST",
      body: { token: "valid_looking_token_string", newPassword: "short" },
    });

    assert.equal(res.status, 400);
    assert.match(res.data.error.message, /Password must be at least 8 characters/i);
  });

  test("Test 9: Repeated forgot-password requests -> Rate limiting triggers 429", async () => {
    const email = "rate_limit_pw_test@aastu.edu.et";
    let hitRateLimit = false;

    // Send 6 rapid requests (rate limit is max 5 per 60s per IP:email)
    for (let i = 0; i < 6; i++) {
      const res = await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      if (res.status === 429) {
        hitRateLimit = true;
        assert.equal(res.data.error.code, "RATE_LIMITED");
        break;
      }
    }

    assert.ok(hitRateLimit, "Expected rate limit (HTTP 429) to trigger on repeated requests");
  });

  test("Test 10: Successful password reset revokes all existing refresh tokens", async () => {
    // Issue two active refresh tokens for the test user
    const rt1 = generateRefreshToken();
    const rt2 = generateRefreshToken();
    const fam = crypto.randomUUID();

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
       VALUES ($1, $2, $3, now() + interval '30 days'),
              ($1, $4, $3, now() + interval '30 days')`,
      [testUser.id, hashToken(rt1), fam, hashToken(rt2)]
    );

    // Request reset
    await apiRequest("/api/auth/forgot-password", {
      method: "POST",
      body: { email: testUser.email },
    });
    const rawToken = capturedEmails[0].text.match(/token=([a-f0-9]{64})/)[1];

    // Execute reset
    await apiRequest("/api/auth/reset-password", {
      method: "POST",
      body: { token: rawToken, newPassword: "RevokedTokensPassword123!" },
    });

    // Check that all refresh tokens for this user are revoked
    const { rows } = await db.query(
      "SELECT revoked FROM refresh_tokens WHERE user_id = $1",
      [testUser.id]
    );
    assert.ok(rows.length >= 2);
    for (const r of rows) {
      assert.equal(r.revoked, true, "All existing sessions must be revoked");
    }
  });

  test("Test 11: Real email provider configuration audit check", () => {
    // Tests that mailer correctly identifies whether an SMTP host is configured
    const configured = mailer.isEmailConfigured();
    assert.equal(typeof configured, "boolean");
    // In this development environment without EMAIL_HOST, configured is false
    assert.equal(configured, Boolean(process.env.EMAIL_HOST));
  });
});

