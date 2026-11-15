const db = require("../../db");
const { notify } = require("../../utils/notify");

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "with",
  "by", "from", "of", "about", "is", "was", "are", "were", "it", "my",
  "i", "me", "we", "our", "you", "your", "this", "that", "lost", "found",
  "item", "items", "please", "help", "reward", "near", "around"
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function jaccardSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculates weighted match score (0 - 100) between a lost item and a found item.
 */
function calculateMatchScore(lostItem, foundItem) {
  // Ensure opposite types
  if (!lostItem || !foundItem) return { score: 0, reasons: [] };
  if (lostItem.type === foundItem.type) return { score: 0, reasons: [] };

  const lItem = lostItem.type === "lost" ? lostItem : foundItem;
  const fItem = lostItem.type === "lost" ? foundItem : lostItem;

  let totalScore = 0;
  const reasons = [];

  // 1. Category Similarity (Weight: 20 pts)
  const lCat = (lItem.category || "").toLowerCase().trim();
  const fCat = (fItem.category || "").toLowerCase().trim();
  if (lCat && fCat && lCat === fCat) {
    totalScore += 20;
    reasons.push({ factor: "category", points: 20, description: `Exact category match: ${lItem.category}` });
  } else if (lCat === "other" || fCat === "other") {
    totalScore += 5;
    reasons.push({ factor: "category", points: 5, description: "General category overlap" });
  } else {
    // Distinctly conflicting categories (e.g. Laptops vs Clothing)
    reasons.push({ factor: "category", points: 0, description: `Conflicting categories (${lItem.category} vs ${fItem.category})` });
  }

  // 2. Title Similarity (Weight: 25 pts)
  const lTitleTokens = tokenize(lItem.title);
  const fTitleTokens = tokenize(fItem.title);
  const titleSim = jaccardSimilarity(lTitleTokens, fTitleTokens);
  const titlePoints = Math.round(titleSim * 25);
  if (titlePoints > 0) {
    totalScore += titlePoints;
    reasons.push({ factor: "title", points: titlePoints, description: `Title keyword similarity (${Math.round(titleSim * 100)}%)` });
  }

  // 3. Description Similarity (Weight: 15 pts)
  const lDescTokens = tokenize(lItem.description);
  const fDescTokens = tokenize(fItem.description);
  const descSim = jaccardSimilarity(lDescTokens, fDescTokens);
  const descPoints = Math.round(descSim * 15);
  if (descPoints > 0) {
    totalScore += descPoints;
    reasons.push({ factor: "description", points: descPoints, description: `Description keyword overlap (${Math.round(descSim * 100)}%)` });
  }

  // 4. Color Similarity (Weight: 10 pts)
  const lColor = (lItem.color || "").toLowerCase().trim();
  const fColor = (fItem.color || "").toLowerCase().trim();
  if (lColor && fColor) {
    if (lColor === fColor || lColor.includes(fColor) || fColor.includes(lColor)) {
      totalScore += 10;
      reasons.push({ factor: "color", points: 10, description: `Matching color: ${lItem.color}` });
    } else {
      reasons.push({ factor: "color", points: 0, description: `Color difference (${lItem.color} vs ${fItem.color})` });
    }
  } else if (lColor || fColor) {
    const presentColor = lColor || fColor;
    const otherText = `${lItem.title} ${lItem.description} ${fItem.title} ${fItem.description}`.toLowerCase();
    if (otherText.includes(presentColor)) {
      totalScore += 8;
      reasons.push({ factor: "color", points: 8, description: `Color mentioned in report: ${presentColor}` });
    } else {
      totalScore += 4;
      reasons.push({ factor: "color", points: 4, description: "Color unspecified in one report" });
    }
  } else {
    // Neither specified color
    totalScore += 5;
  }

  // 5. Brand Similarity (Weight: 10 pts)
  const lBrand = (lItem.brand || "").toLowerCase().trim();
  const fBrand = (fItem.brand || "").toLowerCase().trim();
  if (lBrand && fBrand) {
    if (lBrand === fBrand || lBrand.includes(fBrand) || fBrand.includes(lBrand)) {
      totalScore += 10;
      reasons.push({ factor: "brand", points: 10, description: `Matching brand: ${lItem.brand}` });
    } else {
      reasons.push({ factor: "brand", points: 0, description: `Brand conflict (${lItem.brand} vs ${fItem.brand})` });
    }
  } else if (lBrand || fBrand) {
    const presentBrand = lBrand || fBrand;
    const otherText = `${lItem.title} ${lItem.description} ${fItem.title} ${fItem.description}`.toLowerCase();
    if (otherText.includes(presentBrand)) {
      totalScore += 8;
      reasons.push({ factor: "brand", points: 8, description: `Brand mentioned in report: ${presentBrand}` });
    } else {
      totalScore += 4;
      reasons.push({ factor: "brand", points: 4, description: "Brand unspecified in one report" });
    }
  } else {
    // Neither specified brand
    totalScore += 5;
  }

  // 6. Campus Location Proximity (Weight: 10 pts)
  const lLocTokens = tokenize(lItem.location);
  const fLocTokens = tokenize(fItem.location);
  const locSim = jaccardSimilarity(lLocTokens, fLocTokens);
  if (locSim > 0.5) {
    totalScore += 10;
    reasons.push({ factor: "location", points: 10, description: `Matching campus location: ${lItem.location}` });
  } else if (locSim > 0) {
    totalScore += 6;
    reasons.push({ factor: "location", points: 6, description: "Nearby campus area" });
  } else {
    totalScore += 3; // Same campus
  }

  // 7. Date Proximity (Weight: 10 pts)
  if (lItem.date_occurred && fItem.date_occurred) {
    const lDate = new Date(lItem.date_occurred);
    const fDate = new Date(fItem.date_occurred);
    const diffDays = Math.round((fDate - lDate) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 3) {
      totalScore += 10;
      reasons.push({ factor: "date", points: 10, description: `Found within ${diffDays} days of being lost` });
    } else if (diffDays > 3 && diffDays <= 7) {
      totalScore += 7;
      reasons.push({ factor: "date", points: 7, description: `Found ${diffDays} days after being lost` });
    } else if (diffDays > 7 && diffDays <= 14) {
      totalScore += 4;
      reasons.push({ factor: "date", points: 4, description: `Found within 2 weeks of being lost` });
    } else if (diffDays >= -3 && diffDays < 0) {
      // Small date estimate variance (e.g. uncertain loss date)
      totalScore += 5;
      reasons.push({ factor: "date", points: 5, description: "Dates approximate within 3 days" });
    } else if (diffDays > 14 && diffDays <= 30) {
      totalScore += 2;
    } else {
      totalScore += 0;
    }
  } else {
    totalScore += 4;
  }

  const finalScore = Math.min(100, Math.max(0, totalScore));
  return { score: finalScore, reasons };
}

