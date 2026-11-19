import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createDefaultUserProfile, UserProfileStore } from "@/lib/types";
import {
  checkSlidingWindowRateLimit,
  formatDisplayName,
  getClientIp,
  mintCapabilitySlug,
  readWorkspace,
  writeWorkspace,
} from "@/lib/workspaceStore";

export const dynamic = "force-dynamic";

const CREATE_RATE_LIMIT = 15;
const ONE_HOUR_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rate = checkSlidingWindowRateLimit(
      `workspace-create:${ip}`,
      CREATE_RATE_LIMIT,
      ONE_HOUR_MS
    );

    if (!rate.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many workspaces created recently from this network. Please try again shortly.",
          retryAfterSeconds: rate.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawName =
      typeof body?.name === "string" ? body.name.trim().slice(0, 48) : "";
    const isGuest = Boolean(body?.isGuest);

    let mintedSlug = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate = mintCapabilitySlug(rawName || "athlete");
      const existing = await readWorkspace(candidate);
      if (!existing.exists) {
        mintedSlug = candidate;
        break;
      }
    }

    if (!mintedSlug) {
      return NextResponse.json(
        { error: "Unable to allocate a unique workspace URL. Please retry." },
        { status: 503 }
      );
    }

    const nowIso = new Date().toISOString();
    const baseProfile = createDefaultUserProfile(mintedSlug);
    const initialProfile: UserProfileStore = {
      ...baseProfile,
      slug: mintedSlug,
      displayName: formatDisplayName(rawName, mintedSlug),
      workspaceId: crypto.randomUUID(),
      authMode: "url-only",
      isGuest,
      createdAt: nowIso,
      lastActiveAt: nowIso,
      updatedAt: nowIso,
    };

    const { source, profile } = await writeWorkspace(mintedSlug, initialProfile);

    return NextResponse.json(
      {
        ok: true,
        slug: mintedSlug,
        profile,
        source,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create workspace", detail: String(err) },
      { status: 500 }
    );
  }
}
