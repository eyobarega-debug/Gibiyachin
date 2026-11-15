const db = require("../../db");
const { badRequest, forbidden, notFound } = require("../../utils/errors");
const { calculateAge, sanitizeDiscoveryProfile, getDiscoveryCandidates } = require("./matching");
const { emitToUser } = require("../../realtime/socket");
const { notify } = require("../../utils/notify");

/**
 * Get the current user's dating profile and preferences
 */
async function getMyProfile(userId) {
  const { rows: profileRows } = await db.query(
    `SELECT dp.*, uni.name as university_name
     FROM dating_profiles dp
     JOIN universities uni ON uni.id = dp.university_id
     WHERE dp.user_id = $1`,
    [userId]
  );

  const profile = profileRows[0] || null;

  const { rows: prefRows } = await db.query(
    "SELECT * FROM dating_preferences WHERE user_id = $1",
    [userId]
  );
  const preferences = prefRows[0] || null;

  let academicYearStr = null;
  if (profile?.academic_year) {
    const y = profile.academic_year;
    academicYearStr = y === 1 ? "1st Year" : y === 2 ? "2nd Year" : y === 3 ? "3rd Year" : `${y}th Year`;
  }

  return {
    profile: profile
      ? {
          id: profile.id,
          userId: profile.user_id,
          universityId: profile.university_id,
          universityName: profile.university_name,
          displayName: profile.display_name,
          age: profile.age,
          gender: profile.gender,
          bio: profile.bio || "",
          department: profile.department || "",
          academicYear: academicYearStr,
          interests: profile.interests || [],
          hobbies: profile.hobbies || [],
          favoriteMusic: profile.favorite_music ? [profile.favorite_music] : [],
          favoriteMovies: profile.favorite_movies ? [profile.favorite_movies] : [],
          favoriteActivities: profile.favorite_activities ? [profile.favorite_activities] : [],
          languages: profile.languages || [],
          avatarUrl: profile.avatar_url,
          photos: profile.photos || [],
          privacySettings: profile.privacy_settings || { show_age: true, show_department: true, show_year: true },
          status: profile.status,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        }
      : null,
    preferences: preferences
      ? {
          minAge: preferences.min_age,
          maxAge: preferences.max_age,
          interestedIn: preferences.interested_in,
          sameUniversityOnly: preferences.same_university_only,
          preferredInterests: preferences.preferred_interests || [],
        }
      : null,
  };
}

/**
 * Create or update dating profile (Strict 18+ enforcement)
 */
async function createOrUpdateProfile(userId, universityId, data) {
  const calculatedAge = calculateAge(data.birthDate);
  if (calculatedAge < 18) {
    throw badRequest("Age requirement not met: you must be at least 18 years old to use Gibiyachin Connect");
  }

  // Ensure university exists (with user affiliation fallback if tenant context was unset)
  let effectiveUniId = universityId;
  if (!effectiveUniId) {
    const { rows: uRows } = await db.query("SELECT university_id FROM users WHERE id = $1", [userId]);
    effectiveUniId = uRows[0]?.university_id;
  }

  const { rows: uniRows } = await db.query("SELECT id FROM universities WHERE id = $1", [effectiveUniId]);
  if (!uniRows.length) {
    throw badRequest("Valid university tenant is required for dating profile");
  }

  const effectiveAvatar =
    data.avatarUrl ||
    (Array.isArray(data.photos) && data.photos.length > 0 ? data.photos[0] : null) ||
    "/uploads/default_avatar.png";

  await db.withTransaction(async (client) => {
    const query = `
      INSERT INTO dating_profiles (
        user_id, university_id, birth_date, age, display_name, bio, gender,
        department, academic_year, interests, hobbies, favorite_music,
        favorite_movies, favorite_activities, languages, avatar_url, photos,
        privacy_settings, status, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, 'active', NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        university_id = EXCLUDED.university_id,
        birth_date = EXCLUDED.birth_date,
        age = EXCLUDED.age,
        display_name = EXCLUDED.display_name,
        bio = EXCLUDED.bio,
        gender = EXCLUDED.gender,
        department = EXCLUDED.department,
        academic_year = EXCLUDED.academic_year,
        interests = EXCLUDED.interests,
        hobbies = EXCLUDED.hobbies,
        favorite_music = EXCLUDED.favorite_music,
        favorite_movies = EXCLUDED.favorite_movies,
        favorite_activities = EXCLUDED.favorite_activities,
        languages = EXCLUDED.languages,
        avatar_url = EXCLUDED.avatar_url,
        photos = EXCLUDED.photos,
        privacy_settings = EXCLUDED.privacy_settings,
        status = 'active',
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      userId,
      effectiveUniId,
      data.birthDate,
      calculatedAge,
      data.displayName,
      data.bio || "",
      data.gender,
      data.department || null,
      data.academicYear || null,
      data.interests || [],
      data.hobbies || [],
      data.favoriteMusic || null,
      data.favoriteMovies || null,
      data.favoriteActivities || null,
      data.languages || [],
      effectiveAvatar,
      data.photos || [],
      JSON.stringify(data.privacySettings || { show_age: true, show_department: true, show_year: true }),
    ];

    const { rows: profileRows } = await client.query(query, values);

    // Seed default preferences if not yet existing
    await client.query(
      `INSERT INTO dating_preferences (user_id, min_age, max_age, interested_in, same_university_only, preferred_interests)
       VALUES ($1, 18, 35, '{"all"}', TRUE, '{}')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    return profileRows[0];
  });

  return getMyProfile(userId);
}