/**
 * Searches for matches for a given item against existing reports in the university,
 * records recommendations in lost_found_matches, and sends real-time notifications.
 */
async function findAndSaveMatches(item, universityId) {
  if (!item || !universityId || ["returned", "closed", "removed", "expired"].includes(item.status)) {
    return [];
  }

  const oppositeType = item.type === "lost" ? "found" : "lost";

  // Query candidate opposite active items in the same university (ignore closed/returned/removed)
  const { rows: candidates } = await db.query(
    `SELECT * FROM lost_found_items
     WHERE university_id = $1
       AND type = $2
       AND status IN ('open', 'matched', 'claim_pending')
       AND id <> $3
       AND reporter_id <> $4
     ORDER BY created_at DESC
     LIMIT 100`,
    [universityId, oppositeType, item.id, item.reporter_id]
  );

  const matchedRecords = [];

  for (const candidate of candidates) {
    const lostItem = item.type === "lost" ? item : candidate;
    const foundItem = item.type === "found" ? item : candidate;

    const { score, reasons } = calculateMatchScore(lostItem, foundItem);

    // Only record potential matches meeting the recommendation threshold (>= 65)
    if (score >= 65) {
      const { rows } = await db.query(
        `INSERT INTO lost_found_matches (university_id, lost_item_id, found_item_id, score, reasons)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (lost_item_id, found_item_id)
         DO UPDATE SET score = EXCLUDED.score, reasons = EXCLUDED.reasons, updated_at = now()
         WHERE lost_found_matches.status <> 'dismissed'
         RETURNING *`,
        [universityId, lostItem.id, foundItem.id, score, JSON.stringify(reasons)]
      );

      const matchRow = rows[0];
      if (!matchRow) continue; // Match exists but is dismissed; keep it dismissed

      matchedRecords.push({ match: matchRow, lostItem, foundItem, score });

      // Notify owners if match is not dismissed and not yet notified for this pair
      if (matchRow.status !== "dismissed" && !matchRow.notified_lost_owner) {
        await notify(
          lostItem.reporter_id,
          "lost_found_match",
          "Potential Match Found!",
          `A reported found item "${foundItem.title}" has an estimated ${score}% match with your lost "${lostItem.title}".`,
          `/lost-found/${foundItem.id}`,
          "lost_found_item",
          foundItem.id
        ).catch((err) => console.warn("[matching] notify lost owner failed:", err.message));

        await db.query("UPDATE lost_found_matches SET notified_lost_owner = true WHERE id = $1", [matchRow.id]).catch(() => {});
      }

      if (matchRow.status !== "dismissed" && !matchRow.notified_found_finder) {
        await notify(
          foundItem.reporter_id,
          "lost_found_match",
          "Potential Match Found!",
          `A student reported losing "${lostItem.title}", which matches what you found (${score}% match).`,
          `/lost-found/${lostItem.id}`,
          "lost_found_item",
          lostItem.id
        ).catch((err) => console.warn("[matching] notify finder failed:", err.message));

        await db.query("UPDATE lost_found_matches SET notified_found_finder = true WHERE id = $1", [matchRow.id]).catch(() => {});
      }
    }
  }

  // Update item statuses to 'matched' if any matches were found and status is 'open'
  // Note: 'matched' items remain fully active and browsable in search and catalog
  if (matchedRecords.length > 0) {
    if (item.status === "open") {
      await db.query("UPDATE lost_found_items SET status = 'matched', updated_at = now() WHERE id = $1", [item.id]).catch(() => {});
      item.status = "matched";
    }
  }

  return matchedRecords;
}

async function findPotentialMatches(itemOrId, universityId) {
  let item = itemOrId;
  let uniId = universityId;
  if (typeof itemOrId === "string") {
    const { rows } = await db.query("SELECT * FROM lost_found_items WHERE id = $1", [itemOrId]);
    item = rows[0];
    if (!item) return [];
    uniId = item.university_id;
  }
  return findAndSaveMatches(item, uniId);
}

module.exports = {
  calculateMatchScore,
  findAndSaveMatches,
  findPotentialMatches,
  tokenize,
  jaccardSimilarity,
};
