import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { put, list } from "@vercel/blob";
import type { NextRequest } from "next/server";
import type { UserProfileStore } from "@/lib/types";

// 32-char unambiguous alphabet (omits 0/o/1/l/i) -> 5 bits per char -> 50 bits for 10 chars
export const CAPABILITY_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const MAX_STATE_PAYLOAD_BYTES = 768 * 1024; // 768 KB

export function sanitizeSlug(raw: string | null | undefined): string {
  const cleaned = (raw || "main")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 48);
  return cleaned || "main";
}

export function sanitizePrefix(raw: string | null | undefined): string {
  const cleaned = (raw || "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return cleaned || "athlete";
}

export function generateCapabilityToken(length = 10): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CAPABILITY_ALPHABET[bytes[i] % CAPABILITY_ALPHABET.length];
  }
  return out;
}

export function mintCapabilitySlug(rawName?: string): string {
  const prefix = sanitizePrefix(rawName);
  const token = generateCapabilityToken(10);
  return sanitizeSlug(`${prefix}-${token}`);
}

export function formatDisplayName(
  rawName: string | undefined,
  slug: string
): string {
  const trimmed = (rawName || "").trim().slice(0, 48);
  if (trimmed) {
    // Format slug-like guest aliases nicely (e.g., "tester-profile-4821" -> "Tester Profile 4821")
    if (/^[a-z0-9-]+$/.test(trimmed) && trimmed.includes("-")) {
      return trimmed
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }
    return trimmed;
  }
  const base = slug.split("-").slice(0, -1).join(" ") || slug;
  return base
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function getHmacSecret(): string {
  return (
    process.env.WORKSPACE_KEY_SECRET ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    "local-dev-secret"
  );
}

export function deriveHashedBlobKey(slug: string): string {
  const digest = crypto
    .createHmac("sha256", getHmacSecret())
    .update(slug)
    .digest("hex")
    .slice(0, 32);
  return `fitness-profiles/k-${digest}.json`;
}

export function getLegacyBlobKey(slug: string): string {
  return `fitness-profiles/${slug}.json`;
}

export function getLocalFilePath(slug: string): string {
  return path.join("/tmp", `pulse-loop-fitness-${slug}.json`);
}

async function fetchBlobByPathname(
  pathname: string
): Promise<UserProfileStore | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { blobs } = await list({ prefix: pathname, limit: 5 });
    const exact = blobs.find((b) => b.pathname === pathname);
    if (!exact?.url) return null;
    const res = await fetch(`${exact.url}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as UserProfileStore;
  } catch (err) {
    console.warn(`Vercel Blob read fallback (${pathname}):`, err);
    return null;
  }
}

export async function readWorkspace(slug: string): Promise<{
  exists: boolean;
  profile: UserProfileStore | null;
  source: "cloud-blob" | "local-fs" | "not-found";
}> {
  const cleanSlug = sanitizeSlug(slug);

  // 1. Try Vercel Blob: hashed key first, then legacy key for backward compatibility
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const hashed = await fetchBlobByPathname(deriveHashedBlobKey(cleanSlug));
    if (hashed) {
      return { exists: true, profile: hashed, source: "cloud-blob" };
    }
    const legacy = await fetchBlobByPathname(getLegacyBlobKey(cleanSlug));
    if (legacy) {
      return { exists: true, profile: legacy, source: "cloud-blob" };
    }
  }

  // 2. Fallback to /tmp local file
  try {
    const raw = await fs.readFile(getLocalFilePath(cleanSlug), "utf-8");
    const data = JSON.parse(raw) as UserProfileStore;
    return { exists: true, profile: data, source: "local-fs" };
  } catch {
    // Not found in /tmp
  }

  return { exists: false, profile: null, source: "not-found" };
}

export async function writeWorkspace(
  slug: string,
  profile: UserProfileStore
): Promise<{
  source: "cloud-blob" | "local-fs";
  profile: UserProfileStore;
}> {
  const cleanSlug = sanitizeSlug(slug);
  const nowIso = new Date().toISOString();
  const updated: UserProfileStore = {
    ...profile,
    slug: cleanSlug,
    createdAt: profile.createdAt || nowIso,
    lastActiveAt: nowIso,
    updatedAt: nowIso,
  };
  const serialized = JSON.stringify(updated);

  // Always write to /tmp for fast local caching & fallback
  try {
    await fs.writeFile(getLocalFilePath(cleanSlug), serialized, "utf-8");
  } catch {
    // ignore /tmp write errors in read-only environments
  }

  // Write to Vercel Blob under non-guessable HMAC-derived key if token is configured
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await put(deriveHashedBlobKey(cleanSlug), serialized, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 0,
      });
      return { source: "cloud-blob", profile: updated };
    } catch (err) {
      console.warn("Vercel Blob write fallback:", err);
    }
  }

  return { source: "local-fs", profile: updated };
}

// Lightweight in-memory sliding-window rate limiter (per server instance)
const rateLimitStore = new Map<string, number[]>();

export function checkSlidingWindowRateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (rateLimitStore.get(bucketKey) || []).filter(
    (t) => t > cutoff
  );

  if (timestamps.length >= limit) {
    const oldest = timestamps[0] || now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000)
    );
    rateLimitStore.set(bucketKey, timestamps);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  timestamps.push(now);
  rateLimitStore.set(bucketKey, timestamps);

  // Periodic map cap to avoid unbounded memory growth
  if (rateLimitStore.size > 2000) {
    for (const [k, listTs] of rateLimitStore.entries()) {
      const fresh = listTs.filter((t) => t > cutoff);
      if (fresh.length === 0) rateLimitStore.delete(k);
      else rateLimitStore.set(k, fresh);
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim() || "unknown";
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
