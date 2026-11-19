export interface SavedSpaceRecord {
  slug: string;
  displayName: string;
  isGuest?: boolean;
  lastOpenedAt: string;
}

const ACTIVE_SLUG_KEY = "pulse-loop-active-slug";
const SAVED_SPACES_KEY = "pulse-loop-saved-spaces";

export function getActiveSlug(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_SLUG_KEY);
    return raw && raw.trim() ? raw.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

export function setActiveSlug(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_SLUG_KEY, slug.trim().toLowerCase());
  } catch {
    // ignore storage quota/privacy mode restrictions
  }
}

export function clearActiveSlugIfMatches(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = localStorage.getItem(ACTIVE_SLUG_KEY);
    if (current && current.toLowerCase() === slug.trim().toLowerCase()) {
      localStorage.removeItem(ACTIVE_SLUG_KEY);
    }
  } catch {
    // ignore
  }
}

export function getSavedSpaces(): SavedSpaceRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_SPACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SavedSpaceRecord =>
          Boolean(item) &&
          typeof item.slug === "string" &&
          item.slug.trim().length > 0
      )
      .sort((a, b) =>
        (b.lastOpenedAt || "").localeCompare(a.lastOpenedAt || "")
      );
  } catch {
    return [];
  }
}

export function upsertSavedSpace(record: {
  slug: string;
  displayName: string;
  isGuest?: boolean;
}): SavedSpaceRecord[] {
  if (typeof window === "undefined") return [];
  const cleanSlug = record.slug.trim().toLowerCase();
  if (!cleanSlug) return getSavedSpaces();

  const existing = getSavedSpaces();
  const prev = existing.find((s) => s.slug === cleanSlug);
  const nextEntry: SavedSpaceRecord = {
    slug: cleanSlug,
    displayName: record.displayName.trim() || prev?.displayName || cleanSlug,
    isGuest: record.isGuest ?? prev?.isGuest,
    lastOpenedAt: new Date().toISOString(),
  };

  const nextList = [
    nextEntry,
    ...existing.filter((s) => s.slug !== cleanSlug),
  ].slice(0, 12);

  try {
    localStorage.setItem(SAVED_SPACES_KEY, JSON.stringify(nextList));
  } catch {
    // ignore
  }
  return nextList;
}

export function removeSavedSpace(slug: string): SavedSpaceRecord[] {
  if (typeof window === "undefined") return [];
  const cleanSlug = slug.trim().toLowerCase();
  const nextList = getSavedSpaces().filter((s) => s.slug !== cleanSlug);
  try {
    localStorage.setItem(SAVED_SPACES_KEY, JSON.stringify(nextList));
    clearActiveSlugIfMatches(cleanSlug);
  } catch {
    // ignore
  }
  return nextList;
}

export function extractSlugFromInput(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return "";

  // Match full URL or relative path containing /u/<slug>
  const urlMatch = trimmed.match(/\/u\/([a-zA-Z0-9_-]+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1].toLowerCase().slice(0, 48);
  }

  return trimmed
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 48);
}

export function isLinkNudgeDismissed(slug: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      localStorage.getItem(`pulse-loop-link-nudge-dismissed-${slug}`) === "1"
    );
  } catch {
    return false;
  }
}

export function dismissLinkNudge(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`pulse-loop-link-nudge-dismissed-${slug}`, "1");
  } catch {
    // ignore
  }
}
