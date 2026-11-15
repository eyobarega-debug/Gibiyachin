const db = require("../../db");
const { calculateAge } = require("./validation");

/**
 * Sanitize dating profile for public/candidate discovery
 * STRICT PRIVACY: NEVER expose birth_date, email, phone, or student ID.
 */
function sanitizeDiscoveryProfile(row) {
  const privacy = row.privacy_settings || {};
  const hideDept = privacy.hideMajor === true || privacy.show_department === false;
  const hideYear = privacy.show_year === false;

  let yearStr = null;
  if (row.academic_year && !hideYear) {
    const y = row.academic_year;
    yearStr = y === 1 ? "1st Year" : y === 2 ? "2nd Year" : y === 3 ? "3rd Year" : `${y}th Year`;
  }

  return {
    userId: row.user_id,
    displayName: row.display_name,
    age: row.age,
    gender: row.gender,
    bio: row.bio || "",
    department: hideDept ? null : row.department || null,
    academicYear: yearStr,
    interests: Array.isArray(row.interests) ? row.interests : [],
    hobbies: Array.isArray(row.hobbies) ? row.hobbies : [],
    favoriteMusic: row.favorite_music ? [row.favorite_music] : [],
    favoriteMovies: row.favorite_movies ? [row.favorite_movies] : [],
    favoriteActivities: row.favorite_activities ? [row.favorite_activities] : [],
    languages: Array.isArray(row.languages) ? row.languages : [],
    avatarUrl: row.avatar_url || null,
    photos: Array.isArray(row.photos) ? row.photos : [],
    universityName: row.university_name || null,
    sharedInterestsCount: row.shared_interests_count ? parseInt(row.shared_interests_count, 10) : 0,
  };
}

/**
 * Fetch candidate dating profiles for the discovery swipe deck
 */
async function getDiscoveryCandidates(userId, universityId, limit = 20) {
  // 1. Fetch user's profile & preferences
  const { rows: profileRows } = await db.query(
    "SELECT * FROM dating_profiles WHERE user_id = $1",
    [userId]
  );
  const myProfile = profileRows[0];
  if (!myProfile || myProfile.status !== "active") {
    return [];
  }

  const { rows: prefRows } = await db.query(
    "SELECT * FROM dating_preferences WHERE user_id = $1",
    [userId]
  );
  const myPref = prefRows[0] || {
    min_age: 18,
    max_age: 35,
    interested_in: ["all"],
    same_university_only: true,
    preferred_interests: [],
  };

  const params = [userId];
  const conditions = [
    "dp.user_id != $1",
    "dp.status = 'active'",
    "u.suspended = false",
    "dp.age >= $" + (params.length + 1),
    "dp.age <= $" + (params.length + 2),
  ];
  params.push(myPref.min_age, myPref.max_age);

  // University scoping
  if (myPref.same_university_only && universityId) {
    params.push(universityId);
    conditions.push("dp.university_id = $" + params.length);
  }

  // Gender preferences
  const interested = Array.isArray(myPref.interested_in) ? myPref.interested_in : ["all"];
  const wantsAll = interested.includes("all") || interested.includes("everyone") || interested.length === 0;
  if (!wantsAll) {
    const wantsMen = interested.some((i) => ["men", "man", "male"].includes(i));
    const wantsWomen = interested.some((i) => ["women", "woman", "female"].includes(i));
    if (wantsMen && !wantsWomen) {
      conditions.push("dp.gender = 'man'");
    } else if (wantsWomen && !wantsMen) {
      conditions.push("dp.gender = 'woman'");
    }
  }

  // Exclude already swiped profiles
  conditions.push(`dp.user_id NOT IN (SELECT target_id FROM dating_swipes WHERE swiper_id = $1)`);

  // Exclude blocked profiles
  conditions.push(`NOT EXISTS (
    SELECT 1 FROM user_blocks ub
    WHERE (ub.blocker_id = $1 AND ub.blocked_id = dp.user_id)
       OR (ub.blocker_id = dp.user_id AND ub.blocked_id = $1)
  )`);

  // Exclude already matched profiles
  conditions.push(`NOT EXISTS (
    SELECT 1 FROM dating_matches dm
    WHERE ((dm.user_a_id = $1 AND dm.user_b_id = dp.user_id)
       OR  (dm.user_b_id = $1 AND dm.user_a_id = dp.user_id))
      AND dm.status IN ('active', 'unmatched', 'blocked')
  )`);

  params.push(limit);
  const limitIdx = params.length;

  const myInterests = Array.isArray(myProfile.interests) ? myProfile.interests : [];
  params.push(myInterests);
  const interestsIdx = params.length;

  const query = `
    SELECT 
      dp.id, dp.user_id, dp.university_id, dp.age, dp.display_name, dp.bio, dp.gender,
      dp.department, dp.academic_year, dp.interests, dp.hobbies, dp.favorite_music,
      dp.favorite_movies, dp.favorite_activities, dp.languages, dp.avatar_url, dp.photos,
      dp.privacy_settings, dp.created_at,
      uni.name as university_name,
      cardinality(ARRAY(SELECT unnest(dp.interests) INTERSECT SELECT unnest($${interestsIdx}::text[]))) as shared_interests_count
    FROM dating_profiles dp
    JOIN users u ON u.id = dp.user_id
    JOIN universities uni ON uni.id = dp.university_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY shared_interests_count DESC, dp.updated_at DESC
    LIMIT $${limitIdx}
  `;

  const { rows } = await db.query(query, params);
  return rows.map(sanitizeDiscoveryProfile);
}

module.exports = {
  calculateAge,
  sanitizeDiscoveryProfile,
  getDiscoveryCandidates,
};
