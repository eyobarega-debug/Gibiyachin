const db = require("../../db");
const { ApiError, notFound, forbidden, badRequest } = require("../../utils/errors");
const { notify, audit } = require("../../utils/notify");
const { findAndSaveMatches } = require("./matching");

function assertSameTenant(tenant, rowUniversityId, what = "Lost & Found item") {
  const t = tenant && tenant.universityId;
  if (t && rowUniversityId !== t) throw notFound(`${what} not found`);
}

/**
 * Strips private details and proofs from items or claims unless the user is
 * the author, the reviewing finder, or a platform/campus administrator.
 */
function sanitizeItem(item, user) {
  if (!item) return null;
  const isReporter = user && user.id === item.reporter_id;
  const isAdmin = user && (user.role === "admin" || user.role === "super_admin");

  const sanitized = { ...item };
  if (!isReporter && !isAdmin) {
    delete sanitized.private_details;
  }
  return sanitized;
}

function sanitizeClaim(claim, user, itemReporterId) {
  if (!claim) return null;
  const isClaimant = user && user.id === claim.claimant_id;
  const isItemReporter = user && user.id === itemReporterId;
  const isAdmin = user && (user.role === "admin" || user.role === "super_admin");

  const sanitized = { ...claim };
  if (!isClaimant && !isItemReporter && !isAdmin) {
    delete sanitized.private_proof;
    delete sanitized.evidence_images;
  }
  return sanitized;
}

// ------------------------------------------------------------------
// Item CRUD Operations
// ------------------------------------------------------------------

