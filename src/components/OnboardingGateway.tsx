"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowRight,
  ChevronDown,
  Lock,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck,
  Link2,
} from "lucide-react";
import {
  SavedSpaceRecord,
  extractSlugFromInput,
  getActiveSlug,
  getSavedSpaces,
  setActiveSlug,
  upsertSavedSpace,
} from "@/lib/localSpaces";

const GUEST_POOLS = {
  tester: ["tester-profile", "test-profile", "test-user"],
  guest: ["tester-random", "guest-pulse", "guest-athlete"],
  demo: ["demo-tracker", "demo-fitness", "sandbox-fit"],
  stealth: ["anon-runner", "stealth-lifter", "private-loop"],
} as const;

const INITIAL_SSR_SUGGESTIONS = [
  { style: "Tester", handle: "tester-profile-4821" },
  { style: "Guest", handle: "guest-pulse-829" },
  { style: "Demo", handle: "demo-tracker-942" },
  { style: "Stealth", handle: "anon-runner-318" },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateBalancedSuggestions(): Array<{ style: string; handle: string }> {
  const pick = <T,>(arr: readonly T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];
  return [
    { style: "Tester", handle: `${pick(GUEST_POOLS.tester)}-${randomInt(1000, 9999)}` },
    { style: "Guest", handle: `${pick(GUEST_POOLS.guest)}-${randomInt(100, 999)}` },
    { style: "Demo", handle: `${pick(GUEST_POOLS.demo)}-${randomInt(100, 999)}` },
    { style: "Stealth", handle: `${pick(GUEST_POOLS.stealth)}-${randomInt(100, 999)}` },
  ];
}

function previewPrefix(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return cleaned || "your-name";
}

export default function OnboardingGateway() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const suppressAutoRedirect =
    searchParams.get("new") === "1" || searchParams.get("choose") === "1";

  const [checkingRedirect, setCheckingRedirect] = useState(true);
  const [resumingSlug, setResumingSlug] = useState<string | null>(null);
  const [savedSpaces, setSavedSpaces] = useState<SavedSpaceRecord[]>([]);
  const [colorSchemeOverride, setColorSchemeOverride] = useState<"dark" | "light">("dark");

  const [nameInput, setNameInput] = useState("");
  const [selectedGuestChip, setSelectedGuestChip] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState(INITIAL_SSR_SUGGESTIONS);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [existingInput, setExistingInput] = useState("");
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [existingError, setExistingError] = useState("");
  const [hostDisplay, setHostDisplay] = useState("pulse-loop-fitness.vercel.app");

  // Sync theme with <meta name="color-scheme">
  useEffect(() => {
    try {
      const stored = localStorage.getItem("color-scheme");
      const scheme: "dark" | "light" = stored === "light" ? "light" : "dark";
      setColorSchemeOverride(scheme);
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) meta.setAttribute("content", scheme);
    } catch {
      // ignore
    }
  }, []);

  const toggleColorScheme = () => {
    const nextScheme = colorSchemeOverride === "dark" ? "light" : "dark";
    setColorSchemeOverride(nextScheme);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute("content", nextScheme);
    try {
      localStorage.setItem("color-scheme", nextScheme);
    } catch {
      // ignore
    }
  };

  // Auto-redirect returning visitors unless escape hatch (?new=1 or ?choose=1) is present
  useEffect(() => {
    if (typeof window !== "undefined") {
      setHostDisplay(window.location.host || "pulse-loop-fitness.vercel.app");
    }
    setSuggestions(generateBalancedSuggestions());
    const spaces = getSavedSpaces();
    setSavedSpaces(spaces);

    const active = getActiveSlug();
    if (!suppressAutoRedirect && active) {
      setResumingSlug(active);
      router.replace(`/u/${active}`);
      return;
    }
    setCheckingRedirect(false);
  }, [router, suppressAutoRedirect]);

  const urlPrefixPreview = useMemo(() => previewPrefix(nameInput), [nameInput]);

  const handleRefreshSuggestions = () => {
    setSuggestions(generateBalancedSuggestions());
  };

  const handleSelectChip = (handle: string) => {
    setNameInput(handle);
    setSelectedGuestChip(handle);
    setCreateError("");
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setCreateError("");

    const isGuest =
      Boolean(selectedGuestChip && selectedGuestChip === nameInput.trim()) ||
      !nameInput.trim();
    const chosenName =
      nameInput.trim() || suggestions[0]?.handle || "guest-athlete";

    try {
      const res = await fetch("/api/workspace/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: chosenName, isGuest }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.slug) {
        throw new Error(
          data?.error || "Could not create your private space. Please retry."
        );
      }

      const newSlug = String(data.slug).toLowerCase();
      if (data.profile) {
        try {
          localStorage.setItem(
            `pulse-loop-profile-${newSlug}`,
            JSON.stringify(data.profile)
          );
        } catch {
          // ignore
        }
      }
      upsertSavedSpace({
        slug: newSlug,
        displayName: data.profile?.displayName || chosenName,
        isGuest,
      });
      setActiveSlug(newSlug);
      router.replace(`/u/${newSlug}`);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to launch private space."
      );
      setCreating(false);
    }
  };

  const handleOpenExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedSlug = extractSlugFromInput(existingInput);
    if (!parsedSlug) {
      setExistingError("Paste a private URL or space code first.");
      return;
    }
    setCheckingExisting(true);
    setExistingError("");
    try {
      const res = await fetch(
        `/api/state?slug=${encodeURIComponent(parsedSlug)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok || !data?.exists || !data?.profile) {
        setExistingError(
          "We couldn't find that private space — please check for typos."
        );
        setCheckingExisting(false);
        return;
      }
      upsertSavedSpace({
        slug: parsedSlug,
        displayName: data.profile.displayName || parsedSlug,
        isGuest: data.profile.isGuest,
      });
      setActiveSlug(parsedSlug);
      router.replace(`/u/${parsedSlug}`);
    } catch {
      setExistingError(
        "Unable to verify that link right now. Please check your connection."
      );
      setCheckingExisting(false);
    }
  };

  if (checkingRedirect && resumingSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-center space-y-3">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
          </div>
          <div className="text-sm font-bold">Resuming your private space...</div>
          <p className="text-xs text-[var(--text-muted)] font-mono truncate">
            /u/{resumingSlug}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Compact Top Bar */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur-md">
        <div className="mx-auto max-w-xl px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <Activity className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="font-bold tracking-tight text-base">PulseLoop</span>
          </div>

          <button
            type="button"
            onClick={toggleColorScheme}
            aria-label={
              colorSchemeOverride === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-medium hover:border-emerald-500/40 transition"
          >
            {colorSchemeOverride === "dark" ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-xl px-4 py-6 sm:py-10 space-y-5">
        {/* Resume Existing Spaces on This Device (Shown when ?new=1 or saved spaces exist) */}
        {savedSpaces.length > 0 && (
          <section
            aria-label="Resume Existing Space on This Device"
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Resume Existing Space on This Device
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {savedSpaces.length} saved
              </span>
            </div>
            <div className="space-y-1.5">
              {savedSpaces.slice(0, 4).map((sp) => (
                <button
                  key={sp.slug}
                  type="button"
                  onClick={() => {
                    setActiveSlug(sp.slug);
                    router.push(`/u/${sp.slug}`);
                  }}
                  className="w-full flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-left hover:border-emerald-500/50 transition"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">
                      {sp.displayName}
                    </div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">
                      /u/{sp.slug}
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                    Open <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Primary Onboarding Card */}
        <section
          aria-labelledby="welcome-heading"
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-5 shadow-sm"
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Private Capability URL · Cloud Auto-Saved</span>
            </div>
            <h1
              id="welcome-heading"
              className="text-xl sm:text-2xl font-extrabold tracking-tight"
            >
              Your private PulseLoop dashboard — no signup or password needed.
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
              Enter your name or pick a random guest alias below. We&apos;ll generate a unique private URL that saves your workouts, meals, sleep, and habits across days.
            </p>
          </div>

          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="onboarding-name-input"
                className="block text-xs font-semibold text-[var(--text-primary)]"
              >
                Name or Guest Alias
              </label>
              <input
                id="onboarding-name-input"
                type="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={48}
                placeholder="Enter your name or nickname (e.g. rahul)"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setSelectedGuestChip(null);
                  setCreateError("");
                }}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm font-medium focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* 4 Balanced Random Guest Suggestion Chips + Refresh */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                  Or tap a privacy-friendly guest alias:
                </span>
                <button
                  type="button"
                  onClick={handleRefreshSuggestions}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-emerald-400 hover:border-emerald-500/40 transition"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                  <span>Refresh</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {suggestions.map((item) => {
                  const isSelected = selectedGuestChip === item.handle;
                  return (
                    <button
                      key={item.handle}
                      type="button"
                      onClick={() => handleSelectChip(item.handle)}
                      aria-pressed={isSelected}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-400"
                          : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-emerald-500/40"
                      }`}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {item.style}
                      </div>
                      <div className="text-xs font-mono font-bold truncate">
                        {item.handle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Private URL Preview */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/80 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>Your Private URL Preview</span>
              </div>
              <div className="font-mono text-xs break-all text-[var(--text-primary)]">
                {hostDisplay}/u/
                <span className="font-bold text-emerald-400">
                  {urlPrefixPreview}
                </span>
                -<span className="text-[var(--text-muted)]">••••••••••</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                A unique secret code is automatically added so nobody else can guess or overwrite your data.
              </p>
            </div>

            {createError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400"
              >
                {createError}
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 transition shadow-sm"
            >
              {creating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Minting Your Private Space...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>Launch My Private Space &rarr;</span>
                </>
              )}
            </button>
          </form>

          {/* Secondary Expandable Disclosure: Open Existing Private Link */}
          <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 p-3">
            <summary className="flex items-center justify-between gap-2 cursor-pointer list-none text-xs font-semibold text-[var(--text-primary)]">
              <span className="inline-flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                <span>Already have a private link or space code?</span>
              </span>
              <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
            </summary>
            <form onSubmit={handleOpenExisting} className="mt-3 space-y-2.5">
              <label
                htmlFor="existing-space-input"
                className="block text-[11px] text-[var(--text-muted)]"
              >
                Paste your full private URL (e.g. .../u/rahul-k9m4x7p2q8) or space code:
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="existing-space-input"
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="rahul-k9m4x7p2q8 or full URL"
                  value={existingInput}
                  onChange={(e) => {
                    setExistingInput(e.target.value);
                    setExistingError("");
                  }}
                  className="flex-1 min-w-[180px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono focus:border-sky-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={checkingExisting}
                  className="rounded-lg bg-sky-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-60 transition"
                >
                  {checkingExisting ? "Checking..." : "Open Space"}
                </button>
              </div>
              {existingError && (
                <p role="alert" className="text-xs font-medium text-rose-400">
                  {existingError}
                </p>
              )}
            </form>
          </details>
        </section>

        <p className="text-center text-[11px] text-[var(--text-muted)]">
          Mobile-first closed-loop Workouts · Nutrition · Sleep · Habits Journal
        </p>
      </main>
    </div>
  );
}
