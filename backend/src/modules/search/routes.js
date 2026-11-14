const express = require("express");
const { z } = require("zod");
const db = require("../../db");
const { asyncHandler, ApiError } = require("../../utils/errors");
const { scopeTo } = require("../../middleware/tenant");
const { rateLimit } = require("../../middleware/rateLimit");

const router = express.Router();

// Apply rate limiting: max 120 search queries per minute per IP/client
router.use(rateLimit({ windowMs: 60_000, max: 120 }));

const searchParamsSchema = z.object({
  q: z.string().max(200).optional().default(""),
  type: z.enum(["all", "products", "listings", "rentals", "events", "lost_found"]).optional().default("all"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  sort: z.enum(["relevance", "price_asc", "price_desc", "newest"]).optional().default("relevance"),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = searchParamsSchema.safeParse(req.query);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ApiError(400, issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid search parameters", "VALIDATION_ERROR");
    }

    const { q, type, page, limit, sort } = parsed.data;
    const rawTerm = q.replace(/\0/g, "").trim();

    // Feature flags check
    const flags = (req.tenant && req.tenant.university && req.tenant.university.feature_flags) || {};
    const p2pEnabled = flags.p2p !== false;
    const rentalsEnabled = flags.rentals !== false;
    const eventsEnabled = flags.events !== false;
    const lostFoundEnabled = flags.lost_found !== false;

    if (type === "listings" && !p2pEnabled) {
      throw new ApiError(403, 'The "p2p" feature is not enabled for this university', "FEATURE_DISABLED");
    }
    if (type === "rentals" && !rentalsEnabled) {
      throw new ApiError(403, 'The "rentals" feature is not enabled for this university', "FEATURE_DISABLED");
    }
    if (type === "events" && !eventsEnabled) {
      throw new ApiError(403, 'The "events" feature is not enabled for this university', "FEATURE_DISABLED");
    }
    if (type === "lost_found" && !lostFoundEnabled) {
      throw new ApiError(403, 'The "lost_found" feature is not enabled for this university', "FEATURE_DISABLED");
    }

    // Queries shorter than 2 characters return empty result structure
    if (rawTerm.length < 2) {
      return res.json({
        query: rawTerm,
        type,
        results: [],
        grouped: { products: [], listings: [], rentals: [], events: [], lost_found: [] },
        counts: { all: 0, products: 0, listings: 0, rentals: 0, events: 0, lost_found: 0 },
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    const containsPattern = `%${rawTerm}%`;
    const prefixPattern = `${rawTerm}%`;

    // ------------------------------------------------------------------
    // Counts
    // ------------------------------------------------------------------
    const countPromises = [];

    // Products count
    const pCountConditions = ["p.status = 'active'", "s.status = 'active'"];
    const pCountParams = [containsPattern];
    pCountConditions.push(`(p.title ILIKE $1 OR p.description ILIKE $1 OR c.name ILIKE $1)`);
    scopeTo(req, "s.university_id", pCountConditions, pCountParams);
    const pCountSql = `
      SELECT COUNT(DISTINCT p.id)::int AS count
      FROM products p
      JOIN stores s ON s.id = p.store_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${pCountConditions.join(" AND ")}
    `;
    countPromises.push(db.query(pCountSql, pCountParams).then((r) => r.rows[0]?.count || 0));

    // Listings count
    if (p2pEnabled) {
      const lCountConditions = ["l.status = 'active'"];
      const lCountParams = [containsPattern];
      lCountConditions.push(`(l.title ILIKE $1 OR l.description ILIKE $1 OR c.name ILIKE $1)`);
      scopeTo(req, "l.university_id", lCountConditions, lCountParams);
      const lCountSql = `
        SELECT COUNT(l.id)::int AS count
        FROM p2p_listings l
        JOIN users u ON u.id = l.seller_id
        LEFT JOIN categories c ON c.id = l.category_id
        WHERE ${lCountConditions.join(" AND ")}
      `;
      countPromises.push(db.query(lCountSql, lCountParams).then((r) => r.rows[0]?.count || 0));
    } else {
      countPromises.push(Promise.resolve(0));
    }

    // Rentals count
    if (rentalsEnabled) {
      const riCountConditions = ["ri.status = 'active'"];
      const riCountParams = [containsPattern];
      riCountConditions.push(`(ri.title ILIKE $1 OR ri.description ILIKE $1 OR c.name ILIKE $1)`);
      scopeTo(req, "ri.university_id", riCountConditions, riCountParams);
      const riCountSql = `
        SELECT COUNT(ri.id)::int AS count
        FROM rental_items ri
        JOIN users u ON u.id = ri.owner_id
        LEFT JOIN categories c ON c.id = ri.category_id
        WHERE ${riCountConditions.join(" AND ")}
      `;
      countPromises.push(db.query(riCountSql, riCountParams).then((r) => r.rows[0]?.count || 0));
    } else {
      countPromises.push(Promise.resolve(0));
    }

    // Events count
    if (eventsEnabled) {
      const eCountConditions = ["e.status = 'published'", "e.date_time >= now()"];
      const eCountParams = [containsPattern];
      eCountConditions.push(`(e.title ILIKE $1 OR e.description ILIKE $1 OR e.category ILIKE $1 OR e.venue_name ILIKE $1 OR e.location ILIKE $1)`);
      scopeTo(req, "e.university_id", eCountConditions, eCountParams);
      const eCountSql = `
        SELECT COUNT(DISTINCT e.id)::int AS count
        FROM events e
        JOIN clubs c ON c.id = e.club_id
        WHERE ${eCountConditions.join(" AND ")}
      `;
      countPromises.push(db.query(eCountSql, eCountParams).then((r) => r.rows[0]?.count || 0));
    } else {
      countPromises.push(Promise.resolve(0));
    }

    // Lost & Found count
    if (lostFoundEnabled) {
      const lfCountConditions = ["lf.status NOT IN ('removed', 'closed', 'expired')"];
      const lfCountParams = [containsPattern];
      lfCountConditions.push(`(lf.title ILIKE $1 OR lf.description ILIKE $1 OR lf.category ILIKE $1 OR lf.location ILIKE $1 OR lf.brand ILIKE $1)`);
      scopeTo(req, "lf.university_id", lfCountConditions, lfCountParams);
      const lfCountSql = `
        SELECT COUNT(lf.id)::int AS count
        FROM lost_found_items lf
        WHERE ${lfCountConditions.join(" AND ")}
      `;
      countPromises.push(db.query(lfCountSql, lfCountParams).then((r) => r.rows[0]?.count || 0));
    } else {
      countPromises.push(Promise.resolve(0));
    }

    const [productCount, listingCount, rentalCount, eventCount, lostFoundCount] = await Promise.all(countPromises);
    const totalAll = productCount + listingCount + rentalCount + eventCount + lostFoundCount;

    const counts = {
      all: totalAll,
      products: productCount,
      listings: listingCount,
      rentals: rentalCount,
      events: eventCount,
      lost_found: lostFoundCount,
    };

    // ------------------------------------------------------------------
    // Fetch Items
    // ------------------------------------------------------------------
    const offset = (page - 1) * limit;

    // Helper functions for entity queries
    async function fetchProducts(fetchLimit, fetchOffset) {
      const pConditions = ["p.status = 'active'", "s.status = 'active'"];
      const pParams = [containsPattern]; // $1
      pConditions.push(`(p.title ILIKE $1 OR p.description ILIKE $1 OR c.name ILIKE $1)`);
      scopeTo(req, "s.university_id", pConditions, pParams);

      const exactIdx = pParams.push(rawTerm); // $exact
      const prefixIdx = pParams.push(prefixPattern); // $prefix

      let orderBy = "rank_score ASC, is_featured DESC, p.created_at DESC";
      if (sort === "price_asc") orderBy = "p.price ASC, rank_score ASC, p.created_at DESC";
      else if (sort === "price_desc") orderBy = "p.price DESC, rank_score ASC, p.created_at DESC";
      else if (sort === "newest") orderBy = "p.created_at DESC, rank_score ASC";

      const limitIdx = pParams.push(fetchLimit);
      const offsetIdx = pParams.push(fetchOffset);

      const sql = `
        SELECT
          p.id,
          'product' AS type,
          p.title,
          p.description,
          (CASE WHEN array_length(p.images, 1) > 0 THEN p.images[1] ELSE NULL END) AS image,
          p.price::float AS price,
          'ETB' AS price_unit,
          NULL::timestamptz AS date,
          ('/marketplace/' || p.id::text) AS destination_url,
          c.name AS category_name,
          s.name AS store_name,
          s.id AS store_id,
          p.stock,
          p.status,
          p.images,
          p.created_at,
          (p.featured_until IS NOT NULL AND p.featured_until > now()) AS is_featured,
          COALESCE(AVG(r.rating), 0)::float AS avg_rating,
          COUNT(r.id)::int AS review_count,
          CASE
            WHEN LOWER(p.title) = LOWER($${exactIdx}) THEN 1
            WHEN LOWER(p.title) LIKE LOWER($${prefixIdx}) THEN 2
            WHEN LOWER(p.title) LIKE LOWER($1) THEN 3
            ELSE 4
          END AS rank_score
        FROM products p
        JOIN stores s ON s.id = p.store_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN reviews r ON r.target_type = 'product' AND r.target_id = p.id
        WHERE ${pConditions.join(" AND ")}
        GROUP BY p.id, s.name, s.id, c.name
        ORDER BY ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;

      const { rows } = await db.query(sql, pParams);
      return rows.map(formatProductItem);
    }

    async function fetchListings(fetchLimit, fetchOffset) {
      if (!p2pEnabled) return [];
      const lConditions = ["l.status = 'active'"];
      const lParams = [containsPattern];
      lConditions.push(`(l.title ILIKE $1 OR l.description ILIKE $1 OR c.name ILIKE $1)`);
      scopeTo(req, "l.university_id", lConditions, lParams);

      const exactIdx = lParams.push(rawTerm);
      const prefixIdx = lParams.push(prefixPattern);

      let orderBy = "rank_score ASC, l.created_at DESC";
      if (sort === "price_asc") orderBy = "l.price ASC, rank_score ASC, l.created_at DESC";
      else if (sort === "price_desc") orderBy = "l.price DESC, rank_score ASC, l.created_at DESC";
      else if (sort === "newest") orderBy = "l.created_at DESC, rank_score ASC";

      const limitIdx = lParams.push(fetchLimit);
      const offsetIdx = lParams.push(fetchOffset);

      const sql = `
        SELECT
          l.id,
          'listing' AS type,
          l.title,
          l.description,
          (CASE WHEN array_length(l.images, 1) > 0 THEN l.images[1] ELSE NULL END) AS image,
          l.price::float AS price,
          'ETB' AS price_unit,
          NULL::timestamptz AS date,
          ('/listings/' || l.id::text) AS destination_url,
          c.name AS category_name,
          u.name AS seller_name,
          u.id AS seller_id,
          l.condition,
          l.status,
          l.images,
          l.created_at,
          CASE
            WHEN LOWER(l.title) = LOWER($${exactIdx}) THEN 1
            WHEN LOWER(l.title) LIKE LOWER($${prefixIdx}) THEN 2
            WHEN LOWER(l.title) LIKE LOWER($1) THEN 3
            ELSE 4
          END AS rank_score
        FROM p2p_listings l
        JOIN users u ON u.id = l.seller_id
        LEFT JOIN categories c ON c.id = l.category_id
        WHERE ${lConditions.join(" AND ")}
        ORDER BY ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;

      const { rows } = await db.query(sql, lParams);
      return rows.map(formatListingItem);
    }

    async function fetchRentals(fetchLimit, fetchOffset) {
      if (!rentalsEnabled) return [];
      const riConditions = ["ri.status = 'active'"];
      const riParams = [containsPattern];
      riConditions.push(`(ri.title ILIKE $1 OR ri.description ILIKE $1 OR c.name ILIKE $1)`);
      scopeTo(req, "ri.university_id", riConditions, riParams);

      const exactIdx = riParams.push(rawTerm);
      const prefixIdx = riParams.push(prefixPattern);

      let orderBy = "rank_score ASC, ri.created_at DESC";
      if (sort === "price_asc") orderBy = "ri.price_per_day ASC, rank_score ASC, ri.created_at DESC";
      else if (sort === "price_desc") orderBy = "ri.price_per_day DESC, rank_score ASC, ri.created_at DESC";
      else if (sort === "newest") orderBy = "ri.created_at DESC, rank_score ASC";

      const limitIdx = riParams.push(fetchLimit);
      const offsetIdx = riParams.push(fetchOffset);

      const sql = `
        SELECT
          ri.id,
          'rental' AS type,
          ri.title,
          ri.description,
          (CASE WHEN array_length(ri.images, 1) > 0 THEN ri.images[1] ELSE NULL END) AS image,
          ri.price_per_day::float AS price,
          ri.price_per_day::float AS price_per_day,
          ri.deposit::float AS deposit,
          'ETB / day' AS price_unit,
          NULL::timestamptz AS date,
          ('/rentals/' || ri.id::text) AS destination_url,
          c.name AS category_name,
          u.name AS owner_name,
          u.id AS owner_id,
          ri.status,
          ri.images,
          ri.created_at,
          CASE
            WHEN LOWER(ri.title) = LOWER($${exactIdx}) THEN 1
            WHEN LOWER(ri.title) LIKE LOWER($${prefixIdx}) THEN 2
            WHEN LOWER(ri.title) LIKE LOWER($1) THEN 3
            ELSE 4
          END AS rank_score
        FROM rental_items ri
        JOIN users u ON u.id = ri.owner_id
        LEFT JOIN categories c ON c.id = ri.category_id
        WHERE ${riConditions.join(" AND ")}
        ORDER BY ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;

      const { rows } = await db.query(sql, riParams);
      return rows.map(formatRentalItem);
    }

    async function fetchEvents(fetchLimit, fetchOffset) {
      if (!eventsEnabled) return [];
      const eConditions = ["e.status = 'published'", "e.date_time >= now()"];
      const eParams = [containsPattern];
      eConditions.push(`(e.title ILIKE $1 OR e.description ILIKE $1 OR e.category ILIKE $1 OR e.venue_name ILIKE $1 OR e.location ILIKE $1)`);
      scopeTo(req, "e.university_id", eConditions, eParams);

      const exactIdx = eParams.push(rawTerm);
      const prefixIdx = eParams.push(prefixPattern);

      let orderBy = "rank_score ASC, e.date_time ASC";
      if (sort === "price_asc") orderBy = "price ASC, rank_score ASC, e.date_time ASC";
      else if (sort === "price_desc") orderBy = "price DESC, rank_score ASC, e.date_time ASC";
      else if (sort === "newest") orderBy = "e.created_at DESC, rank_score ASC";

      const limitIdx = eParams.push(fetchLimit);
      const offsetIdx = eParams.push(fetchOffset);

      const sql = `
        SELECT
          e.id,
          'event' AS type,
          e.title,
          e.description,
          e.poster_url AS image,
          e.poster_url,
          COALESCE((SELECT MIN(price) FROM ticket_types WHERE event_id = e.id AND is_active = true), 0)::float AS price,
          'ETB' AS price_unit,
          e.date_time AS date,
          e.date_time,
          ('/events/' || e.id::text) AS destination_url,
          e.category,
          c.name AS club_name,
          COALESCE(e.organizer_name, c.name) AS organizer_name,
          COALESCE(e.venue_name, e.location) AS venue_name,
          COALESCE(e.venue_name, e.location) AS location,
          COALESCE(SUM(tt.quantity_total), 0)::int AS capacity_total,
          COALESCE(SUM(tt.quantity_sold), 0)::int AS capacity_sold,
          e.status,
          e.created_at,
          CASE
            WHEN LOWER(e.title) = LOWER($${exactIdx}) THEN 1
            WHEN LOWER(e.title) LIKE LOWER($${prefixIdx}) THEN 2
            WHEN LOWER(e.title) LIKE LOWER($1) THEN 3
            ELSE 4
          END AS rank_score
        FROM events e
        JOIN clubs c ON c.id = e.club_id
        LEFT JOIN ticket_types tt ON tt.event_id = e.id
        WHERE ${eConditions.join(" AND ")}
        GROUP BY e.id, c.name
        ORDER BY ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;

      const { rows } = await db.query(sql, eParams);
      return rows.map(formatEventItem);
    }

    async function fetchLostFound(fetchLimit, fetchOffset) {
      if (!lostFoundEnabled) return [];
      const lfConditions = ["lf.status NOT IN ('removed', 'closed', 'expired')"];
      const lfParams = [containsPattern];
      lfConditions.push(`(lf.title ILIKE $1 OR lf.description ILIKE $1 OR lf.category ILIKE $1 OR lf.location ILIKE $1 OR lf.brand ILIKE $1)`);
      scopeTo(req, "lf.university_id", lfConditions, lfParams);

      const exactIdx = lfParams.push(rawTerm);
      const prefixIdx = lfParams.push(prefixPattern);

      let orderBy = "rank_score ASC, lf.created_at DESC";
      if (sort === "price_asc") orderBy = "lf.reward_amount ASC NULLS LAST, rank_score ASC, lf.created_at DESC";
      else if (sort === "price_desc") orderBy = "lf.reward_amount DESC NULLS LAST, rank_score ASC, lf.created_at DESC";
      else if (sort === "newest") orderBy = "lf.created_at DESC, rank_score ASC";

      const limitIdx = lfParams.push(fetchLimit);
      const offsetIdx = lfParams.push(fetchOffset);

      const sql = `
        SELECT
          lf.id,
          'lost_found' AS type,
          lf.title,
          lf.description,
          (CASE WHEN array_length(lf.images, 1) > 0 THEN lf.images[1] ELSE NULL END) AS image,
          lf.reward_amount::float AS price,
          (CASE WHEN lf.reward_amount IS NOT NULL THEN 'ETB Reward' ELSE NULL END) AS price_unit,
          lf.date_occurred AS date,
          ('/lost-found/' || lf.id::text) AS destination_url,
          lf.category,
          lf.location,
          lf.type AS report_type,
          lf.brand,
          lf.color,
          lf.status,
          lf.images,
          lf.reward_amount,
          lf.created_at,
          CASE
            WHEN LOWER(lf.title) = LOWER($${exactIdx}) THEN 1
            WHEN LOWER(lf.title) LIKE LOWER($${prefixIdx}) THEN 2
            WHEN LOWER(lf.title) LIKE LOWER($1) THEN 3
            ELSE 4
          END AS rank_score
        FROM lost_found_items lf
        WHERE ${lfConditions.join(" AND ")}
        ORDER BY ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;

      const { rows } = await db.query(sql, lfParams);
      return rows.map(formatLostFoundItem);
    }

    let results = [];
    const grouped = {
      products: [],
      listings: [],
      rentals: [],
      events: [],
      lost_found: [],
    };
    let total = 0;

    if (type === "products") {
      results = await fetchProducts(limit, offset);
      grouped.products = results;
      total = productCount;
    } else if (type === "listings") {
      results = await fetchListings(limit, offset);
      grouped.listings = results;
      total = listingCount;
    } else if (type === "rentals") {
      results = await fetchRentals(limit, offset);
      grouped.rentals = results;
      total = rentalCount;
    } else if (type === "events") {
      results = await fetchEvents(limit, offset);
      grouped.events = results;
      total = eventCount;
    } else if (type === "lost_found") {
      results = await fetchLostFound(limit, offset);
      grouped.lost_found = results;
      total = lostFoundCount;
    } else {
      // type === "all"
      total = totalAll;

      // Grouped previews for dropdown / multi-category view
      const [prodSample, listSample, rentSample, eventSample, lostFoundSample] = await Promise.all([
        productCount > 0 ? fetchProducts(Math.min(limit, 8), 0) : Promise.resolve([]),
        listingCount > 0 ? fetchListings(Math.min(limit, 8), 0) : Promise.resolve([]),
        rentalCount > 0 ? fetchRentals(Math.min(limit, 8), 0) : Promise.resolve([]),
        eventCount > 0 ? fetchEvents(Math.min(limit, 8), 0) : Promise.resolve([]),
        lostFoundCount > 0 ? fetchLostFound(Math.min(limit, 8), 0) : Promise.resolve([]),
      ]);

      grouped.products = prodSample;
      grouped.listings = listSample;
      grouped.rentals = rentSample;
      grouped.events = eventSample;
      grouped.lost_found = lostFoundSample;

      // Combine across entities, sort by rank_score & sort criterion, then slice page/limit
      const combined = [...prodSample, ...listSample, ...rentSample, ...eventSample, ...lostFoundSample];
      combined.sort((a, b) => {
        if (a.rankScore !== b.rankScore) return a.rankScore - b.rankScore;
        if (sort === "price_asc") return (a.price ?? 0) - (b.price ?? 0);
        if (sort === "price_desc") return (b.price ?? 0) - (a.price ?? 0);
        if (sort === "newest") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        // Default relevance: products featured first, then newest
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });

      results = combined.slice(offset, offset + limit);
    }

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    res.json({
      query: rawTerm,
      type,
      results,
      grouped,
      counts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  })
);

// ------------------------------------------------------------------
// Item formatters
// ------------------------------------------------------------------
function formatProductItem(row) {
  return {
    id: row.id,
    type: "product",
    title: row.title,
    description: row.description || "",
    image: row.image || (Array.isArray(row.images) && row.images[0]) || null,
    price: row.price != null ? Number(row.price) : null,
    priceUnit: "ETB",
    date: null,
    venue: null,
    category: row.category_name || null,
    destinationUrl: `/marketplace/${row.id}`,
    rankScore: row.rank_score,
    // Props for ProductCard reuse
    images: row.images || [],
    store_id: row.store_id,
    store_name: row.store_name,
    stock: row.stock,
    is_featured: Boolean(row.is_featured),
    avg_rating: Number(row.avg_rating) || 0,
    review_count: Number(row.review_count) || 0,
    status: row.status,
    created_at: row.created_at,
  };
}

function formatListingItem(row) {
  return {
    id: row.id,
    type: "listing",
    title: row.title,
    description: row.description || "",
    image: row.image || (Array.isArray(row.images) && row.images[0]) || null,
    price: row.price != null ? Number(row.price) : null,
    priceUnit: "ETB",
    date: null,
    venue: null,
    category: row.category_name || null,
    destinationUrl: `/listings/${row.id}`,
    rankScore: row.rank_score,
    // Props for ListingCard reuse
    images: row.images || [],
    condition: row.condition || null,
    seller_name: row.seller_name,
    seller_id: row.seller_id,
    status: row.status,
    created_at: row.created_at,
  };
}

function formatRentalItem(row) {
  return {
    id: row.id,
    type: "rental",
    title: row.title,
    description: row.description || "",
    image: row.image || (Array.isArray(row.images) && row.images[0]) || null,
    price: row.price != null ? Number(row.price) : null,
    priceUnit: "ETB / day",
    date: null,
    venue: null,
    category: row.category_name || null,
    destinationUrl: `/rentals/${row.id}`,
    rankScore: row.rank_score,
    // Props for RentalCard reuse
    images: row.images || [],
    price_per_day: row.price_per_day != null ? Number(row.price_per_day) : Number(row.price),
    deposit: Number(row.deposit) || 0,
    owner_name: row.owner_name,
    owner_id: row.owner_id,
    status: row.status,
    created_at: row.created_at,
  };
}

function formatEventItem(row) {
  return {
    id: row.id,
    type: "event",
    title: row.title,
    description: row.description || "",
    image: row.image || row.poster_url || null,
    price: row.price != null ? Number(row.price) : null,
    priceUnit: "ETB",
    date: row.date_time ? new Date(row.date_time).toISOString() : null,
    venue: row.venue_name || row.location || null,
    category: row.category || null,
    destinationUrl: `/events/${row.id}`,
    rankScore: row.rank_score,
    // Props for EventCard reuse
    poster_url: row.poster_url,
    date_time: row.date_time,
    organizer_name: row.organizer_name,
    club_name: row.club_name,
    venue_name: row.venue_name,
    location: row.location,
    capacity_total: Number(row.capacity_total) || 0,
    capacity_sold: Number(row.capacity_sold) || 0,
    status: row.status,
    created_at: row.created_at,
  };
}

function formatLostFoundItem(row) {
  return {
    id: row.id,
    type: "lost_found",
    title: row.title,
    description: row.description || "",
    image: row.image || (Array.isArray(row.images) && row.images[0]) || null,
    price: row.price != null ? Number(row.price) : null,
    priceUnit: row.price_unit || (row.price ? "ETB Reward" : null),
    date: row.date ? new Date(row.date).toISOString() : null,
    venue: row.location || null,
    location: row.location || null,
    category: row.category || null,
    destinationUrl: `/lost-found/${row.id}`,
    rankScore: row.rank_score,
    reportType: row.report_type,
    status: row.status,
    brand: row.brand,
    color: row.color,
    reward_amount: row.reward_amount != null ? Number(row.reward_amount) : null,
    images: row.images || [],
    created_at: row.created_at,
  };
}

module.exports = router;
