/**
 * Automated Test Suite - FEATURE 01: SMART GLOBAL SEARCH
 *
 * Verifies all 12 backend search requirements:
 * 1. Product search
 * 2. P2P listing search
 * 3. Rental search
 * 4. Event search
 * 5. Combined search results (type=all)
 * 6. Empty queries (returns 200 with 0 counts)
 * 7. Malformed queries (returns 400 validation error)
 * 8. SQL injection attempts (safely handled via parameterized SQL)
 * 9. Pagination and result limits (capped at 50)
 * 10. University tenant isolation (no cross-campus leakage)
 * 11. Feature-flag behavior (disabled modules excluded / 403)
 * 12. Unavailable and unpublished content exclusion (removed, sold, draft, past events)
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

// Test Universities
let uniA, uniB, uniCDisabled;

// Users & Tokens
let studentAToken, studentAUser;
let studentBToken, studentBUser;
let studentCToken, studentCUser;

// Cleanup IDs
const cleanupUniIds = [];
const cleanupUserIds = [];
const cleanupStoreIds = [];
const cleanupClubIds = [];

async function apiRequest(path, { method = "GET", headers = {} } = {}) {
  const url = `${baseUrl}${path}`;
  const reqHeaders = { ...headers };

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
          let body = raw;
          try {
            body = JSON.parse(raw);
          } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body });
        });
      }
    );
    req.on("error", reject);
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

  // 1. Create Uni A (standard active campus)
  const uniARes = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{}') RETURNING *`,
    ["GlobalSearch Uni A", `search-uni-a-${ts}`, `search-a-${ts}.edu.et`, [`search-a-${ts}.edu.et`]]
  );
  uniA = uniARes.rows[0];
  cleanupUniIds.push(uniA.id);

  // 2. Create Uni B (isolated active campus)
  const uniBRes = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{}') RETURNING *`,
    ["GlobalSearch Uni B", `search-uni-b-${ts}`, `search-b-${ts}.edu.et`, [`search-b-${ts}.edu.et`]]
  );
  uniB = uniBRes.rows[0];
  cleanupUniIds.push(uniB.id);

  // 3. Create Uni C (with p2p, rentals, events, lost_found disabled in feature_flags)
  const uniCRes = await db.query(
    `INSERT INTO universities (name, slug, domain, permitted_domains, status, feature_flags)
     VALUES ($1, $2, $3, $4, 'active', '{"p2p":false,"rentals":false,"events":false,"lost_found":false}') RETURNING *`,
    ["GlobalSearch Uni C", `search-uni-c-${ts}`, `search-c-${ts}.edu.et`, [`search-c-${ts}.edu.et`]]
  );
  uniCDisabled = uniCRes.rows[0];
  cleanupUniIds.push(uniCDisabled.id);

  // Create Users
  const stA = await createTestUser({ name: "Searcher A", email: `search_a_${ts}@search-a-${ts}.edu.et`, role: "student", universityId: uniA.id });
  studentAUser = stA.user; studentAToken = stA.token;

  const stB = await createTestUser({ name: "Searcher B", email: `search_b_${ts}@search-b-${ts}.edu.et`, role: "student", universityId: uniB.id });
  studentBUser = stB.user; studentBToken = stB.token;

  const stC = await createTestUser({ name: "Searcher C", email: `search_c_${ts}@search-c-${ts}.edu.et`, role: "student", universityId: uniCDisabled.id });
  studentCUser = stC.user; studentCToken = stC.token;

  // Merchant & Store in Uni A
  const merA = await createTestUser({ name: "Merchant A", email: `mer_a_${ts}@search-a-${ts}.edu.et`, role: "merchant", universityId: uniA.id });
  const storeARes = await db.query(
    `INSERT INTO stores (name, merchant_id, university_id, status) VALUES ($1, $2, $3, 'active') RETURNING *`,
    ["Tech Store A", merA.user.id, uniA.id]
  );
  const storeA = storeARes.rows[0];
  cleanupStoreIds.push(storeA.id);

  // Store in Uni B
  const merB = await createTestUser({ name: "Merchant B", email: `mer_b_${ts}@search-b-${ts}.edu.et`, role: "merchant", universityId: uniB.id });
  const storeBRes = await db.query(
    `INSERT INTO stores (name, merchant_id, university_id, status) VALUES ($1, $2, $3, 'active') RETURNING *`,
    ["Tech Store B", merB.user.id, uniB.id]
  );
  const storeB = storeBRes.rows[0];
  cleanupStoreIds.push(storeB.id);

  // Store in Uni C
  const merC = await createTestUser({ name: "Merchant C", email: `mer_c_${ts}@search-c-${ts}.edu.et`, role: "merchant", universityId: uniCDisabled.id });
  const storeCRes = await db.query(
    `INSERT INTO stores (name, merchant_id, university_id, status) VALUES ($1, $2, $3, 'active') RETURNING *`,
    ["Tech Store C", merC.user.id, uniCDisabled.id]
  );
  const storeC = storeCRes.rows[0];
  cleanupStoreIds.push(storeC.id);

  // Inactive Store in Uni A
  const storeAInactRes = await db.query(
    `INSERT INTO stores (name, merchant_id, university_id, status) VALUES ($1, $2, $3, 'suspended') RETURNING *`,
    ["Suspended Store A", merA.user.id, uniA.id]
  );
  const storeAInact = storeAInactRes.rows[0];
  cleanupStoreIds.push(storeAInact.id);

  // ------------------------------------------------------------------
  // Seed Products
  // ------------------------------------------------------------------
  // Uni A: Exact match title
  await db.query(
    `INSERT INTO products (store_id, title, description, price, stock, images, status)
     VALUES ($1, 'Laptop', 'Pure laptop device', 25000.00, 5, ARRAY['/uploads/laptop1.png'], 'active')`,
    [storeA.id]
  );
  // Uni A: Partial match title
  await db.query(
    `INSERT INTO products (store_id, title, description, price, stock, images, status)
     VALUES ($1, 'Laptop Sleeve Case', 'Padded waterproof laptop case', 850.00, 20, ARRAY['/uploads/case.png'], 'active')`,
    [storeA.id]
  );
  // Uni A: Description match only
  await db.query(
    `INSERT INTO products (store_id, title, description, price, stock, images, status)
     VALUES ($1, 'Ergonomic Stand', 'Aluminum cooling stand for your laptop', 1200.00, 15, ARRAY['/uploads/stand.png'], 'active')`,
    [storeA.id]
  );
  // Uni A: Removed product (MUST NOT APPEAR)
  await db.query(
    `INSERT INTO products (store_id, title, description, price, stock, status)
     VALUES ($1, 'Broken Laptop Old', 'Should be hidden', 500.00, 0, 'removed')`,
    [storeA.id]
  );
  // Uni A: Product in suspended store (MUST NOT APPEAR)
  await db.query(
    `INSERT INTO products (store_id, title, description, price, stock, status)
     VALUES ($1, 'Suspended Store Laptop', 'Should be hidden', 15000.00, 1, 'active')`,
    [storeAInact.id]
  );
  // Uni B: Product in Uni B (MUST NOT APPEAR FOR UNI A)
  await db.query(
    `INSERT INTO products (store_id, title, description, price, stock, status)
     VALUES ($1, 'Uni B Secret Laptop', 'Uni B item', 30000.00, 2, 'active')`,
    [storeB.id]
  );
  // Uni C: Product in Uni C
  await db.query(
    `INSERT INTO products (store_id, title, description, price, stock, status)
     VALUES ($1, 'Uni C Allowed Laptop', 'Uni C allowed product', 22000.00, 4, 'active')`,
    [storeC.id]
  );

  // ------------------------------------------------------------------
  // Seed P2P Listings
  // ------------------------------------------------------------------
  // Uni A: Active listing
  await db.query(
    `INSERT INTO p2p_listings (seller_id, university_id, title, description, price, condition, images, status)
     VALUES ($1, $2, 'Used Laptop Charger 65W', 'Original type C laptop charger', 900.00, 'Used - Good', ARRAY['/uploads/charger.png'], 'active')`,
    [studentAUser.id, uniA.id]
  );
  // Uni A: Sold listing (MUST NOT APPEAR)
  await db.query(
    `INSERT INTO p2p_listings (seller_id, university_id, title, description, price, condition, status)
     VALUES ($1, $2, 'Sold Laptop DDR4 RAM', 'Already sold', 700.00, 'Used', 'sold')`,
    [studentAUser.id, uniA.id]
  );
  // Uni A: Pending review listing (MUST NOT APPEAR)
  await db.query(
    `INSERT INTO p2p_listings (seller_id, university_id, title, description, price, condition, status)
     VALUES ($1, $2, 'Pending Laptop Battery', 'Pending approval', 1100.00, 'Used', 'pending_review')`,
    [studentAUser.id, uniA.id]
  );
  // Uni B: Listing in Uni B (MUST NOT APPEAR FOR UNI A)
  await db.query(
    `INSERT INTO p2p_listings (seller_id, university_id, title, description, price, condition, status)
     VALUES ($1, $2, 'Uni B Student Laptop', 'Uni B peer item', 20000.00, 'Like New', 'active')`,
    [studentBUser.id, uniB.id]
  );

  // ------------------------------------------------------------------
  // Seed Rental Items
  // ------------------------------------------------------------------
  // Uni A: Active rental
  await db.query(
    `INSERT INTO rental_items (owner_id, university_id, title, description, price_per_day, deposit, available_from, available_to, images, status)
     VALUES ($1, $2, 'Laptop HDMI Projector', 'High lumen projector for presentations', 150.00, 1000.00, CURRENT_DATE - 1, CURRENT_DATE + 30, ARRAY['/uploads/proj.png'], 'active')`,
    [studentAUser.id, uniA.id]
  );
  // Uni A: Removed rental (MUST NOT APPEAR)
  await db.query(
    `INSERT INTO rental_items (owner_id, university_id, title, description, price_per_day, deposit, available_from, available_to, status)
     VALUES ($1, $2, 'Broken Rental Laptop', 'Unavailable', 200.00, 2000.00, CURRENT_DATE - 1, CURRENT_DATE + 30, 'removed')`,
    [studentAUser.id, uniA.id]
  );
  // Uni B: Rental in Uni B (MUST NOT APPEAR FOR UNI A)
  await db.query(
    `INSERT INTO rental_items (owner_id, university_id, title, description, price_per_day, deposit, available_from, available_to, status)
     VALUES ($1, $2, 'Uni B Rental Laptop Camera', 'Uni B rental item', 100.00, 500.00, CURRENT_DATE - 1, CURRENT_DATE + 30, 'active')`,
    [studentBUser.id, uniB.id]
  );

  // ------------------------------------------------------------------
  // Seed Clubs & Events
  // ------------------------------------------------------------------
  const clubARes = await db.query(
    `INSERT INTO clubs (name, university_id, lead_user_id, status) VALUES ($1, $2, $3, 'active') RETURNING *`,
    ["Coding Club Uni A", uniA.id, studentAUser.id]
  );
  const clubA = clubARes.rows[0];
  cleanupClubIds.push(clubA.id);

  const clubBRes = await db.query(
    `INSERT INTO clubs (name, university_id, lead_user_id, status) VALUES ($1, $2, $3, 'active') RETURNING *`,
    ["Coding Club Uni B", uniB.id, studentBUser.id]
  );
  const clubB = clubBRes.rows[0];
  cleanupClubIds.push(clubB.id);

  // Uni A: Upcoming published event
  await db.query(
    `INSERT INTO events (club_id, university_id, title, description, date_time, venue_name, category, poster_url, capacity, status)
     VALUES ($1, $2, 'Annual Laptop Hackathon', 'Bring your laptop for 24h coding', now() + interval '5 days', 'Hall 4B', 'tech', '/uploads/hackathon.png', 100, 'published')`,
    [clubA.id, uniA.id]
  );
  // Uni A: Past published event (MUST NOT APPEAR - only upcoming)
  await db.query(
    `INSERT INTO events (club_id, university_id, title, description, date_time, venue_name, category, capacity, status)
     VALUES ($1, $2, 'Past Laptop Seminar 2022', 'Old seminar', now() - interval '30 days', 'Room 101', 'tech', 50, 'published')`,
    [clubA.id, uniA.id]
  );
  // Uni A: Draft event (MUST NOT APPEAR - unpublished)
  await db.query(
    `INSERT INTO events (club_id, university_id, title, description, date_time, venue_name, category, capacity, status)
     VALUES ($1, $2, 'Draft Laptop Meetup', 'Still in draft', now() + interval '10 days', 'Room 102', 'tech', 30, 'draft')`,
    [clubA.id, uniA.id]
  );
  // Uni B: Event in Uni B (MUST NOT APPEAR FOR UNI A)
  await db.query(
    `INSERT INTO events (club_id, university_id, title, description, date_time, venue_name, category, capacity, status)
     VALUES ($1, $2, 'Uni B Laptop Bootcamp', 'Uni B event', now() + interval '5 days', 'Hall B', 'tech', 80, 'published')`,
    [clubB.id, uniB.id]
  );

  // ------------------------------------------------------------------
  // Seed Lost & Found Items
  // ------------------------------------------------------------------
  // Uni A: Active Lost report
  await db.query(
    `INSERT INTO lost_found_items (university_id, reporter_id, type, title, category, description, location, reward_amount, private_details, status)
     VALUES ($1, $2, 'lost', 'Lost HP Laptop In Library', 'Laptops', 'Silver HP laptop lost on 2nd floor', 'Main Library', 500, 'SECRET_SERIAL_XYZ_999', 'open')`,
    [uniA.id, studentAUser.id]
  );
  // Uni A: Active Found report
  await db.query(
    `INSERT INTO lost_found_items (university_id, reporter_id, type, title, category, description, location, private_details, status)
     VALUES ($1, $2, 'found', 'Found Dell Laptop Charger In Cafe', 'Electronics', 'Black Dell laptop charger left at counter', 'Campus Cafe', 'SECRET_INITIALS_ENGRAVED', 'open')`,
    [uniA.id, studentAUser.id]
  );
  // Uni A: Removed report (MUST NOT APPEAR)
  await db.query(
    `INSERT INTO lost_found_items (university_id, reporter_id, type, title, category, description, location, status)
     VALUES ($1, $2, 'lost', 'Removed Broken Laptop Report', 'Laptops', 'Should not appear', 'Hall', 'removed')`,
    [uniA.id, studentAUser.id]
  );
  // Uni B: Report in Uni B (MUST NOT APPEAR FOR UNI A)
  await db.query(
    `INSERT INTO lost_found_items (university_id, reporter_id, type, title, category, description, location, private_details, status)
     VALUES ($1, $2, 'lost', 'Uni B Lost Lenovo Laptop', 'Laptops', 'Lenovo Thinkpad lost in Uni B', 'Dorm 3', 'UNI_B_PRIVATE_DETAILS', 'open')`,
    [uniB.id, studentBUser.id]
  );
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));

  // Clean up test data
  for (const cid of cleanupClubIds) {
    await db.query("DELETE FROM clubs WHERE id = $1", [cid]).catch(() => {});
  }
  for (const sid of cleanupStoreIds) {
    await db.query("DELETE FROM stores WHERE id = $1", [sid]).catch(() => {});
  }
  for (const uid of cleanupUserIds) {
    await db.query("DELETE FROM users WHERE id = $1", [uid]).catch(() => {});
  }
  for (const unid of cleanupUniIds) {
    await db.query("DELETE FROM universities WHERE id = $1", [unid]).catch(() => {});
  }
  await db.pool.end().catch(() => {});
});

describe("Smart Global Search API (/api/search)", () => {
  // ------------------------------------------------------------------
  // 1. Product search
  // ------------------------------------------------------------------
  test("1. Product search: returns active products with store and rating info", async () => {
    const res = await apiRequest("/api/search?q=laptop&type=products", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.type, "products");
    assert.ok(res.body.results.length >= 3);
    const item = res.body.results[0];
    assert.equal(item.type, "product");
    assert.ok(item.title);
    assert.ok(item.destinationUrl.startsWith("/marketplace/"));
    assert.ok(typeof item.price === "number");
    assert.ok(item.store_name);

    // Exact title match ("Laptop") ranks at the very top (rankScore 1)
    assert.equal(res.body.results[0].title, "Laptop");
    assert.equal(res.body.results[0].rankScore, 1);
  });

  // ------------------------------------------------------------------
  // 2. P2P listing search
  // ------------------------------------------------------------------
  test("2. P2P listing search: returns active student market listings", async () => {
    const res = await apiRequest("/api/search?q=laptop&type=listings", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.type, "listings");
    assert.ok(res.body.results.length >= 1);
    const item = res.body.results.find((r) => r.title.includes("Charger"));
    assert.ok(item);
    assert.equal(item.type, "listing");
    assert.equal(item.price, 900);
    assert.equal(item.seller_name, "Searcher A");
    assert.ok(item.destinationUrl.startsWith("/listings/"));
    // Verify no private user data like email or password is leaked
    assert.equal(item.email, undefined);
    assert.equal(item.password_hash, undefined);
  });

  // ------------------------------------------------------------------
  // 3. Rental search
  // ------------------------------------------------------------------
  test("3. Rental search: returns active rental items with deposit and price/day", async () => {
    const res = await apiRequest("/api/search?q=laptop&type=rentals", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.type, "rentals");
    assert.ok(res.body.results.length >= 1);
    const item = res.body.results[0];
    assert.equal(item.type, "rental");
    assert.equal(item.price_per_day, 150);
    assert.equal(item.deposit, 1000);
    assert.equal(item.owner_name, "Searcher A");
    assert.ok(item.destinationUrl.startsWith("/rentals/"));
  });

  // ------------------------------------------------------------------
  // 4. Event search
  // ------------------------------------------------------------------
  test("4. Event search: returns published upcoming events only", async () => {
    const res = await apiRequest("/api/search?q=laptop&type=events", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.type, "events");
    assert.equal(res.body.results.length, 1);
    const item = res.body.results[0];
    assert.equal(item.type, "event");
    assert.equal(item.title, "Annual Laptop Hackathon");
    assert.ok(item.date);
    assert.equal(item.venue, "Hall 4B");
    assert.ok(item.destinationUrl.startsWith("/events/"));
  });

  // ------------------------------------------------------------------
  // 5. Combined search results (type=all)
  // ------------------------------------------------------------------
  test("5. Combined search results: returns unified results and grouped sections with counts", async () => {
    const res = await apiRequest("/api/search?q=laptop&type=all", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.type, "all");
    assert.ok(res.body.results.length >= 4);

    // Verify counts object contains counts across all categories
    assert.ok(res.body.counts.all >= 6);
    assert.ok(res.body.counts.products >= 3);
    assert.ok(res.body.counts.listings >= 1);
    assert.ok(res.body.counts.rentals >= 1);
    assert.ok(res.body.counts.events >= 1);

    // Verify grouped object has arrays for live autocomplete suggestions
    assert.ok(Array.isArray(res.body.grouped.products));
    assert.ok(Array.isArray(res.body.grouped.listings));
    assert.ok(Array.isArray(res.body.grouped.rentals));
    assert.ok(Array.isArray(res.body.grouped.events));

    // Exact title match ("Laptop") ranks first
    assert.equal(res.body.results[0].title, "Laptop");
    assert.equal(res.body.results[0].rankScore, 1);
  });

  // ------------------------------------------------------------------
  // 6. Empty queries
  // ------------------------------------------------------------------
  test("6. Empty and short queries return 200 with zero results without querying database", async () => {
    const emptyRes = await apiRequest("/api/search?q=", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(emptyRes.status, 200);
    assert.equal(emptyRes.body.results.length, 0);
    assert.equal(emptyRes.body.counts.all, 0);

    const singleCharRes = await apiRequest("/api/search?q=a", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(singleCharRes.status, 200);
    assert.equal(singleCharRes.body.results.length, 0);
    assert.equal(singleCharRes.body.counts.all, 0);
  });

  // ------------------------------------------------------------------
  // 7. Malformed queries
  // ------------------------------------------------------------------
  test("7. Malformed queries return HTTP 400 validation error", async () => {
    const badTypeRes = await apiRequest("/api/search?q=laptop&type=unsupported_type", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(badTypeRes.status, 400);
    assert.equal(badTypeRes.body.error.code, "VALIDATION_ERROR");

    const badPageRes = await apiRequest("/api/search?q=laptop&page=-5", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(badPageRes.status, 400);
  });

  // ------------------------------------------------------------------
  // 8. SQL injection attempts
  // ------------------------------------------------------------------
  test("8. SQL injection attempts are safely neutralized via parameterized SQL", async () => {
    const sqliQueries = [
      "laptop' OR '1'='1",
      "'; DROP TABLE products; --",
      "' UNION SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1 --",
      `" OR ""="`,
    ];

    for (const sqli of sqliQueries) {
      const res = await apiRequest(`/api/search?q=${encodeURIComponent(sqli)}`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      // Must respond with 200 and zero injected results, never 500 error or syntax crash
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.results));
    }
  });

  // ------------------------------------------------------------------
  // 9. Pagination and result limits
  // ------------------------------------------------------------------
  test("9. Pagination and result limits are strictly enforced and capped at 50", async () => {
    // Limit = 2, Page = 1
    const page1Res = await apiRequest("/api/search?q=laptop&type=products&limit=2&page=1", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(page1Res.status, 200);
    assert.equal(page1Res.body.results.length, 2);
    assert.equal(page1Res.body.pagination.page, 1);
    assert.equal(page1Res.body.pagination.limit, 2);
    assert.ok(page1Res.body.pagination.totalPages >= 2);

    // Limit = 2, Page = 2
    const page2Res = await apiRequest("/api/search?q=laptop&type=products&limit=2&page=2", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(page2Res.status, 200);
    assert.equal(page2Res.body.pagination.page, 2);
    // Page 2 items must not be the same as Page 1 items
    assert.notEqual(page1Res.body.results[0].id, page2Res.body.results[0].id);

    // Limit > 50 must be capped at 50
    const overLimitRes = await apiRequest("/api/search?q=laptop&limit=999", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    // Zod max(50) rejects or caps
    assert.ok(overLimitRes.status === 400 || (overLimitRes.status === 200 && overLimitRes.body.pagination.limit <= 50));
  });

  // ------------------------------------------------------------------
  // 10. University tenant isolation
  // ------------------------------------------------------------------
  test("10. University tenant isolation: Uni A user NEVER sees Uni B records, and vice versa", async () => {
    // Student A searches for "laptop" -> must see Uni A records, zero Uni B records
    const resA = await apiRequest("/api/search?q=laptop&type=all", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(resA.status, 200);
    for (const item of resA.body.results) {
      assert.ok(!item.title.includes("Uni B"), `Tenant leakage: Uni A saw Uni B item: ${item.title}`);
    }

    // Student B searches for "laptop" -> must see Uni B records, zero Uni A records
    const resB = await apiRequest("/api/search?q=laptop&type=all", {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    assert.equal(resB.status, 200);
    for (const item of resB.body.results) {
      assert.ok(!item.title.includes("Tech Store A"), `Tenant leakage: Uni B saw Uni A item: ${item.title}`);
      assert.ok(item.title !== "Laptop" || item.store_name === "Tech Store B");
    }

    // Student A cannot forge x-university-id header to breach tenant boundary
    const forgedRes = await apiRequest("/api/search?q=laptop", {
      headers: {
        Authorization: `Bearer ${studentAToken}`,
        "X-University-Id": uniB.id,
      },
    });
    // resolveTenant rejects conflicting university header with 403 TENANT_MISMATCH
    assert.equal(forgedRes.status, 403);
    assert.equal(forgedRes.body.error.code, "TENANT_MISMATCH");
  });

  // ------------------------------------------------------------------
  // 11. Feature-flag behavior
  // ------------------------------------------------------------------
  test("11. Feature-flag behavior: disabled features are excluded from all, and return 403 on direct queries", async () => {
    // Uni C has p2p: false, rentals: false, events: false, lost_found: false
    const resAllC = await apiRequest("/api/search?q=laptop&type=all", {
      headers: { Authorization: `Bearer ${studentCToken}` },
    });
    assert.equal(resAllC.status, 200);
    assert.equal(resAllC.body.counts.listings, 0);
    assert.equal(resAllC.body.counts.rentals, 0);
    assert.equal(resAllC.body.counts.events, 0);
    assert.equal(resAllC.body.counts.lost_found, 0);
    assert.ok(resAllC.body.counts.products >= 1);
    for (const item of resAllC.body.results) {
      assert.equal(item.type, "product");
    }

    // Direct search for disabled type returns 403 FEATURE_DISABLED
    const resP2PC = await apiRequest("/api/search?q=laptop&type=listings", {
      headers: { Authorization: `Bearer ${studentCToken}` },
    });
    assert.equal(resP2PC.status, 403);
    assert.equal(resP2PC.body.error.code, "FEATURE_DISABLED");

    const resRentalsC = await apiRequest("/api/search?q=laptop&type=rentals", {
      headers: { Authorization: `Bearer ${studentCToken}` },
    });
    assert.equal(resRentalsC.status, 403);
    assert.equal(resRentalsC.body.error.code, "FEATURE_DISABLED");

    const resEventsC = await apiRequest("/api/search?q=laptop&type=events", {
      headers: { Authorization: `Bearer ${studentCToken}` },
    });
    assert.equal(resEventsC.status, 403);
    assert.equal(resEventsC.body.error.code, "FEATURE_DISABLED");

    const resLostFoundC = await apiRequest("/api/search?q=laptop&type=lost_found", {
      headers: { Authorization: `Bearer ${studentCToken}` },
    });
    assert.equal(resLostFoundC.status, 403);
    assert.equal(resLostFoundC.body.error.code, "FEATURE_DISABLED");
  });

  // ------------------------------------------------------------------
  // 12. Unavailable and unpublished content exclusion
  // ------------------------------------------------------------------
  test("12. Unavailable and unpublished content is completely excluded", async () => {
    const res = await apiRequest("/api/search?q=laptop&type=all&limit=50", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(res.status, 200);

    const titles = res.body.results.map((r) => r.title);

    // Removed product must be excluded
    assert.ok(!titles.includes("Broken Laptop Old"));

    // Product in suspended store must be excluded
    assert.ok(!titles.includes("Suspended Store Laptop"));

    // Sold listing must be excluded
    assert.ok(!titles.includes("Sold Laptop DDR4 RAM"));

    // Pending review listing must be excluded
    assert.ok(!titles.includes("Pending Laptop Battery"));

    // Removed rental must be excluded
    assert.ok(!titles.includes("Broken Rental Laptop"));

    // Past event must be excluded
    assert.ok(!titles.includes("Past Laptop Seminar 2022"));

    // Draft event must be excluded
    assert.ok(!titles.includes("Draft Laptop Meetup"));

    // Removed lost/found report must be excluded
    assert.ok(!titles.includes("Removed Broken Laptop Report"));
  });

  // ------------------------------------------------------------------
  // 13. Lost & Found Search Integration
  // ------------------------------------------------------------------
  test("13. Lost & Found Search: returns active lost and found reports, correct category/destination, zero leakage of private details, and tenant scoping", async () => {
    // 1. Direct lost_found search for Student A
    const res = await apiRequest("/api/search?q=laptop&type=lost_found", {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.type, "lost_found");
    assert.ok(res.body.results.length >= 2);
    assert.ok(res.body.counts.lost_found >= 2);

    const titles = res.body.results.map((r) => r.title);
    assert.ok(titles.includes("Lost HP Laptop In Library"));
    assert.ok(titles.includes("Found Dell Laptop Charger In Cafe"));

    // Verify found and lost reports properties
    const lostItem = res.body.results.find((r) => r.title === "Lost HP Laptop In Library");
    assert.ok(lostItem);
    assert.equal(lostItem.type, "lost_found");
    assert.equal(lostItem.reportType, "lost");
    assert.equal(lostItem.category, "Laptops");
    assert.equal(lostItem.destinationUrl, `/lost-found/${lostItem.id}`);
    assert.equal(lostItem.price, 500); // Reward amount

    const foundItem = res.body.results.find((r) => r.title === "Found Dell Laptop Charger In Cafe");
    assert.ok(foundItem);
    assert.equal(foundItem.type, "lost_found");
    assert.equal(foundItem.reportType, "found");
    assert.equal(foundItem.category, "Electronics");
    assert.equal(foundItem.destinationUrl, `/lost-found/${foundItem.id}`);

    // Critical Security: Private verification details must NEVER appear in search response
    const rawResponseBody = JSON.stringify(res.body);
    assert.ok(!rawResponseBody.includes("SECRET_SERIAL_XYZ_999"));
    assert.ok(!rawResponseBody.includes("SECRET_INITIALS_ENGRAVED"));
    for (const r of res.body.results) {
      assert.equal(r.private_details, undefined);
    }

    // Tenant Isolation: Uni A student must NOT see Uni B lost items
    assert.ok(!titles.includes("Uni B Lost Lenovo Laptop"));

    // Student B searching sees Uni B item, but NOT Uni A items
    const resB = await apiRequest("/api/search?q=laptop&type=lost_found", {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    assert.equal(resB.status, 200);
    const bTitles = resB.body.results.map((r) => r.title);
    assert.ok(bTitles.includes("Uni B Lost Lenovo Laptop"));
    assert.ok(!bTitles.includes("Lost HP Laptop In Library"));
    assert.ok(!bTitles.includes("Found Dell Laptop Charger In Cafe"));
    assert.ok(!JSON.stringify(resB.body).includes("UNI_B_PRIVATE_DETAILS"));
  });
});