async function createItem(data, user, tenant) {
  const universityId = tenant?.universityId || user.university_id;
  if (!universityId) {
    throw new ApiError(403, "Your account is not attached to a university", "NO_TENANT");
  }

  const {
    type,
    title,
    category,
    description,
    dateOccurred,
    location,
    images = [],
    brand = null,
    color = null,
    identifyingCharacteristics = null,
    rewardAmount = 0,
    privateDetails = null,
  } = data;

  const { rows } = await db.query(
    `INSERT INTO lost_found_items (
      university_id, reporter_id, type, title, category, description,
      date_occurred, location, images, brand, color,
      identifying_characteristics, reward_amount, private_details
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      universityId,
      user.id,
      type,
      title,
      category,
      description,
      dateOccurred,
      location,
      images,
      brand,
      color,
      identifyingCharacteristics,
      rewardAmount,
      privateDetails,
    ]
  );

  const newItem = rows[0];

  // Run automated matching algorithm
  try {
    await findAndSaveMatches(newItem, universityId);
  } catch (err) {
    console.warn("[lostFound] automated match execution warning:", err.message);
  }

  await audit(user.id, `lost_found_create_${type}`, "lost_found_item", newItem.id, { title, category });

  return sanitizeItem(newItem, user);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id) {
  return typeof id === "string" && UUID_REGEX.test(id);
}

async function getItemById(id, user, tenant) {
  if (!isValidUuid(id)) throw notFound("Lost & Found item not found");

  const { rows } = await db.query(
    `SELECT i.*, u.name AS reporter_name, u.avatar_url AS reporter_avatar, u.role AS reporter_role,
            uni.name AS university_name
     FROM lost_found_items i
     JOIN users u ON u.id = i.reporter_id
     JOIN universities uni ON uni.id = i.university_id
     WHERE i.id = $1`,
    [id]
  );

  const item = rows[0];
  if (!item) throw notFound("Lost & Found item not found");
  assertSameTenant(tenant, item.university_id);

  if (item.status === "removed" && (!user || (user.id !== item.reporter_id && user.role !== "admin" && user.role !== "super_admin"))) {
    throw notFound("This report has been removed");
  }

  const sanitized = sanitizeItem(item, user);

  // Attach claims if authorized
  if (user) {
    const isReporter = user.id === item.reporter_id;
    const isAdmin = user.role === "admin" || user.role === "super_admin";
    let claimsSql = `
      SELECT c.*, u.name AS claimant_name, u.avatar_url AS claimant_avatar
      FROM lost_found_claims c
      JOIN users u ON u.id = c.claimant_id
      WHERE c.item_id = $1
    `;
    const cParams = [id];
    if (!isReporter && !isAdmin) {
      claimsSql += " AND c.claimant_id = $2";
      cParams.push(user.id);
    }
    claimsSql += " ORDER BY c.created_at DESC";
    const claimsRes = await db.query(claimsSql, cParams);
    sanitized.claims = claimsRes.rows.map((c) => sanitizeClaim(c, user, item.reporter_id));

    // Attach matches if reporter or admin
    if (isReporter || isAdmin) {
      const matchRes = await db.query(
        `SELECT m.*,
                opp.id AS matched_item_id, opp.title, opp.type, opp.category, opp.description,
                opp.date_occurred, opp.location, opp.images, opp.status AS item_status,
                u.name AS reporter_name
         FROM lost_found_matches m
         JOIN lost_found_items opp ON opp.id = (CASE WHEN m.lost_item_id = $1 THEN m.found_item_id ELSE m.lost_item_id END)
         JOIN users u ON u.id = opp.reporter_id
         WHERE (m.lost_item_id = $1 OR m.found_item_id = $1)
           AND m.status <> 'dismissed'
           AND opp.status NOT IN ('returned', 'closed', 'removed')
         ORDER BY m.score DESC`,
        [id]
      );
      sanitized.matches = matchRes.rows.map((r) => ({
        ...r,
        similarity_score: Math.round(Number(r.score) || 0),
        matched_item: sanitizeItem(r, user),
      }));
    } else {
      sanitized.matches = [];
    }
  } else {
    sanitized.claims = [];
    sanitized.matches = [];
  }

  return sanitized;
}

async function listItems(filters, user, tenant) {
  const {
    q,
    type = "all",
    category = "all",
    status = "all",
    location,
    page = 1,
    limit = 20,
    sort = "newest",
  } = filters;

  const conditions = [];
  const params = [];

  // University tenant boundary
  if (tenant && tenant.universityId) {
    params.push(tenant.universityId);
    conditions.push(`i.university_id = $${params.length}`);
  }

  // Type filter
  if (type && type !== "all") {
    params.push(type);
    conditions.push(`i.type = $${params.length}`);
  }

  // Category filter
  if (category && category !== "all") {
    params.push(category);
    conditions.push(`i.category = $${params.length}`);
  }

  // Status filter (by default hide removed/closed from public browsing)
  if (status && status !== "all") {
    params.push(status);
    conditions.push(`i.status = $${params.length}`);
  } else {
    conditions.push(`i.status NOT IN ('removed', 'closed')`);
  }

  // Location filter
  if (location && location.trim()) {
    params.push(`%${location.trim()}%`);
    conditions.push(`i.location ILIKE $${params.length}`);
  }

  // Keyword search (title, description, brand, color, category, location)
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    const qIdx = params.length;
    conditions.push(`(
      i.title ILIKE $${qIdx} OR
      i.description ILIKE $${qIdx} OR
      i.category ILIKE $${qIdx} OR
      i.brand ILIKE $${qIdx} OR
      i.color ILIKE $${qIdx} OR
      i.location ILIKE $${qIdx}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count query
  const countRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM lost_found_items i ${whereClause}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  // Sorting
  let orderBy = "i.created_at DESC";
  if (sort === "oldest") orderBy = "i.created_at ASC";
  else if (sort === "reward_desc") orderBy = "i.reward_amount DESC, i.created_at DESC";

  // Pagination
  const safeLimit = Math.min(50, Math.max(1, limit));
  const offset = (Math.max(1, page) - 1) * safeLimit;
  params.push(safeLimit, offset);

  const { rows } = await db.query(
    `SELECT i.id, i.university_id, i.reporter_id, i.type, i.title, i.category,
            i.description, i.date_occurred, i.location, i.images, i.brand, i.color,
            i.identifying_characteristics, i.reward_amount, i.status, i.resolved_at,
            i.created_at, i.updated_at,
            u.name AS reporter_name, u.avatar_url AS reporter_avatar
     FROM lost_found_items i
     JOIN users u ON u.id = i.reporter_id
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    items: rows.map((it) => sanitizeItem(it, user)),
    pagination: {
      total,
      page: Number(page),
      limit: safeLimit,
      totalPages: total > 0 ? Math.ceil(total / safeLimit) : 0,
    },
    total,
    page: Number(page),
    limit: safeLimit,
    totalPages: total > 0 ? Math.ceil(total / safeLimit) : 0,
  };
}

async function updateItem(id, updates, user, tenant) {
  if (!isValidUuid(id)) throw notFound("Lost & Found item not found");
  const item = await getItemById(id, user, tenant);
  const isReporter = user.id === item.reporter_id;
  const isAdmin = user.role === "admin" || user.role === "super_admin";

  if (!isReporter && !isAdmin) {
    throw forbidden("You are not authorized to update this report");
  }

  const allowedFields = [
    "title", "category", "description", "dateOccurred", "location",
    "images", "brand", "color", "identifyingCharacteristics",
    "rewardAmount", "privateDetails", "status"
  ];

  const dbFieldMap = {
    dateOccurred: "date_occurred",
    identifyingCharacteristics: "identifying_characteristics",
    rewardAmount: "reward_amount",
    privateDetails: "private_details",
  };

  const setClauses = [];
  const params = [id];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      const dbCol = dbFieldMap[field] || field;
      params.push(updates[field]);
      setClauses.push(`${dbCol} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) return sanitizeItem(item, user);

  setClauses.push("updated_at = now()");

  const { rows } = await db.query(
    `UPDATE lost_found_items SET ${setClauses.join(", ")} WHERE id = $1 RETURNING *`,
    params
  );

  const updated = rows[0];

  // Re-run matching if core descriptors changed
  if (updates.title || updates.category || updates.description || updates.color || updates.brand) {
    findAndSaveMatches(updated, updated.university_id).catch(() => {});
  }

  await audit(user.id, "lost_found_update", "lost_found_item", id, updates);

  return sanitizeItem(updated, user);
}

async function deleteItem(id, user, tenant) {
  if (!isValidUuid(id)) throw notFound("Lost & Found item not found");
  const item = await getItemById(id, user, tenant);
  const isReporter = user.id === item.reporter_id;
  const isAdmin = user.role === "admin" || user.role === "super_admin";

  if (!isReporter && !isAdmin) {
    throw forbidden("You are not authorized to remove this report");
  }

  await db.query(
    `UPDATE lost_found_items SET status = 'removed', updated_at = now() WHERE id = $1`,
    [id]
  );

  await audit(user.id, "lost_found_remove", "lost_found_item", id, { reporterId: item.reporter_id });
  return { success: true };
}

// ------------------------------------------------------------------
// Personal Dashboard Operations
// ------------------------------------------------------------------

async function getMyItems(user, tenant) {
  const universityId = tenant?.universityId || user.university_id;

  // 1. My Lost Reports
  const lostRes = await db.query(
    `SELECT * FROM lost_found_items
     WHERE reporter_id = $1 AND type = 'lost' AND status <> 'removed'
     ORDER BY created_at DESC`,
    [user.id]
  );

  // 2. My Found Reports
  const foundRes = await db.query(
    `SELECT * FROM lost_found_items
     WHERE reporter_id = $1 AND type = 'found' AND status <> 'removed'
     ORDER BY created_at DESC`,
    [user.id]
  );

  // 3. Potential Matches for my items
  const matchesRes = await db.query(
    `SELECT m.*,
            li.title AS lost_title, li.images AS lost_images, li.location AS lost_location, li.reporter_id AS lost_reporter_id,
            fi.title AS found_title, fi.images AS found_images, fi.location AS found_location, fi.reporter_id AS found_reporter_id
     FROM lost_found_matches m
     JOIN lost_found_items li ON li.id = m.lost_item_id
     JOIN lost_found_items fi ON fi.id = m.found_item_id
     WHERE m.university_id = $1
       AND (li.reporter_id = $2 OR fi.reporter_id = $2)
       AND m.status <> 'dismissed'
       AND li.status NOT IN ('returned', 'closed', 'removed')
       AND fi.status NOT IN ('returned', 'closed', 'removed')
     ORDER BY m.score DESC, m.created_at DESC`,
    [universityId, user.id]
  );

  // 4. Claims received on my reported items
  const receivedClaimsRes = await db.query(
    `SELECT c.*, i.title AS item_title, i.type AS item_type, i.images AS item_images,
            u.name AS claimant_name, u.avatar_url AS claimant_avatar
     FROM lost_found_claims c
     JOIN lost_found_items i ON i.id = c.item_id
     JOIN users u ON u.id = c.claimant_id
     WHERE i.reporter_id = $1 AND c.status <> 'cancelled'
     ORDER BY c.created_at DESC`,
    [user.id]
  );

  // 5. Claims submitted by me
  const myClaimsRes = await db.query(
    `SELECT c.*, i.title AS item_title, i.type AS item_type, i.images AS item_images, i.status AS item_status,
            u.name AS finder_name
     FROM lost_found_claims c
     JOIN lost_found_items i ON i.id = c.item_id
     JOIN users u ON u.id = i.reporter_id
     WHERE c.claimant_id = $1
     ORDER BY c.created_at DESC`,
    [user.id]
  );

  // 6. Returned / recovered items
  const returnedRes = await db.query(
    `SELECT i.*, c.id AS completed_claim_id, c.claimant_id
     FROM lost_found_items i
     LEFT JOIN lost_found_claims c ON c.item_id = i.id AND c.status = 'completed'
     WHERE (i.reporter_id = $1 OR c.claimant_id = $1)
       AND i.status = 'returned'
     ORDER BY i.resolved_at DESC, i.updated_at DESC`,
    [user.id]
  );

  return {
    myLost: lostRes.rows.map((it) => sanitizeItem(it, user)),
    myFound: foundRes.rows.map((it) => sanitizeItem(it, user)),
    matches: matchesRes.rows,
    receivedClaims: receivedClaimsRes.rows.map((c) => sanitizeClaim(c, user, user.id)),
    myClaims: myClaimsRes.rows.map((c) => sanitizeClaim(c, user, null)),
    returned: returnedRes.rows.map((it) => sanitizeItem(it, user)),
    counts: {
      myLost: lostRes.rows.length,
      myFound: foundRes.rows.length,
      matches: matchesRes.rows.length,
      receivedClaims: receivedClaimsRes.rows.length,
      myClaims: myClaimsRes.rows.length,
      returned: returnedRes.rows.length,
    },
  };
}

async function getItemMatches(itemId, user, tenant) {
  const item = await getItemById(itemId, user, tenant);
  const isReporter = user.id === item.reporter_id;
  const isAdmin = user.role === "admin" || user.role === "super_admin";

  if (!isReporter && !isAdmin) {
    throw forbidden("You can only view match recommendations for your own reports");
  }

  const { rows } = await db.query(
    `SELECT m.*,
            opp.id AS matched_item_id, opp.title, opp.type, opp.category, opp.description,
            opp.date_occurred, opp.location, opp.images, opp.status AS item_status,
            u.name AS reporter_name
     FROM lost_found_matches m
     JOIN lost_found_items opp ON opp.id = (CASE WHEN m.lost_item_id = $1 THEN m.found_item_id ELSE m.lost_item_id END)
     JOIN users u ON u.id = opp.reporter_id
     WHERE (m.lost_item_id = $1 OR m.found_item_id = $1)
       AND m.status <> 'dismissed'
       AND opp.status NOT IN ('returned', 'closed', 'removed')
     ORDER BY m.score DESC`,
    [itemId]
  );

  return rows.map((r) => ({
    ...r,
    matchedItem: sanitizeItem(r, user),
  }));
}

// ------------------------------------------------------------------
// Claim Verification Workflow
// ------------------------------------------------------------------

async function submitClaim(itemId, claimData, user, tenant) {
  if (!isValidUuid(itemId)) throw notFound("Lost & Found item not found");
  const item = await getItemById(itemId, user, tenant);

  // Security: user cannot claim their own reported item
  if (item.reporter_id === user.id) {
    throw badRequest("You cannot claim an item that you reported yourself");
  }

  // Item must be active
  if (item.status === "returned" || item.status === "closed" || item.status === "removed") {
    throw badRequest(`This item is currently ${item.status} and cannot be claimed`);
  }

  // Prevent duplicate active claims by same claimant
  const existingClaim = await db.query(
    `SELECT id FROM lost_found_claims WHERE item_id = $1 AND claimant_id = $2 AND status IN ('pending', 'approved')`,
    [itemId, user.id]
  );
  if (existingClaim.rows.length > 0) {
    throw badRequest("You already have an active claim pending review for this item", "CLAIM_ALREADY_EXISTS");
  }

  const {
    message = claimData.privateProof || "I am submitting a claim to verify ownership of this item.",
    privateProof,
    evidenceImages = [],
  } = claimData;

  const claimRes = await db.query(
    `INSERT INTO lost_found_claims (
      item_id, claimant_id, university_id, message, private_proof, evidence_images
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [itemId, user.id, item.university_id, message, privateProof, evidenceImages]
  );

  const newClaim = claimRes.rows[0];

  // Update item status to 'claim_pending' if open/matched
  if (item.status === "open" || item.status === "matched") {
    await db.query(`UPDATE lost_found_items SET status = 'claim_pending', updated_at = now() WHERE id = $1`, [itemId]);
  }

  // Notify the finder/reporter
  await notify(
    item.reporter_id,
    "lost_found_claim",
    "New Claim Submitted!",
    `A student has claimed your found item "${item.title}". Please review the proof in your dashboard.`,
    `/lost-found/my-items`,
    "lost_found_claim",
    newClaim.id
  ).catch((err) => console.warn("[claims] notify finder failed:", err.message));

  await audit(user.id, "lost_found_claim_submit", "lost_found_claim", newClaim.id, { itemId });

  return sanitizeClaim(newClaim, user, item.reporter_id);
}

async function getItemClaims(itemId, user, tenant) {
  const item = await getItemById(itemId, user, tenant);
  const isReporter = user.id === item.reporter_id;
  const isAdmin = user.role === "admin" || user.role === "super_admin";

  let querySql = `
    SELECT c.*, u.name AS claimant_name, u.avatar_url AS claimant_avatar
    FROM lost_found_claims c
    JOIN users u ON u.id = c.claimant_id
    WHERE c.item_id = $1
  `;
  const params = [itemId];

  if (!isReporter && !isAdmin) {
    // Regular users can only see their own claim on this item
    querySql += " AND c.claimant_id = $2";
    params.push(user.id);
  }

  querySql += " ORDER BY c.created_at DESC";

  const { rows } = await db.query(querySql, params);
  return rows.map((c) => sanitizeClaim(c, user, item.reporter_id));
}

async function reviewClaim(claimId, reviewData, user, tenant) {
  if (!isValidUuid(claimId)) throw notFound("Claim not found");
  const { action, reviewNotes = null } = reviewData;

  const claimRes = await db.query(
    `SELECT c.*, i.reporter_id AS item_reporter_id, i.title AS item_title, i.status AS item_status
     FROM lost_found_claims c
     JOIN lost_found_items i ON i.id = c.item_id
     WHERE c.id = $1`,
    [claimId]
  );

  const claim = claimRes.rows[0];
  if (!claim) throw notFound("Claim not found");
  assertSameTenant(tenant, claim.university_id);

  const isItemReporter = user.id === claim.item_reporter_id;
  const isAdmin = user.role === "admin" || user.role === "super_admin";

  if (!isItemReporter && !isAdmin) {
    throw forbidden("You are not authorized to review this claim");
  }

  if (claim.status !== "pending") {
    throw badRequest(`This claim has already been ${claim.status}`);
  }

  if (action === "approve") {
    return await db.withTransaction(async (client) => {
      // 1. Approve this claim
      const updatedClaimRes = await client.query(
        `UPDATE lost_found_claims
         SET status = 'approved', review_notes = $1, updated_at = now()
         WHERE id = $2 RETURNING *`,
        [reviewNotes, claimId]
      );

      // 2. Transition item to awaiting_handover
      await client.query(
        `UPDATE lost_found_items
         SET status = 'awaiting_handover', updated_at = now()
         WHERE id = $1`,
        [claim.item_id]
      );

      // 3. Reject any other pending claims for this item
      await client.query(
        `UPDATE lost_found_claims
         SET status = 'rejected', review_notes = 'Another claim was verified and approved.', updated_at = now()
         WHERE item_id = $1 AND id <> $2 AND status = 'pending'`,
        [claim.item_id, claimId]
      );

      // Notify claimant
      await notify(
        claim.claimant_id,
        "lost_found_claim_approved",
        "Claim Approved!",
        `Your claim for "${claim.item_title}" has been verified! Contact the finder to arrange handover.`,
        `/lost-found/my-items`,
        "lost_found_claim",
        claimId
      ).catch(() => {});

      await audit(user.id, "lost_found_claim_approve", "lost_found_claim", claimId, { itemId: claim.item_id });

      return sanitizeClaim(updatedClaimRes.rows[0], user, claim.item_reporter_id);
    });
  } else {
    // Reject claim
    const updatedClaimRes = await db.query(
      `UPDATE lost_found_claims
       SET status = 'rejected', review_notes = $1, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [reviewNotes, claimId]
    );

    // If no remaining pending claims, revert item to 'open' or 'matched'
    const remainingPending = await db.query(
      `SELECT id FROM lost_found_claims WHERE item_id = $1 AND status = 'pending'`,
      [claim.item_id]
    );
    if (remainingPending.rows.length === 0) {
      const matchCheck = await db.query(
        `SELECT id FROM lost_found_matches WHERE (lost_item_id = $1 OR found_item_id = $1) AND status <> 'dismissed' LIMIT 1`,
        [claim.item_id]
      );
      const newStatus = matchCheck.rows.length > 0 ? "matched" : "open";
      await db.query(`UPDATE lost_found_items SET status = $1, updated_at = now() WHERE id = $2`, [newStatus, claim.item_id]);
    }

    // Notify claimant
    await notify(
      claim.claimant_id,
      "lost_found_claim_rejected",
      "Claim Update",
      `The finder reviewed your claim for "${claim.item_title}" but was unable to verify ownership.${reviewNotes ? ` Note: ${reviewNotes}` : ""}`,
      `/lost-found/${claim.item_id}`,
      "lost_found_claim",
      claimId
    ).catch(() => {});

    await audit(user.id, "lost_found_claim_reject", "lost_found_claim", claimId, { itemId: claim.item_id });

    return sanitizeClaim(updatedClaimRes.rows[0], user, claim.item_reporter_id);
  }
}

async function confirmHandover(claimId, user, tenant) {
  if (!isValidUuid(claimId)) throw notFound("Claim not found");
  const claimRes = await db.query(
    `SELECT c.*, i.reporter_id AS item_reporter_id, i.title AS item_title, i.status AS item_status
     FROM lost_found_claims c
     JOIN lost_found_items i ON i.id = c.item_id
     WHERE c.id = $1`,
    [claimId]
  );

  const claim = claimRes.rows[0];
  if (!claim) throw notFound("Claim not found");
  assertSameTenant(tenant, claim.university_id);

  const isFinder = user.id === claim.item_reporter_id;
  const isClaimant = user.id === claim.claimant_id;
  const isAdmin = user.role === "admin" || user.role === "super_admin";

  if (!isFinder && !isClaimant && !isAdmin) {
    throw forbidden("You are not a participant in this claim handover");
  }

  if (claim.status !== "approved") {
    throw badRequest(`Cannot confirm handover for claim with status: ${claim.status}`);
  }

  let finderConfirmed = claim.handover_confirmed_by_finder;
  let claimantConfirmed = claim.handover_confirmed_by_claimant;

  if (isFinder || isAdmin) finderConfirmed = true;
  if (isClaimant || isAdmin) claimantConfirmed = true;

  return await db.withTransaction(async (client) => {
    // Both confirmed -> mark as returned and completed
    if (finderConfirmed && claimantConfirmed) {
      const updatedClaimRes = await client.query(
        `UPDATE lost_found_claims
         SET handover_confirmed_by_finder = true,
             handover_confirmed_by_claimant = true,
             status = 'completed',
             resolved_at = now(),
             updated_at = now()
         WHERE id = $1 RETURNING *`,
        [claimId]
      );

      await client.query(
        `UPDATE lost_found_items
         SET status = 'returned', resolved_at = now(), updated_at = now()
         WHERE id = $1`,
        [claim.item_id]
      );

      // Notify both parties
      await notify(
        claim.claimant_id,
        "lost_found_returned",
        "Belonging Recovered!",
        `Handover confirmed! "${claim.item_title}" has been marked as returned.`,
        `/lost-found/my-items`,
        "lost_found_item",
        claim.item_id
      ).catch(() => {});

      await notify(
        claim.item_reporter_id,
        "lost_found_returned",
        "Belonging Recovered!",
        `Handover confirmed! Thank you for returning "${claim.item_title}".`,
        `/lost-found/my-items`,
        "lost_found_item",
        claim.item_id
      ).catch(() => {});

      await audit(user.id, "lost_found_handover_complete", "lost_found_claim", claimId, { itemId: claim.item_id });

      return sanitizeClaim(updatedClaimRes.rows[0], user, claim.item_reporter_id);
    } else {
      // Partial confirmation
      const updatedClaimRes = await client.query(
        `UPDATE lost_found_claims
         SET handover_confirmed_by_finder = $1,
             handover_confirmed_by_claimant = $2,
             updated_at = now()
         WHERE id = $3 RETURNING *`,
        [finderConfirmed, claimantConfirmed, claimId]
      );

      // Notify the other party to confirm receipt
      const otherUserId = isFinder ? claim.claimant_id : claim.item_reporter_id;
      await notify(
        otherUserId,
        "lost_found_handover_pending",
        "Handover Confirmation Needed",
        `Handover was confirmed by the ${isFinder ? "finder" : "claimant"}. Please confirm receipt on your dashboard to complete recovery.`,
        `/lost-found/my-items`,
        "lost_found_claim",
        claimId
      ).catch(() => {});

      return sanitizeClaim(updatedClaimRes.rows[0], user, claim.item_reporter_id);
    }
  });
}

async function disputeClaim(claimId, reason, user, tenant) {
  const claimRes = await db.query(
    `SELECT c.*, i.reporter_id AS item_reporter_id, i.title AS item_title
     FROM lost_found_claims c
     JOIN lost_found_items i ON i.id = c.item_id
     WHERE c.id = $1`,
    [claimId]
  );

  const claim = claimRes.rows[0];
  if (!claim) throw notFound("Claim not found");
  assertSameTenant(tenant, claim.university_id);

  if (user.id !== claim.claimant_id && user.id !== claim.item_reporter_id) {
    throw forbidden("You are not authorized to dispute this claim");
  }

  const { rows } = await db.query(
    `UPDATE lost_found_claims
     SET status = 'disputed', dispute_reason = $1, updated_at = now()
     WHERE id = $2 RETURNING *`,
    [reason, claimId]
  );

  // Notify campus admins
  const admins = await db.query(
    `SELECT id FROM users WHERE role = 'admin' AND university_id = $1`,
    [claim.university_id]
  );
  await Promise.all(
    admins.rows.map((a) =>
      notify(
        a.id,
        "lost_found_dispute",
        "Lost & Found Claim Dispute",
        `Dispute raised on "${claim.item_title}": ${reason}`,
        `/admin?tab=Reports`,
        "lost_found_claim",
        claimId
      ).catch(() => {})
    )
  );

  await audit(user.id, "lost_found_claim_dispute", "lost_found_claim", claimId, { reason });

  return sanitizeClaim(rows[0], user, claim.item_reporter_id);
}

// ------------------------------------------------------------------
// Administration & Moderation
// ------------------------------------------------------------------

async function adminListItems(filters, user, tenant) {
  const { status, type, category, page = 1, limit = 20 } = filters;
  const conditions = [];
  const params = [];

  if (tenant && tenant.universityId) {
    params.push(tenant.universityId);
    conditions.push(`i.university_id = $${params.length}`);
  }

  if (status && status !== "all") {
    params.push(status);
    conditions.push(`i.status = $${params.length}`);
  }

  if (type && type !== "all") {
    params.push(type);
    conditions.push(`i.type = $${params.length}`);
  }

  if (category && category !== "all") {
    params.push(category);
    conditions.push(`i.category = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRes = await db.query(`SELECT COUNT(*)::int AS total FROM lost_found_items i ${whereClause}`, params);
  const total = countRes.rows[0]?.total || 0;

  const safeLimit = Math.min(50, Math.max(1, limit));
  const offset = (Math.max(1, page) - 1) * safeLimit;
  params.push(safeLimit, offset);

  const { rows } = await db.query(
    `SELECT i.*, u.name AS reporter_name, u.email AS reporter_email,
            (SELECT COUNT(*)::int FROM lost_found_claims WHERE item_id = i.id) AS claims_count
     FROM lost_found_items i
     JOIN users u ON u.id = i.reporter_id
     ${whereClause}
     ORDER BY i.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    items: rows,
    total,
    page: Number(page),
    limit: safeLimit,
    totalPages: total > 0 ? Math.ceil(total / safeLimit) : 0,
  };
}

async function adminModerateItem(itemId, moderation, user, tenant) {
  const { action, reason, resolution } = moderation;
  const item = await getItemById(itemId, user, tenant);

  let targetStatus;
  if (action === "remove") targetStatus = "removed";
  else if (action === "restore") targetStatus = "open";
  else if (action === "close") targetStatus = "closed";
  else targetStatus = item.status;

  const { rows } = await db.query(
    `UPDATE lost_found_items
     SET status = $1, updated_at = now()
     WHERE id = $2 RETURNING *`,
    [targetStatus, itemId]
  );

  await audit(user.id, `lost_found_admin_${action}`, "lost_found_item", itemId, { reason, resolution });

  return rows[0];
}

async function confirmHandoverByItem(itemId, user, tenant) {
  if (!isValidUuid(itemId)) throw notFound("Lost & Found item not found");
  const { rows } = await db.query(
    "SELECT id FROM lost_found_claims WHERE item_id = $1 AND status IN ('approved', 'completed') ORDER BY created_at DESC LIMIT 1",
    [itemId]
  );
  if (rows.length === 0) {
    throw notFound("No approved claim awaiting handover found for this item");
  }
  const claim = await confirmHandover(rows[0].id, user, tenant);
  return {
    handover: {
      finderConfirmed: claim.handover_confirmed_by_finder,
      claimantConfirmed: claim.handover_confirmed_by_claimant,
      status: claim.status === "completed" ? "returned" : "awaiting_handover",
    },
    claim,
  };
}

module.exports = {
  createItem,
  getItemById,
  listItems,
  updateItem,
  deleteItem,
  getMyItems,
  getItemMatches,
  submitClaim,
  getItemClaims,
  reviewClaim,
  confirmHandover,
  confirmHandoverByItem,
  disputeClaim,
  adminListItems,
  adminModerateItem,
  sanitizeItem,
  sanitizeClaim,
};
