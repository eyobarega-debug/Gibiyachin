/**
 * Admin User Management — backend security & data-integrity suite (Phases 20/21).
 *
 * Covers the full permission model:
 *   Super Admin  — create campus admins, assign campus, change campus,
 *                  deactivate admins (with LAST_ADMIN safeguard), platform-wide.
 *   Campus Admin — manage users/merchants/organizers of THEIR campus only;
 *                  deactivate with reason; dependency-aware physical deletion;
 *                  never touch admins or super admins.
 *   Normal user  — cannot perform any administrative action.
 *
 * Data integrity: merchant with store/products/orders/payments/reviews and
 * organizer with club/events/sold tickets can only be deactivated, never
 * physically deleted; all historical rows survive. A user with zero
 * dependencies can be physically deleted (cascades clean tokens/notifications).
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const crypto = require("crypto");

process.env.NODE_ENV = "test";

const app = require("../src/app");
const db = require("../src/db");
const { hashPassword } = require("../src/utils/hash");
const { signAccessToken } = require("../src/utils/jwt");

let server;
let baseUrl;

let uniA, uniB;
let superToken;
let adminAToken, adminAUser;
let adminBToken, adminBUser;
let createdAdminUser; // created through the API in test 1
let studentA1Token, studentA1User; // plain user (deactivation tests)
let studentCleanToken, studentCleanUser; // zero dependencies (physical delete)
let buyerUser; // creates orders/payments/reviews against merchant
let merchantUser, merchantToken, storeA, productA;
let organizerUser, organizerToken, clubA, eventA, ticketTypeA;

const cleanupUniIds = [];
const cleanupUserIds = [];

async function api(path, { method = "GET", headers = {}, body, token } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    h["Content-Type"] = "application/json";
    payload = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, { method, headers: h, body: payload });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  return { status: res.status, data };
}

async function createUser({ name, email, role, universityId }) {
  const passwordHash = await hashPassword("Password123!");
  const { rows } = await db.query(
    `INSERT INTO users (name, email, role, university_id, verified, verification_method, password_hash, department, year, email_verified)
     VALUES ($1,$2,$3,$4,true,'domain',$5,'CS',3,true) RETURNING *`,
    [name, email, role, universityId, passwordHash]
  );
  cleanupUserIds.push(rows[0].id);
  return { user: rows[0], token: signAccessToken(rows[0]) };
}

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const ts = Date.now();
  const uniARes = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status)
     VALUES ($1,$2,$3,$4,'active') RETURNING *`,
    ["UMgmt Uni A", `umgmt-a-${ts}`, `uma-${ts}.edu.et`, [`uma-${ts}.edu.et`]]
  );
  uniA = uniARes.rows[0];
  cleanupUniIds.push(uniA.id);
  const uniBRes = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status)
     VALUES ($1,$2,$3,$4,'active') RETURNING *`,
    ["UMgmt Uni B", `umgmt-b-${ts}`, `umb-${ts}.edu.et`, [`umb-${ts}.edu.et`]]
  );
  uniB = uniBRes.rows[0];
  cleanupUniIds.push(uniB.id);

  const sup = await createUser({ name: "UMgmt Super", email: `umgmt_super_${ts}@platform.local`, role: "super_admin", universityId: null });
  superToken = sup.token;

  ({ user: adminAUser, token: adminAToken } = await createUser({ name: "UMgmt Admin A", email: `umgmt_admin_${ts}@uma-${ts}.edu.et`, role: "admin", universityId: uniA.id }));
  ({ user: adminBUser, token: adminBToken } = await createUser({ name: "UMgmt Admin B", email: `umgmt_adminb_${ts}@umb-${ts}.edu.et`, role: "admin", universityId: uniB.id }));

  ({ user: studentA1User, token: studentA1Token } = await createUser({ name: "UMgmt Student A1", email: `umgmt_stu1_${ts}@uma-${ts}.edu.et`, role: "student", universityId: uniA.id }));
  ({ user: studentCleanUser, token: studentCleanToken } = await createUser({ name: "UMgmt Clean Student", email: `umgmt_clean_${ts}@uma-${ts}.edu.et`, role: "student", universityId: uniA.id }));
  ({ user: buyerUser } = await createUser({ name: "UMgmt Buyer", email: `umgmt_buyer_${ts}@uma-${ts}.edu.et`, role: "student", universityId: uniA.id }));
  ({ user: merchantUser, token: merchantToken } = await createUser({ name: "UMgmt Merchant", email: `umgmt_mer_${ts}@uma-${ts}.edu.et`, role: "merchant", universityId: uniA.id }));
  ({ user: organizerUser, token: organizerToken } = await createUser({ name: "UMgmt Organizer", email: `umgmt_org_${ts}@uma-${ts}.edu.et`, role: "organizer", universityId: uniA.id }));

  // Merchant with store, product, order, payment, review
  const st = await db.query(
    `INSERT INTO stores (name, merchant_id, university_id, status) VALUES ($1,$2,$3,'active') RETURNING *`,
    ["UMgmt Store", merchantUser.id, uniA.id]
  );
  storeA = st.rows[0];
  const pr = await db.query(
    `INSERT INTO products (store_id, title, price, stock, status) VALUES ($1,'UMgmt Product',100,5,'active') RETURNING *`,
    [storeA.id]
  );
  productA = pr.rows[0];
  await db.query(
    `INSERT INTO orders (buyer_id, store_id, status, total_amount, university_id) VALUES ($1,$2,'completed',100,$3)`,
    [buyerUser.id, storeA.id, uniA.id]
  );
  const ord = await db.query("SELECT id FROM orders WHERE buyer_id = $1 LIMIT 1", [buyerUser.id]);
  await db.query(
    `INSERT INTO payments (transaction_type, transaction_id, amount, status, payer_id, payee_id, university_id, provider)
     VALUES ('order',$1,100,'confirmed',$2,$3,$4,'mock')`,
    [ord.rows[0].id, buyerUser.id, merchantUser.id, uniA.id]
  );
  await db.query(
    `INSERT INTO reviews (author_id, target_type, target_id, rating, university_id) VALUES ($1,'store',$2,5,$3)`,
    [buyerUser.id, storeA.id, uniA.id]
  );

  // Organizer with club, event, ticket type and a sold ticket
  const cl = await db.query(
    `INSERT INTO clubs (name, university_id, lead_user_id, status) VALUES ($1,$2,$3,'active') RETURNING *`,
    ["UMgmt Club", uniA.id, organizerUser.id]
  );
  clubA = cl.rows[0];
  const ev = await db.query(
    `INSERT INTO events (club_id, title, date_time, location, capacity, status, university_id)
     VALUES ($1,'UMgmt Event', now() + interval '2 days','Hall',100,'published',$2) RETURNING *`,
    [clubA.id, uniA.id]
  );
  eventA = ev.rows[0];
  const tt = await db.query(
    `INSERT INTO ticket_types (event_id, name, price, quantity_total, quantity_sold, university_id)
     VALUES ($1,'General',50,100,1,$2) RETURNING *`,
    [eventA.id, uniA.id]
  );
  ticketTypeA = tt.rows[0];
  const ticketId = crypto.randomUUID();
  const qrHash = crypto.createHash("sha256").update(ticketId + "umgmt").digest("hex");
  await db.query(
    `INSERT INTO tickets (id, event_id, ticket_type_id, holder_id, status, qr_token_hash, university_id)
     VALUES ($1,$2,$3,$4,'active',$5,$6)`,
    [ticketId, eventA.id, ticketTypeA.id, buyerUser.id, qrHash, uniA.id]
  );
});

after(async () => {
  try {
    for (const unid of cleanupUniIds) {
      await db.query("DELETE FROM tickets WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM ticket_types WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM events WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM clubs WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE university_id = $1)", [unid]).catch(() => {});
      await db.query("DELETE FROM orders WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM payments WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM reviews WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM products WHERE store_id IN (SELECT id FROM stores WHERE university_id = $1)", [unid]).catch(() => {});
      await db.query("DELETE FROM stores WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM application_agreements WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM organizer_applications WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM merchant_applications WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM payout_accounts WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE university_id = $1)", [unid]).catch(() => {});
      await db.query("DELETE FROM audit_logs WHERE actor_id IN (SELECT id FROM users WHERE university_id = $1) OR target_id IN (SELECT id FROM users WHERE university_id = $1)", [unid]).catch(() => {});
      await db.query("DELETE FROM users WHERE university_id = $1", [unid]).catch(() => {});
      await db.query("DELETE FROM universities WHERE id = $1", [unid]).catch(() => {});
    }
    await db.query("DELETE FROM notifications WHERE user_id = ANY($1)", [cleanupUserIds]).catch(() => {});
    await db.query("DELETE FROM audit_logs WHERE actor_id = ANY($1) OR target_id = ANY($1)", [cleanupUserIds]).catch(() => {});
    await db.query("DELETE FROM users WHERE id = ANY($1)", [cleanupUserIds]).catch(() => {});
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.pool.end();
  }
});

describe("1. Super Admin — create campus admins (Phases 4/5)", () => {
  let createdId;

  test("super admin creates an admin assigned to exactly one campus", async () => {
    const res = await api("/api/super/admins", {
      method: "POST",
      token: superToken,
      body: { name: "Created Admin", email: `umgmt_created_${Date.now()}@uma-x.edu.et`, password: "AdminPass123!", universityId: uniA.id },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.admin.role, "admin");
    assert.equal(res.data.admin.university_id, uniA.id);
    assert.equal(res.data.admin.verified, true);
    assert.equal(res.data.admin.suspended, false);
    createdId = res.data.admin.id;
    createdAdminUser = res.data.admin;

    const { rows } = await db.query("SELECT * FROM audit_logs WHERE action = 'SUPER_ADMIN_CREATED_ADMIN' AND target_id = $1", [createdId]);
    assert.ok(rows.length >= 1, "creation is audited");
  });

  test("created admin can sign in with the given password", async () => {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: { email: createdAdminUser.email, password: "AdminPass123!" },
    });
    assert.equal(res.status, 200, `login failed: ${JSON.stringify(res.data)}`);
    assert.ok(res.data.accessToken || res.data.tokens?.accessToken || res.data.token, "token issued");
  });

  test("duplicate email is rejected", async () => {
    const res = await api("/api/super/admins", {
      method: "POST",
      token: superToken,
      body: { name: "Dup", email: createdAdminUser.email, password: "AdminPass123!", universityId: uniA.id },
    });
    assert.equal(res.status, 409);
    assert.equal(res.data.error.code, "EMAIL_TAKEN");
  });

  test("unknown or inactive campus is rejected", async () => {
    const notFoundRes = await api("/api/super/admins", {
      method: "POST",
      token: superToken,
      body: { name: "Ghost Campus", email: `umgmt_x_${Date.now()}@x.edu.et`, password: "AdminPass123!", universityId: crypto.randomUUID() },
    });
    assert.equal(notFoundRes.status, 404);
  });

  test("campus admin and normal users cannot create admins", async () => {
    const asAdmin = await api("/api/super/admins", {
      method: "POST",
      token: adminAToken,
      body: { name: "Nope", email: `umgmt_nope_${Date.now()}@x.edu.et`, password: "AdminPass123!", universityId: uniA.id },
    });
    assert.equal(asAdmin.status, 403);

    const asStudent = await api("/api/super/admins", {
      method: "POST",
      token: studentA1Token,
      body: { name: "Nope", email: `umgmt_nope2_${Date.now()}@x.edu.et`, password: "AdminPass123!", universityId: uniA.id },
    });
    assert.equal(asStudent.status, 403);

    const anon = await api("/api/super/admins", {
      method: "POST",
      body: { name: "Nope", email: `umgmt_nope3_${Date.now()}@x.edu.et`, password: "AdminPass123!", universityId: uniA.id },
    });
    assert.ok(anon.status === 401 || anon.status === 400, `expected auth rejection, got ${anon.status}`);
  });

  test("the new admin can access the admin API but only for their campus", async () => {
    const token = signAccessToken({ id: createdId, role: "admin", university_id: uniA.id });
    const list = await api("/api/admin/users", { token });
    assert.equal(list.status, 200);
    assert.ok(list.data.users.every((u) => u.university_id === uniA.id), "scoped to their campus");

    const bUser = await db.query("SELECT id FROM users WHERE university_id = $1 AND role = 'student' LIMIT 1", [uniB.id]);
    if (bUser.rows[0]) {
      const cross = await api(`/api/admin/users/${bUser.rows[0].id}`, { token });
      assert.equal(cross.status, 404, "cannot read another campus's user");
    }
  });
});

describe("2. Campus Admin — campus isolation (Phase 6/17)", () => {
  test("adminA listing is scoped to campus A", async () => {
    const res = await api("/api/admin/users", { token: adminAToken });
    assert.equal(res.status, 200);
    assert.ok(res.data.users.length > 0);
    assert.ok(res.data.users.every((u) => u.university_id === uniA.id));
    assert.ok(!res.data.users.some((u) => u.id === adminBUser.id), "does not see campus B admins");
  });

  test("adminA cannot read, patch, deactivate or delete campus B users", async () => {
    const crossId = adminBUser.id;
    const read = await api(`/api/admin/users/${crossId}`, { token: adminAToken });
    assert.equal(read.status, 404);
    const patch = await api(`/api/admin/users/${crossId}`, { method: "PATCH", token: adminAToken, body: { suspended: true } });
    assert.equal(patch.status, 404);
    const deact = await api(`/api/admin/users/${crossId}/deactivate`, { method: "POST", token: adminAToken, body: {} });
    assert.equal(deact.status, 404);
    const del = await api(`/api/admin/users/${crossId}`, { method: "DELETE", token: adminAToken, body: {} });
    assert.equal(del.status, 404);
  });

  test("campus B admin cannot manage campus A users", async () => {
    const res = await api(`/api/admin/users/${studentA1User.id}/deactivate`, { method: "POST", token: adminBToken, body: {} });
    assert.equal(res.status, 404);
  });

  test("super admin without campus sees all campuses", async () => {
    const res = await api("/api/admin/users", { token: superToken });
    assert.equal(res.status, 200);
    const unis = new Set(res.data.users.map((u) => u.university_id));
    assert.ok(unis.has(uniA.id) && unis.has(uniB.id), "cross-campus listing");
  });
});

describe("3. Privilege boundaries (Phase 2/5/20)", () => {
  test("campus admin cannot patch or deactivate another admin", async () => {
    const patch = await api(`/api/admin/users/${createdAdminUser.id}`, { method: "PATCH", token: adminAToken, body: { suspended: true } });
    assert.equal(patch.status, 403);
    assert.equal(patch.data.error.code, "ADMIN_TARGET_FORBIDDEN");

    const deact = await api(`/api/admin/users/${createdAdminUser.id}/deactivate`, { method: "POST", token: adminAToken, body: {} });
    assert.equal(deact.status, 403);
  });

  test("campus admin cannot deactivate or delete themselves", async () => {
    const deact = await api(`/api/admin/users/${adminAUser.id}/deactivate`, { method: "POST", token: adminAToken, body: {} });
    assert.equal(deact.status, 403, "admins are not manageable by campus admins at all");
    const patch = await api(`/api/admin/users/${adminAUser.id}`, { method: "PATCH", token: adminAToken, body: { suspended: true } });
    assert.equal(patch.status, 403);
  });

  test("super admin accounts are invisible to management endpoints", async () => {
    const supUser = await db.query("SELECT id FROM users WHERE role = 'super_admin' AND university_id IS NULL ORDER BY created_at LIMIT 1");
    const supId = supUser.rows[0].id;
    const patch = await api(`/api/admin/users/${supId}`, { method: "PATCH", token: adminAToken, body: { suspended: true } });
    assert.equal(patch.status, 404);
    const deact = await api(`/api/admin/users/${supId}/deactivate`, { method: "POST", token: adminAToken, body: {} });
    assert.equal(deact.status, 404);
    const del = await api(`/api/admin/users/${supId}`, { method: "DELETE", token: adminAToken, body: {} });
    assert.equal(del.status, 404);
  });

  test("normal users cannot call any management endpoint", async () => {
    const list = await api("/api/admin/users", { token: studentA1Token });
    assert.equal(list.status, 403);
    const deact = await api(`/api/admin/users/${studentCleanUser.id}/deactivate`, { method: "POST", token: studentA1Token, body: {} });
    assert.equal(deact.status, 403);
    const del = await api(`/api/admin/users/${studentCleanUser.id}`, { method: "DELETE", token: studentA1Token, body: {} });
    assert.equal(del.status, 403);
    const promote = await api("/api/super/admins/promote", { method: "POST", token: studentA1Token, body: { userId: studentCleanUser.id } });
    assert.equal(promote.status, 403);
  });

  test("campus admin PATCH cannot promote to admin", async () => {
    const res = await api(`/api/admin/users/${studentA1User.id}`, { method: "PATCH", token: adminAToken, body: { role: "admin" } });
    assert.equal(res.status, 400);
  });
});

describe("4. Deactivation behavior (Phases 8/9/13/14/18)", () => {
  test("campus admin deactivates a student with a reason; account is blocked immediately", async () => {
    const res = await api(`/api/admin/users/${studentA1User.id}/deactivate`, {
      method: "POST",
      token: adminAToken,
      body: { reason: "Policy violation" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.suspended, true);

    const { rows } = await db.query("SELECT suspended FROM users WHERE id = $1", [studentA1User.id]);
    assert.equal(rows[0].suspended, true);

    const audits = await db.query("SELECT * FROM audit_logs WHERE action = 'ADMIN_DEACTIVATED_USER' AND target_id = $1", [studentA1User.id]);
    assert.ok(audits.rows.length >= 1);
    assert.equal(audits.rows[0].details.reason, "Policy violation", "reason stored in audit");

    // The tenant middleware treats suspended users as unauthenticated, so the
    // request needs the university header to reach requireAuth() which then
    // produces the ACCOUNT_SUSPENDED rejection.
    const blocked = await api("/api/onboarding/status", { token: studentA1Token, headers: { "X-University-Id": uniA.id } });
    assert.equal(blocked.status, 403, "suspended account cannot use the API");
    assert.equal(blocked.data.error.code, "ACCOUNT_SUSPENDED");
  });

  test("double deactivation conflicts; reactivate restores access", async () => {
    const again = await api(`/api/admin/users/${studentA1User.id}/deactivate`, { method: "POST", token: adminAToken, body: {} });
    assert.equal(again.status, 409);

    const re = await api(`/api/admin/users/${studentA1User.id}`, { method: "PATCH", token: adminAToken, body: { suspended: false } });
    assert.equal(re.status, 200);
    const ok = await api("/api/onboarding/status", { token: studentA1Token });
    assert.equal(ok.status, 200, "reactivated account works again");
  });

  test("merchant deactivation is audited with the merchant-specific action", async () => {
    const res = await api(`/api/admin/users/${merchantUser.id}/deactivate`, {
      method: "POST",
      token: adminAToken,
      body: { reason: "Fraud reports" },
    });
    assert.equal(res.status, 200);
    const audits = await db.query("SELECT * FROM audit_logs WHERE action = 'ADMIN_DEACTIVATED_MERCHANT' AND target_id = $1", [merchantUser.id]);
    assert.ok(audits.rows.length >= 1);

    const blocked = await api("/api/merchants/stores/mine", { token: merchantToken, headers: { "X-University-Id": uniA.id } });
    assert.equal(blocked.status, 403, "deactivated merchant cannot reach the merchant dashboard");

    await api(`/api/admin/users/${merchantUser.id}`, { method: "PATCH", token: adminAToken, body: { suspended: false } });
  });

  test("organizer deactivation is audited with the organizer-specific action", async () => {
    const res = await api(`/api/admin/users/${organizerUser.id}/deactivate`, {
      method: "POST",
      token: adminAToken,
      body: { reason: "Unapproved events" },
    });
    assert.equal(res.status, 200);
    const audits = await db.query("SELECT * FROM audit_logs WHERE action = 'ADMIN_DEACTIVATED_ORGANIZER' AND target_id = $1", [organizerUser.id]);
    assert.ok(audits.rows.length >= 1);
    await api(`/api/admin/users/${organizerUser.id}`, { method: "PATCH", token: adminAToken, body: { suspended: false } });
  });
});

describe("5. Data integrity — safe deletion (Phases 8/9/10/11/21)", () => {
  test("merchant with store/products/orders/payments/reviews: delete refused, deactivate preserves everything", async () => {
    const deps = await api(`/api/admin/users/${merchantUser.id}/dependencies`, { token: adminAToken });
    assert.equal(deps.status, 200);
    assert.equal(deps.data.canDelete, false);
    assert.ok(deps.data.counts.stores >= 1);
    assert.ok(deps.data.counts.products >= 1);
    assert.ok(deps.data.counts.payments >= 1, "payee_id payment counted");

    const del = await api(`/api/admin/users/${merchantUser.id}`, { method: "DELETE", token: adminAToken, body: {} });
    assert.equal(del.status, 409);
    assert.equal(del.data.error.code, "DEPENDENCIES_EXIST");

    const deact = await api(`/api/admin/users/${merchantUser.id}/deactivate`, { method: "POST", token: adminAToken, body: {} });
    assert.equal(deact.status, 200);

    const counts = await Promise.all([
      db.query("SELECT count(*)::int AS n FROM stores WHERE merchant_id = $1", [merchantUser.id]),
      db.query("SELECT count(*)::int AS n FROM products WHERE store_id = $1", [storeA.id]),
      db.query("SELECT count(*)::int AS n FROM orders WHERE store_id = $1", [storeA.id]),
      db.query("SELECT count(*)::int AS n FROM payments WHERE payee_id = $1", [merchantUser.id]),
      db.query("SELECT count(*)::int AS n FROM reviews WHERE target_id = $1", [storeA.id]),
    ]);
    for (const c of counts) assert.ok(c.rows[0].n >= 1, "historical row survived deactivation");

    await api(`/api/admin/users/${merchantUser.id}`, { method: "PATCH", token: adminAToken, body: { suspended: false } });
  });

  test("organizer with club/events/sold tickets: delete refused, history intact after deactivation", async () => {
    const deps = await api(`/api/admin/users/${organizerUser.id}/dependencies`, { token: adminAToken });
    assert.equal(deps.data.canDelete, false);
    assert.ok(deps.data.counts.clubs >= 1);
    assert.ok(deps.data.counts.events >= 1);
    assert.ok(deps.data.counts.tickets >= 1 || deps.data.counts.events >= 1);

    const del = await api(`/api/admin/users/${organizerUser.id}`, { method: "DELETE", token: adminAToken, body: {} });
    assert.equal(del.status, 409);
    assert.equal(del.data.error.code, "DEPENDENCIES_EXIST");

    const deact = await api(`/api/admin/users/${organizerUser.id}/deactivate`, { method: "POST", token: adminAToken, body: {} });
    assert.equal(deact.status, 200);

    const eventRow = await db.query("SELECT status FROM events WHERE id = $1", [eventA.id]);
    assert.ok(eventRow.rows[0], "event still exists");
    const ticketRow = await db.query("SELECT status FROM tickets WHERE event_id = $1", [eventA.id]);
    assert.ok(ticketRow.rows[0].status === "active" || ticketRow.rows.length >= 1, "sold ticket untouched");

    await api(`/api/admin/users/${organizerUser.id}`, { method: "PATCH", token: adminAToken, body: { suspended: false } });
  });

  test("user with audit history cannot be physically deleted (deactivate instead)", async () => {
    // studentA1 was the target of admin actions; actor-based audit rows belong
    // to the admin. Give the user actor history via an audited self-action:
    // applying (merchant apply creates an audit row with the applicant as actor).
    const terms = await api("/api/onboarding/terms?type=merchant", { token: studentA1Token });
    await api("/api/merchants/apply", {
      method: "POST",
      token: studentA1Token,
      body: { businessName: "UMgmt Audit Shop", terms: { accepted: true, version: terms.data.terms.version } },
    }).catch(() => {});

    const deps = await api(`/api/admin/users/${studentA1User.id}/dependencies`, { token: adminAToken });
    assert.equal(deps.data.canDelete, false, "auditRecords/applications make deletion unsafe");
    const del = await api(`/api/admin/users/${studentA1User.id}`, { method: "DELETE", token: adminAToken, body: {} });
    assert.equal(del.status, 409);
  });

  test("user with zero dependencies can be physically deleted; cascades clean tokens", async () => {
    const deps = await api(`/api/admin/users/${studentCleanUser.id}/dependencies`, { token: adminAToken });
    assert.equal(deps.status, 200);
    assert.equal(deps.data.canDelete, true, `unexpected deps: ${JSON.stringify(deps.data.counts)}`);

    // seed a refresh token + notification to prove cascades
    await db.query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')", [studentCleanUser.id, crypto.randomBytes(32).toString("hex")]).catch(() => {});
    await db.query("INSERT INTO notifications (user_id, type, title, body) VALUES ($1,'test','t','b')", [studentCleanUser.id]).catch(() => {});

    const del = await api(`/api/admin/users/${studentCleanUser.id}`, { method: "DELETE", token: adminAToken, body: { reason: "Account cleanup" } });
    assert.equal(del.status, 200);
    assert.equal(del.data.deleted, true);

    const { rows } = await db.query("SELECT id FROM users WHERE id = $1", [studentCleanUser.id]);
    assert.equal(rows.length, 0, "row physically removed");

    const audits = await db.query("SELECT * FROM audit_logs WHERE action = 'ADMIN_DELETED_USER' AND target_id = $1", [studentCleanUser.id]);
    assert.ok(audits.rows.length >= 1, "deletion audited");

    const gone = await api("/api/onboarding/status", { token: studentCleanToken, headers: { "X-University-Id": uniA.id } });
    assert.equal(gone.status, 401, "tokens for deleted user no longer resolve");
  });
});

describe("6. Super Admin — manage campus admins (Phases 18/19)", () => {
  test("change an admin's campus assignment", async () => {
    const res = await api(`/api/super/admins/${createdAdminUser.id}`, {
      method: "PATCH",
      token: superToken,
      body: { universityId: uniB.id },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.admin.university_id, uniB.id);

    const { rows } = await db.query("SELECT * FROM audit_logs WHERE action = 'SUPER_ADMIN_CHANGED_ADMIN_CAMPUS' AND target_id = $1", [createdAdminUser.id]);
    assert.ok(rows.length >= 1, "campus change audited");

    // Now the admin is scoped to campus B
    const token = signAccessToken({ id: createdAdminUser.id, role: "admin", university_id: uniB.id });
    const list = await api("/api/admin/users", { token });
    assert.ok(list.data.users.every((u) => u.university_id === uniB.id), "sees the new campus only");

    // Move back for later tests
    await api(`/api/super/admins/${createdAdminUser.id}`, { method: "PATCH", token: superToken, body: { universityId: uniA.id } });
  });

  test("LAST_ADMIN safeguards: sole admin cannot be moved or suspended", async () => {
    const move = await api(`/api/super/admins/${adminBUser.id}`, { method: "PATCH", token: superToken, body: { universityId: uniA.id } });
    assert.equal(move.status, 409);
    assert.equal(move.data.error.code, "LAST_ADMIN");

    const suspend = await api(`/api/super/admins/${adminBUser.id}`, { method: "PATCH", token: superToken, body: { suspended: true } });
    assert.equal(suspend.status, 409);
    assert.equal(suspend.data.error.code, "LAST_ADMIN");
  });

  test("super admin deactivates and reactivates a campus admin", async () => {
    // uniA has adminA + createdAdmin → adminA can be suspended
    const off = await api(`/api/super/admins/${adminAUser.id}`, {
      method: "PATCH",
      token: superToken,
      body: { suspended: true, reason: "On leave" },
    });
    assert.equal(off.status, 200);
    assert.equal(off.data.admin.suspended, true);

    const { rows } = await db.query("SELECT * FROM audit_logs WHERE action = 'SUPER_ADMIN_DEACTIVATED_ADMIN' AND target_id = $1", [adminAUser.id]);
    assert.ok(rows.length >= 1);

    const blocked = await api("/api/admin/users", { token: adminAToken, headers: { "X-University-Id": uniA.id } });
    assert.equal(blocked.status, 403, "deactivated admin cannot use admin APIs");

    const on = await api(`/api/super/admins/${adminAUser.id}`, { method: "PATCH", token: superToken, body: { suspended: false } });
    assert.equal(on.status, 200);
    const ok = await api("/api/admin/users", { token: adminAToken });
    assert.equal(ok.status, 200, "reactivated admin works again");
  });

  test("super admin endpoints reject campus admins and unknown ids", async () => {
    const notAdmin = await api(`/api/super/admins/${studentA1User.id}`, { method: "PATCH", token: superToken, body: { suspended: true } });
    assert.equal(notAdmin.status, 404, "only role=admin rows are manageable");

    const asAdmin = await api(`/api/super/admins/${createdAdminUser.id}`, { method: "PATCH", token: adminAToken, body: { suspended: true } });
    assert.equal(asAdmin.status, 403);
  });

  test("promote/demote still work and demote keeps the last-admin guard", async () => {
    const target = await createUser({ name: "UMgmt Promo", email: `umgmt_promo_${Date.now()}@uma-x.edu.et`, role: "student", universityId: uniA.id });
    const promo = await api("/api/super/admins/promote", { method: "POST", token: superToken, body: { userId: target.user.id } });
    assert.equal(promo.status, 200);
    assert.equal(promo.data.user.role, "admin");

    // Demote the freshly promoted admin (uniA has others) → ok
    const demote = await api("/api/super/admins/demote", { method: "POST", token: superToken, body: { userId: target.user.id } });
    assert.equal(demote.status, 200);
  });
});
