"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dumbbell,
  Apple,
  Moon,
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Plus,
  Trash2,
  Share2,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Sun,
  CloudCheck,
  RefreshCw,
  FileText,
  UserCheck,
  BookOpen,
  Flame,
  Droplets,
  Clock,
  HeartPulse,
  ArrowUpRight,
  Send,
  Bot,
  RotateCcw,
  Wand2,
} from "lucide-react";
import {
  UserProfileStore,
  DailyEntry,
  WorkoutExercise,
  ExerciseSet,
  MealEntry,
  CustomHealthMetric,
  AiCoachMessage,
  AiRecoveryPrescription,
  createDefaultUserProfile,
  createDefaultDailyEntry,
  calculateSufficiencyAnalysis,
} from "@/lib/types";

interface FitnessDashboardProps {
  initialSlug?: string;
}

type ActiveTab = "all" | "workout" | "nutrition" | "sleep" | "research";

const QUICK_EXERCISE_PRESETS = [
  { name: "Barbell Squat", group: "Legs" },
  { name: "Romanian Deadlift", group: "Hamstrings" },
  { name: "Overhead Press", group: "Shoulders" },
  { name: "Pull-Ups / Chin-Ups", group: "Back" },
  { name: "Dumbbell Lateral Raise", group: "Shoulders" },
  { name: "Cable Tricep Pushdown", group: "Arms" },
  { name: "Barbell Curl", group: "Arms" },
  { name: "Leg Press", group: "Legs" },
];

