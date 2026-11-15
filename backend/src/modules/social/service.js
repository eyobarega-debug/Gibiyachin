const crypto = require("crypto");
const db = require("../../db");
const { badRequest, forbidden, notFound } = require("../../utils/errors");
const { notify } = require("../../utils/notify");

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * ------------------------------------------------------------------
 * Smart Anonymous Identity System for Gibiyachin Confessions
 * ------------------------------------------------------------------
 * Every student receives a persistent, unique anonymous identifier (e.g. "Anonymous #104").
 * Non-sequential, cryptographically random, collision-resistant per university.
 * Never exposes underlying database user IDs.
 */
async function getOrCreateAnonymousIdentity(userId, universityId) {
  if (!userId) return null;

  // 1. Check existing
  const { rows: existing } = await db.query(
    `SELECT user_id, university_id, identity_number, identity_code, avatar_seed
     FROM confession_user_identities
     WHERE user_id = $1`,
    [userId]
  );
  if (existing.length > 0) {
    return existing[0];
  }

  // 2. Resolve effective universityId if not passed
  let effectiveUniId = universityId;
  if (!effectiveUniId) {
    const { rows: uRows } = await db.query("SELECT university_id FROM users WHERE id = $1", [userId]);
    effectiveUniId = uRows[0]?.university_id;
  }
  if (!effectiveUniId) {
    const { rows: uniRows } = await db.query(
      "SELECT id FROM universities WHERE status = 'active' ORDER BY created_at ASC LIMIT 1"
    );
    effectiveUniId = uniRows[0]?.id;
  }
  if (!effectiveUniId) return null;

  // 3. Generate cryptographically random number between 101 and 9999 (retry on collision)
  for (let attempt = 0; attempt < 50; attempt++) {
    const randNum = crypto.randomInt(101, 10000);
    const code = `Anonymous #${randNum}`;
    const seed = `seed_${randNum}`;

    try {
      const { rows: inserted } = await db.query(
        `INSERT INTO confession_user_identities (user_id, university_id, identity_number, identity_code, avatar_seed)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING user_id, university_id, identity_number, identity_code, avatar_seed`,
        [userId, effectiveUniId, randNum, code, seed]
      );
      if (inserted.length > 0) {
        return inserted[0];
      }
    } catch (err) {
      if (err.code === "23505") {
        // Unique collision on (university_id, identity_number), loop and retry
        continue;
      }
      throw err;
    }
  }

  // Fallback wider range
  const wideNum = crypto.randomInt(10000, 999999);
  const code = `Anonymous #${wideNum}`;
  const seed = `seed_${wideNum}`;
  const { rows: inserted } = await db.query(
    `INSERT INTO confession_user_identities (user_id, university_id, identity_number, identity_code, avatar_seed)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING user_id, university_id, identity_number, identity_code, avatar_seed`,
    [userId, effectiveUniId, wideNum, code, seed]
  );
  if (inserted.length > 0) return inserted[0];

  const { rows: finalCheck } = await db.query(
    `SELECT user_id, university_id, identity_number, identity_code, avatar_seed
     FROM confession_user_identities
     WHERE user_id = $1`,
    [userId]
  );
  return finalCheck[0];
}

async function getMyAnonymousIdentity(userId, universityId) {
  const identity = await getOrCreateAnonymousIdentity(userId, universityId);
  return {
    identity: identity ? identity.identity_code : "Anonymous",
    number: identity ? identity.identity_number : null,
    avatarSeed: identity ? identity.avatar_seed : null,
  };
}

/**
 * Helper to slugify a community name
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/**
 * Format post record into consistent frontend presentation
 */
const CATEGORY_MAP = {
  // Gibiyachin Confessions Categories
  love: "Love & Relationships",
  "love & relationships": "Love & Relationships",
  "love & relationships ❤️": "Love & Relationships",
  funny: "Funny Confessions",
  "funny confessions": "Funny Confessions",
  "funny confessions 😂": "Funny Confessions",
  university_life: "University Life",
  "university life": "University Life",
  "university life 🎓": "University Life",
  heartbreak: "Heartbreak",
  "heartbreak 💔": "Heartbreak",
  secrets: "Secrets",
  secret: "Secrets",
  "secrets 🤫": "Secrets",
  rants: "Rants & Frustrations",
  "rants & frustrations": "Rants & Frustrations",
  "rants & frustrations 😭": "Rants & Frustrations",
  random: "Random Thoughts",
  "random thoughts": "Random Thoughts",
  "random thoughts 💭": "Random Thoughts",
  hot_takes: "Hot Takes",
  "hot takes": "Hot Takes",
  "hot takes 🔥": "Hot Takes",
  academic_life: "Academic Life",
  "academic life": "Academic Life",
  "academic life 📚": "Academic Life",
  other: "Other",
  // Legacy categories
  general: "General",
  academic: "Education",
  education: "Education",
  tech: "Technology",
  technology: "Technology",
  entertainment: "Entertainment",
  sports: "Sports",
  business: "Business",
  events: "Events",
  questions: "Questions",
  campus_life: "Campus Life",
  "campus life": "Campus Life",
  announcements: "Announcements",
  announcement: "Announcements",
  creative: "Entertainment",
  gaming: "Entertainment",
  career: "Business",
};

function normalizeCategory(cat) {
  if (!cat) return "General";
  const key = String(cat).trim().toLowerCase();
  return CATEGORY_MAP[key] || "General";
}

function normalizeAudience(aud, hasCommunity = false) {
  if (hasCommunity) {
    const key = String(aud || "").trim().toLowerCase();
    return key === "private" ? "private" : "community";
  }
  const key = String(aud || "").trim().toLowerCase();
  if (key === "private") return "private";
  return "university";
}

const REPORT_CATEGORY_MAP = {
  harassment: "harassment",
  bullying: "bullying",
  spam: "spam",
  fraud: "fraud",
  impersonation: "impersonation",
  inappropriate_content: "inappropriate_content",
  hate_or_abusive: "hate_or_abusive",
  hate_speech: "hate_or_abusive",
  misinformation: "other",
  other: "other",
};

