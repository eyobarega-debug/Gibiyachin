const STORAGE_KEY = "gibiyachin_recent_searches";
const MAX_RECENT = 8;

export function getRecentSearches() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string" && t.trim().length > 0).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(term) {
  if (typeof window === "undefined" || !window.localStorage) return [];
  const clean = (term || "").trim();
  if (clean.length < 2) return getRecentSearches();

  try {
    const current = getRecentSearches();
    const updated = [clean, ...current.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function removeRecentSearch(term) {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const current = getRecentSearches();
    const updated = current.filter((item) => item.toLowerCase() !== (term || "").toLowerCase().trim());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearRecentSearches() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return [];
}
