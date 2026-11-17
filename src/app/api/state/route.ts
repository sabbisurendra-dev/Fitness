import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import { createDefaultUserProfile, UserProfileStore } from "@/lib/types";

export const dynamic = "force-dynamic";

function sanitizeSlug(raw: string | null): string {
  const cleaned = (raw || "main")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 48);
  return cleaned || "main";
}

function getLocalFilePath(slug: string): string {
  return path.join("/tmp", `pulse-loop-fitness-${slug}.json`);
}

async function readStore(slug: string): Promise<{
  profile: UserProfileStore;
  source: "cloud-blob" | "local-fs" | "default";
}> {
  // 1. Try Vercel Blob if BLOB_READ_WRITE_TOKEN is configured
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const prefix = `fitness-profiles/${slug}.json`;
      const { blobs } = await list({ prefix, limit: 5 });
      const exact = blobs.find((b) => b.pathname === prefix) || blobs[0];
      if (exact?.url) {
        const res = await fetch(`${exact.url}?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as UserProfileStore;
          return { profile: data, source: "cloud-blob" };
        }
      }
    } catch (err) {
      console.warn("Vercel Blob read fallback:", err);
    }
  }

  // 2. Fallback to /tmp local file
  try {
    const raw = await fs.readFile(getLocalFilePath(slug), "utf-8");
    const data = JSON.parse(raw) as UserProfileStore;
    return { profile: data, source: "local-fs" };
  } catch {
    // Not found yet, return default
  }

  return { profile: createDefaultUserProfile(slug), source: "default" };
}

async function writeStore(
  slug: string,
  profile: UserProfileStore
): Promise<"cloud-blob" | "local-fs"> {
  const updated: UserProfileStore = {
    ...profile,
    slug,
    updatedAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(updated);

  // Always write to /tmp for fast local caching
  try {
    await fs.writeFile(getLocalFilePath(slug), serialized, "utf-8");
  } catch {
    // ignore /tmp errors
  }

  // Write to Vercel Blob if token is configured
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await put(`fitness-profiles/${slug}.json`, serialized, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 0,
      });
      return "cloud-blob";
    } catch (err) {
      console.warn("Vercel Blob write fallback:", err);
    }
  }

  return "local-fs";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = sanitizeSlug(searchParams.get("slug"));
  const { profile, source } = await readStore(slug);
  return NextResponse.json(
    { profile, source },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slug = sanitizeSlug(body?.slug || body?.profile?.slug);
    const profile = body?.profile as UserProfileStore;
    if (!profile || typeof profile !== "object") {
      return NextResponse.json(
        { error: "Invalid profile payload" },
        { status: 400 }
      );
    }
    const source = await writeStore(slug, profile);
    return NextResponse.json({
      ok: true,
      slug,
      source,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to save state", detail: String(err) },
      { status: 500 }
    );
  }
}