/**
 * Update user discovery preferences
 */
async function updatePreferences(userId, data) {
  const interestedArr = Array.isArray(data.interestedIn) ? data.interestedIn : [data.interestedIn || "all"];

  const query = `
    INSERT INTO dating_preferences (
      user_id, min_age, max_age, interested_in, same_university_only, preferred_interests, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      min_age = EXCLUDED.min_age,
      max_age = EXCLUDED.max_age,
      interested_in = EXCLUDED.interested_in,
      same_university_only = EXCLUDED.same_university_only,
      preferred_interests = EXCLUDED.preferred_interests,
      updated_at = NOW()
    RETURNING *
  `;

  const { rows } = await db.query(query, [
    userId,
    data.minAge,
    data.maxAge,
    interestedArr,
    data.sameUniversityOnly,
    data.preferredInterests || [],
  ]);

  const p = rows[0];
  return {
    minAge: p.min_age,
    maxAge: p.max_age,
    interestedIn: p.interested_in,
    sameUniversityOnly: p.same_university_only,
    preferredInterests: p.preferred_interests,
  };
}

/**
 * Update dating profile status: active | paused | hidden | deactivated
 */
async function updateStatus(userId, status) {
  const { rows } = await db.query(
    "UPDATE dating_profiles SET status = $1, updated_at = NOW() WHERE user_id = $2 RETURNING status",
    [status, userId]
  );
  if (!rows.length) {
    throw notFound("Dating profile not found");
  }
  return { status: rows[0].status };
}

/**
 * Discover profiles to swipe on
 */
async function getDiscovery(userId, universityId) {
  return getDiscoveryCandidates(userId, universityId);
}

/**
 * Perform a swipe (like / pass) and detect mutual match
 */
