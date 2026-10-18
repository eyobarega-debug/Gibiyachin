const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const crypto = require("crypto");

process.env.NODE_ENV = "test";

const app = require("../src/app");
const db = require("../src/db");
const { hashPassword } = require("../src/utils/hash");
const { signAccessToken } = require("../src/utils/jwt");
const { notify } = require("../src/utils/notify");
const orderStatus = require("../src/services/orderStatus");

let server;
let baseUrl;

let userA, userB;
let tokenA, tokenB;

async function request(method, path, body, token) {
  const url = new URL(path, baseUrl);
  const payload = body ? JSON.stringify(body) : null;
  const headers = {};
  if (payload) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(payload);
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method, headers },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (_) {
            json = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe("Actionable Notifications & Deep-Link Metadata", () => {
  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    const { rows: unis } = await db.query("SELECT id FROM universities LIMIT 1");
    const uniId = unis[0].id;
    const pwd = await hashPassword("Password123!");

    const userAEmail = `notif_user_a_${crypto.randomBytes(4).toString("hex")}@test.edu.et`;
    const userBEmail = `notif_user_b_${crypto.randomBytes(4).toString("hex")}@test.edu.et`;

    const { rows: uA } = await db.query(
      `INSERT INTO users (university_id, name, email, password_hash, role, verified, email_verified)
       VALUES ($1, 'User A', $2, $3, 'student', true, true) RETURNING *`,
      [uniId, userAEmail, pwd]
    );
    userA = uA[0];
    tokenA = signAccessToken(userA);

    const { rows: uB } = await db.query(
      `INSERT INTO users (university_id, name, email, password_hash, role, verified, email_verified)
       VALUES ($1, 'User B', $2, $3, 'student', true, true) RETURNING *`,
      [uniId, userBEmail, pwd]
    );
    userB = uB[0];
    tokenB = signAccessToken(userB);
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (userA) {
      await db.query("DELETE FROM notifications WHERE user_id = $1", [userA.id]).catch(() => {});
      await db.query("DELETE FROM users WHERE id = $1", [userA.id]).catch(() => {});
    }
    if (userB) {
      await db.query("DELETE FROM notifications WHERE user_id = $1", [userB.id]).catch(() => {});
      await db.query("DELETE FROM users WHERE id = $1", [userB.id]).catch(() => {});
    }
  });

  test("1. notify() persists target_route, target_entity_type, and target_entity_id via positional args", async () => {
    const testOrderId = crypto.randomUUID();
    await notify(
      userA.id,
      "order_update",
      "Order ready for pickup",
      "Your item is waiting at the student center.",
      `/orders?orderId=${testOrderId}`,
      "order",
      testOrderId
    );

    const { rows } = await db.query(
      "SELECT * FROM notifications WHERE user_id = $1 AND title = 'Order ready for pickup'",
      [userA.id]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].target_route, `/orders?orderId=${testOrderId}`);
    assert.equal(rows[0].target_entity_type, "order");
    assert.equal(rows[0].target_entity_id, testOrderId);
    assert.equal(rows[0].read_at, null);
  });

  test("2. notify() persists target metadata via options object", async () => {
    const testTicketId = crypto.randomUUID();
    await notify(
      userA.id,
      "ticket_update",
      "Ticket confirmed",
      "Your QR code ticket is active.",
      {
        targetRoute: `/tickets?ticketId=${testTicketId}`,
        targetEntityType: "ticket",
        targetEntityId: testTicketId,
      }
    );

    const { rows } = await db.query(
      "SELECT * FROM notifications WHERE user_id = $1 AND title = 'Ticket confirmed'",
      [userA.id]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].target_route, `/tickets?ticketId=${testTicketId}`);
    assert.equal(rows[0].target_entity_type, "ticket");
    assert.equal(rows[0].target_entity_id, testTicketId);
  });

  test("3. queueNotification() in transaction records target route and entity data", async () => {
    const testOrderId = crypto.randomUUID();
    await db.withTransaction(async (client) => {
      await orderStatus.queueNotification(
        client,
        userA.id,
        "Order delivered",
        "Your order was completed.",
        `/orders?orderId=${testOrderId}`,
        "order",
        testOrderId
      );
    });

    const { rows } = await db.query(
      "SELECT * FROM notifications WHERE user_id = $1 AND title = 'Order delivered'",
      [userA.id]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].target_route, `/orders?orderId=${testOrderId}`);
    assert.equal(rows[0].target_entity_type, "order");
    assert.equal(rows[0].target_entity_id, testOrderId);
  });

  test("4. Legacy notification without target fields safely stores nulls", async () => {
    await notify(userA.id, "test_legacy", "Old system notification", "Body text without targets");

    const { rows } = await db.query(
      "SELECT * FROM notifications WHERE user_id = $1 AND title = 'Old system notification'",
      [userA.id]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].target_route, null);
    assert.equal(rows[0].target_entity_type, null);
    assert.equal(rows[0].target_entity_id, null);
  });

  test("5. GET /api/notifications returns formatted target objects and unread count", async () => {
    const res = await request("GET", "/api/notifications", null, tokenA);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.notifications));
    assert.ok(res.body.unreadCount >= 4);

    const orderNotif = res.body.notifications.find((n) => n.title === "Order ready for pickup");
    assert.ok(orderNotif);
    assert.ok(orderNotif.target);
    assert.ok(orderNotif.target.route.startsWith("/orders?orderId="));
    assert.equal(orderNotif.target.entityType, "order");
    assert.equal(orderNotif.targetRoute, orderNotif.target.route);

    const legacyNotif = res.body.notifications.find((n) => n.title === "Old system notification");
    assert.ok(legacyNotif);
    assert.equal(legacyNotif.targetRoute, null);
    assert.equal(legacyNotif.target.route, null);
  });

  test("6. PATCH /api/notifications/:id/read marks notification as read and returns updated state", async () => {
    const { rows } = await db.query(
      "SELECT id FROM notifications WHERE user_id = $1 AND read_at IS NULL LIMIT 1",
      [userA.id]
    );
    const notifId = rows[0].id;

    const res = await request("PATCH", `/api/notifications/${notifId}/read`, null, tokenA);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.notification);
    assert.equal(res.body.notification.id, notifId);
    assert.ok(res.body.notification.read_at);
    assert.ok(typeof res.body.unreadCount === "number");

    // Repeat PATCH is idempotent
    const repeatRes = await request("PATCH", `/api/notifications/${notifId}/read`, null, tokenA);
    assert.equal(repeatRes.status, 200);
    assert.equal(repeatRes.body.success, true);
  });

  test("7. Cross-user IDOR protection: cannot mark another user's notification as read", async () => {
    const { rows } = await db.query(
      "SELECT id FROM notifications WHERE user_id = $1 LIMIT 1",
      [userA.id]
    );
    const notifId = rows[0].id;

    const res = await request("PATCH", `/api/notifications/${notifId}/read`, null, tokenB);
    assert.equal(res.status, 404);
  });

  test("8. POST /api/notifications/read-all marks all unread notifications for the user", async () => {
    const res = await request("POST", "/api/notifications/read-all", null, tokenA);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.unreadCount, 0);

    const check = await request("GET", "/api/notifications", null, tokenA);
    assert.equal(check.status, 200);
    assert.equal(check.body.unreadCount, 0);
  });
});