function formatPost(row, currentUserId) {
  const pollOptions = Array.isArray(row.poll_options) ? row.poll_options : [];
  const totalVotes = parseInt(row.poll_total_votes || "0", 10);

  const formattedPoll = row.poll_id
    ? {
        id: row.poll_id,
        question: row.poll_question,
        expiresAt: row.poll_expires_at,
        isExpired: row.poll_expires_at ? new Date(row.poll_expires_at) < new Date() : false,
        totalVotes,
        userVotedOptionId: row.user_voted_option_id || null,
        hasVoted: Boolean(row.user_voted_option_id),
        options: pollOptions.map((opt) => {
          const vCount = parseInt(opt.vote_count || "0", 10);
          const percentage = totalVotes > 0 ? Math.round((vCount / totalVotes) * 100) : 0;
          return {
            id: opt.id,
            text: opt.option_text,
            optionText: opt.option_text,
            voteCount: vCount,
            votesCount: vCount,
            percentage,
            isVotedByMe: row.user_voted_option_id === opt.id,
          };
        }),
      }
    : null;

  const isOfficial = Boolean(row.is_official);
  const isAnonymous = row.is_anonymous !== false;
  const isAuthor = currentUserId ? row.author_id === currentUserId : false;

  // Smart Anonymous Identity (Gibiyachin Confessions):
  // Resolves the consistent Anonymous #<num> identity for this author.
  // Real name, email, department, avatar, and authorId are completely omitted.
  let authorName = "Anonymous";
  if (isOfficial) {
    authorName = "Campus Administration";
  } else if (row.author_identity_code) {
    authorName = row.author_identity_code;
  } else if (row.author_name && row.author_name.startsWith("Anonymous #")) {
    authorName = row.author_name;
  } else if (row.author_id) {
    const pseudoNum = (Math.abs(hashString(String(row.author_id))) % 9000) + 101;
    authorName = `Anonymous #${pseudoNum}`;
  }

  // Parse recent likes: list of anonymous identities
  const rawRecentLikes = Array.isArray(row.recent_likes) ? row.recent_likes : [];
  const recentLikes = rawRecentLikes
    .map((l) => (typeof l === "string" ? l : l?.identity || ""))
    .filter(Boolean);

  return {
    id: row.id,
    universityId: row.university_id,
    content: row.content,
    mediaUrls: Array.isArray(row.images) ? row.images : [],
    images: Array.isArray(row.images) ? row.images : [],
    location: row.location || null,
    category: row.category,
    postType: row.post_type,
    audience: row.audience,
    authorName,
    authorIdentity: isOfficial ? null : authorName,
    authorAvatarSeed: isOfficial ? null : (row.author_avatar_seed || `seed_${authorName.replace(/\D/g, "")}`),
    authorAvatar: null,
    authorDepartment: null,
    isOfficial,
    isPinned: Boolean(row.is_pinned),
    isAnonymous,
    status: row.status,
    likesCount: parseInt(row.likes_count || "0", 10),
    recentLikes,
    commentsCount: parseInt(row.comments_count || "0", 10),
    sharesCount: parseInt(row.shares_count || "0", 10),
    bookmarksCount: parseInt(row.bookmarks_count || "0", 10),
    isLiked: Boolean(row.is_liked),
    isBookmarked: Boolean(row.is_bookmarked),
    isAuthor,
    communityId: row.community_id || null,
    community: row.community_id
      ? {
          id: row.community_id,
          name: row.community_name,
          slug: row.community_slug,
          avatarUrl: row.community_avatar,
          type: row.community_type,
        }
      : null,
    poll: formattedPoll,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * ------------------------------------------------------------------
 * 1. Social Feed & Post Listing
 * ------------------------------------------------------------------
 */
async function getFeed(userId, universityId, {
  tab = "for_you",
  category,
  communityId,
  authorId,
  page = 1,
  limit = 20,
  search,
} = {}) {
  const offset = (page - 1) * limit;
  const params = [userId || "00000000-0000-0000-0000-000000000000"];
  const conditions = [];

  // University isolation
  if (universityId) {
    params.push(universityId);
    conditions.push(`sp.university_id = $${params.length}`);
  }

  // Hide deleted posts; non-authors only see published posts
  if ((tab === "my_posts" || tab === "mine") && userId) {
    params.push(userId);
    conditions.push(`sp.author_id = $${params.length}`);
    conditions.push(`sp.status IN ('published', 'draft')`);
  } else {
    conditions.push(`sp.status = 'published'`);
  }

  // Filter by category
  if (category && category !== "All") {
    params.push(normalizeCategory(category));
    conditions.push(`sp.category = $${params.length}`);
  }

  // Filter by community
  if (communityId) {
    params.push(communityId);
    conditions.push(`sp.community_id = $${params.length}`);
  }

  // Filter by specific author (strictly protected: users can only filter their own authorId)
  if (authorId && userId && authorId === userId) {
    params.push(authorId);
    conditions.push(`sp.author_id = $${params.length}`);
  }

  // Text search
  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIdx = params.length;
    conditions.push(`(LOWER(sp.content) LIKE $${sIdx} OR LOWER(COALESCE(sp.location, '')) LIKE $${sIdx} OR LOWER(COALESCE(c.name, '')) LIKE $${sIdx})`);
  }

  // Tab-specific filters & ordering
  let orderBy = "sp.is_pinned DESC, sp.created_at DESC";

  if ((tab === "my_posts" || tab === "mine") && userId) {
    orderBy = "sp.created_at DESC";
  } else if (tab === "saved" && userId) {
    conditions.push(`EXISTS (SELECT 1 FROM social_bookmarks sb WHERE sb.post_id = sp.id AND sb.user_id = $1)`);
  } else if (tab === "following" && userId) {
    conditions.push(`(
      sp.community_id IN (SELECT cm.community_id FROM community_members cm WHERE cm.user_id = $1)
    )`);
  } else if (tab === "communities") {
    conditions.push(`sp.community_id IS NOT NULL`);
  } else if (tab === "announcements") {
    conditions.push(`(sp.is_official = true OR sp.category = 'Announcements')`);
  } else if (tab === "trending") {
    // Dynamic engagement decay formula:
    // (likes * 2 + comments * 3 + shares * 1.5 + 1) / (hours_passed + 2)^1.3
    orderBy = `
      sp.is_pinned DESC,
      ((sp.likes_count * 2.0 + sp.comments_count * 3.0 + sp.shares_count * 1.5 + 1.0) /
       POWER(GREATEST(EXTRACT(EPOCH FROM (NOW() - sp.created_at))/3600.0, 0) + 2.0, 1.3)) DESC,
      sp.created_at DESC
    `;
  } else if (tab === "most_liked" || tab === "top") {
    orderBy = "sp.is_pinned DESC, sp.likes_count DESC, sp.created_at DESC";
  } else if (tab === "most_discussed" || tab === "discussed") {
    orderBy = "sp.is_pinned DESC, sp.comments_count DESC, sp.created_at DESC";
  } else if (tab === "latest" || tab === "recent") {
    orderBy = "sp.is_pinned DESC, sp.created_at DESC";
  } else if (tab === "for_you" && userId) {
    // Prioritize pinned official announcements + communities user is in + high recent activity
    orderBy = `
      sp.is_pinned DESC,
      (CASE WHEN sp.community_id IN (SELECT cm.community_id FROM community_members cm WHERE cm.user_id = $1) THEN 1 ELSE 0 END) DESC,
      (sp.likes_count * 2 + sp.comments_count * 3) DESC,
      sp.created_at DESC
    `;
  }

  // Private community visibility guard:
  // If post belongs to a private community, current user MUST be an approved member
  conditions.push(`(
    c.type IS NULL 
    OR c.type != 'private' 
    OR EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = $1)
    OR sp.author_id = $1
  )`);

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // 1. Total Count Query
  const countQuery = `
    SELECT COUNT(sp.id)::int as total
    FROM social_posts sp
    LEFT JOIN communities c ON c.id = sp.community_id
    ${whereClause}
  `;
  const countRes = await db.query(countQuery, params);
  const total = countRes.rows[0]?.total || 0;

  // 2. Posts Query with Aggregated Poll Data and Like/Bookmark status
  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const query = `
    SELECT 
      sp.*,
      COALESCE(cui.identity_code, 'Anonymous #' || (abs(hashtext(sp.author_id::text)) % 9000 + 101)) as author_name,
      cui.identity_code as author_identity_code,
      cui.identity_number as author_identity_number,
      cui.avatar_seed as author_avatar_seed,
      uni.name as university_name,
      c.name as community_name,
      c.slug as community_slug,
      c.avatar_url as community_avatar,
      c.type as community_type,
      EXISTS (SELECT 1 FROM social_likes sl WHERE sl.post_id = sp.id AND sl.user_id = $1) as is_liked,
      EXISTS (SELECT 1 FROM social_bookmarks sb WHERE sb.post_id = sp.id AND sb.user_id = $1) as is_bookmarked,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'identity', COALESCE(cui_l.identity_code, 'Anonymous #' || (abs(hashtext(sub_l.user_id::text)) % 9000 + 101)),
            'avatarSeed', cui_l.avatar_seed
          )
        )
        FROM (
          SELECT sl.user_id
          FROM social_likes sl
          WHERE sl.post_id = sp.id
          ORDER BY sl.created_at DESC
          LIMIT 3
        ) sub_l
        LEFT JOIN confession_user_identities cui_l ON cui_l.user_id = sub_l.user_id
      ) as recent_likes,
      p.id as poll_id,
      p.question as poll_question,
      p.expires_at as poll_expires_at,
      p.total_votes as poll_total_votes,
      (
        SELECT spv.option_id 
        FROM social_poll_votes spv 
        WHERE spv.poll_id = p.id AND spv.user_id = $1
      ) as user_voted_option_id,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', spo.id,
            'option_text', spo.option_text,
            'vote_count', spo.vote_count,
            'sort_order', spo.sort_order
          ) ORDER BY spo.sort_order ASC
        )
        FROM social_poll_options spo
        WHERE spo.poll_id = p.id
      ) as poll_options
    FROM social_posts sp
    JOIN universities uni ON uni.id = sp.university_id
    LEFT JOIN confession_user_identities cui ON cui.user_id = sp.author_id
    LEFT JOIN communities c ON c.id = sp.community_id
    LEFT JOIN social_polls p ON p.post_id = sp.id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await db.query(query, params);
  return {
    posts: rows.map((r) => formatPost(r, userId)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get single post details by ID
 */
async function getPostById(postId, userId, universityId) {
  const query = `
    SELECT 
      sp.*,
      COALESCE(cui.identity_code, 'Anonymous #' || (abs(hashtext(sp.author_id::text)) % 9000 + 101)) as author_name,
      cui.identity_code as author_identity_code,
      cui.identity_number as author_identity_number,
      cui.avatar_seed as author_avatar_seed,
      uni.name as university_name,
      c.name as community_name,
      c.slug as community_slug,
      c.avatar_url as community_avatar,
      c.type as community_type,
      EXISTS (SELECT 1 FROM social_likes sl WHERE sl.post_id = sp.id AND sl.user_id = $1) as is_liked,
      EXISTS (SELECT 1 FROM social_bookmarks sb WHERE sb.post_id = sp.id AND sb.user_id = $1) as is_bookmarked,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'identity', COALESCE(cui_l.identity_code, 'Anonymous #' || (abs(hashtext(sub_l.user_id::text)) % 9000 + 101)),
            'avatarSeed', cui_l.avatar_seed
          )
        )
        FROM (
          SELECT sl.user_id
          FROM social_likes sl
          WHERE sl.post_id = sp.id
          ORDER BY sl.created_at DESC
          LIMIT 3
        ) sub_l
        LEFT JOIN confession_user_identities cui_l ON cui_l.user_id = sub_l.user_id
      ) as recent_likes,
      p.id as poll_id,
      p.question as poll_question,
      p.expires_at as poll_expires_at,
      p.total_votes as poll_total_votes,
      (
        SELECT spv.option_id 
        FROM social_poll_votes spv 
        WHERE spv.poll_id = p.id AND spv.user_id = $1
      ) as user_voted_option_id,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', spo.id,
            'option_text', spo.option_text,
            'vote_count', spo.vote_count,
            'sort_order', spo.sort_order
          ) ORDER BY spo.sort_order ASC
        )
        FROM social_poll_options spo
        WHERE spo.poll_id = p.id
      ) as poll_options
    FROM social_posts sp
    JOIN universities uni ON uni.id = sp.university_id
    LEFT JOIN confession_user_identities cui ON cui.user_id = sp.author_id
    LEFT JOIN communities c ON c.id = sp.community_id
    LEFT JOIN social_polls p ON p.post_id = sp.id
    WHERE sp.id = $2
  `;

  const { rows } = await db.query(query, [userId || "00000000-0000-0000-0000-000000000000", postId]);
  if (!rows.length || rows[0].status === "deleted") {
    throw notFound("Post not found");
  }

  const post = rows[0];

  // University check
  if (universityId && post.university_id !== universityId) {
    throw forbidden("Cannot access content from another university");
  }

  // Private community membership check
  if (post.community_type === "private" && post.author_id !== userId) {
    const { rows: memRows } = await db.query(
      "SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2",
      [post.community_id, userId]
    );
    if (!memRows.length) {
      throw forbidden("You must be an approved member of this private community to view this post");
    }
  }

  return formatPost(post, userId);
}

/**
 * ------------------------------------------------------------------
 * 2. Post Creation, Editing & Deletion
 * ------------------------------------------------------------------
 */
async function createPost(authorId, universityId, userRole, data) {
  const isOfficial = Boolean(data.isOfficial || data.is_official || data.postType === "announcement");

  // Official badge security constraint
  if (isOfficial && !["admin", "super_admin"].includes(userRole)) {
    throw forbidden("Only university administrators can create official university announcements");
  }

  // Fallback university resolution
  let effectiveUniId = universityId;
  if (!effectiveUniId) {
    const { rows: uRows } = await db.query("SELECT university_id FROM users WHERE id = $1", [authorId]);
    effectiveUniId = uRows[0]?.university_id;
  }
  if (!effectiveUniId) {
    const { rows: uniRows } = await db.query("SELECT id FROM universities WHERE status = 'active' ORDER BY created_at ASC LIMIT 1");
    effectiveUniId = uniRows[0]?.id;
  }
  if (!effectiveUniId) {
    throw badRequest("A valid university is required to create a post");
  }

  const finalImages = (Array.isArray(data.images) && data.images.length > 0)
    ? data.images
    : (Array.isArray(data.mediaUrls) ? data.mediaUrls : []);

  // Community validation if communityId provided
  if (data.communityId) {
    const { rows: commRows } = await db.query(
      "SELECT id, university_id, type FROM communities WHERE id = $1",
      [data.communityId]
    );
    if (!commRows.length) {
      throw notFound("Community not found");
    }
    const comm = commRows[0];
    if (effectiveUniId && comm.university_id !== effectiveUniId) {
      throw forbidden("Community does not belong to your university");
    }

    // If private community, ensure student is an approved member
    if (comm.type === "private" && !["admin", "super_admin"].includes(userRole)) {
      const { rows: memRows } = await db.query(
        "SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2",
        [data.communityId, authorId]
      );
      if (!memRows.length) {
        throw forbidden("You must join this community before posting");
      }
    }
  }

  // Ensure author has an anonymous identity
  await getOrCreateAnonymousIdentity(authorId, effectiveUniId);

  const effectiveType = isOfficial ? "announcement" : (data.poll ? "poll" : data.postType || "post");
  const effectiveCategory = isOfficial ? "Announcements" : normalizeCategory(data.category);
  const effectiveAudience = normalizeAudience(data.audience, Boolean(data.communityId));

  const newPost = await db.withTransaction(async (client) => {
    // 1. Insert post
    const { rows: postRows } = await client.query(
      `INSERT INTO social_posts (
        university_id, author_id, community_id, content, images, location,
        category, post_type, audience, is_official, is_pinned, status, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'published', $12)
      RETURNING *`,
      [
        effectiveUniId,
        authorId,
        data.communityId || null,
        data.content.trim(),
        finalImages,
        data.location || null,
        effectiveCategory,
        effectiveType,
        effectiveAudience,
        isOfficial,
        Boolean(data.isPinned),
        data.expiresAt || null,
      ]
    );
    const post = postRows[0];

    // 2. If community post, increment posts_count
    if (data.communityId) {
      await client.query(
        "UPDATE communities SET posts_count = posts_count + 1, updated_at = NOW() WHERE id = $1",
        [data.communityId]
      );
    }

    // 3. If poll, insert poll question and options
    if (effectiveType === "poll" && data.poll) {
      const { rows: pollRows } = await client.query(
        `INSERT INTO social_polls (post_id, question, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [post.id, data.poll.question.trim(), data.poll.expiresAt || null]
      );
      const pollId = pollRows[0].id;

      let order = 0;
      for (const optText of data.poll.options) {
        if (optText && optText.trim()) {
          await client.query(
            `INSERT INTO social_poll_options (poll_id, option_text, sort_order)
             VALUES ($1, $2, $3)`,
            [pollId, optText.trim(), order++]
          );
        }
      }
    }

    return post;
  });

  return getPostById(newPost.id, authorId, effectiveUniId);
}