async function swipe(userId, universityId, { targetId, action }) {
  if (userId === targetId) {
    throw badRequest("You cannot swipe on your own profile");
  }

  // 1. Block check: ensure users have not blocked each other
  const { rows: blockRows } = await db.query(
    `SELECT 1 FROM user_blocks 
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)`,
    [userId, targetId]
  );
  if (blockRows.length > 0) {
    throw forbidden("Cannot interact with this profile because communication is blocked");
  }

  // 2. Verify user has an active dating profile
  const { rows: myRows } = await db.query(
    "SELECT id, user_id, display_name, avatar_url, status FROM dating_profiles WHERE user_id = $1",
    [userId]
  );
  const myProfile = myRows[0];
  if (!myProfile || myProfile.status !== "active") {
    throw forbidden("You must have an active Gibiyachin Connect profile to swipe");
  }

  // 3. Verify target has an active dating profile
  const { rows: targetRows } = await db.query(
    `SELECT dp.*, uni.name as university_name 
     FROM dating_profiles dp 
     JOIN universities uni ON uni.id = dp.university_id 
     WHERE dp.user_id = $1`,
    [targetId]
  );
  const targetProfile = targetRows[0];
  if (!targetProfile || targetProfile.status !== "active") {
    throw notFound("Profile is no longer available");
  }

  // 4. Scoping & multi-tenant isolation check
  const { rows: prefRows } = await db.query(
    "SELECT same_university_only FROM dating_preferences WHERE user_id = $1",
    [userId]
  );
  const sameUniOnly = prefRows[0] ? prefRows[0].same_university_only : true;
  if (sameUniOnly && universityId && targetProfile.university_id !== universityId) {
    throw forbidden("Cannot swipe on profiles from other universities under current preferences");
  }

  // 5. Record the swipe
  await db.query(
    `INSERT INTO dating_swipes (swiper_id, target_id, action)
     VALUES ($1, $2, $3)
     ON CONFLICT (swiper_id, target_id) DO UPDATE SET action = EXCLUDED.action, created_at = NOW()`,
    [userId, targetId, action]
  );

  // If action is pass, return early
  if (action === "pass") {
    return { passed: true, targetId };
  }

  // 6. Check if target previously liked current user
  const { rows: reverseSwipe } = await db.query(
    `SELECT action FROM dating_swipes WHERE swiper_id = $1 AND target_id = $2 AND action = 'like'`,
    [targetId, userId]
  );

  const isMutual = reverseSwipe.length > 0;
  if (!isMutual) {
    return { matched: false, targetId };
  }

  // 7. IT'S A MATCH! Create match and dedicated dating conversation
  const minId = userId < targetId ? userId : targetId;
  const maxId = userId < targetId ? targetId : userId;

  const { match, conversation } = await db.withTransaction(async (client) => {
    // Upsert match
    const { rows: matchRows } = await client.query(
      `INSERT INTO dating_matches (user_a_id, user_b_id, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET status = 'active', updated_at = NOW()
       RETURNING *`,
      [minId, maxId]
    );
    const m = matchRows[0];

    // Create or locate dating conversation
    let conv = null;
    if (m.conversation_id) {
      const { rows: existingConv } = await client.query(
        "SELECT * FROM conversations WHERE id = $1",
        [m.conversation_id]
      );
      if (existingConv.length > 0) {
        conv = existingConv[0];
      }
    }

    if (!conv) {
      const contextData = {
        matchId: m.id,
        matchedAt: new Date().toISOString(),
        userA: { id: userId, name: myProfile.display_name },
        userB: { id: targetId, name: targetProfile.display_name },
      };

      const { rows: convRows } = await client.query(
        `INSERT INTO conversations (university_id, type, context_type, context_id, context_data, last_message_preview)
         VALUES ($1, 'dating', 'dating_match', $2, $3, 'It''s a Match! Start your conversation.')
         RETURNING *`,
        [universityId || targetProfile.university_id, m.id, JSON.stringify(contextData)]
      );
      conv = convRows[0];

      // Add both participants
      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id)
         VALUES ($1, $2), ($1, $3)
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [conv.id, userId, targetId]
      );

      // Link conversation to match
      await client.query(
        `UPDATE dating_matches SET conversation_id = $1 WHERE id = $2`,
        [conv.id, m.id]
      );
    } else {
      await client.query(
        `UPDATE conversations SET last_message_preview = 'It''s a Match! Start your conversation.', updated_at = NOW() WHERE id = $1`,
        [conv.id]
      );
    }

    return { match: m, conversation: conv };
  });

  // Real-time Socket.IO notification to both users
  const matchPayloadForUser = {
    matchId: match.id,
    conversationId: conversation.id,
    partner: sanitizeDiscoveryProfile(targetProfile),
  };

  const matchPayloadForTarget = {
    matchId: match.id,
    conversationId: conversation.id,
    partner: {
      userId: myProfile.user_id,
      displayName: myProfile.display_name,
      avatarUrl: myProfile.avatar_url,
    },
  };

  emitToUser(userId, "dating:match", matchPayloadForUser);
  emitToUser(targetId, "dating:match", matchPayloadForTarget);

  // Send in-app notification to both users
  notify(
    targetId,
    "dating_match",
    "It's a Match! ❤️",
    `You and ${myProfile.display_name} liked each other! Start chatting now.`,
    {
      targetRoute: `/messages/${conversation.id}`,
      targetEntityType: "conversation",
      targetEntityId: conversation.id,
    }
  ).catch((err) => console.warn("[dating] notify match failed:", err.message));

  notify(
    userId,
    "dating_match",
    "It's a Match! ❤️",
    `You and ${targetProfile.display_name} liked each other! Start chatting now.`,
    {
      targetRoute: `/messages/${conversation.id}`,
      targetEntityType: "conversation",
      targetEntityId: conversation.id,
    }
  ).catch((err) => console.warn("[dating] notify match failed:", err.message));

  return {
    matched: true,
    matchId: match.id,
    conversationId: conversation.id,
    partner: sanitizeDiscoveryProfile(targetProfile),
  };
}

/**
 * List active mutual matches for current user
 */
