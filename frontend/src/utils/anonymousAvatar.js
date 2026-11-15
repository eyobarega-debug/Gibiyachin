/**
 * Smart Anonymous Identity Visual Palette & Helpers
 * Provides deterministic styling for anonymous identities (e.g. "Anonymous #104")
 */

export const ANONYMOUS_PALETTES = [
  {
    name: "Rose",
    bg: "bg-rose-500",
    text: "text-white",
    border: "border-rose-300",
    gradient: "from-rose-500 to-pink-500",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    accent: "text-rose-600",
  },
  {
    name: "Violet",
    bg: "bg-violet-600",
    text: "text-white",
    border: "border-violet-300",
    gradient: "from-violet-600 to-purple-600",
    badge: "bg-violet-100 text-violet-800 border-violet-200",
    accent: "text-violet-600",
  },
  {
    name: "Ocean",
    bg: "bg-sky-500",
    text: "text-white",
    border: "border-sky-300",
    gradient: "from-sky-500 to-blue-600",
    badge: "bg-sky-100 text-sky-800 border-sky-200",
    accent: "text-sky-600",
  },
  {
    name: "Amber",
    bg: "bg-amber-500",
    text: "text-white",
    border: "border-amber-300",
    gradient: "from-amber-500 to-orange-500",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    accent: "text-amber-600",
  },
  {
    name: "Emerald",
    bg: "bg-emerald-600",
    text: "text-white",
    border: "border-emerald-300",
    gradient: "from-emerald-500 to-teal-600",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    accent: "text-emerald-600",
  },
  {
    name: "Indigo",
    bg: "bg-indigo-600",
    text: "text-white",
    border: "border-indigo-300",
    gradient: "from-indigo-600 to-blue-700",
    badge: "bg-indigo-100 text-indigo-800 border-indigo-200",
    accent: "text-indigo-600",
  },
  {
    name: "Fuchsia",
    bg: "bg-fuchsia-600",
    text: "text-white",
    border: "border-fuchsia-300",
    gradient: "from-fuchsia-600 to-pink-600",
    badge: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
    accent: "text-fuchsia-600",
  },
  {
    name: "Teal",
    bg: "bg-teal-600",
    text: "text-white",
    border: "border-teal-300",
    gradient: "from-teal-500 to-cyan-600",
    badge: "bg-teal-100 text-teal-800 border-teal-200",
    accent: "text-teal-600",
  },
  {
    name: "Orange",
    bg: "bg-orange-500",
    text: "text-white",
    border: "border-orange-300",
    gradient: "from-orange-500 to-amber-600",
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    accent: "text-orange-600",
  },
  {
    name: "Cyan",
    bg: "bg-cyan-600",
    text: "text-white",
    border: "border-cyan-300",
    gradient: "from-cyan-600 to-blue-600",
    badge: "bg-cyan-100 text-cyan-800 border-cyan-200",
    accent: "text-cyan-600",
  },
];

/**
 * Extracts the identity number from a string like "Anonymous #104" or seeds
 */
export function extractIdentityNumber(identityStr) {
  if (!identityStr) return 100;
  const digits = String(identityStr).replace(/\D/g, "");
  if (!digits) {
    let hash = 0;
    for (let i = 0; i < identityStr.length; i++) {
      hash = (hash << 5) - hash + identityStr.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
  return parseInt(digits, 10);
}

/**
 * Deterministically returns a color palette for an anonymous identity
 */
export function getAnonymousPalette(identityStr) {
  const num = extractIdentityNumber(identityStr);
  const palette = ANONYMOUS_PALETTES[num % ANONYMOUS_PALETTES.length];
  return {
    ...palette,
    number: num,
  };
}

/**
 * Formats like sentence:
 * - 1 like: "Liked by Anonymous #104"
 * - 2 likes: "Liked by Anonymous #104 and Anonymous #287"
 * - 3+ likes: "Liked by Anonymous #104, Anonymous #287 and 15 others"
 */
export function formatLikesSentence(recentLikes = [], totalLikes = 0) {
  const likes = Array.isArray(recentLikes) ? recentLikes.filter(Boolean) : [];
  const count = Math.max(totalLikes, likes.length);

  if (count === 0) return null;

  if (likes.length === 0) {
    return `${count} ${count === 1 ? "like" : "likes"}`;
  }

  if (count === 1) {
    return `Liked by ${likes[0]}`;
  }

  if (count === 2) {
    if (likes.length >= 2) {
      return `Liked by ${likes[0]} and ${likes[1]}`;
    }
    return `Liked by ${likes[0]} and 1 other`;
  }

  // 3 or more likes
  if (likes.length >= 2) {
    const remaining = count - 2;
    if (remaining === 1) {
      return `Liked by ${likes[0]}, ${likes[1]} and 1 other`;
    }
    return `Liked by ${likes[0]}, ${likes[1]} and ${remaining} others`;
  }

  // Fallback if only 1 like in array but count > 2
  const remaining = count - 1;
  return `Liked by ${likes[0]} and ${remaining} others`;
}