/**
 * Update an existing post
 */
async function updatePost(postId, userId, userRole, data) {
  const { rows } = await db.query(
    "SELECT id, author_id, community_id, university_id, is_official FROM social_posts WHERE id = $1",
    [postId]
  );
  if (!rows.length) {
    throw notFound("Post not found");
  }
  const post = rows[0];

  const isAuthor = post.author_id === userId;
  const isAdmin = ["admin", "super_admin"].includes(userRole);

  if (!isAuthor && !isAdmin) {
    throw forbidden("You are not authorized to edit this post");
  }

  const updates = [];
  const params = [postId];

  if (data.content !== undefined) {
    params.push(data.content.trim());
    updates.push(`content = $${params.length}`);
  }
  if (data.images !== undefined || data.mediaUrls !== undefined) {
    const imgs = data.images !== undefined ? data.images : data.mediaUrls;
    params.push(imgs);
    updates.push(`images = $${params.length}`);
  }
  if (data.location !== undefined) {
    params.push(data.location ? data.location.trim() : null);
    updates.push(`location = $${params.length}`);
  }
  if (data.category !== undefined) {
    params.push(normalizeCategory(data.category));
    updates.push(`category = $${params.length}`);
  }
  if (data.isPinned !== undefined && isAdmin) {
    params.push(Boolean(data.isPinned));
    updates.push(`is_pinned = $${params.length}`);
  }

  if (updates.length > 0) {
    updates.push("updated_at = NOW()");
    await db.query(
      `UPDATE social_posts SET ${updates.join(", ")} WHERE id = $1`,
      params
    );
  }

  return getPostById(postId, userId, post.university_id);
}