async function getMatches(userId) {
  const query = `
    SELECT 
      dm.id as match_id,
      dm.conversation_id,
      dm.created_at as matched_at,
      dp.*,
      uni.name as university_name
    FROM dating_matches dm
    JOIN dating_profiles dp ON dp.user_id = CASE WHEN dm.user_a_id = $1 THEN dm.user_b_id ELSE dm.user_a_id END
    JOIN universities uni ON uni.id = dp.university_id
    WHERE (dm.user_a_id = $1 OR dm.user_b_id = $1)
      AND dm.status = 'active'
    ORDER BY dm.created_at DESC
  `;

  const { rows } = await db.query(query, [userId]);
  return rows.map((r) => ({
    matchId: r.match_id,
    conversationId: r.conversation_id,
    matchedAt: r.matched_at,
    partner: sanitizeDiscoveryProfile(r),
  }));
}

/**
 * Unmatch a user
 */
async function unmatch(userId, matchId) {
  const { rows } = await db.query(
    `SELECT user_a_id, user_b_id, conversation_id FROM dating_matches WHERE id = $1`,
    [matchId]
  );
  if (!rows.length) {
    throw notFound("Match not found");
  }
  const match = rows[0];

  if (match.user_a_id !== userId && match.user_b_id !== userId) {
    throw forbidden("You are not part of this match");
  }

  await db.query(
    `UPDATE dating_matches 
     SET status = 'unmatched', unmatched_by = $1, unmatched_at = NOW(), updated_at = NOW() 
     WHERE id = $2`,
    [userId, matchId]
  );

  // If a conversation was linked to this match, update preview and emit event
  if (match.conversation_id) {
    await db.query(
      `UPDATE conversations 
       SET last_message_preview = '[Match ended]', updated_at = NOW() 
       WHERE id = $1`,
      [match.conversation_id]
    );

    emitToUser(match.user_a_id, "conversation:updated", {
      conversationId: match.conversation_id,
      isDatingUnmatched: true,
      lastMessagePreview: "[Match ended]",
    });
    emitToUser(match.user_b_id, "conversation:updated", {
      conversationId: match.conversation_id,
      isDatingUnmatched: true,
      lastMessagePreview: "[Match ended]",
    });
  }

  return { success: true, matchId };
}

/**
 * Report a dating profile for inappropriate behavior
 */
async function reportDatingProfile(reporterId, universityId, { targetId, category = "other", reason, details }) {
  if (reporterId === targetId) {
    throw badRequest("You cannot report yourself");
  }

  const effectiveCategory = [
    "inappropriate_content",
    "harassment",
    "impersonation",
    "underage",
    "spam",
    "other",
  ].includes(category)
    ? category
    : "other";

  const description = details || reason || "Safety report";

  // 1. Insert report
  const { rows } = await db.query(
    `INSERT INTO dating_reports (reporter_id, target_user_id, university_id, category, description, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING id`,
    [reporterId, targetId, universityId, effectiveCategory, description]
  );

  // 2. Automatically record pass swipe
  await db.query(
    `INSERT INTO dating_swipes (swiper_id, target_id, action)
     VALUES ($1, $2, 'pass')
     ON CONFLICT (swiper_id, target_id) DO UPDATE SET action = 'pass'`,
    [reporterId, targetId]
  );

  // 3. Block communication across platform
  await db.query(
    `INSERT INTO user_blocks (blocker_id, blocked_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
    [reporterId, targetId, `Dating report: ${description}`]
  );

  // 4. Update any existing active match to 'blocked'
  const minId = reporterId < targetId ? reporterId : targetId;
  const maxId = reporterId < targetId ? targetId : reporterId;
  const { rows: matchRows } = await db.query(
    `UPDATE dating_matches 
     SET status = 'blocked', unmatched_by = $1, unmatched_at = NOW(), updated_at = NOW() 
     WHERE user_a_id = $2 AND user_b_id = $3 AND status = 'active'
     RETURNING conversation_id`,
    [reporterId, minId, maxId]
  );

  if (matchRows.length > 0 && matchRows[0].conversation_id) {
    await db.query(
      `UPDATE conversations 
       SET last_message_preview = '[User blocked]', updated_at = NOW() 
       WHERE id = $1`,
      [matchRows[0].conversation_id]
    );
    emitToUser(reporterId, "conversation:updated", {
      conversationId: matchRows[0].conversation_id,
      isDatingUnmatched: true,
      lastMessagePreview: "[User blocked]",
    });
    emitToUser(targetId, "conversation:updated", {
      conversationId: matchRows[0].conversation_id,
      isDatingUnmatched: true,
      lastMessagePreview: "[User blocked]",
    });
  }

  return { success: true, reportId: rows[0].id };
}

module.exports = {
  getMyProfile,
  createOrUpdateProfile,
  updatePreferences,
  updateStatus,
  getDiscovery,
  swipe,
  getMatches,
  unmatch,
  reportDatingProfile,
};
