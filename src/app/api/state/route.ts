import { NextRequest, NextResponse } from "next/server";
import { UserProfileStore } from "@/lib/types";
import {
  MAX_STATE_PAYLOAD_BYTES,
  readWorkspace,
  sanitizeSlug,
  writeWorkspace,
} from "@/lib/workspaceStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawSlug = searchParams.get("slug");
  const slug = sanitizeSlug(rawSlug);
  const result = await readWorkspace(slug);

  if (!result.exists || !result.profile) {
    return NextResponse.json(
      {
        exists: false,
        slug,
        source: "not-found",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }

  return NextResponse.json(
    {
      exists: true,
      profile: result.profile,
      source: result.source,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const byteLength = Buffer.byteLength(rawBody, "utf-8");
    if (byteLength > MAX_STATE_PAYLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `Payload exceeds maximum allowed size (${Math.round(
            MAX_STATE_PAYLOAD_BYTES / 1024
          )} KB).`,
        },
        { status: 413 }
      );
    }

    let body: { slug?: string; profile?: UserProfileStore } | null = null;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Malformed JSON payload" },
        { status: 400 }
      );
    }

    const slug = sanitizeSlug(body?.slug || body?.profile?.slug);
    const incomingProfile = body?.profile as UserProfileStore | undefined;
    if (!incomingProfile || typeof incomingProfile !== "object") {
      return NextResponse.json(
        { error: "Invalid profile payload" },
        { status: 400 }
      );
    }

    // Verify workspace already exists before overwriting so uncreated/arbitrary slugs cannot spam storage
    const existing = await readWorkspace(slug);
    if (!existing.exists || !existing.profile) {
      return NextResponse.json(
        {
          error:
            "Workspace not found. Create a private space first via /api/workspace/create.",
          exists: false,
          slug,
        },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();
    const mergedProfile: UserProfileStore = {
      ...incomingProfile,
      slug,
      // Preserve immutable workspace governance fields from server copy
      workspaceId: existing.profile.workspaceId ?? incomingProfile.workspaceId,
      createdAt: existing.profile.createdAt ?? incomingProfile.createdAt ?? nowIso,
      authMode: existing.profile.authMode ?? incomingProfile.authMode ?? "url-only",
      ownerUserId: existing.profile.ownerUserId,
      isGuest: existing.profile.isGuest ?? incomingProfile.isGuest,
      lastActiveAt: nowIso,
      updatedAt: nowIso,
    };

    const { source } = await writeWorkspace(slug, mergedProfile);
    return NextResponse.json(
      {
        ok: true,
        exists: true,
        slug,
        source,
        updatedAt: nowIso,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to save state", detail: String(err) },
      { status: 500 }
    );
  }
}