/**
 * Delete a post (or soft delete)
 */
async function deletePost(postId, userId, userRole) {
  const { rows } = await db.query(
    "SELECT id, author_id, community_id, university_id FROM social_posts WHERE id = $1",
    [postId]
  );
  if (!rows.length) {
    throw notFound("Post not found");
  }
  const post = rows[0];

  let canDelete = post.author_id === userId || ["admin", "super_admin"].includes(userRole);

  // Community moderator/owner can also moderate community posts
  if (!canDelete && post.community_id) {
    const { rows: memRows } = await db.query(
      "SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2",
      [post.community_id, userId]
    );
    if (memRows.length && ["owner", "moderator"].includes(memRows[0].role)) {
      canDelete = true;
    }
  }

  if (!canDelete) {
    throw forbidden("You are not authorized to delete this post");
  }

  await db.withTransaction(async (client) => {
    await client.query("DELETE FROM social_posts WHERE id = $1", [postId]);
    if (post.community_id) {
      await client.query(
        "UPDATE communities SET posts_count = GREATEST(posts_count - 1, 0), updated_at = NOW() WHERE id = $1",
        [post.community_id]
      );
    }
  });

  return { success: true, postId };
}

/**
 * ------------------------------------------------------------------
 * 3. Interactions: Likes & Bookmarks
 * ------------------------------------------------------------------
 */
async function toggleLikePost(postId, userId) {
  const { rows } = await db.query(
    "SELECT id, author_id, university_id, content FROM social_posts WHERE id = $1 AND status = 'published'",
    [postId]
  );
  if (!rows.length) {
    throw notFound("Post not found");
  }
  const post = rows[0];

  // Ensure user has an anonymous identity
  await getOrCreateAnonymousIdentity(userId, post.university_id);

  const { rows: existingLike } = await db.query(
    "SELECT 1 FROM social_likes WHERE post_id = $1 AND user_id = $2",
    [postId, userId]
  );

  let liked = false;
  if (existingLike.length > 0) {
    // Unlike
    await db.withTransaction(async (client) => {
      await client.query("DELETE FROM social_likes WHERE post_id = $1 AND user_id = $2", [postId, userId]);
      await client.query("UPDATE social_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1", [postId]);
    });
    liked = false;
  } else {
    // Like
    await db.withTransaction(async (client) => {
      await client.query(
        "INSERT INTO social_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [postId, userId]
      );
      await client.query("UPDATE social_posts SET likes_count = likes_count + 1 WHERE id = $1", [postId]);
    });
    liked = true;

    // Send in-app notification if not liking own post (strictly anonymous: zero liker identity exposed)
    if (post.author_id !== userId) {
      notify(
        post.author_id,
        "confession_like",
        "New Like on Your Confession ❤️",
        "Someone liked your confession.",
        {
          targetRoute: `/confessions?post=${postId}`,
          targetEntityType: "confession",
          targetEntityId: postId,
        }
      ).catch((err) => console.warn("[confessions] like notify failed:", err.message));
    }
  }

  const { rows: updatedRows } = await db.query("SELECT likes_count FROM social_posts WHERE id = $1", [postId]);
  const likesData = await getPostLikes(postId, post.university_id);
  return {
    liked,
    likesCount: parseInt(updatedRows[0]?.likes_count || "0", 10),
    recentLikes: likesData.likes.slice(0, 3).map((l) => l.identity),
  };
}

async function getPostLikes(postId, universityId) {
  const { rows: postRows } = await db.query(
    "SELECT id, university_id FROM social_posts WHERE id = $1 AND status = 'published'",
    [postId]
  );
  if (!postRows.length) {
    throw notFound("Confession not found");
  }
  const post = postRows[0];
  if (universityId && post.university_id !== universityId) {
    throw forbidden("Cannot access content from another university");
  }

  const { rows } = await db.query(
    `SELECT 
       COALESCE(cui.identity_code, 'Anonymous #' || (abs(hashtext(sl.user_id::text)) % 9000 + 101)) as identity,
       cui.avatar_seed as avatar_seed,
       sl.created_at
     FROM social_likes sl
     LEFT JOIN confession_user_identities cui ON cui.user_id = sl.user_id
     WHERE sl.post_id = $1
     ORDER BY sl.created_at DESC
     LIMIT 100`,
    [postId]
  );

  return {
    likesCount: rows.length,
    likes: rows.map((r) => ({
      identity: r.identity,
      avatarSeed: r.avatar_seed || `seed_${r.identity.replace(/\D/g, "")}`,
      createdAt: r.created_at,
    })),
  };
}

async function toggleBookmarkPost(postId, userId) {
  const { rows } = await db.query(
    "SELECT id FROM social_posts WHERE id = $1 AND status = 'published'",
    [postId]
  );
  if (!rows.length) {
    throw notFound("Post not found");
  }

  const { rows: existing } = await db.query(
    "SELECT 1 FROM social_bookmarks WHERE post_id = $1 AND user_id = $2",
    [postId, userId]
  );

  let bookmarked = false;
  if (existing.length > 0) {
    await db.withTransaction(async (client) => {
      await client.query("DELETE FROM social_bookmarks WHERE post_id = $1 AND user_id = $2", [postId, userId]);
      await client.query("UPDATE social_posts SET bookmarks_count = GREATEST(bookmarks_count - 1, 0) WHERE id = $1", [postId]);
    });
    bookmarked = false;
  } else {
    await db.withTransaction(async (client) => {
      await client.query("INSERT INTO social_bookmarks (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [postId, userId]);
      await client.query("UPDATE social_posts SET bookmarks_count = bookmarks_count + 1 WHERE id = $1", [postId]);
    });
    bookmarked = true;
  }

  const { rows: updatedRows } = await db.query("SELECT bookmarks_count FROM social_posts WHERE id = $1", [postId]);
  return {
    bookmarked,
    bookmarksCount: parseInt(updatedRows[0]?.bookmarks_count || "0", 10),
  };
}

async function recordShare(postId) {
  const { rows } = await db.query(
    "UPDATE social_posts SET shares_count = shares_count + 1 WHERE id = $1 RETURNING shares_count",
    [postId]
  );
  if (!rows.length) throw notFound("Post not found");
  return { sharesCount: rows[0].shares_count };
}

/**
 * ------------------------------------------------------------------
 * 4. Poll Voting
 * ------------------------------------------------------------------
 */
async function votePoll(targetId, userId, optionId) {
  const { rows: pollRows } = await db.query(
    "SELECT id, post_id, expires_at, total_votes FROM social_polls WHERE id = $1 OR post_id = $1",
    [targetId]
  );
  if (!pollRows.length) {
    throw notFound("Poll not found on this post");
  }
  const poll = pollRows[0];

  // Check expiration
  if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
    throw badRequest("This poll has already expired");
  }

  // Validate option belongs to poll
  const { rows: optRows } = await db.query(
    "SELECT id, poll_id FROM social_poll_options WHERE id = $1 AND poll_id = $2",
    [optionId, poll.id]
  );
  if (!optRows.length) {
    throw badRequest("Selected option does not belong to this poll");
  }

  // Check if user already voted
  const { rows: voteRows } = await db.query(
    "SELECT 1 FROM social_poll_votes WHERE poll_id = $1 AND user_id = $2",
    [poll.id, userId]
  );
  if (voteRows.length > 0) {
    throw badRequest("You have already voted on this poll");
  }

  // Record vote in transaction
  await db.withTransaction(async (client) => {
    await client.query(
      "INSERT INTO social_poll_votes (poll_id, user_id, option_id) VALUES ($1, $2, $3)",
      [poll.id, userId, optionId]
    );
    await client.query(
      "UPDATE social_poll_options SET vote_count = vote_count + 1 WHERE id = $1",
      [optionId]
    );
    await client.query(
      "UPDATE social_polls SET total_votes = total_votes + 1 WHERE id = $1",
      [poll.id]
    );
  });

  const updatedPost = await getPostById(poll.post_id, userId);
  return updatedPost.poll;
}