export default function FitnessDashboard({
  initialSlug = "main",
}: FitnessDashboardProps) {
  const slug = (initialSlug || "main").toLowerCase();
  const todayStr = new Date().toISOString().slice(0, 10);

  const [profile, setProfile] = useState<UserProfileStore>(() =>
    createDefaultUserProfile(slug)
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [syncState, setSyncState] = useState<
    "loading" | "saving" | "saved" | "local-only"
  >("loading");
  const [storageSource, setStorageSource] = useState<string>("loading");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [customSlugInput, setCustomSlugInput] = useState("");
  const [showSlugSwitcher, setShowSlugSwitcher] = useState(false);
  const [colorSchemeOverride, setColorSchemeOverride] = useState<
    "light dark" | "dark" | "light"
  >("dark");
  const [geminiModel, setGeminiModel] = useState<
    "gemini-4-hydrogen" | "gemini-4-argon"
  >("gemini-4-hydrogen");
  const [geminiLoadingMode, setGeminiLoadingMode] = useState<
    null | "optimize-day" | "smart-log" | "coach"
  >(null);
  const [smartLogInput, setSmartLogInput] = useState("");
  const [coachInput, setCoachInput] = useState("");
  const [smartLogError, setSmartLogError] = useState("");
  const [coachError, setCoachError] = useState("");
  const [geminiStatusMessage, setGeminiStatusMessage] = useState("");
  const [showAiHub, setShowAiHub] = useState(true);

  const smartLogTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const coachTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);

  // Sync theme override with <meta name="color-scheme"> per modern-web-guidance
  useEffect(() => {
    try {
      const stored = localStorage.getItem("color-scheme") as
        | "dark"
        | "light"
        | null;
      const initial = stored || "dark";
      setColorSchemeOverride(initial);
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) {
        meta.setAttribute("content", initial);
      }
    } catch {
      // ignore storage restrictions
    }
  }, []);

  const toggleColorScheme = () => {
    const nextScheme = colorSchemeOverride === "dark" ? "light" : "dark";
    setColorSchemeOverride(nextScheme);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.setAttribute("content", nextScheme);
    }
    try {
      localStorage.setItem("color-scheme", nextScheme);
    } catch {
      // ignore
    }
  };

  // Load initial profile from Cloud API + LocalStorage fallback
  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setSyncState("loading");
      const localKey = `pulse-loop-profile-${slug}`;
      let localData: UserProfileStore | null = null;

      try {
        const rawLocal = localStorage.getItem(localKey);
        if (rawLocal) {
          localData = JSON.parse(rawLocal) as UserProfileStore;
          if (!cancelled && localData) {
            setProfile(localData);
          }
        }
      } catch {
        // ignore local parse error
      }

      try {
        const res = await fetch(`/api/state?slug=${encodeURIComponent(slug)}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data?.profile) {
            const serverProfile = data.profile as UserProfileStore;
            setStorageSource(data.source || "cloud");
            // Prefer whichever has a newer updatedAt if local exists and server was default
            if (
              data.source === "default" &&
              localData &&
              localData.updatedAt
            ) {
              setProfile(localData);
              // Push existing local data to server
              await fetch("/api/state", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug, profile: localData }),
              });
            } else {
              setProfile(serverProfile);
              try {
                localStorage.setItem(localKey, JSON.stringify(serverProfile));
              } catch {
                // ignore
              }
            }
            setSyncState("saved");
          }
        } else {
          setSyncState("local-only");
        }
      } catch {
        if (!cancelled) {
          setSyncState("local-only");
        }
      } finally {
        isInitialLoadRef.current = false;
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Debounced auto-save on any profile state change
  const triggerAutoSave = useCallback(
    (nextProfile: UserProfileStore) => {
      const localKey = `pulse-loop-profile-${slug}`;
      try {
        localStorage.setItem(localKey, JSON.stringify(nextProfile));
      } catch {
        // ignore
      }

      setSyncState("saving");
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug, profile: nextProfile }),
          });
          if (res.ok) {
            const result = await res.json();
            setStorageSource(result.source || "cloud");
            setSyncState("saved");
          } else {
            setSyncState("local-only");
          }
        } catch {
          setSyncState("local-only");
        }
      }, 380);
    },
    [slug]
  );

  const currentDay: DailyEntry =
    profile.days[selectedDate] || createDefaultDailyEntry(selectedDate);

  const updateCurrentDay = useCallback(
    (updater: (prev: DailyEntry) => DailyEntry) => {
      setProfile((prevProfile) => {
        const existingDay =
          prevProfile.days[selectedDate] ||
          createDefaultDailyEntry(selectedDate);
        const updatedDay = {
          ...updater(existingDay),
          date: selectedDate,
          updatedAt: new Date().toISOString(),
        };

        // If useMealSum is enabled, recalculate daily macros from meals
        if (updatedDay.nutrition.useMealSum) {
          const totals = updatedDay.nutrition.meals.reduce(
            (acc, m) => ({
              calories: acc.calories + (Number(m.calories) || 0),
              protein: acc.protein + (Number(m.protein) || 0),
              carbs: acc.carbs + (Number(m.carbs) || 0),
              fats: acc.fats + (Number(m.fats) || 0),
            }),
            { calories: 0, protein: 0, carbs: 0, fats: 0 }
          );
          updatedDay.nutrition = {
            ...updatedDay.nutrition,
            ...totals,
          };
        }

        const nextProfile: UserProfileStore = {
          ...prevProfile,
          days: {
            ...prevProfile.days,
            [selectedDate]: updatedDay,
          },
          updatedAt: new Date().toISOString(),
        };
        triggerAutoSave(nextProfile);
        return nextProfile;
      });
    },
    [selectedDate, triggerAutoSave]
  );

  const updateProfileMeta = useCallback(
    (updater: (prev: UserProfileStore) => UserProfileStore) => {
      setProfile((prev) => {
        const next = {
          ...updater(prev),
          updatedAt: new Date().toISOString(),
        };
        triggerAutoSave(next);
        return next;
      });
    },
    [triggerAutoSave]
  );

  const shiftDate = (daysDelta: number) => {
    const dt = new Date(`${selectedDate}T12:00:00`);
    dt.setDate(dt.getDate() + daysDelta);
    setSelectedDate(dt.toISOString().slice(0, 10));
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2200);
    } catch {
      // ignore
    }
  };

  // Workout helpers
  const addExercise = (presetName = "", presetGroup = "Strength") => {
    const newEx: WorkoutExercise = {
      id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: presetName || "New Exercise",
      muscleGroup: presetGroup,
      note: "",
      sets: [{ id: `s-${Date.now()}`, weight: 40, reps: 10, rpe: 8, completed: true }],
    };
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        exercises: [...d.workout.exercises, newEx],
      },
    }));
  };

  const updateExercise = (
    exId: string,
    patch: Partial<WorkoutExercise>
  ) => {
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        exercises: d.workout.exercises.map((ex) =>
          ex.id === exId ? { ...ex, ...patch } : ex
        ),
      },
    }));
  };

  const removeExercise = (exId: string) => {
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        exercises: d.workout.exercises.filter((ex) => ex.id !== exId),
      },
    }));
  };

  const addSetToExercise = (exId: string) => {
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        exercises: d.workout.exercises.map((ex) => {
          if (ex.id !== exId) return ex;
          const lastSet = ex.sets[ex.sets.length - 1];
          const newSet: ExerciseSet = {
            id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            weight: lastSet ? lastSet.weight : 40,
            reps: lastSet ? lastSet.reps : 10,
            rpe: lastSet ? lastSet.rpe : 8,
            completed: true,
          };
          return { ...ex, sets: [...ex.sets, newSet] };
        }),
      },
    }));
  };

  const updateExerciseSet = (
    exId: string,
    setId: string,
    patch: Partial<ExerciseSet>
  ) => {
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        exercises: d.workout.exercises.map((ex) =>
          ex.id === exId
            ? {
                ...ex,
                sets: ex.sets.map((s) =>
                  s.id === setId ? { ...s, ...patch } : s
                ),
              }
            : ex
        ),
      },
    }));
  };

  const removeExerciseSet = (exId: string, setId: string) => {
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        exercises: d.workout.exercises.map((ex) =>
          ex.id === exId
            ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
            : ex
        ),
      },
    }));
  };

  // Nutrition helpers
  const addMeal = () => {
    const newMeal: MealEntry = {
      id: `m-${Date.now()}`,
      time: "12:30",
      name: "Custom Meal / Shake",
      calories: 450,
      protein: 35,
      carbs: 45,
      fats: 12,
      note: "",
    };
    updateCurrentDay((d) => ({
      ...d,
      nutrition: {
        ...d.nutrition,
        meals: [...d.nutrition.meals, newMeal],
      },
    }));
  };

  const updateMeal = (mealId: string, patch: Partial<MealEntry>) => {
    updateCurrentDay((d) => ({
      ...d,
      nutrition: {
        ...d.nutrition,
        meals: d.nutrition.meals.map((m) =>
          m.id === mealId ? { ...m, ...patch } : m
        ),
      },
    }));
  };

  const removeMeal = (mealId: string) => {
    updateCurrentDay((d) => ({
      ...d,
      nutrition: {
        ...d.nutrition,
        meals: d.nutrition.meals.filter((m) => m.id !== mealId),
      },
    }));
  };

  const addCustomMetric = () => {
    const newMetric: CustomHealthMetric = {
      id: `cm-${Date.now()}`,
      label: "Custom Metric",
      value: "100",
      unit: "mg",
      note: "",
    };
    updateCurrentDay((d) => ({
      ...d,
      nutrition: {
        ...d.nutrition,
        customMetrics: [...d.nutrition.customMetrics, newMetric],
      },
    }));
  };

  const updateCustomMetric = (
    id: string,
    patch: Partial<CustomHealthMetric>
  ) => {
    updateCurrentDay((d) => ({
      ...d,
      nutrition: {
        ...d.nutrition,
        customMetrics: d.nutrition.customMetrics.map((cm) =>
          cm.id === id ? { ...cm, ...patch } : cm
        ),
      },
    }));
  };

  const removeCustomMetric = (id: string) => {
    updateCurrentDay((d) => ({
      ...d,
      nutrition: {
        ...d.nutrition,
        customMetrics: d.nutrition.customMetrics.filter((cm) => cm.id !== id),
      },
    }));
  };

  const analysis = calculateSufficiencyAnalysis(currentDay, profile);

  return (
    <div className="min-h-screen pb-16 transition-colors">
      {/* Sticky Minimal Top Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-3.5 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Brand + Editable Workspace Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                <Activity className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    aria-label="Dashboard Title"
                    value={profile.displayName}
                    onChange={(e) =>
                      updateProfileMeta((p) => ({
                        ...p,
                        displayName: e.target.value,
                      }))
                    }
                    className="inline-edit-input font-semibold tracking-tight text-base sm:text-lg truncate max-w-[200px] sm:max-w-xs"
                  />
                  <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)] border border-[var(--border-subtle)]">
                    /u/{slug}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Tap any number, exercise, or note to edit inline · Auto-saves live
                </p>
              </div>
            </div>

            {/* Right Controls: Auto-save status, User URL Switcher, Share, Theme */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-medium"
              >
                {syncState === "saving" || syncState === "loading" ? (
                  <>
                    <RefreshCw
                      className="h-3.5 w-3.5 animate-spin text-amber-400"
                      aria-hidden="true"
                    />
                    <span className="text-[var(--text-muted)]">
                      {syncState === "loading" ? "Syncing..." : "Saving..."}
                    </span>
                  </>
                ) : (
                  <>
                    <CloudCheck
                      className="h-3.5 w-3.5 text-emerald-400"
                      aria-hidden="true"
                    />
                    <span className="text-emerald-400">
                      {storageSource === "cloud-blob"
                        ? "Cloud Saved ✓"
                        : "Auto-Saved ✓"}
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowSlugSwitcher((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-medium hover:border-emerald-500/50 transition"
                title="Switch or create a custom URL for another user"
              >
                <UserCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                <span className="hidden sm:inline">Custom URL</span>
              </button>

              <button
                type="button"
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition"
              >
                {copiedUrl ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Share Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={toggleColorScheme}
                aria-label={
                  colorSchemeOverride === "dark"
                    ? "Switch to light theme"
                    : "Switch to dark theme"
                }
                className="inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-xs hover:border-emerald-500/40 transition"
              >
                {colorSchemeOverride === "dark" ? (
                  <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Expandable Per-User Custom URL Bar */}
          {showSlugSwitcher && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-[var(--bg-elevated)] p-2.5 text-xs">
              <div className="text-[var(--text-muted)]">
                Every custom URL gets its own isolated auto-saved profile (e.g.{" "}
                <code className="text-emerald-400">/u/alex</code>,{" "}
                <code className="text-emerald-400">/u/client1</code>):
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = customSlugInput
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9-_]/g, "");
                  if (clean) {
                    window.location.href = `/u/${clean}`;
                  }
                }}
                className="flex items-center gap-1.5"
              >
                <span className="text-[var(--text-muted)]">/u/</span>
                <input
                  type="text"
                  placeholder="enter-name"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={customSlugInput}
                  onChange={(e) => setCustomSlugInput(e.target.value)}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-3 py-1 font-semibold text-slate-950 hover:bg-emerald-400 transition"
                >
                  Open URL
                </button>
              </form>
            </div>
          )}

          {/* Date Bar + Module Filter Pills */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-1">
            {/* Date Picker */}
            <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
              <button
                type="button"
                onClick={() => shiftDate(-1)}
                aria-label="Previous Day"
                className="rounded-lg p-1.5 hover:bg-[var(--bg-surface)] transition"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <input
                type="date"
                aria-label="Selected Log Date"
                value={selectedDate}
                onChange={(e) =>
                  e.target.value && setSelectedDate(e.target.value)
                }
                className="bg-transparent px-2 text-xs font-semibold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => shiftDate(1)}
                aria-label="Next Day"
                className="rounded-lg p-1.5 hover:bg-[var(--bg-surface)] transition"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
              {selectedDate !== todayStr && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-400"
                >
                  Today
                </button>
              )}
            </div>

            {/* Module Filter Pills */}
            <nav
              aria-label="Dashboard Modules"
              className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1"
            >
              {(
                [
                  { id: "all", label: "All Modules" },
                  { id: "workout", label: "Workouts" },
                  { id: "nutrition", label: "Nutrition" },
                  { id: "sleep", label: "Sleep & Recovery" },
                  { id: "research", label: "Market Benchmarks" },
                ] as { id: ActiveTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    activeTab === tab.id
                      ? "bg-emerald-500 text-slate-950 font-semibold shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-3.5 pt-5 sm:px-6">
        {/* TOP CLOSED-LOOP SUFFICIENCY & READINESS BANNER */}
        <section
          aria-label="Daily Sufficiency and Readiness Summary"
          className={`rounded-2xl border p-4 sm:p-5 transition ${
            analysis.verdictLevel === "optimal"
              ? "border-emerald-500/40 bg-emerald-500/5"
              : analysis.verdictLevel === "moderate"
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-rose-500/40 bg-rose-500/5"
          }`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                    analysis.verdictLevel === "optimal"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : analysis.verdictLevel === "moderate"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-rose-500/20 text-rose-400"
                  }`}
                >
                  {analysis.verdictLevel === "optimal" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : analysis.verdictLevel === "moderate" ? (
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <AlertOctagon className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {analysis.verdictLevel === "optimal"
                    ? "Optimal Recovery Loop"
                    : analysis.verdictLevel === "moderate"
                    ? "Borderline Sufficiency"
                    : "Recovery / Fueling Deficit"}
                </span>

                <span className="text-xs text-[var(--text-muted)]">
                  WHOOP / Oura / Clinical Sufficiency Engine
                </span>
              </div>

              <h1 className="text-lg font-bold tracking-tight sm:text-xl">
                {analysis.verdictHeadline}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                {analysis.verdictExplanation}
              </p>
            </div>

            {/* 4 Key Ring Gauges */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 shrink-0">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-center">
                <div className="text-[11px] font-medium text-[var(--text-muted)]">
                  Readiness
                </div>
                <div className="mt-0.5 text-xl font-extrabold text-emerald-400">
                  {analysis.readinessScore}%
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  Holistic Score
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-center">
                <div className="text-[11px] font-medium text-[var(--text-muted)]">
                  Gym Strain
                </div>
                <div className="mt-0.5 text-xl font-extrabold text-sky-400">
                  {analysis.strainScore}
                  <span className="text-xs font-normal text-[var(--text-muted)]">
                    /21
                  </span>
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  {currentDay.workout.gymDurationMinutes}m · {analysis.totalSets} sets
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-center">
                <div className="text-[11px] font-medium text-[var(--text-muted)]">
                  Sleep vs Need
                </div>
                <div className="mt-0.5 text-xl font-extrabold text-indigo-400">
                  {currentDay.sleep.totalHours}h
                  <span className="text-xs font-normal text-[var(--text-muted)]">
                    /{analysis.requiredSleepHours}h
                  </span>
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  Deep: {currentDay.sleep.deepSleepHours}h ({analysis.deepSleepPercentage}%)
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-center">
                <div className="text-[11px] font-medium text-[var(--text-muted)]">
                  Fuel & Protein
                </div>
                <div className="mt-0.5 text-xl font-extrabold text-amber-400">
                  {currentDay.nutrition.protein}g
                  <span className="text-xs font-normal text-[var(--text-muted)]">
                    /{currentDay.nutrition.proteinTarget}g
                  </span>
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  {currentDay.nutrition.calories} / {currentDay.nutrition.calorieTarget} kcal
                </div>
              </div>
            </div>
          </div>

          {/* 3 Clinical Sufficiency Checks */}
          <div className="mt-3.5 grid gap-2 sm:grid-cols-3">
            {Object.entries(analysis.clinicalPillarChecks).map(
              ([key, check]) => (
                <div
                  key={key}
                  className="flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 p-2.5 text-xs"
                >
                  <span
                    className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      check.status === "optimal"
                        ? "bg-emerald-400"
                        : check.status === "warning"
                        ? "bg-amber-400"
                        : "bg-rose-400"
                    }`}
                  />
                  <div>
                    <div className="font-semibold">{check.label}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {check.detail}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {/* General Daily Context Note (Inline Auto-Save) */}
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
            <FileText
              className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label="Daily Master Note"
              placeholder="Type a general daily note, morning mindset, injury tweak, or coach check-in..."
              value={currentDay.dailyNote}
              onChange={(e) =>
                updateCurrentDay((d) => ({ ...d, dailyNote: e.target.value }))
              }
              className="w-full bg-transparent text-xs sm:text-sm focus:outline-none"
            />
          </div>
        </section>

        {/* =========================================================
            MODULE 1: WORKOUTS (Gym Duration, Exercises, Sets, Reps, Weight, Notes)
           ========================================================= */}
        {(activeTab === "all" || activeTab === "workout") && (
          <section
            aria-labelledby="heading-workouts"
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                  <Dumbbell className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="heading-workouts"
                    className="text-base font-bold sm:text-lg"
                  >
                    1. Workouts & Gym Session
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Inline set/rep/weight tracker · Volume:{" "}
                    <strong className="text-[var(--text-primary)]">
                      {analysis.totalVolume.toLocaleString()} {profile.weightUnit}
                    </strong>{" "}
                    across {analysis.totalSets} sets ({analysis.totalReps} total reps)
                  </p>
                </div>
              </div>

              {/* Weight Unit Toggle (kg / lbs) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateProfileMeta((p) => ({
                      ...p,
                      weightUnit: p.weightUnit === "kg" ? "lbs" : "kg",
                    }))
                  }
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold hover:border-sky-500/40"
                >
                  Unit: {profile.weightUnit.toUpperCase()}
                </button>
                <button
                  type="button"
                  onClick={() => addExercise()}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Add Exercise</span>
                </button>
              </div>
            </div>

            {/* Session Summary Inputs (Gym Time, Workout Name, RPE, Cardio) */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                <label
                  htmlFor="workout-title"
                  className="block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  Workout Split / Focus
                </label>
                <input
                  id="workout-title"
                  type="text"
                  value={currentDay.workout.sessionTitle}
                  onChange={(e) =>
                    updateCurrentDay((d) => ({
                      ...d,
                      workout: { ...d.workout, sessionTitle: e.target.value },
                    }))
                  }
                  className="mt-1 w-full bg-transparent text-sm font-semibold focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                <label
                  htmlFor="gym-minutes"
                  className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]"
                >
                  <Clock className="h-3 w-3 text-sky-400" aria-hidden="true" />
                  Time Spent in Gym (min)
                </label>
                <div className="mt-1 flex items-baseline gap-1">
                  <input
                    id="gym-minutes"
                    type="text"
                    inputMode="numeric"
                    value={currentDay.workout.gymDurationMinutes}
                    onChange={(e) =>
                      updateCurrentDay((d) => ({
                        ...d,
                        workout: {
                          ...d.workout,
                          gymDurationMinutes: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0,
                        },
                      }))
                    }
                    className="w-20 bg-transparent text-lg font-bold text-sky-400 focus:outline-none"
                  />
                  <span className="text-xs text-[var(--text-muted)]">mins</span>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                <label
                  htmlFor="session-rpe"
                  className="block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  Session Intensity (RPE 1–10)
                </label>
                <div className="mt-1 flex items-baseline gap-1">
                  <input
                    id="session-rpe"
                    type="text"
                    inputMode="decimal"
                    value={currentDay.workout.sessionRpe}
                    onChange={(e) =>
                      updateCurrentDay((d) => ({
                        ...d,
                        workout: {
                          ...d.workout,
                          sessionRpe: Math.min(
                            10,
                            Number(e.target.value.replace(/[^0-9.]/g, "")) || 0
                          ),
                        },
                      }))
                    }
                    className="w-16 bg-transparent text-lg font-bold text-amber-400 focus:outline-none"
                  />
                  <span className="text-xs text-[var(--text-muted)]">/ 10</span>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                <label
                  htmlFor="cardio-mins"
                  className="block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  Cardio / Conditioning (min)
                </label>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    id="cardio-mins"
                    type="text"
                    inputMode="numeric"
                    value={currentDay.workout.cardioMinutes}
                    onChange={(e) =>
                      updateCurrentDay((d) => ({
                        ...d,
                        workout: {
                          ...d.workout,
                          cardioMinutes: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0,
                        },
                      }))
                    }
                    className="w-12 bg-transparent text-base font-bold text-emerald-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    aria-label="Cardio Type"
                    placeholder="Type (e.g. Zone 2 Walk)"
                    value={currentDay.workout.cardioType}
                    onChange={(e) =>
                      updateCurrentDay((d) => ({
                        ...d,
                        workout: { ...d.workout, cardioType: e.target.value },
                      }))
                    }
                    className="w-full bg-transparent text-xs text-[var(--text-muted)] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Quick-Add Exercise Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-[var(--text-muted)] mr-1">
                Quick Add:
              </span>
              {QUICK_EXERCISE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => addExercise(preset.name, preset.group)}
                  className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] hover:border-sky-500/50 hover:text-sky-400 transition"
                >
                  + {preset.name}
                </button>
              ))}
            </div>

            {/* Exercise Cards List */}
            <div className="space-y-3">
              {currentDay.workout.exercises.map((exercise, exIdx) => (
                <div
                  key={exercise.id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 sm:p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-xs font-bold text-sky-400">
                        {exIdx + 1}
                      </span>
                      <input
                        type="text"
                        aria-label={`Exercise ${exIdx + 1} Name`}
                        value={exercise.name}
                        onChange={(e) =>
                          updateExercise(exercise.id, { name: e.target.value })
                        }
                        placeholder="Type exercise name..."
                        className="w-full bg-transparent text-sm sm:text-base font-bold focus:outline-none border-b border-transparent focus:border-sky-500"
                      />
                      <input
                        type="text"
                        aria-label={`Exercise ${exIdx + 1} Muscle Group`}
                        value={exercise.muscleGroup}
                        onChange={(e) =>
                          updateExercise(exercise.id, {
                            muscleGroup: e.target.value,
                          })
                        }
                        placeholder="Muscle"
                        className="w-28 shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-center text-[11px] text-[var(--text-muted)]"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => addSetToExercise(exercise.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-400 hover:bg-sky-500/20"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        <span>Set</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeExercise(exercise.id)}
                        aria-label={`Delete ${exercise.name}`}
                        className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-rose-500/15 hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Sets Inline Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
                          <th className="py-1.5 pr-2 w-12">Set</th>
                          <th className="py-1.5 px-2">
                            Weight ({profile.weightUnit})
                          </th>
                          <th className="py-1.5 px-2">Reps</th>
                          <th className="py-1.5 px-2">RPE</th>
                          <th className="py-1.5 px-2">Volume</th>
                          <th className="py-1.5 pl-2 text-right">Done</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]/50">
                        {exercise.sets.map((s, sIdx) => (
                          <tr
                            key={s.id}
                            className={
                              s.completed ? "" : "opacity-50"
                            }
                          >
                            <td className="py-1.5 pr-2 font-semibold text-[var(--text-muted)]">
                              #{sIdx + 1}
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                aria-label={`Set ${sIdx + 1} Weight`}
                                value={s.weight}
                                onChange={(e) =>
                                  updateExerciseSet(exercise.id, s.id, {
                                    weight:
                                      Number(
                                        e.target.value.replace(/[^0-9.]/g, "")
                                      ) || 0,
                                  })
                                }
                                className="w-20 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 font-semibold focus:border-sky-400 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                aria-label={`Set ${sIdx + 1} Reps`}
                                value={s.reps}
                                onChange={(e) =>
                                  updateExerciseSet(exercise.id, s.id, {
                                    reps:
                                      Number(
                                        e.target.value.replace(/[^0-9]/g, "")
                                      ) || 0,
                                  })
                                }
                                className="w-16 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 font-semibold focus:border-sky-400 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                aria-label={`Set ${sIdx + 1} RPE`}
                                value={s.rpe ?? 8}
                                onChange={(e) =>
                                  updateExerciseSet(exercise.id, s.id, {
                                    rpe:
                                      Number(
                                        e.target.value.replace(/[^0-9.]/g, "")
                                      ) || 0,
                                  })
                                }
                                className="w-14 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[var(--text-muted)] focus:border-sky-400 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-2 font-medium text-[var(--text-muted)]">
                              {(
                                (Number(s.weight) || 0) * (Number(s.reps) || 0)
                              ).toLocaleString()}{" "}
                              {profile.weightUnit}
                            </td>
                            <td className="py-1.5 pl-2 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  aria-label={`Mark set ${sIdx + 1} completed`}
                                  checked={s.completed}
                                  onChange={(e) =>
                                    updateExerciseSet(exercise.id, s.id, {
                                      completed: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 rounded accent-emerald-500"
                                />
                                {exercise.sets.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeExerciseSet(exercise.id, s.id)
                                    }
                                    aria-label={`Remove set ${sIdx + 1}`}
                                    className="text-[var(--text-muted)] hover:text-rose-400 p-1"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Per-Exercise Inline Note */}
                  <div className="pt-1">
                    <input
                      type="text"
                      aria-label={`Note for ${exercise.name}`}
                      placeholder="Add exercise note (e.g., grip width, machine setting, tempo, joint feel)..."
                      value={exercise.note}
                      onChange={(e) =>
                        updateExercise(exercise.id, { note: e.target.value })
                      }
                      className="w-full rounded-lg border border-[var(--border-subtle)]/70 bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] focus:text-[var(--text-primary)] focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Overall Workout Session Note */}
            <div className="space-y-1">
              <label
                htmlFor="workout-session-note"
                className="block text-xs font-medium text-[var(--text-muted)]"
              >
                Workout Session Notes & Gym Summary
              </label>
              <textarea
                id="workout-session-note"
                placeholder="Type any workout notes, PRs hit, energy levels, or coach remarks..."
                value={currentDay.workout.note}
                onChange={(e) =>
                  updateCurrentDay((d) => ({
                    ...d,
                    workout: { ...d.workout, note: e.target.value },
                  }))
                }
                className="auto-grow-textarea w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs sm:text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </section>
        )}

        {/* =========================================================
            MODULE 2: NUTRITION & HEALTH METRICS (Calories, Macros, Water, Custom Metrics, Notes)
           ========================================================= */}
        {(activeTab === "all" || activeTab === "nutrition") && (
          <section
            aria-labelledby="heading-nutrition"
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                  <Apple className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="heading-nutrition"
                    className="text-base font-bold sm:text-lg"
                  >
                    2. Nutrition, Macros & Health Metrics
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Tap any calorie/macro value or target to type directly, or log meals below
                  </p>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentDay.nutrition.useMealSum}
                  onChange={(e) =>
                    updateCurrentDay((d) => ({
                      ...d,
                      nutrition: {
                        ...d.nutrition,
                        useMealSum: e.target.checked,
                      },
                    }))
                  }
                  className="h-4 w-4 rounded accent-emerald-500"
                />
                <span>Auto-sum totals from meal rows</span>
              </label>
            </div>

            {/* Core Calories & Macros Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {[
                {
                  key: "calories",
                  targetKey: "calorieTarget",
                  label: "Calories",
                  unit: "kcal",
                  color: "bg-amber-400",
                  textColor: "text-amber-400",
                },
                {
                  key: "protein",
                  targetKey: "proteinTarget",
                  label: "Protein",
                  unit: "g",
                  color: "bg-emerald-400",
                  textColor: "text-emerald-400",
                },
                {
                  key: "carbs",
                  targetKey: "carbTarget",
                  label: "Carbs",
                  unit: "g",
                  color: "bg-sky-400",
                  textColor: "text-sky-400",
                },
                {
                  key: "fats",
                  targetKey: "fatTarget",
                  label: "Fats",
                  unit: "g",
                  color: "bg-purple-400",
                  textColor: "text-purple-400",
                },
                {
                  key: "waterLiters",
                  targetKey: "waterTargetLiters",
                  label: "Hydration",
                  unit: "L",
                  color: "bg-cyan-400",
                  textColor: "text-cyan-400",
                },
                {
                  key: "fiberGrams",
                  targetKey: "fiberTargetGrams",
                  label: "Fiber",
                  unit: "g",
                  color: "bg-teal-400",
                  textColor: "text-teal-400",
                },
              ].map((item) => {
                const val = Number(
                  currentDay.nutrition[
                    item.key as keyof typeof currentDay.nutrition
                  ]
                ) || 0;
                const target = Number(
                  currentDay.nutrition[
                    item.targetKey as keyof typeof currentDay.nutrition
                  ]
                ) || 1;
                const pct = Math.min(100, Math.round((val / target) * 100));

                return (
                  <div
                    key={item.key}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] font-medium text-[var(--text-muted)]">
                      <span>{item.label}</span>
                      <span>{pct}%</span>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`${item.label} Consumed (${item.unit})`}
                        value={val}
                        onChange={(e) =>
                          updateCurrentDay((d) => ({
                            ...d,
                            nutrition: {
                              ...d.nutrition,
                              useMealSum: false,
                              [item.key]:
                                Number(
                                  e.target.value.replace(/[^0-9.]/g, "")
                                ) || 0,
                            },
                          }))
                        }
                        className={`w-16 bg-transparent text-lg font-extrabold ${item.textColor} focus:outline-none`}
                      />
                      <span className="text-[11px] text-[var(--text-muted)]">
                        /
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`${item.label} Target (${item.unit})`}
                        value={target}
                        onChange={(e) =>
                          updateCurrentDay((d) => ({
                            ...d,
                            nutrition: {
                              ...d.nutrition,
                              [item.targetKey]:
                                Number(
                                  e.target.value.replace(/[^0-9.]/g, "")
                                ) || 0,
                            },
                          }))
                        }
                        className="w-14 bg-transparent text-xs text-[var(--text-muted)] focus:outline-none"
                      />
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {item.unit}
                      </span>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Meal Log Breakdown */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Meals & Timed Nutrition Log
                </h3>
                <button
                  type="button"
                  onClick={addMeal}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  <span>Add Meal</span>
                </button>
              </div>

              <div className="space-y-2">
                {currentDay.nutrition.meals.map((meal) => (
                  <div
                    key={meal.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 sm:p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        aria-label="Meal Time"
                        value={meal.time}
                        onChange={(e) =>
                          updateMeal(meal.id, { time: e.target.value })
                        }
                        className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-medium"
                      />
                      <input
                        type="text"
                        aria-label="Meal Description"
                        value={meal.name}
                        onChange={(e) =>
                          updateMeal(meal.id, { name: e.target.value })
                        }
                        placeholder="Meal / food items..."
                        className="flex-1 min-w-[180px] bg-transparent text-xs sm:text-sm font-semibold focus:outline-none"
                      />

                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <label className="flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2 py-1">
                          <span className="text-[10px] text-amber-400">kcal</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={meal.calories}
                            onChange={(e) =>
                              updateMeal(meal.id, {
                                calories:
                                  Number(
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  ) || 0,
                              })
                            }
                            className="w-12 bg-transparent font-bold text-right focus:outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2 py-1">
                          <span className="text-[10px] text-emerald-400">P(g)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={meal.protein}
                            onChange={(e) =>
                              updateMeal(meal.id, {
                                protein:
                                  Number(
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  ) || 0,
                              })
                            }
                            className="w-10 bg-transparent font-bold text-right focus:outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2 py-1">
                          <span className="text-[10px] text-sky-400">C(g)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={meal.carbs}
                            onChange={(e) =>
                              updateMeal(meal.id, {
                                carbs:
                                  Number(
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  ) || 0,
                              })
                            }
                            className="w-10 bg-transparent font-bold text-right focus:outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2 py-1">
                          <span className="text-[10px] text-purple-400">F(g)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={meal.fats}
                            onChange={(e) =>
                              updateMeal(meal.id, {
                                fats:
                                  Number(
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  ) || 0,
                              })
                            }
                            className="w-10 bg-transparent font-bold text-right focus:outline-none"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeMeal(meal.id)}
                          aria-label={`Remove ${meal.name}`}
                          className="p-1 text-[var(--text-muted)] hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      aria-label={`Note for ${meal.name}`}
                      placeholder="Meal note (digestion, pre/post workout context, restaurant estimate)..."
                      value={meal.note}
                      onChange={(e) =>
                        updateMeal(meal.id, { note: e.target.value })
                      }
                      className="w-full rounded-lg bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-muted)] focus:text-[var(--text-primary)] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Custom General Health & Supplement Metrics */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  General Health, Supplements & Biomarker Metrics
                </h3>
                <button
                  type="button"
                  onClick={addCustomMetric}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  <span>Add Custom Metric</span>
                </button>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-3">
                {currentDay.nutrition.customMetrics.map((cm) => (
                  <div
                    key={cm.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <input
                        type="text"
                        aria-label="Custom Metric Name"
                        value={cm.label}
                        onChange={(e) =>
                          updateCustomMetric(cm.id, { label: e.target.value })
                        }
                        className="w-full bg-transparent text-xs font-semibold text-[var(--text-muted)] focus:text-[var(--text-primary)] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeCustomMetric(cm.id)}
                        aria-label={`Delete ${cm.label}`}
                        className="text-[var(--text-muted)] hover:text-rose-400 text-xs px-1"
                      >
                        ×
                      </button>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <input
                        type="text"
                        aria-label={`${cm.label} Value`}
                        value={cm.value}
                        onChange={(e) =>
                          updateCustomMetric(cm.id, { value: e.target.value })
                        }
                        className="w-24 bg-transparent text-base font-bold text-emerald-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        aria-label={`${cm.label} Unit`}
                        value={cm.unit}
                        onChange={(e) =>
                          updateCustomMetric(cm.id, { unit: e.target.value })
                        }
                        placeholder="unit"
                        className="w-16 bg-transparent text-xs text-[var(--text-muted)] focus:outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      aria-label={`Note for ${cm.label}`}
                      placeholder="Add note..."
                      value={cm.note}
                      onChange={(e) =>
                        updateCustomMetric(cm.id, { note: e.target.value })
                      }
                      className="w-full rounded-md bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-muted)] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Overall Nutrition Note */}
            <div className="space-y-1">
              <label
                htmlFor="nutrition-note"
                className="block text-xs font-medium text-[var(--text-muted)]"
              >
                Nutrition, Hydration & Gut Health Notes
              </label>
              <textarea
                id="nutrition-note"
                placeholder="Type any notes on appetite, meal timing, supplements, or energy availability..."
                value={currentDay.nutrition.note}
                onChange={(e) =>
                  updateCurrentDay((d) => ({
                    ...d,
                    nutrition: { ...d.nutrition, note: e.target.value },
                  }))
                }
                className="auto-grow-textarea w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
          </section>
        )}

        {/* =========================================================
            MODULE 3: SLEEP & RECOVERY SUFFICIENCY
           ========================================================= */}
        {(activeTab === "all" || activeTab === "sleep") && (
          <section
            aria-labelledby="heading-sleep"
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
                  <Moon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="heading-sleep"
                    className="text-base font-bold sm:text-lg"
                  >
                    3. Sleep Architecture & Workout/Nutrition Sufficiency
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Evaluates total sleep & deep sleep against today&apos;s{" "}
                    {currentDay.workout.gymDurationMinutes}m gym load and{" "}
                    {currentDay.nutrition.calories} kcal nutrition
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <label
                  htmlFor="baseline-sleep-need"
                  className="text-[var(--text-muted)]"
                >
                  Base Sleep Need (hrs):
                </label>
                <input
                  id="baseline-sleep-need"
                  type="text"
                  inputMode="decimal"
                  value={profile.baselineSleepNeedHours}
                  onChange={(e) =>
                    updateProfileMeta((p) => ({
                      ...p,
                      baselineSleepNeedHours:
                        Number(e.target.value.replace(/[^0-9.]/g, "")) || 7.5,
                    }))
                  }
                  className="w-14 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-center font-bold text-indigo-400"
                />
              </div>
            </div>

            {/* Sleep Metrics Inline Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 col-span-1 sm:col-span-2">
                <label
                  htmlFor="sleep-total"
                  className="block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  Total Sleep Duration (hrs)
                </label>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <input
                    id="sleep-total"
                    type="text"
                    inputMode="decimal"
                    value={currentDay.sleep.totalHours}
                    onChange={(e) =>
                      updateCurrentDay((d) => ({
                        ...d,
                        sleep: {
                          ...d.sleep,
                          totalHours:
                            Number(e.target.value.replace(/[^0-9.]/g, "")) || 0,
                        },
                      }))
                    }
                    className="w-20 bg-transparent text-2xl font-extrabold text-indigo-400 focus:outline-none"
                  />
                  <span className="text-xs text-[var(--text-muted)]">
                    hrs (Need: {analysis.requiredSleepHours}h)
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 col-span-1 sm:col-span-2">
                <label
                  htmlFor="sleep-deep"
                  className="block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  Deep Sleep / SWS (hrs)
                </label>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <input
                    id="sleep-deep"
                    type="text"
                    inputMode="decimal"
                    value={currentDay.sleep.deepSleepHours}
                    onChange={(e) =>
                      updateCurrentDay((d) => ({
                        ...d,
                        sleep: {
                          ...d.sleep,
                          deepSleepHours:
                            Number(e.target.value.replace(/[^0-9.]/g, "")) || 0,
                        },
                      }))
                    }
                    className="w-16 bg-transparent text-2xl font-extrabold text-emerald-400 focus:outline-none"
                  />
                  <span className="text-xs text-[var(--text-muted)]">
                    hrs ({analysis.deepSleepPercentage}% · min {analysis.requiredDeepSleepHours}h)
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                <label
                  htmlFor="sleep-rem"
                  className="block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  REM Sleep (hrs)
                </label>
                <input
                  id="sleep-rem"
                  type="text"
                  inputMode="decimal"
                  value={currentDay.sleep.remSleepHours}
                  onChange={(e) =>
                    updateCurrentDay((d) => ({
                      ...d,
                      sleep: {
                        ...d.sleep,
                        remSleepHours:
                          Number(e.target.value.replace(/[^0-9.]/g, "")) || 0,
                      },
                    }))
                  }
                  className="mt-1 w-full bg-transparent text-lg font-bold text-sky-400 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                <label
                  htmlFor="sleep-quality"
                  className="block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  Sleep Quality (1–10)
                </label>
                <input
                  id="sleep-quality"
                  type="text"
                  inputMode="numeric"
                  value={currentDay.sleep.sleepQuality}
                  onChange={(e) =>
                    updateCurrentDay((d) => ({
                      ...d,
                      sleep: {
                        ...d.sleep,
                        sleepQuality: Math.min(
                          10,
                          Number(e.target.value.replace(/[^0-9.]/g, "")) || 0
                        ),
                      },
                    }))
                  }
                  className="mt-1 w-full bg-transparent text-lg font-bold text-amber-400 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                <label
                  htmlFor="sleep-rhr"
                  className="block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  Resting HR (bpm)
                </label>
                <input
                  id="sleep-rhr"
                  type="text"
                  inputMode="numeric"
                  value={currentDay.sleep.restingHeartRate}
                  onChange={(e) =>
                    updateCurrentDay((d) => ({
                      ...d,
                      sleep: {
                        ...d.sleep,
                        restingHeartRate:
                          Number(e.target.value.replace(/[^0-9.]/g, "")) || 0,
                      },
                    }))
                  }
                  className="mt-1 w-full bg-transparent text-lg font-bold text-rose-400 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                <label
                  htmlFor="sleep-hrv"
                  className="block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  HRV (ms)
                </label>
                <input
                  id="sleep-hrv"
                  type="text"
                  inputMode="numeric"
                  value={currentDay.sleep.hrvMs}
                  onChange={(e) =>
                    updateCurrentDay((d) => ({
                      ...d,
                      sleep: {
                        ...d.sleep,
                        hrvMs:
                          Number(e.target.value.replace(/[^0-9.]/g, "")) || 0,
                      },
                    }))
                  }
                  className="mt-1 w-full bg-transparent text-lg font-bold text-teal-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Sleep Stage Visual Bar & Sufficiency Verdict Box */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold">
                  Cross-Module Sufficiency Diagnostic (Sleep × Workout × Nutrition)
                </span>
                <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                  <label className="flex items-center gap-1">
                    Bedtime:
                    <input
                      type="time"
                      value={currentDay.sleep.bedtime}
                      onChange={(e) =>
                        updateCurrentDay((d) => ({
                          ...d,
                          sleep: { ...d.sleep, bedtime: e.target.value },
                        }))
                      }
                      className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-xs"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    Wake:
                    <input
                      type="time"
                      value={currentDay.sleep.wakeTime}
                      onChange={(e) =>
                        updateCurrentDay((d) => ({
                          ...d,
                          sleep: { ...d.sleep, wakeTime: e.target.value },
                        }))
                      }
                      className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-xs"
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <div className="font-semibold text-indigo-400">
                    Is Sleep Sufficient for Today&apos;s Gym Workout?
                  </div>
                  <p className="mt-1 text-[var(--text-muted)] leading-relaxed">
                    {analysis.isSleepSufficientForWorkout &&
                    analysis.isDeepSleepSufficient
                      ? `Yes — Your ${currentDay.sleep.totalHours}h total sleep and ${currentDay.sleep.deepSleepHours}h deep sleep meet the ${analysis.requiredSleepHours}h strain-adjusted recovery requirement for your ${currentDay.workout.gymDurationMinutes}m (${analysis.totalSets}-set) workout.`
                      : `Not Quite — Your ${currentDay.workout.gymDurationMinutes}m gym session (Strain ${analysis.strainScore}/21) requires ${analysis.requiredSleepHours}h total sleep and ${analysis.requiredDeepSleepHours}h deep sleep. You logged ${currentDay.sleep.totalHours}h total and ${currentDay.sleep.deepSleepHours}h deep.`}
                  </p>
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <div className="font-semibold text-emerald-400">
                    Is Nutrition Sufficient for Sleep & Muscle Repair?
                  </div>
                  <p className="mt-1 text-[var(--text-muted)] leading-relaxed">
                    {analysis.isNutritionSufficientForWorkout
                      ? `Yes — ${currentDay.nutrition.protein}g protein and ${currentDay.nutrition.calories} kcal provide sufficient amino acid & glycogen availability so overnight growth hormone during deep sleep can repair muscle tissue.`
                      : `Deficit Detected — With ${analysis.totalVolume.toLocaleString()} ${profile.weightUnit} lifted today, your current intake (${currentDay.nutrition.calories} kcal, ${currentDay.nutrition.protein}g protein) risks blunting overnight HRV and deep-sleep muscle synthesis.`}
                  </p>
                </div>
              </div>
            </div>

            {/* Sleep Free-Text Note */}
            <div className="space-y-1">
              <label
                htmlFor="sleep-note"
                className="block text-xs font-medium text-[var(--text-muted)]"
              >
                Sleep Hygiene, Dreams & Recovery Notes
              </label>
              <textarea
                id="sleep-note"
                placeholder="Type any notes on sleep quality, late meals, caffeine cutoff, room temp, or morning soreness..."
                value={currentDay.sleep.note}
                onChange={(e) =>
                  updateCurrentDay((d) => ({
                    ...d,
                    sleep: { ...d.sleep, note: e.target.value },
                  }))
                }
                className="auto-grow-textarea w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs sm:text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </section>
        )}

        {/* =========================================================
            MODULE 4: MARKET RESEARCH, WEARABLES & CLINICAL BENCHMARKS
           ========================================================= */}
        {(activeTab === "all" || activeTab === "research") && (
          <section
            aria-labelledby="heading-research"
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="heading-research"
                  className="text-base font-bold sm:text-lg"
                >
                  Industry Market Research & Clinical Best Practices Applied
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  How WHOOP, Apple, Garmin, Samsung, Fitbit/Google, Oura & Pro Clinics shaped this dashboard
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-1.5">
                <div className="font-bold text-emerald-400">
                  WHOOP & Oura Ring (Closed-Loop Readiness)
                </div>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  <strong>Best Practice Adopted:</strong> Sleep isn&apos;t evaluated in a vacuum. Higher daytime gym strain (`0–21`) dynamically raises tonight&apos;s required sleep hours and deep sleep (SWS) threshold.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-1.5">
                <div className="font-bold text-sky-400">
                  Apple Watch Vitals, Garmin & Samsung Energy
                </div>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  <strong>Best Practice Adopted:</strong> Glanceable multi-ring status cards (`Readiness %`, `Strain`, `Sleep vs Need`, `Protein/Fuel`) with instant color-coded anomaly alerts (`Optimal`, `Borderline`, `Deficit`).
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-1.5">
                <div className="font-bold text-amber-400">
                  Fitbit / Google Health & Clinical Coaching Portals
                </div>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  <strong>Best Practice Adopted:</strong> Plain-English narrative insights + ubiquitous inline free-text notes at every layer (TrueCoach / Cronometer Pro standard) with zero-modal friction.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