/**
 * ------------------------------------------------------------------
 * 5. Comments & Discussions
 * ------------------------------------------------------------------
 */
async function getComments(postId, userId, { page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      sc.*,
      COALESCE(cui.identity_code, 'Anonymous #' || (abs(hashtext(sc.author_id::text)) % 9000 + 101)) as author_name,
      cui.identity_code as author_identity_code,
      cui.identity_number as author_identity_number,
      cui.avatar_seed as author_avatar_seed,
      sp.author_id as post_author_id,
      EXISTS (SELECT 1 FROM social_comment_likes scl WHERE scl.comment_id = sc.id AND scl.user_id = $1) as is_liked,
      (SELECT COUNT(*)::int FROM social_comments r WHERE r.parent_comment_id = sc.id AND r.is_deleted = false) as replies_count
    FROM social_comments sc
    JOIN social_posts sp ON sp.id = sc.post_id
    LEFT JOIN confession_user_identities cui ON cui.user_id = sc.author_id
    WHERE sc.post_id = $2
    ORDER BY sc.created_at ASC
    LIMIT $3 OFFSET $4
  `;

  const { rows } = await db.query(query, [userId || "00000000-0000-0000-0000-000000000000", postId, limit, offset]);
  const formatted = rows.map((c) => {
    let authorName = c.author_identity_code;
    if (!authorName) {
      if (c.author_name && c.author_name.startsWith("Anonymous #")) {
        authorName = c.author_name;
      } else {
        const pseudoNum = (Math.abs(hashString(String(c.author_id))) % 9000) + 101;
        authorName = `Anonymous #${pseudoNum}`;
      }
    }
    const isPostAuthor = Boolean(c.post_author_id && c.author_id === c.post_author_id);
    const isAuthor = Boolean(userId && c.author_id === userId);

    return {
      id: c.id,
      postId: c.post_id,
      parentCommentId: c.parent_comment_id,
      authorName,
      authorIdentity: authorName,
      authorAvatarSeed: c.author_avatar_seed || `seed_${authorName.replace(/\D/g, "")}`,
      authorAvatar: null,
      authorDepartment: null,
      isPostAuthor,
      isAuthor,
      content: c.is_deleted ? "[Comment deleted]" : c.content,
      likesCount: c.likes_count,
      isLiked: Boolean(c.is_liked),
      isEdited: Boolean(c.is_edited),
      isDeleted: Boolean(c.is_deleted),
      repliesCount: c.replies_count,
      replies: [],
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  });

  const commentMap = new Map();
  formatted.forEach((c) => commentMap.set(c.id, c));

  const topLevel = [];
  formatted.forEach((c) => {
    if (c.parentCommentId && commentMap.has(c.parentCommentId)) {
      commentMap.get(c.parentCommentId).replies.push(c);
    } else {
      topLevel.push(c);
    }
  });

  return topLevel;
}

async function createComment(postId, authorId, { content, parentCommentId = null }) {
  const { rows: postRows } = await db.query(
    "SELECT id, author_id, university_id, content FROM social_posts WHERE id = $1 AND status = 'published'",
    [postId]
  );
  if (!postRows.length) {
    throw notFound("Post not found");
  }
  const post = postRows[0];

  // If parent comment supplied, verify it exists
  let parentAuthorId = null;
  if (parentCommentId) {
    const { rows: parentRows } = await db.query(
      "SELECT id, author_id FROM social_comments WHERE id = $1 AND post_id = $2",
      [parentCommentId, postId]
    );
    if (!parentRows.length) {
      throw badRequest("Parent comment not found");
    }
    parentAuthorId = parentRows[0].author_id;
  }

  // Ensure commenter has an anonymous identity
  const commenterIdentity = await getOrCreateAnonymousIdentity(authorId, post.university_id);

  const comment = await db.withTransaction(async (client) => {
    const { rows: commentRows } = await client.query(
      `INSERT INTO social_comments (post_id, author_id, parent_comment_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [postId, authorId, parentCommentId, content.trim()]
    );
    await client.query(
      "UPDATE social_posts SET comments_count = comments_count + 1 WHERE id = $1",
      [postId]
    );
    return commentRows[0];
  });

  // Notify post author (or parent comment author if reply) with anonymous identity
  const notifyRecipient = parentAuthorId && parentAuthorId !== authorId ? parentAuthorId : post.author_id;
  if (notifyRecipient && notifyRecipient !== authorId) {
    const isReply = Boolean(parentAuthorId);
    notify(
      notifyRecipient,
      isReply ? "confession_reply" : "confession_comment",
      isReply ? "New Reply on Your Confession Comment 💬" : "New Comment on Your Confession 💬",
      isReply
        ? `${commenterIdentity.identity_code} replied to your comment on a confession.`
        : `${commenterIdentity.identity_code} commented on your confession.`,
      {
        targetRoute: `/confessions?post=${postId}`,
        targetEntityType: "confession",
        targetEntityId: postId,
      }
    ).catch((err) => console.warn("[confessions] comment notify failed:", err.message));
  }

  const isPostAuthor = Boolean(post.author_id && post.author_id === authorId);

  return {
    id: comment.id,
    postId: comment.post_id,
    parentCommentId: comment.parent_comment_id,
    authorName: commenterIdentity.identity_code,
    authorIdentity: commenterIdentity.identity_code,
    authorAvatarSeed: commenterIdentity.avatar_seed,
    authorAvatar: null,
    authorDepartment: null,
    isPostAuthor,
    isAuthor: true,
    content: comment.content,
    likesCount: 0,
    isLiked: false,
    isEdited: false,
    isDeleted: false,
    repliesCount: 0,
    replies: [],
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  };
}

async function updateComment(commentId, userId, { content }) {
  const { rows } = await db.query(
    "SELECT id, author_id, post_id, is_deleted FROM social_comments WHERE id = $1",
    [commentId]
  );
  if (!rows.length || rows[0].is_deleted) {
    throw notFound("Comment not found");
  }
  if (rows[0].author_id !== userId) {
    throw forbidden("You can only edit your own comments");
  }

  await db.query(
    "UPDATE social_comments SET content = $1, is_edited = true, updated_at = NOW() WHERE id = $2",
    [content.trim(), commentId]
  );

  const comments = await getComments(rows[0].post_id, userId, { limit: 100 });
  return comments.find((c) => c.id === commentId);
}

async function deleteComment(commentId, userId, userRole) {
  const { rows } = await db.query(
    "SELECT id, author_id, post_id, is_deleted FROM social_comments WHERE id = $1",
    [commentId]
  );
  if (!rows.length) {
    throw notFound("Comment not found");
  }
  const comment = rows[0];

  const canDelete = comment.author_id === userId || ["admin", "super_admin"].includes(userRole);
  if (!canDelete) {
    throw forbidden("You are not authorized to delete this comment");
  }

  await db.withTransaction(async (client) => {
    // Soft delete to preserve thread replies structure
    await client.query(
      "UPDATE social_comments SET is_deleted = true, content = '[Comment deleted]', updated_at = NOW() WHERE id = $1",
      [commentId]
    );
    await client.query(
      "UPDATE social_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1",
      [comment.post_id]
    );
  });

  return { success: true, commentId };
}

async function toggleLikeComment(commentId, userId) {
  const { rows } = await db.query(
    "SELECT id, likes_count FROM social_comments WHERE id = $1 AND is_deleted = false",
    [commentId]
  );
  if (!rows.length) {
    throw notFound("Comment not found");
  }

  const { rows: existing } = await db.query(
    "SELECT 1 FROM social_comment_likes WHERE comment_id = $1 AND user_id = $2",
    [commentId, userId]
  );

  let liked = false;
  if (existing.length > 0) {
    await db.withTransaction(async (client) => {
      await client.query("DELETE FROM social_comment_likes WHERE comment_id = $1 AND user_id = $2", [commentId, userId]);
      await client.query("UPDATE social_comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1", [commentId]);
    });
    liked = false;
  } else {
    await db.withTransaction(async (client) => {
      await client.query("INSERT INTO social_comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [commentId, userId]);
      await client.query("UPDATE social_comments SET likes_count = likes_count + 1 WHERE id = $1", [commentId]);
    });
    liked = true;
  }

  const { rows: updated } = await db.query("SELECT likes_count FROM social_comments WHERE id = $1", [commentId]);
  return { liked, likesCount: updated[0].likes_count };
}

/**
 * ------------------------------------------------------------------
 * 6. Campus Communities
 * ------------------------------------------------------------------
 */
async function getCommunities(universityId, userId, { search, category, type, joinedOnly = false } = {}) {
  const params = [userId || "00000000-0000-0000-0000-000000000000"];
  const conditions = [];

  if (universityId) {
    params.push(universityId);
    conditions.push(`c.university_id = $${params.length}`);
  }

  if (category && category !== "All") {
    params.push(category);
    conditions.push(`c.category = $${params.length}`);
  }

  if (type) {
    params.push(type);
    conditions.push(`c.type = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIdx = params.length;
    conditions.push(`(LOWER(c.name) LIKE $${sIdx} OR LOWER(COALESCE(c.description, '')) LIKE $${sIdx})`);
  }

  if (joinedOnly && userId) {
    conditions.push(`EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = $1)`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT 
      c.*,
      uni.name as university_name,
      u.name as creator_name,
      EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = $1) as is_member,
      (SELECT cm.role FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = $1) as user_role,
      EXISTS (SELECT 1 FROM community_join_requests cjr WHERE cjr.community_id = c.id AND cjr.user_id = $1 AND cjr.status = 'pending') as has_pending_request
    FROM communities c
    JOIN universities uni ON uni.id = c.university_id
    JOIN users u ON u.id = c.creator_id
    ${whereClause}
    ORDER BY c.is_verified DESC, c.members_count DESC, c.name ASC
  `;

  const { rows } = await db.query(query, params);
  return rows.map((r) => ({
    id: r.id,
    universityId: r.university_id,
    universityName: r.university_name,
    name: r.name,
    slug: r.slug,
    description: r.description,
    category: r.category,
    type: r.type,
    avatarUrl: r.avatar_url,
    bannerUrl: r.banner_url,
    rules: r.rules,
    creatorId: r.creator_id,
    creatorName: r.creator_name,
    membersCount: r.members_count,
    postsCount: r.posts_count,
    isVerified: Boolean(r.is_verified),
    isMember: Boolean(r.is_member),
    userRole: r.user_role || null,
    hasPendingRequest: Boolean(r.has_pending_request),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

async function getCommunityById(idOrSlug, universityId, userId) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  const col = isUuid ? "c.id" : "c.slug";

  const query = `
    SELECT 
      c.*,
      uni.name as university_name,
      u.name as creator_name,
      EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = $1) as is_member,
      (SELECT cm.role FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = $1) as user_role,
      EXISTS (SELECT 1 FROM community_join_requests cjr WHERE cjr.community_id = c.id AND cjr.user_id = $1 AND cjr.status = 'pending') as has_pending_request
    FROM communities c
    JOIN universities uni ON uni.id = c.university_id
    JOIN users u ON u.id = c.creator_id
    WHERE ${col} = $2
  `;

  const { rows } = await db.query(query, [userId || "00000000-0000-0000-0000-000000000000", idOrSlug]);
  if (!rows.length) {
    throw notFound("Community not found");
  }
  const comm = rows[0];

  if (universityId && comm.university_id !== universityId) {
    throw forbidden("Community belongs to another university");
  }

  // Fetch recent members preview
  const { rows: memberRows } = await db.query(
    `SELECT u.id, u.name, u.avatar_url, u.department, cm.role, cm.joined_at
     FROM community_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.community_id = $1
     ORDER BY CASE WHEN cm.role = 'owner' THEN 1 WHEN cm.role = 'moderator' THEN 2 ELSE 3 END, cm.joined_at ASC
     LIMIT 20`,
    [comm.id]
  );

  return {
    id: comm.id,
    universityId: comm.university_id,
    universityName: comm.university_name,
    name: comm.name,
    slug: comm.slug,
    description: comm.description,
    category: comm.category,
    type: comm.type,
    avatarUrl: comm.avatar_url,
    bannerUrl: comm.banner_url,
    rules: comm.rules,
    creatorId: comm.creator_id,
    creatorName: comm.creator_name,
    membersCount: comm.members_count,
    postsCount: comm.posts_count,
    isVerified: Boolean(comm.is_verified),
    isMember: Boolean(comm.is_member),
    userRole: comm.user_role || null,
    hasPendingRequest: Boolean(comm.has_pending_request),
    membersPreview: memberRows.map((m) => ({
      id: m.id,
      name: m.name,
      avatarUrl: m.avatar_url,
      department: m.department,
      role: m.role,
      joinedAt: m.joined_at,
    })),
    createdAt: comm.created_at,
    updatedAt: comm.updated_at,
  };
}

async function createCommunity(creatorId, universityId, userRole, data) {
  const isOfficial = data.type === "official";
  if (isOfficial && !["admin", "super_admin"].includes(userRole)) {
    throw forbidden("Only university administrators can create official campus communities");
  }

  let effectiveUniId = universityId;
  if (!effectiveUniId) {
    const { rows: uRows } = await db.query("SELECT university_id FROM users WHERE id = $1", [creatorId]);
    effectiveUniId = uRows[0]?.university_id;
  }
  if (!effectiveUniId) {
    const { rows: uniRows } = await db.query("SELECT id FROM universities WHERE status = 'active' ORDER BY created_at ASC LIMIT 1");
    effectiveUniId = uniRows[0]?.id;
  }
  if (!effectiveUniId) {
    throw badRequest("A valid university is required to create a community");
  }

  let finalSlug = data.slug ? slugify(data.slug) : slugify(data.name);
  if (!finalSlug) finalSlug = `comm-${Date.now()}`;

  // Ensure unique slug per university
  const { rows: existSlug } = await db.query(
    "SELECT 1 FROM communities WHERE university_id = $1 AND slug = $2",
    [effectiveUniId, finalSlug]
  );
  if (existSlug.length > 0) {
    finalSlug = `${finalSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const community = await db.withTransaction(async (client) => {
    const { rows: commRows } = await client.query(
      `INSERT INTO communities (
        university_id, name, slug, description, category, type,
        avatar_url, banner_url, rules, creator_id, members_count, is_verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11)
      RETURNING *`,
      [
        effectiveUniId,
        data.name.trim(),
        finalSlug,
        data.description || "",
        data.category || "General",
        data.type || "public",
        data.avatarUrl || null,
        data.bannerUrl || null,
        data.rules || null,
        creatorId,
        isOfficial,
      ]
    );
    const comm = commRows[0];

    // Creator is automatically owner
    await client.query(
      `INSERT INTO community_members (community_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [comm.id, creatorId]
    );

    return comm;
  });

  return getCommunityById(community.id, effectiveUniId, creatorId);
}

async function updateCommunity(communityId, userId, userRole, data) {
  const { rows } = await db.query(
    "SELECT * FROM communities WHERE id = $1",
    [communityId]
  );
  if (!rows.length) throw notFound("Community not found");
  const comm = rows[0];

  const isAdmin = ["admin", "super_admin"].includes(userRole);
  const { rows: memRows } = await db.query(
    "SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2",
    [communityId, userId]
  );
  const isOwner = memRows.length && memRows[0].role === "owner";

  if (!isOwner && !isAdmin) {
    throw forbidden("Only the community owner or campus administrator can update community details");
  }

  const updates = [];
  const params = [communityId];

  if (data.name) {
    params.push(data.name.trim());
    updates.push(`name = $${params.length}`);
  }
  if (data.description !== undefined) {
    params.push(data.description);
    updates.push(`description = $${params.length}`);
  }
  if (data.category) {
    params.push(data.category);
    updates.push(`category = $${params.length}`);
  }
  if (data.avatarUrl !== undefined) {
    params.push(data.avatarUrl);
    updates.push(`avatar_url = $${params.length}`);
  }
  if (data.bannerUrl !== undefined) {
    params.push(data.bannerUrl);
    updates.push(`banner_url = $${params.length}`);
  }
  if (data.rules !== undefined) {
    params.push(data.rules);
    updates.push(`rules = $${params.length}`);
  }
  if (data.type && isAdmin) {
    params.push(data.type);
    updates.push(`type = $${params.length}`);
  }

  if (updates.length > 0) {
    updates.push("updated_at = NOW()");
    await db.query(
      `UPDATE communities SET ${updates.join(", ")} WHERE id = $1`,
      params
    );
  }

  return getCommunityById(communityId, comm.university_id, userId);
}

async function joinCommunity(communityId, userId, universityId) {
  const { rows } = await db.query(
    "SELECT id, university_id, type, name, creator_id FROM communities WHERE id = $1",
    [communityId]
  );
  if (!rows.length) throw notFound("Community not found");
  const comm = rows[0];

  if (universityId && comm.university_id !== universityId) {
    throw forbidden("Cannot join a community belonging to another university");
  }

  // Already a member?
  const { rows: existingMem } = await db.query(
    "SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2",
    [communityId, userId]
  );
  if (existingMem.length > 0) {
    return { status: "already_member", role: existingMem[0].role };
  }

  // If private: create join request
  if (comm.type === "private") {
    await db.query(
      `INSERT INTO community_join_requests (community_id, user_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (community_id, user_id) DO UPDATE SET status = 'pending', updated_at = NOW()`,
      [communityId, userId]
    );

    // Notify community owner
    notify(
      comm.creator_id,
      "community_join_request",
      "New Community Join Request 👥",
      `A student requested to join "${comm.name}".`,
      {
        targetRoute: `/community/communities/${comm.id}`,
        targetEntityType: "community",
        targetEntityId: comm.id,
      }
    ).catch(() => {});

    return { status: "requested", message: "Join request submitted for review" };
  }

  // Public or official: join directly
  await db.withTransaction(async (client) => {
    await client.query(
      "INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
      [communityId, userId]
    );
    await client.query(
      "UPDATE communities SET members_count = members_count + 1, updated_at = NOW() WHERE id = $1",
      [communityId]
    );
  });

  return { status: "joined", role: "member" };
}

async function leaveCommunity(communityId, userId) {
  const { rows } = await db.query(
    "SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2",
    [communityId, userId]
  );
  if (!rows.length) {
    throw badRequest("You are not a member of this community");
  }

  if (rows[0].role === "owner") {
    const { rows: otherOwners } = await db.query(
      "SELECT 1 FROM community_members WHERE community_id = $1 AND role = 'owner' AND user_id != $2",
      [communityId, userId]
    );
    if (!otherOwners.length) {
      throw badRequest("As the sole owner, you must assign another owner before leaving this community");
    }
  }

  await db.withTransaction(async (client) => {
    await client.query(
      "DELETE FROM community_members WHERE community_id = $1 AND user_id = $2",
      [communityId, userId]
    );
    await client.query(
      "UPDATE communities SET members_count = GREATEST(members_count - 1, 0), updated_at = NOW() WHERE id = $1",
      [communityId]
    );
  });

  return { success: true, communityId };
}

async function reviewJoinRequest(communityId, requestId, reviewerId, reviewerRole, status) {
  const { rows: reqRows } = await db.query(
    "SELECT * FROM community_join_requests WHERE id = $1 AND community_id = $2",
    [requestId, communityId]
  );
  if (!reqRows.length) throw notFound("Join request not found");
  const joinReq = reqRows[0];

  // Authorization check: reviewer must be owner, moderator, or admin
  const { rows: memRows } = await db.query(
    "SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2",
    [communityId, reviewerId]
  );
  const isAuthorized =
    ["admin", "super_admin"].includes(reviewerRole) ||
    (memRows.length && ["owner", "moderator"].includes(memRows[0].role));

  if (!isAuthorized) {
    throw forbidden("You are not authorized to moderate join requests for this community");
  }

  await db.withTransaction(async (client) => {
    await client.query(
      "UPDATE community_join_requests SET status = $1, reviewed_by = $2, updated_at = NOW() WHERE id = $3",
      [status, reviewerId, requestId]
    );

    if (status === "approved") {
      await client.query(
        "INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
        [communityId, joinReq.user_id]
      );
      await client.query(
        "UPDATE communities SET members_count = members_count + 1, updated_at = NOW() WHERE id = $1",
        [communityId]
      );
    }
  });

  return { success: true, requestId, status };
}

async function updateMemberRole(communityId, targetUserId, newRole, actorId, actorRole) {
  const isAdmin = ["admin", "super_admin"].includes(actorRole);
  const { rows: actorMem } = await db.query(
    "SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2",
    [communityId, actorId]
  );
  const isOwner = actorMem.length && actorMem[0].role === "owner";

  if (!isOwner && !isAdmin) {
    throw forbidden("Only the community owner can promote or demote members");
  }

  const { rows: targetMem } = await db.query(
    "SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2",
    [communityId, targetUserId]
  );
  if (!targetMem.length) {
    throw notFound("Target user is not a member of this community");
  }

  await db.query(
    "UPDATE community_members SET role = $1 WHERE community_id = $2 AND user_id = $3",
    [newRole, communityId, targetUserId]
  );

  return { success: true, communityId, targetUserId, role: newRole };
}

async function removeMember(communityId, targetUserId, actorId, actorRole) {
  const isAdmin = ["admin", "super_admin"].includes(actorRole);
  const { rows: actorMem } = await db.query(
    "SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2",
    [communityId, actorId]
  );
  const actorRoleInComm = actorMem.length ? actorMem[0].role : null;

  const { rows: targetMem } = await db.query(
    "SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2",
    [communityId, targetUserId]
  );
  if (!targetMem.length) throw notFound("Member not found in this community");

  const targetRoleInComm = targetMem[0].role;

  // Cannot remove owner
  if (targetRoleInComm === "owner" && !isAdmin) {
    throw forbidden("Cannot remove the community owner");
  }

  // Moderator can only remove regular members
  if (actorRoleInComm === "moderator" && targetRoleInComm !== "member") {
    throw forbidden("Moderators cannot remove other moderators or owners");
  }

  if (actorRoleInComm !== "owner" && actorRoleInComm !== "moderator" && !isAdmin) {
    throw forbidden("You are not authorized to remove members from this community");
  }

  await db.withTransaction(async (client) => {
    await client.query(
      "DELETE FROM community_members WHERE community_id = $1 AND user_id = $2",
      [communityId, targetUserId]
    );
    await client.query(
      "UPDATE communities SET members_count = GREATEST(members_count - 1, 0), updated_at = NOW() WHERE id = $1",
      [communityId]
    );
  });

  return { success: true, communityId, targetUserId };
}

/**
 * ------------------------------------------------------------------
 * 7. University Announcements
 * ------------------------------------------------------------------
 */
async function getAnnouncements(universityId, { page = 1, limit = 20 } = {}) {
  return getFeed(null, universityId, {
    tab: "announcements",
    page,
    limit,
  });
}

/**
 * ------------------------------------------------------------------
 * 8. Moderation & Safety Reporting
 * ------------------------------------------------------------------
 */
async function reportContent(reporterId, universityId, data) {
  const targetType = data.targetType || "post";
  const targetId = data.targetId;
  const rawCat = String(data.reasonCategory || data.category || "other").toLowerCase().trim();
  const category = REPORT_CATEGORY_MAP[rawCat] || "other";
  const description = data.reasonDetails || data.description || "Safety report";

  const { rows } = await db.query(
    `INSERT INTO social_reports (university_id, reporter_id, target_type, target_id, category, description, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING id`,
    [universityId, reporterId, targetType, targetId, category, description]
  );

  return { success: true, message: "Safety report submitted", reportId: rows[0].id };
}

async function getReports(universityId, adminRole, { status = "pending", page = 1, limit = 50 } = {}) {
  if (!["admin", "super_admin"].includes(adminRole)) {
    throw forbidden("Only administrators can view moderation reports");
  }

  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  if (adminRole !== "super_admin" && universityId) {
    params.push(universityId);
    conditions.push(`sr.university_id = $${params.length}`);
  }

  if (status && status !== "all") {
    params.push(status);
    conditions.push(`sr.status = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);

  const query = `
    SELECT 
      sr.*,
      u.name as reporter_name,
      u.email as reporter_email
    FROM social_reports sr
    JOIN users u ON u.id = sr.reporter_id
    ${whereClause}
    ORDER BY sr.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const { rows } = await db.query(query, params);
  return rows;
}

async function getCommunityMembers(communityId, universityId) {
  const { rows } = await db.query(
    `SELECT cm.role, cm.created_at, u.id as user_id, u.name as full_name, u.avatar_url, u.department
     FROM community_members cm
     JOIN users u ON u.id = cm.user_id
     JOIN communities c ON c.id = cm.community_id
     WHERE cm.community_id = $1 ${universityId ? "AND c.university_id = $2" : ""}
     ORDER BY (CASE WHEN cm.role = 'owner' THEN 1 WHEN cm.role = 'moderator' THEN 2 ELSE 3 END), cm.created_at ASC`,
    universityId ? [communityId, universityId] : [communityId]
  );
  return rows.map((r) => ({
    userId: r.user_id,
    fullName: r.full_name,
    avatarUrl: r.avatar_url,
    department: r.department,
    role: r.role,
    createdAt: r.created_at,
  }));
}

async function getJoinRequests(communityId, reviewerId, reviewerRole, universityId) {
  const { rows: memRows } = await db.query(
    "SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2",
    [communityId, reviewerId]
  );
  const isAuthorized =
    ["admin", "super_admin"].includes(reviewerRole) ||
    (memRows.length && ["owner", "moderator"].includes(memRows[0].role));

  if (!isAuthorized) {
    throw forbidden("You are not authorized to view join requests for this community");
  }

  const { rows } = await db.query(
    `SELECT cjr.id, cjr.status, cjr.created_at, u.id as user_id, u.name as full_name, u.avatar_url, u.department
     FROM community_join_requests cjr
     JOIN users u ON u.id = cjr.user_id
     WHERE cjr.community_id = $1 AND cjr.status = 'pending'
     ORDER BY cjr.created_at ASC`,
    [communityId]
  );

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    fullName: r.full_name,
    avatarUrl: r.avatar_url,
    department: r.department,
    status: r.status,
    createdAt: r.created_at,
  }));
}

async function togglePinAnnouncement(announcementId, adminRole, universityId) {
  if (!["admin", "super_admin"].includes(adminRole)) {
    throw forbidden("Only administrators can pin announcements");
  }

  const { rows } = await db.query(
    "SELECT id, is_pinned, university_id FROM social_posts WHERE id = $1",
    [announcementId]
  );
  if (!rows.length) throw notFound("Announcement not found");

  if (adminRole !== "super_admin" && universityId && rows[0].university_id !== universityId) {
    throw forbidden("Announcement belongs to another university");
  }

  const newPinned = !rows[0].is_pinned;
  await db.query(
    "UPDATE social_posts SET is_pinned = $1, updated_at = NOW() WHERE id = $2",
    [newPinned, announcementId]
  );

  return { success: true, isPinned: newPinned };
}

async function getTrendingTags(universityId) {
  const { rows } = await db.query(
    `SELECT word as tag, COUNT(*)::int as count
     FROM (
       SELECT LOWER(REGEXP_REPLACE(unnest(REGEXP_MATCHES(content, '#([A-Za-z0-9_]+)', 'g')), '^#', '')) as word
       FROM social_posts
       WHERE status = 'published' AND ($1::uuid IS NULL OR university_id = $1)
     ) t
     GROUP BY word
     ORDER BY count DESC
     LIMIT 10`,
    [universityId || null]
  );
  return rows;
}

/**
 * ------------------------------------------------------------------
 * 10. Private Moderation Identity Disclosure & Audit
 * ------------------------------------------------------------------
 */
async function discloseModerationIdentity(moderatorId, moderatorRole, moderatorUniId, { targetType, targetId, reason, ipAddress, userAgent }) {
  if (!["admin", "super_admin"].includes(moderatorRole)) {
    throw forbidden("Only authorized university moderators can investigate confession author identities");
  }

  if (!reason || reason.trim().length < 10) {
    throw badRequest("A detailed reason of at least 10 characters is strictly required for identity audit");
  }

  let authorId = null;
  let targetUniId = null;

  if (targetType === "post") {
    const { rows } = await db.query(
      "SELECT id, author_id, university_id, content FROM social_posts WHERE id = $1",
      [targetId]
    );
    if (!rows.length) throw notFound("Confession post not found");
    authorId = rows[0].author_id;
    targetUniId = rows[0].university_id;
  } else if (targetType === "comment") {
    const { rows } = await db.query(
      `SELECT sc.id, sc.author_id, sp.university_id, sc.content 
       FROM social_comments sc
       JOIN social_posts sp ON sp.id = sc.post_id
       WHERE sc.id = $1`,
      [targetId]
    );
    if (!rows.length) throw notFound("Confession comment not found");
    authorId = rows[0].author_id;
    targetUniId = rows[0].university_id;
  } else {
    throw badRequest("Invalid targetType: must be 'post' or 'comment'");
  }

  // Cross-university scoping: moderators can only access their own university unless super_admin
  if (moderatorRole !== "super_admin" && moderatorUniId && targetUniId !== moderatorUniId) {
    throw forbidden("Moderator is restricted to their own university confessions");
  }

  const { rows: userRows } = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.department, u.verified, u.suspended, uni.name as university_name
     FROM users u
     LEFT JOIN universities uni ON uni.id = u.university_id
     WHERE u.id = $1`,
    [authorId]
  );
  if (!userRows.length) throw notFound("User account not found");
  const author = userRows[0];

  // Log in confession_moderation_audit_logs
  await db.query(
    `INSERT INTO confession_moderation_audit_logs (
      university_id, moderator_id, target_type, target_id, disclosed_user_id, reason, ip_address, user_agent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      targetUniId,
      moderatorId,
      targetType,
      targetId,
      authorId,
      reason.trim(),
      ipAddress || null,
      userAgent || null,
    ]
  );

  const authorIdentity = await getOrCreateAnonymousIdentity(authorId, targetUniId);

  return {
    success: true,
    targetType,
    targetId,
    anonymousIdentity: authorIdentity ? authorIdentity.identity_code : "Anonymous",
    disclosedUser: {
      id: author.id,
      name: author.name,
      email: author.email,
      department: author.department || null,
      role: author.role,
      universityName: author.university_name,
      suspended: Boolean(author.suspended),
      anonymousIdentity: authorIdentity ? authorIdentity.identity_code : "Anonymous",
    },
    disclosedAt: new Date().toISOString(),
    auditLogged: true,
  };
}

async function getModerationAuditLogs(moderatorRole, moderatorUniId, { page = 1, limit = 50 } = {}) {
  if (!["admin", "super_admin"].includes(moderatorRole)) {
    throw forbidden("Only authorized university administrators can review audit logs");
  }

  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (moderatorRole !== "super_admin" && moderatorUniId) {
    params.push(moderatorUniId);
    conditions.push(`cal.university_id = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT 
      cal.*,
      mod.name as moderator_name,
      mod.email as moderator_email,
      u.name as disclosed_user_name,
      u.email as disclosed_user_email,
      uni.name as university_name
    FROM confession_moderation_audit_logs cal
    JOIN users mod ON mod.id = cal.moderator_id
    JOIN users u ON u.id = cal.disclosed_user_id
    JOIN universities uni ON uni.id = cal.university_id
    ${whereClause}
    ORDER BY cal.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  params.push(limit, offset);
  const { rows } = await db.query(query, params);

  return rows.map((r) => ({
    id: r.id,
    universityId: r.university_id,
    universityName: r.university_name,
    moderatorId: r.moderator_id,
    moderatorName: r.moderator_name,
    moderatorEmail: r.moderator_email,
    targetType: r.target_type,
    targetId: r.target_id,
    disclosedUserId: r.disclosed_user_id,
    disclosedUserName: r.disclosed_user_name,
    disclosedUserEmail: r.disclosed_user_email,
    reason: r.reason,
    ipAddress: r.ip_address,
    createdAt: r.created_at,
  }));
}

module.exports = {
  getFeed,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  toggleLikePost,
  toggleBookmarkPost,
  recordShare,
  votePoll,
  getComments,
  createComment,
  updateComment,
  deleteComment,
  toggleLikeComment,
  getCommunities,
  getCommunityById,
  createCommunity,
  updateCommunity,
  joinCommunity,
  leaveCommunity,
  reviewJoinRequest,
  updateMemberRole,
  removeMember,
  getCommunityMembers,
  getJoinRequests,
  getAnnouncements,
  togglePinAnnouncement,
  getTrendingTags,
  reportContent,
  getReports,
  discloseModerationIdentity,
  getModerationAuditLogs,
  getOrCreateAnonymousIdentity,
  getMyAnonymousIdentity,
  getPostLikes,
};
