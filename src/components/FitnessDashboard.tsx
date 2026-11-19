"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  ChevronDown,
  Sparkles,
  Sun,
  CloudCheck,
  RefreshCw,
  FileText,
  UserCheck,
  BookOpen,
  Clock,
  Send,
  Bot,
  RotateCcw,
  Wand2,
  Search,
  Scale,
  Utensils,
  ShieldCheck,
  History,
  Pin,
  Copy,
  Calendar,
  Play,
  Square,
  Star,
  ListChecks,
  X,
  Bell,
  SkipForward,
  SlidersHorizontal,
  Layers,
  Save,
  Home,
  Lock,
  Download,
  ExternalLink,
  MessageCircle,
  LayoutGrid,
  Smartphone,
  Link2,
  MoreHorizontal,
} from "lucide-react";
import { DatePickerDialog, shiftIsoDate } from "@/components/DatePickerDialog";
import { EXPORT_FILE_PREFIX, getAiTierLabel } from "@/lib/brand";
import {
  UserProfileStore,
  DailyEntry,
  WorkoutExercise,
  ExerciseSet,
  ExerciseType,
  WorkoutSetType,
  WorkoutRoutineTemplate,
  HabitDefinition,
  HabitCategory,
  DailyHabitEntry,
  MealEntry,
  CustomHealthMetric,
  AiCoachMessage,
  AiRecoveryPrescription,
  PinnedFoodStaple,
  approximateSleepBiometricsForIndianMale70kg,
  createDefaultUserProfile,
  createDefaultDailyEntry,
  calculateSufficiencyAnalysis,
} from "@/lib/types";
import {
  FOOD_DATABASE,
  FoodDatabaseItem,
  searchFoodsCatalog,
  calculateFoodPortionNutrition,
} from "@/lib/nutritionDatabase";
import {
  isDailyEntryLogged,
  computePeriodSummary,
  findPreviousWorkoutSession,
  findPreviousExerciseSets,
  buildRoutineExercisesWithHistory,
  computeUserFrequentStaples,
  findLastBodyMetricEntry,
  computeHabitRecoveryImpact,
  UserFrequentStaple,
} from "@/lib/historyAndStaples";
import {
  CATEGORIZED_EXERCISE_PRESETS,
  HABIT_CATALOG,
  DEFAULT_ACTIVE_HABIT_IDS,
  getEffectiveRoutines,
  getAllHabitDefinitions,
  getActiveHabitsForProfile,
} from "@/lib/routinesAndHabits";
import {
  SavedSpaceRecord,
  clearActiveSlugIfMatches,
  dismissLinkNudge,
  extractSlugFromInput,
  getSavedSpaces,
  isLinkNudgeDismissed,
  setActiveSlug,
  upsertSavedSpace,
} from "@/lib/localSpaces";

interface FitnessDashboardProps {
  initialSlug?: string;
}

type PrimaryScreen = "home" | "workouts" | "nutrition" | "more";
type HomeSubPage = "checkin" | "summary";
type WorkoutSubPage = "routines" | "sets" | "finish";
type NutritionSubPage = "favs" | "search";
type MoreSubPage = "journal" | "ai" | "trends";

interface DecimalInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type"
  > {
  value: number;
  onValueChange: (val: number) => void;
  min?: number;
  max?: number;
  allowDecimal?: boolean;
  emptyAsZero?: boolean;
  showEmptyWhenZero?: boolean;
}

function DecimalInput({
  value,
  onValueChange,
  min = 0,
  max,
  allowDecimal = true,
  emptyAsZero = true,
  showEmptyWhenZero = false,
  onFocus,
  onBlur,
  ...rest
}: DecimalInputProps) {
  const formatDisplay = (v: number) => {
    if (showEmptyWhenZero && (!Number.isFinite(v) || v === 0)) return "";
    return Number.isFinite(v) ? String(v) : "0";
  };

  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>(() => formatDisplay(value));

  useEffect(() => {
    if (!focused) {
      setDraft(formatDisplay(value));
    }
  }, [value, focused, showEmptyWhenZero]);

  const clampVal = (num: number) => {
    let next = Math.max(min, num);
    if (typeof max === "number") next = Math.min(max, next);
    return next;
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      value={focused ? draft : formatDisplay(value)}
      onFocus={(e) => {
        setFocused(true);
        setDraft(value === 0 ? "" : String(value));
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        const regex = allowDecimal ? /^[0-9]*\.?[0-9]*$/ : /^[0-9]*$/;
        if (!regex.test(raw)) return;
        setDraft(raw);
        if (raw === "" || raw === ".") {
          if (raw === "" && emptyAsZero) {
            onValueChange(clampVal(0));
          }
          return;
        }
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) {
          onValueChange(clampVal(parsed));
        }
      }}
      onBlur={(e) => {
        setFocused(false);
        const parsed = Number(draft);
        const committed =
          draft.trim() === "" || draft === "." || Number.isNaN(parsed)
            ? clampVal(0)
            : clampVal(parsed);
        onValueChange(committed);
        setDraft(formatDisplay(committed));
        onBlur?.(e);
      }}
    />
  );
}

function formatMMSS(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function isPointerOutsideDialog(
  e: React.PointerEvent<HTMLDialogElement>,
  dlg: HTMLDialogElement | null
): boolean {
  if (!dlg) return false;
  const rect = dlg.getBoundingClientRect();
  return (
    e.clientX < rect.left ||
    e.clientX > rect.right ||
    e.clientY < rect.top ||
    e.clientY > rect.bottom
  );
}

export default function FitnessDashboard({
  initialSlug = "main",
}: FitnessDashboardProps) {
  const router = useRouter();
  const slug = (initialSlug || "main").toLowerCase();
  const todayStr = new Date().toISOString().slice(0, 10);

  const [profile, setProfile] = useState<UserProfileStore>(() =>
    createDefaultUserProfile(slug)
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [workspaceNotFound, setWorkspaceNotFound] = useState(false);
  const [notFoundLinkInput, setNotFoundLinkInput] = useState("");
  const [notFoundLinkError, setNotFoundLinkError] = useState("");
  const [checkingNotFoundLink, setCheckingNotFoundLink] = useState(false);

  // Screen-by-Screen Mobile-First Navigation + Optional Desktop Full View
  const [activeScreen, setActiveScreen] = useState<PrimaryScreen>("home");
  const [homeSubPage, setHomeSubPage] = useState<HomeSubPage>("checkin");
  const [workoutSubPage, setWorkoutSubPage] = useState<WorkoutSubPage>("routines");
  const [nutritionSubPage, setNutritionSubPage] = useState<NutritionSubPage>("favs");
  const [moreSubPage, setMoreSubPage] = useState<MoreSubPage>("journal");
  const [desktopFullView, setDesktopFullView] = useState(false);

  // Header Workspace, Backup & Sharing Dialog
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [clientOrigin, setClientOrigin] = useState("");
  const [savedSpaces, setSavedSpaces] = useState<SavedSpaceRecord[]>([]);
  const [existingSpaceInput, setExistingSpaceInput] = useState("");
  const [existingSpaceError, setExistingSpaceError] = useState("");
  const [checkingSpaceLink, setCheckingSpaceLink] = useState(false);
  const [copyStatusText, setCopyStatusText] = useState("");
  const lastCopyAnnouncementRef = useRef("");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [linkNudgeDismissed, setLinkNudgeDismissed] = useState(true);

  const [syncState, setSyncState] = useState<
    "loading" | "saving" | "saved" | "local-only"
  >("loading");
  const [storageSource, setStorageSource] = useState<string>("loading");
  const [colorSchemeOverride, setColorSchemeOverride] = useState<"dark" | "light">("dark");
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

  // Open Food Search & Portion Customizer state
  const [foodSearchQuery, setFoodSearchQuery] = useState("");
  const [foodCategoryFilter, setFoodCategoryFilter] = useState<string>("All");
  const [aiFoodResults, setAiFoodResults] = useState<FoodDatabaseItem[]>([]);
  const [selectedFoodItem, setSelectedFoodItem] = useState<FoodDatabaseItem>(
    () => FOOD_DATABASE[0]
  );
  const [selectedPortionIndex, setSelectedPortionIndex] = useState<number>(0);
  const [customWeightGrams, setCustomWeightGrams] = useState<number>(
    FOOD_DATABASE[0].portions[0].grams
  );
  const [foodQuantity, setFoodQuantity] = useState<number>(1);
  const [foodTime, setFoodTime] = useState<string>("13:00");
  const [foodSearchLoading, setFoodSearchLoading] = useState(false);
  const [foodSearchMessage, setFoodSearchMessage] = useState("");
  const [historyWindowDays, setHistoryWindowDays] = useState<7 | 14 | 30>(7);
  const [stapleQuantities, setStapleQuantities] = useState<Record<string, number>>({});
  const [lastSavedTimeLabel, setLastSavedTimeLabel] = useState<string>("");

  // Workout Dual Timers (Strength Trainer) + Accordion
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [currentHour, setCurrentHour] = useState<number>(12);
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState<number>(0);
  const [restElapsedSeconds, setRestElapsedSeconds] = useState<number>(0);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [presetTypeFilter, setPresetTypeFilter] = useState<"all" | ExerciseType>("all");
  const [quickCardioType, setQuickCardioType] = useState<string>("Running");
  const [quickCardioMins, setQuickCardioMins] = useState<number>(20);
  const [showSaveRoutineForm, setShowSaveRoutineForm] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineEnv, setNewRoutineEnv] = useState<"home" | "external">("home");
  const [workoutStatusBanner, setWorkoutStatusBanner] = useState("");
  const [quickFoodName, setQuickFoodName] = useState("");
  const [quickFoodCalories, setQuickFoodCalories] = useState<number>(0);
  const [quickFoodProtein, setQuickFoodProtein] = useState<number>(0);

  // 100-Habit Catalog Dialog
  const [showHabitCatalogDialog, setShowHabitCatalogDialog] = useState(false);
  const [habitSearchQuery, setHabitSearchQuery] = useState("");
  const [habitCategoryFilter, setHabitCategoryFilter] = useState<"All" | HabitCategory>("All");
  const [customHabitName, setCustomHabitName] = useState("");
  const [customHabitType, setCustomHabitType] = useState<"yes_no" | "dosage">("yes_no");
  const [customHabitUnit, setCustomHabitUnit] = useState("g");
  const [customHabitDefault, setCustomHabitDefault] = useState("5");
  const [customHabitCategory, setCustomHabitCategory] = useState<HabitCategory>("Supplements");

  const workspaceMenuDialogRef = useRef<HTMLDialogElement | null>(null);
  const workspacePressedOutsideRef = useRef(false);
  const habitCatalogDialogRef = useRef<HTMLDialogElement | null>(null);
  const habitPressedOutsideRef = useRef(false);
  const smartLogTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const coachTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUserEditedRef = useRef(false);
  const hasAutoSelectedHomeSubRef = useRef(false);
  const latestProfileRef = useRef<UserProfileStore>(profile);

  useEffect(() => {
    latestProfileRef.current = profile;
  }, [profile]);

  // Accessible copy helper with VoiceOver repeat deduplication (per modern-web-guidance copy-button)
  const announceCopyStatus = useCallback((message: string) => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    let nextMsg = message;
    if (nextMsg === lastCopyAnnouncementRef.current) {
      nextMsg += "\u00A0";
    }
    lastCopyAnnouncementRef.current = nextMsg;
    setCopyStatusText(nextMsg);
    copyTimerRef.current = setTimeout(() => {
      setCopyStatusText("");
    }, 2800);
  }, []);

  const copyTextToClipboard = useCallback(
    async (text: string, successLabel: string) => {
      try {
        await navigator.clipboard.writeText(text);
        announceCopyStatus(successLabel);
        return true;
      } catch {
        // Fallback for non-HTTPS or restricted clipboard contexts
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
          document.body.append(ta);
          ta.select();
          const ok = document.execCommand("copy");
          ta.remove();
          if (ok) {
            announceCopyStatus(successLabel);
            return true;
          }
        } catch {
          // ignore
        }
        announceCopyStatus("Copy failed — select and copy from address bar.");
        return false;
      }
    },
    [announceCopyStatus]
  );

  // Capture client origin after hydration so SSR and first client render match identically
  useEffect(() => {
    setClientOrigin(window.location.origin);
  }, []);

  // Sync theme override with <meta name="color-scheme">
  useEffect(() => {
    const applyScheme = (scheme: "dark" | "light") => {
      setColorSchemeOverride(scheme);
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) meta.setAttribute("content", scheme);
    };
    try {
      const stored = localStorage.getItem("color-scheme");
      applyScheme(stored === "light" ? "light" : "dark");
    } catch {
      // ignore
    }
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === "color-scheme" &&
        (e.newValue === "light" || e.newValue === "dark")
      ) {
        applyScheme(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
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

  // Load workspace with Strict Existence Guard + Cross-Device Auto-Remember + Stale-Link Self-Healing
  useEffect(() => {
    let cancelled = false;
    hasUserEditedRef.current = false;
    hasAutoSelectedHomeSubRef.current = false;
    setWorkspaceNotFound(false);
    setLinkNudgeDismissed(isLinkNudgeDismissed(slug));
    setSavedSpaces(getSavedSpaces());

    async function loadProfile() {
      setSyncState("loading");
      const localKey = `pulse-loop-profile-${slug}`;
      let localData: UserProfileStore | null = null;

      try {
        const rawLocal = localStorage.getItem(localKey);
        if (rawLocal) {
          localData = JSON.parse(rawLocal) as UserProfileStore;
          if (!cancelled && localData && !hasUserEditedRef.current) {
            setProfile(localData);
            latestProfileRef.current = localData;
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
          if (cancelled) return;

          if (data?.exists === false) {
            // Strict existence guard: do NOT silently open blank profile on typos
            clearActiveSlugIfMatches(slug);
            setWorkspaceNotFound(true);
            setSyncState("local-only");
            setProfileLoaded(true);
            return;
          }

          if (data?.profile) {
            const serverProfile = data.profile as UserProfileStore;
            setStorageSource(data.source || "cloud");

            if (hasUserEditedRef.current) return;

            const localTs = localData?.updatedAt
              ? Date.parse(localData.updatedAt) || 0
              : 0;
            const serverTs = serverProfile?.updatedAt
              ? Date.parse(serverProfile.updatedAt) || 0
              : 0;

            let chosenProfile = serverProfile;
            if (localData && localData.updatedAt && localTs > serverTs) {
              chosenProfile = localData;
              setProfile(localData);
              latestProfileRef.current = localData;
              await fetch("/api/state", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug, profile: localData }),
              });
            } else {
              setProfile(serverProfile);
              latestProfileRef.current = serverProfile;
              try {
                localStorage.setItem(localKey, JSON.stringify(serverProfile));
              } catch {
                // ignore
              }
            }

            // Cross-Device Auto-Remember
            setActiveSlug(slug);
            const updatedSpaces = upsertSavedSpace({
              slug,
              displayName: chosenProfile.displayName || slug,
              isGuest: chosenProfile.isGuest,
            });
            setSavedSpaces(updatedSpaces);
            setSyncState("saved");
          }
        } else {
          setSyncState("local-only");
        }
      } catch {
        if (!cancelled) {
          if (!localData) {
            setWorkspaceNotFound(true);
          }
          setSyncState("local-only");
        }
      } finally {
        if (!cancelled) {
          setProfileLoaded(true);
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const flushSaveNow = useCallback(
    async (profileOverride?: UserProfileStore, keepalive = false) => {
      if (workspaceNotFound) return;
      const targetProfile = profileOverride || latestProfileRef.current;
      const localKey = `pulse-loop-profile-${slug}`;
      try {
        localStorage.setItem(localKey, JSON.stringify(targetProfile));
      } catch {
        // ignore
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      setSyncState("saving");
      try {
        const res = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, profile: targetProfile }),
          keepalive,
        });
        if (res.ok) {
          const result = await res.json();
          setStorageSource(result.source || "cloud");
          setSyncState("saved");
          setLastSavedTimeLabel(
            new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          );
        } else {
          setSyncState("local-only");
        }
      } catch {
        setSyncState("local-only");
      }
    },
    [slug, workspaceNotFound]
  );

  useEffect(() => {
    const handlePageHide = () => {
      if (
        !workspaceNotFound &&
        (hasUserEditedRef.current || saveTimerRef.current)
      ) {
        void flushSaveNow(latestProfileRef.current, true);
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [flushSaveNow, workspaceNotFound]);

  const triggerAutoSave = useCallback(
    (nextProfile: UserProfileStore) => {
      if (workspaceNotFound) return;
      hasUserEditedRef.current = true;
      latestProfileRef.current = nextProfile;
      const localKey = `pulse-loop-profile-${slug}`;
      try {
        localStorage.setItem(localKey, JSON.stringify(nextProfile));
      } catch {
        // ignore
      }

      setSyncState("saving");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(() => {
        void flushSaveNow(nextProfile);
      }, 360);
    },
    [slug, flushSaveNow, workspaceNotFound]
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

        if (updatedDay.nutrition.useMealSum) {
          const hasMealFiber = updatedDay.nutrition.meals.some(
            (m) => m.fiberGrams !== undefined
          );
          const hasMealWater = updatedDay.nutrition.meals.some(
            (m) => m.waterLiters !== undefined
          );
          const totals = updatedDay.nutrition.meals.reduce(
            (acc, m) => ({
              calories: acc.calories + (Number(m.calories) || 0),
              protein: acc.protein + (Number(m.protein) || 0),
              carbs: acc.carbs + (Number(m.carbs) || 0),
              fats: acc.fats + (Number(m.fats) || 0),
              fiberGrams: acc.fiberGrams + (Number(m.fiberGrams) || 0),
              waterLiters: acc.waterLiters + (Number(m.waterLiters) || 0),
            }),
            {
              calories: 0,
              protein: 0,
              carbs: 0,
              fats: 0,
              fiberGrams: 0,
              waterLiters: 0,
            }
          );
          updatedDay.nutrition = {
            ...updatedDay.nutrition,
            calories: Math.round(totals.calories),
            protein: Math.round(totals.protein),
            carbs: Math.round(totals.carbs),
            fats: Math.round(totals.fats),
            ...(updatedDay.nutrition.meals.length === 0
              ? { fiberGrams: 0, waterLiters: 0 }
              : {
                  ...(hasMealFiber
                    ? { fiberGrams: Number(totals.fiberGrams.toFixed(1)) }
                    : {}),
                  ...(hasMealWater
                    ? { waterLiters: Number(totals.waterLiters.toFixed(2)) }
                    : {}),
                }),
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
        if (next.displayName !== prev.displayName) {
          const nextSpaces = upsertSavedSpace({
            slug,
            displayName: next.displayName,
            isGuest: next.isGuest,
          });
          setSavedSpaces(nextSpaces);
        }
        return next;
      });
    },
    [slug, triggerAutoSave]
  );

  const shiftDate = (daysDelta: number) => {
    setSelectedDate((prev) => shiftIsoDate(prev, daysDelta));
  };

  // Private Link, Invite a Friend, WhatsApp & Backup handlers
  const getPrivateUrl = () =>
    clientOrigin ? `${clientOrigin}/u/${slug}` : `/u/${slug}`;

  const getMasterInviteUrl = () =>
    clientOrigin || process.env.NEXT_PUBLIC_APP_URL || "";

  const handleCopyPrivateLink = async () => {
    const ok = await copyTextToClipboard(
      getPrivateUrl(),
      "Private link copied (keep for your own devices only)."
    );
    if (ok) {
      dismissLinkNudge(slug);
      setLinkNudgeDismissed(true);
    }
  };

  const handleInviteFriend = async () => {
    await copyTextToClipboard(
      getMasterInviteUrl(),
      "Master invite link copied! Friends will get their own private space."
    );
  };

  const getWhatsAppPrivateHref = () => {
    const text = `My private Fitness Hub link (${profile.displayName}): ${getPrivateUrl()}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const handleDownloadJsonBackup = () => {
    try {
      const blob = new Blob([JSON.stringify(profile, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${EXPORT_FILE_PREFIX}-${slug}-${selectedDate}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      announceCopyStatus("JSON backup downloaded.");
    } catch {
      announceCopyStatus("Unable to download backup.");
    }
  };

  const handleVerifyAndOpenSpace = async (
    rawInput: string,
    setErr: (msg: string) => void,
    setBusy: (b: boolean) => void
  ) => {
    const parsedSlug = extractSlugFromInput(rawInput);
    if (!parsedSlug) {
      setErr("Paste a private URL or space code first.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(
        `/api/state?slug=${encodeURIComponent(parsedSlug)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok || !data?.exists || !data?.profile) {
        setErr("We couldn't find that private space — please check for typos.");
        setBusy(false);
        return;
      }
      upsertSavedSpace({
        slug: parsedSlug,
        displayName: data.profile.displayName || parsedSlug,
        isGuest: data.profile.isGuest,
      });
      setActiveSlug(parsedSlug);
      setShowWorkspaceMenu(false);
      router.push(`/u/${parsedSlug}`);
    } catch {
      setErr("Unable to verify that link right now.");
      setBusy(false);
    }
  };

  // Workout helpers (Strength Trainer + unique ID integrity)
  const addExercise = (
    presetName = "",
    presetGroup = "Strength",
    options?: {
      exerciseType?: ExerciseType;
      defaultWeight?: number;
      defaultReps?: number;
    }
  ) => {
    const inferredType: ExerciseType =
      options?.exerciseType ||
      (presetName.toLowerCase().includes("push-up") ||
      presetName.toLowerCase().includes("pull-up") ||
      presetName.toLowerCase().includes("chin-up") ||
      presetName.toLowerCase().includes("bodyweight") ||
      presetName.toLowerCase().includes("dips")
        ? "bodyweight"
        : "strength");

    if (inferredType === "cardio") {
      setQuickCardioType(presetName || "Running");
      updateCurrentDay((d) => ({
        ...d,
        workout: {
          ...d.workout,
          skipped: false,
          cardioType: presetName || d.workout.cardioType || "Running",
          cardioMinutes:
            d.workout.cardioMinutes > 0 ? d.workout.cardioMinutes : 20,
        },
        checkIn: { ...d.checkIn, workoutSkipped: false },
      }));
      return;
    }

    const prev = presetName
      ? findPreviousExerciseSets(profile, selectedDate, presetName)
      : null;
    const isBw = inferredType === "bodyweight";
    const carriedSets: ExerciseSet[] =
      prev && prev.sets.length > 0
        ? prev.sets.map((s, idx) => ({
            id: `s-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            weight: isBw ? 0 : s.weight,
            reps: s.reps,
            rpe: s.rpe,
            setType: idx === 0 ? "1" : "2",
            completed: true,
          }))
        : [
            {
              id: `s-${Date.now()}`,
              weight: isBw ? 0 : options?.defaultWeight ?? 40,
              reps: options?.defaultReps ?? (isBw ? 15 : 10),
              setType: "1",
              completed: true,
            },
          ];

    const newEx: WorkoutExercise = {
      id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: presetName || "New Exercise",
      muscleGroup: presetGroup,
      exerciseType: inferredType,
      note: prev ? `Carried over from ${prev.sourceDate}` : "",
      sets: carriedSets,
    };
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        skipped: false,
        exercises: [...d.workout.exercises, newEx],
      },
      checkIn: { ...d.checkIn, workoutSkipped: false },
    }));
    setExpandedExerciseId(newEx.id);
    setWorkoutSubPage("sets");
  };

  const applyWorkoutRoutine = (routine: WorkoutRoutineTemplate) => {
    const built = buildRoutineExercisesWithHistory(
      profile,
      selectedDate,
      routine
    );
    const taggedExercises = built.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s, idx) => ({
        ...s,
        setType: (idx === 0 ? "W" : idx === ex.sets.length - 1 && ex.sets.length >= 3 ? "F" : "1") as WorkoutSetType,
      })),
    }));
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        routineId: routine.id,
        sessionTitle: routine.name,
        skipped: false,
        exercises: taggedExercises,
      },
      checkIn: { ...d.checkIn, workoutSkipped: false },
    }));
    if (taggedExercises[0]) {
      setExpandedExerciseId(taggedExercises[0].id);
    }
    setWorkoutSubPage("sets");
    setWorkoutStatusBanner(
      built.sourceDate
        ? `Tagged "${routine.name}" and pre-filled previous weights from ${built.sourceDate}.`
        : `Tagged "${routine.name}" with ${taggedExercises.length} exercises.`
    );
  };

  const startLiveWorkout = () => {
    const nowIso = new Date().toISOString();
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        startedAt: nowIso,
        endedAt: null,
        inSetActive: true,
        restStartedAt: null,
        skipped: false,
      },
      checkIn: { ...d.checkIn, workoutSkipped: false },
    }));
    setLiveElapsedSeconds(0);
    setRestElapsedSeconds(0);
    setWorkoutStatusBanner("Session live — log sets & rest below.");
  };

  const toggleActiveSetState = () => {
    const nowIso = new Date().toISOString();
    const currentlyInSet = Boolean(currentDay.workout.inSetActive);
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        inSetActive: !currentlyInSet,
        restStartedAt: currentlyInSet ? nowIso : null,
      },
    }));
    if (currentlyInSet) {
      setRestElapsedSeconds(0);
    }
  };

  const stopLiveWorkout = () => {
    const startedMs = currentDay.workout.startedAt
      ? Date.parse(currentDay.workout.startedAt)
      : 0;
    const elapsedMins =
      startedMs > 0
        ? Math.max(1, Math.round((Date.now() - startedMs) / 60000))
        : Math.max(1, currentDay.workout.gymDurationMinutes || 45);
    const nowIso = new Date().toISOString();
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        endedAt: nowIso,
        inSetActive: false,
        restStartedAt: null,
        gymDurationMinutes: elapsedMins,
        skipped: false,
      },
    }));
    setWorkoutSubPage("finish");
    setWorkoutStatusBanner(
      `Workout stopped (${elapsedMins} min captured). Rate effort 1–10 below to finalize Strain!`
    );
  };

  const setWorkoutRating = (rating: number) => {
    const clamped = Math.max(1, Math.min(10, Math.round(rating)));
    updateCurrentDay((d) => ({
      ...d,
      dailyWorkoutRating: clamped,
      workout: {
        ...d.workout,
        workoutRating: clamped,
        sessionRpe: clamped,
        skipped: false,
      },
    }));
  };

  const skipWorkoutToday = () => {
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        skipped: true,
        startedAt: null,
        endedAt: null,
        inSetActive: false,
        restStartedAt: null,
      },
      checkIn: { ...d.checkIn, workoutSkipped: true },
    }));
    setWorkoutStatusBanner("Marked today as Rest / Skipped workout.");
  };

  const logQuickCardio = (cardioName: string, minutes: number) => {
    const mins = Math.max(1, Math.round(minutes));
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        skipped: false,
        cardioType: cardioName.trim() || "Cardio Training",
        cardioMinutes: mins,
      },
      checkIn: { ...d.checkIn, workoutSkipped: false },
    }));
    setWorkoutStatusBanner(`Logged ${mins} min of ${cardioName.trim() || "Cardio Training"}.`);
  };

  const saveCurrentWorkoutAsRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newRoutineName.trim() || currentDay.workout.sessionTitle.trim();
    if (!cleanName || currentDay.workout.exercises.length === 0) return;
    const routineId = `custom-${cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 32)}-${Date.now().toString(36).slice(-4)}`;
    const newRoutine: WorkoutRoutineTemplate = {
      id: routineId,
      name: cleanName,
      environment: newRoutineEnv,
      focus: `${currentDay.workout.exercises.length} saved exercises`,
      exercises: currentDay.workout.exercises.map((ex, idx) => {
        const firstSet = ex.sets[0];
        const isBw =
          ex.exerciseType === "bodyweight" ||
          (firstSet && firstSet.weight === 0);
        return {
          id: `tpl-${Date.now()}-${idx}`,
          name: ex.name,
          muscleGroup: ex.muscleGroup || "Strength",
          exerciseType: isBw ? "bodyweight" : "strength",
          defaultSets: Math.max(1, ex.sets.length),
          repRange:
            ex.targetRepRange ||
            `${Math.max(1, (firstSet?.reps || 10) - 2)}-${(firstSet?.reps || 10) + 2}`,
          baselineWeight: isBw ? 0 : firstSet?.weight ?? 20,
          baselineReps: firstSet?.reps ?? 10,
        };
      }),
    };
    updateProfileMeta((p) => ({
      ...p,
      workoutRoutines: [newRoutine, ...(p.workoutRoutines || [])],
    }));
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        routineId: newRoutine.id,
        sessionTitle: newRoutine.name,
      },
    }));
    setNewRoutineName("");
    setShowSaveRoutineForm(false);
    setWorkoutStatusBanner(`Saved routine "${newRoutine.name}" for 1-tap reuse.`);
  };

  const loadPreviousWorkoutIntoToday = () => {
    const prev = findPreviousWorkoutSession(
      profile,
      selectedDate,
      currentDay.workout.sessionTitle
    );
    if (!prev) return;
    const nowTs = Date.now();
    const clonedExercises: WorkoutExercise[] = prev.exercises.map((ex, eIdx) => ({
      id: `ex-${nowTs}-${eIdx}-${Math.random().toString(36).slice(2, 5)}`,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      note: "",
      sets: ex.sets.map((s, sIdx) => ({
        id: `s-${nowTs}-${eIdx}-${sIdx}-${Math.random().toString(36).slice(2, 4)}`,
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        setType: s.setType || (sIdx === 0 ? "1" : "2"),
        completed: true,
      })),
    }));
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        sessionTitle: prev.sessionTitle || d.workout.sessionTitle,
        gymDurationMinutes:
          prev.gymDurationMinutes || d.workout.gymDurationMinutes,
        cardioMinutes: prev.cardioMinutes || d.workout.cardioMinutes,
        cardioType: prev.cardioType || d.workout.cardioType,
        exercises: [...d.workout.exercises, ...clonedExercises],
      },
    }));
    if (clonedExercises[0]) setExpandedExerciseId(clonedExercises[0].id);
    setWorkoutSubPage("sets");
  };

  const updateExercise = (exId: string, patch: Partial<WorkoutExercise>) => {
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
            setType: "2",
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
    const completingSet = patch.completed === true;
    const nowIso = new Date().toISOString();
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        ...(completingSet && d.workout.startedAt && !d.workout.endedAt
          ? { inSetActive: false, restStartedAt: nowIso }
          : {}),
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
    if (completingSet) setRestElapsedSeconds(0);
  };

  const cycleExerciseSetType = (exId: string, setId: string, current?: WorkoutSetType) => {
    const order: WorkoutSetType[] = ["W", "1", "2", "F"];
    const next = order[(order.indexOf(current || "1") + 1) % order.length];
    updateExerciseSet(exId, setId, { setType: next });
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
      fiberGrams: 4,
      waterLiters: 0.2,
      portionLabel: "1 serving (250g)",
      weightGrams: 250,
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

  const handleSelectFoodItem = (food: FoodDatabaseItem) => {
    setSelectedFoodItem(food);
    setSelectedPortionIndex(0);
    setCustomWeightGrams(food.portions[0]?.grams || 100);
    setFoodQuantity(1);
  };

  const handleAddFoodFromSearch = () => {
    const calc = calculateFoodPortionNutrition(
      selectedFoodItem,
      customWeightGrams,
      foodQuantity
    );
    const activePortion =
      selectedPortionIndex >= 0
        ? selectedFoodItem.portions[selectedPortionIndex]
        : null;
    const portionSummary = activePortion
      ? `${foodQuantity !== 1 ? `${foodQuantity} × ` : ""}${activePortion.label}`
      : `${calc.totalGrams}g custom portion`;

    const newMeal: MealEntry = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      time: foodTime || "13:00",
      name: selectedFoodItem.name,
      calories: calc.calories,
      protein: Math.round(calc.protein),
      carbs: Math.round(calc.carbs),
      fats: Math.round(calc.fats),
      fiberGrams: calc.fiberGrams,
      waterLiters: calc.waterLiters,
      portionLabel: portionSummary,
      weightGrams: calc.totalGrams,
      note: `${selectedFoodItem.source} · ${portionSummary}`,
    };

    updateCurrentDay((d) => ({
      ...d,
      nutrition: {
        ...d.nutrition,
        useMealSum: true,
        meals: [...d.nutrition.meals, newMeal],
      },
      checkIn: { ...d.checkIn, nutritionSkipped: false },
    }));
    setFoodSearchMessage(
      `Added ${newMeal.name} (${calc.totalGrams}g · ${calc.calories} kcal, ${Math.round(calc.protein)}g P).`
    );
  };

  const handleOpenAiFoodSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = foodSearchQuery.trim();
    if (!q || foodSearchLoading) return;

    setFoodSearchLoading(true);
    setFoodSearchMessage("");
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "food-search",
          model: geminiModel,
          slug,
          prompt: q,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.food) {
        throw new Error(data?.error || "Unable to fetch food nutrition.");
      }
      const fetched = data.food as FoodDatabaseItem;
      setAiFoodResults((prev) => {
        const filtered = prev.filter(
          (item) => item.name.toLowerCase() !== fetched.name.toLowerCase()
        );
        return [fetched, ...filtered].slice(0, 8);
      });
      handleSelectFoodItem(fetched);
      setFoodSearchMessage(
        data.statusNote ||
          `Loaded standardized macros for "${fetched.name}" (${fetched.source}).`
      );
    } catch (err) {
      setFoodSearchMessage(
        err instanceof Error ? err.message : "Failed to look up custom food."
      );
    } finally {
      setFoodSearchLoading(false);
    }
  };

  const updateSleepWith70kgIndianBaseline = (
    nextHours: number,
    nextQuality: number
  ) => {
    const safeHours = Math.max(0, Math.min(23, Number(nextHours) || 0));
    const safeQuality = Math.max(1, Math.min(10, Number(nextQuality) || 1));
    const approx = approximateSleepBiometricsForIndianMale70kg(
      safeHours,
      safeQuality
    );
    updateCurrentDay((d) => ({
      ...d,
      sleep: {
        ...d.sleep,
        totalHours: safeHours,
        sleepQuality: safeQuality,
        deepSleepHours: approx.deepSleepHours,
        remSleepHours: approx.remSleepHours,
        lightSleepHours: approx.lightSleepHours,
        awakeMinutes: approx.awakeMinutes,
        restingHeartRate: approx.restingHeartRate,
        hrvMs: approx.hrvMs,
      },
    }));
  };

  const togglePinFoodItem = (item: FoodDatabaseItem) => {
    const defaultPortion = item.portions[0] || {
      label: "100g serving",
      grams: 100,
    };
    updateProfileMeta((prev) => {
      const existing = prev.pinnedStaples || [];
      const alreadyPinned = existing.some(
        (p) => p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );
      if (alreadyPinned) {
        return {
          ...prev,
          pinnedStaples: existing.filter(
            (p) => p.name.trim().toLowerCase() !== item.name.trim().toLowerCase()
          ),
        };
      }
      const nextPin: PinnedFoodStaple = {
        id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: item.name,
        caloriesPer100g: item.caloriesPer100g,
        proteinPer100g: item.proteinPer100g,
        carbsPer100g: item.carbsPer100g,
        fatsPer100g: item.fatsPer100g,
        fiberPer100g: item.fiberPer100g,
        waterLitersPer100g: item.waterLitersPer100g,
        defaultPortionLabel: defaultPortion.label,
        defaultGrams: defaultPortion.grams,
        source: item.source || "Custom",
      };
      return {
        ...prev,
        pinnedStaples: [nextPin, ...existing].slice(0, 12),
      };
    });
  };

  const addUserFrequentStapleMeal = (
    staple: UserFrequentStaple,
    quantity = 1
  ) => {
    const safeQty = Math.max(0.25, Math.min(20, Number(quantity) || 1));
    const meal: MealEntry = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      time: foodTime || new Date().toTimeString().slice(0, 5),
      name:
        safeQty !== 1
          ? `${staple.name} (×${Number(safeQty.toFixed(2))})`
          : staple.name,
      calories: Math.round(staple.calories * safeQty),
      protein: Math.round(staple.protein * safeQty),
      carbs: Math.round(staple.carbs * safeQty),
      fats: Math.round(staple.fats * safeQty),
      fiberGrams: Number((staple.fiberGrams * safeQty).toFixed(1)),
      waterLiters: Number((staple.waterLiters * safeQty).toFixed(2)),
      portionLabel: staple.portionLabel,
      weightGrams: Math.round((staple.weightGrams || 100) * safeQty),
      note: "",
    };
    updateCurrentDay((d) => ({
      ...d,
      nutrition: {
        ...d.nutrition,
        useMealSum: true,
        meals: [...d.nutrition.meals, meal],
      },
      checkIn: { ...d.checkIn, nutritionSkipped: false },
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
      label: "Custom Supplement / Metric",
      value: "",
      unit: "",
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

  const addQuickCustomFood = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = quickFoodName.trim();
    if (!cleanName && quickFoodCalories <= 0 && quickFoodProtein <= 0) return;
    const newMeal: MealEntry = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      time: new Date().toTimeString().slice(0, 5),
      name: cleanName || "Quick Food",
      calories: Math.max(0, Math.round(quickFoodCalories)),
      protein: Math.max(0, Math.round(quickFoodProtein)),
      carbs: 0,
      fats: 0,
      note: "Added via Quick Foods",
    };
    updateCurrentDay((d) => ({
      ...d,
      nutrition: {
        ...d.nutrition,
        useMealSum: true,
        meals: [...d.nutrition.meals, newMeal],
      },
      checkIn: { ...d.checkIn, nutritionSkipped: false },
    }));
    setQuickFoodName("");
    setQuickFoodCalories(0);
    setQuickFoodProtein(0);
  };

  // Daily Journal Habit handlers
  const updateHabitEntry = (
    habitId: string,
    patch: Partial<DailyHabitEntry> | null
  ) => {
    updateCurrentDay((d) => {
      const nextLogs: Record<string, DailyHabitEntry> = {
        ...(d.habitLogs || {}),
      };
      if (patch === null) {
        delete nextLogs[habitId];
      } else {
        nextLogs[habitId] = {
          ...(nextLogs[habitId] || {}),
          ...patch,
          updatedAt: new Date().toISOString(),
        };
      }
      return {
        ...d,
        habitLogs: nextLogs,
        checkIn: { ...d.checkIn, habitsSkipped: false },
      };
    });
  };

  const applySameHabitsAsYesterday = () => {
    const yesterdayStr = shiftIsoDate(selectedDate, -1);
    const prevDates = Object.keys(profile.days)
      .filter((d) => d < selectedDate && profile.days[d]?.habitLogs && Object.keys(profile.days[d].habitLogs || {}).length > 0)
      .sort((a, b) => b.localeCompare(a));
    const sourceDate = profile.days[yesterdayStr]?.habitLogs && Object.keys(profile.days[yesterdayStr].habitLogs || {}).length > 0
      ? yesterdayStr
      : prevDates[0];
    if (!sourceDate) return;
    const prevLogs = profile.days[sourceDate]?.habitLogs || {};
    updateCurrentDay((d) => ({
      ...d,
      habitLogs: {
        ...(d.habitLogs || {}),
        ...Object.fromEntries(
          Object.entries(prevLogs).map(([k, v]) => [
            k,
            { ...v, updatedAt: new Date().toISOString() },
          ])
        ),
      },
      checkIn: { ...d.checkIn, habitsSkipped: false },
    }));
  };

  const clearAllHabitsToday = () => {
    updateCurrentDay((d) => ({
      ...d,
      habitLogs: {},
    }));
  };

  const toggleActiveHabit = (habitId: string) => {
    updateProfileMeta((p) => {
      const currentIds =
        p.activeHabitIds && p.activeHabitIds.length > 0
          ? p.activeHabitIds
          : DEFAULT_ACTIVE_HABIT_IDS;
      const exists = currentIds.includes(habitId);
      const nextIds = exists
        ? currentIds.filter((id) => id !== habitId)
        : [...currentIds, habitId];
      return { ...p, activeHabitIds: nextIds };
    });
  };

  const handleAddCustomHabit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customHabitName.trim();
    if (!clean) return;
    const newId = `custom-habit-${clean
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 28)}-${Date.now().toString(36).slice(-4)}`;
    const newDef: HabitDefinition = {
      id: newId,
      name: clean,
      category: customHabitCategory,
      inputType: customHabitType,
      ...(customHabitType === "dosage"
        ? {
            unit: customHabitUnit.trim() || "units",
            defaultValue: customHabitDefault.trim() || "1",
          }
        : {}),
    };
    updateProfileMeta((p) => {
      const currentIds =
        p.activeHabitIds && p.activeHabitIds.length > 0
          ? p.activeHabitIds
          : DEFAULT_ACTIVE_HABIT_IDS;
      return {
        ...p,
        customHabitDefinitions: [newDef, ...(p.customHabitDefinitions || [])],
        activeHabitIds: [...currentIds, newId],
      };
    });
    setCustomHabitName("");
  };

  // Gemini Interactions API helpers
  const handleTextareaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.currentTarget.form?.requestSubmit();
    }
  };

  const handleOptimizeDay = async () => {
    if (geminiLoadingMode !== null) return;
    setGeminiLoadingMode("optimize-day");
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "optimize-day",
          model: geminiModel,
          slug,
          date: selectedDate,
          entry: currentDay,
          profile,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.prescription) {
        throw new Error(data?.error || "Unable to generate daily prescription.");
      }
      const prescription = data.prescription as AiRecoveryPrescription;
      updateCurrentDay((d) => ({
        ...d,
        aiCoach: {
          messages: d.aiCoach?.messages || [],
          lastInteractionId:
            data.interactionId || d.aiCoach?.lastInteractionId,
          prescription,
        },
      }));
      setGeminiStatusMessage(
        data.statusNote ||
          `AI Coach (${getAiTierLabel(data.model || geminiModel)}) updated your recovery prescription.`
      );
    } catch (err) {
      setGeminiStatusMessage(
        err instanceof Error ? err.message : "Failed to run AI recovery optimizer."
      );
    } finally {
      setGeminiLoadingMode(null);
    }
  };

  const handleApplyRecommendedMeal = (
    meal: NonNullable<AiRecoveryPrescription["recommendedMeal"]>
  ) => {
    const newMeal: MealEntry = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      time: meal.time || "20:00",
      name: meal.name,
      calories: Math.max(0, Math.round(Number(meal.calories) || 0)),
      protein: Math.max(0, Math.round(Number(meal.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(meal.carbs) || 0)),
      fats: Math.max(0, Math.round(Number(meal.fats) || 0)),
      note: meal.note || "Added from AI Coach Prescription",
    };

    updateCurrentDay((d) => ({
      ...d,
      nutrition: {
        ...d.nutrition,
        ...(d.nutrition.useMealSum
          ? {}
          : {
              calories: d.nutrition.calories + newMeal.calories,
              protein: d.nutrition.protein + newMeal.protein,
              carbs: d.nutrition.carbs + newMeal.carbs,
              fats: d.nutrition.fats + newMeal.fats,
            }),
        meals: [...d.nutrition.meals, newMeal],
      },
    }));
    setGeminiStatusMessage(`Logged "${newMeal.name}" (${newMeal.calories} kcal).`);
  };

  const handleApplyRecommendedExercise = (
    ex: NonNullable<AiRecoveryPrescription["recommendedExercise"]>
  ) => {
    const numSets = Math.max(1, Math.min(8, Math.round(Number(ex.sets) || 3)));
    const stamp = Date.now();
    const sets: ExerciseSet[] = Array.from({ length: numSets }, (_, idx) => ({
      id: `s-${stamp}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      weight: Math.max(0, Number(ex.weight) || 0),
      reps: Math.max(1, Math.round(Number(ex.reps) || 10)),
      rpe: Math.max(1, Math.min(10, Number(ex.rpe) || 8)),
      setType: idx === 0 ? "1" : "2",
      completed: true,
    }));
    const newExercise: WorkoutExercise = {
      id: `ex-${stamp}-${Math.random().toString(36).slice(2, 5)}`,
      name: ex.name,
      muscleGroup: ex.muscleGroup || "Strength",
      sets,
      note: ex.note || "Added from AI Coach Prescription",
    };
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        exercises: [...d.workout.exercises, newExercise],
      },
    }));
    setGeminiStatusMessage(`Added "${newExercise.name}" (${numSets} sets).`);
  };

  const handleSmartLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const promptText = smartLogInput.trim();
    if (!promptText) {
      setSmartLogError("Enter a workout, meal, or sleep update to log.");
      smartLogTextareaRef.current?.focus();
      return;
    }
    if (geminiLoadingMode !== null) return;

    setSmartLogError("");
    setGeminiLoadingMode("smart-log");
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "smart-log",
          model: geminiModel,
          slug,
          date: selectedDate,
          prompt: promptText,
          entry: currentDay,
          profile,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.parsed) {
        throw new Error(data?.error || "Unable to parse smart log input.");
      }

      const parsed = data.parsed as {
        summaryMessage?: string;
        exercisesToAdd?: Array<{
          name: string;
          muscleGroup: string;
          weight: number;
          reps: number;
          sets: number;
          rpe: number;
          note: string;
        }>;
        mealsToAdd?: Array<{
          time: string;
          name: string;
          calories: number;
          protein: number;
          carbs: number;
          fats: number;
          note: string;
        }>;
        sleepHoursDelta?: number;
        deepSleepHoursDelta?: number;
        gymMinutesDelta?: number;
        cardioMinutesDelta?: number;
      };

      const stamp = Date.now();
      const addedExercises: WorkoutExercise[] = (
        parsed.exercisesToAdd || []
      ).map((ex, exIdx) => {
        const count = Math.max(1, Math.min(8, Math.round(Number(ex.sets) || 3)));
        return {
          id: `ex-${stamp}-${exIdx}-${Math.random().toString(36).slice(2, 5)}`,
          name: ex.name || "Logged Exercise",
          muscleGroup: ex.muscleGroup || "Strength",
          note: ex.note || "",
          sets: Array.from({ length: count }, (_, sIdx) => ({
            id: `s-${stamp}-${exIdx}-${sIdx}-${Math.random().toString(36).slice(2, 5)}`,
            weight: Math.max(0, Number(ex.weight) || 0),
            reps: Math.max(1, Math.round(Number(ex.reps) || 10)),
            rpe: Math.max(1, Math.min(10, Number(ex.rpe) || 8)),
            setType: sIdx === 0 ? "1" : "2",
            completed: true,
          })),
        };
      });

      const addedMeals: MealEntry[] = (parsed.mealsToAdd || []).map(
        (m, mIdx) => ({
          id: `m-${stamp}-${mIdx}-${Math.random().toString(36).slice(2, 5)}`,
          time: m.time || "12:30",
          name: m.name || "Logged Meal",
          calories: Math.max(0, Math.round(Number(m.calories) || 0)),
          protein: Math.max(0, Math.round(Number(m.protein) || 0)),
          carbs: Math.max(0, Math.round(Number(m.carbs) || 0)),
          fats: Math.max(0, Math.round(Number(m.fats) || 0)),
          note: m.note || "",
        })
      );

      const addedMealTotals = addedMeals.reduce(
        (acc, m) => ({
          calories: acc.calories + m.calories,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fats: acc.fats + m.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );

      const gymDelta = Number(parsed.gymMinutesDelta) || 0;
      const cardioDelta = Number(parsed.cardioMinutesDelta) || 0;
      const sleepDelta = Number(parsed.sleepHoursDelta) || 0;
      const deepDelta = Number(parsed.deepSleepHoursDelta) || 0;

      updateCurrentDay((d) => ({
        ...d,
        workout: {
          ...d.workout,
          gymDurationMinutes: Math.max(
            0,
            Math.round(d.workout.gymDurationMinutes + gymDelta)
          ),
          cardioMinutes: Math.max(
            0,
            Math.round(d.workout.cardioMinutes + cardioDelta)
          ),
          exercises: [...d.workout.exercises, ...addedExercises],
        },
        nutrition: {
          ...d.nutrition,
          ...(d.nutrition.useMealSum
            ? {}
            : {
                calories: d.nutrition.calories + addedMealTotals.calories,
                protein: d.nutrition.protein + addedMealTotals.protein,
                carbs: d.nutrition.carbs + addedMealTotals.carbs,
                fats: d.nutrition.fats + addedMealTotals.fats,
              }),
          meals: [...d.nutrition.meals, ...addedMeals],
        },
        sleep: {
          ...d.sleep,
          totalHours: Math.max(
            0,
            Number((d.sleep.totalHours + sleepDelta).toFixed(1))
          ),
          deepSleepHours: Math.max(
            0,
            Number((d.sleep.deepSleepHours + deepDelta).toFixed(1))
          ),
        },
      }));

      setSmartLogInput("");
      setGeminiStatusMessage(
        data.statusNote ||
          parsed.summaryMessage ||
          `Smart-logged ${addedExercises.length} exercise(s) and ${addedMeals.length} meal(s).`
      );
    } catch (err) {
      setSmartLogError(
        err instanceof Error ? err.message : "Failed to parse smart log."
      );
    } finally {
      setGeminiLoadingMode(null);
    }
  };

  const handleCoachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const promptText = coachInput.trim();
    if (!promptText) {
      setCoachError("Enter a question for your AI Coach.");
      coachTextareaRef.current?.focus();
      return;
    }
    if (geminiLoadingMode !== null) return;

    setCoachError("");
    setCoachInput("");
    setGeminiLoadingMode("coach");

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "coach",
          model: geminiModel,
          slug,
          date: selectedDate,
          prompt: promptText,
          previousInteractionId: currentDay.aiCoach?.lastInteractionId,
          entry: currentDay,
          profile,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "AI Coach request failed.");
      }

      const nowIso = new Date().toISOString();
      const userMsg: AiCoachMessage = {
        id: `msg-u-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        role: "user",
        text: promptText,
        createdAt: nowIso,
      };
      const assistantMsg: AiCoachMessage = {
        id: `msg-a-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        role: "assistant",
        text: data.reply || "No response returned.",
        model: data.model || geminiModel,
        interactionId: data.interactionId,
        createdAt: nowIso,
      };

      updateCurrentDay((d) => ({
        ...d,
        aiCoach: {
          prescription: d.aiCoach?.prescription || null,
          lastInteractionId:
            data.interactionId || d.aiCoach?.lastInteractionId,
          messages: [...(d.aiCoach?.messages || []), userMsg, assistantMsg],
        },
      }));
      setGeminiStatusMessage(
        data.statusNote ||
          `AI Coach (${getAiTierLabel(data.model || geminiModel)}) replied.`
      );
    } catch (err) {
      setCoachError(
        err instanceof Error ? err.message : "Failed to reach AI Coach."
      );
    } finally {
      setGeminiLoadingMode(null);
    }
  };

  const handleResetCoachThread = () => {
    updateCurrentDay((d) => ({
      ...d,
      aiCoach: {
        prescription: d.aiCoach?.prescription || null,
        lastInteractionId: undefined,
        messages: [],
      },
    }));
    setGeminiStatusMessage("Started a fresh AI Coach thread.");
  };

  const analysis = calculateSufficiencyAnalysis(currentDay, profile);
  const effectiveRoutines = useMemo(() => getEffectiveRoutines(profile), [profile]);
  const allHabitDefinitions = useMemo(
    () => getAllHabitDefinitions(profile),
    [profile]
  );
  const activeHabits = useMemo(
    () => getActiveHabitsForProfile(profile),
    [profile]
  );

  const isSleepLogged = currentDay.sleep.totalHours > 0;
  const isWeightLoggedToday = Boolean(
    currentDay.bodyMetrics?.weight && currentDay.bodyMetrics.weight > 0
  );
  const isWorkoutLive = Boolean(
    currentDay.workout.startedAt && !currentDay.workout.endedAt
  );
  const isWorkoutLogged =
    currentDay.workout.exercises.length > 0 ||
    currentDay.workout.gymDurationMinutes > 0 ||
    currentDay.workout.cardioMinutes > 0;
  const isTodayBlank = !isDailyEntryLogged(currentDay);

  const hasAnyMeaningfulLog = useMemo(
    () => Object.values(profile.days).some((day) => isDailyEntryLogged(day)),
    [profile.days]
  );

  const loggedDates = useMemo(() => {
    const s = new Set<string>();
    for (const [d, entry] of Object.entries(profile.days)) {
      if (isDailyEntryLogged(entry)) s.add(d);
    }
    return s;
  }, [profile.days]);

  const lastWeightRef = useMemo(
    () => findLastBodyMetricEntry(profile, selectedDate, "weight"),
    [profile, selectedDate]
  );
  const lastBodyFatRef = useMemo(
    () => findLastBodyMetricEntry(profile, selectedDate, "bodyFatPct"),
    [profile, selectedDate]
  );

  // Muscular Load vs Cardio Load split (Strength Trainer)
  const muscularLoadPct = useMemo(() => {
    const strengthSignal = analysis.totalSets * 8 + analysis.totalVolume / 220;
    const cardioSignal = (Number(currentDay.workout.cardioMinutes) || 0) * 3.5;
    if (strengthSignal === 0 && cardioSignal === 0) return 0;
    return Math.min(
      98,
      Math.max(10, Math.round((strengthSignal / (strengthSignal + cardioSignal)) * 100))
    );
  }, [analysis.totalSets, analysis.totalVolume, currentDay.workout.cardioMinutes]);

  const loggedHabitsCount = useMemo(() => {
    const logs = currentDay.habitLogs || {};
    return activeHabits.filter((h) => {
      const entry = logs[h.id];
      if (!entry) return false;
      if (h.inputType === "yes_no") {
        return entry.status === "yes" || entry.status === "no";
      }
      return (
        entry.status === "yes" ||
        entry.status === "no" ||
        (typeof entry.value === "string" && entry.value.trim().length > 0)
      );
    }).length;
  }, [activeHabits, currentDay.habitLogs]);

  const hasPriorHabitsToCopy = useMemo(
    () =>
      Object.keys(profile.days).some(
        (d) =>
          d < selectedDate &&
          profile.days[d]?.habitLogs &&
          Object.keys(profile.days[d].habitLogs || {}).length > 0
      ),
    [profile.days, selectedDate]
  );

  // Client hour & auto-select Home sub-page on first load
  useEffect(() => {
    setCurrentHour(new Date().getHours());
  }, []);

  useEffect(() => {
    if (profileLoaded && !hasAutoSelectedHomeSubRef.current) {
      hasAutoSelectedHomeSubRef.current = true;
      setHomeSubPage(isSleepLogged ? "summary" : "checkin");
    }
  }, [profileLoaded, isSleepLogged]);

  // Keep accordion selection valid when exercises exist
  useEffect(() => {
    if (currentDay.workout.exercises.length === 0) {
      setExpandedExerciseId(null);
      return;
    }
    if (
      !expandedExerciseId ||
      !currentDay.workout.exercises.some((ex) => ex.id === expandedExerciseId)
    ) {
      setExpandedExerciseId(currentDay.workout.exercises[0].id);
    }
  }, [currentDay.workout.exercises, expandedExerciseId]);

  // Sync native <dialog> for 100-Habit Catalog
  useEffect(() => {
    const dlg = habitCatalogDialogRef.current;
    if (!dlg) return;
    if (showHabitCatalogDialog && !dlg.open) {
      dlg.showModal();
    } else if (!showHabitCatalogDialog && dlg.open) {
      dlg.close();
    }
  }, [showHabitCatalogDialog]);

  // Sync native <dialog> for Workspace, Backup & Sharing Menu
  useEffect(() => {
    const dlg = workspaceMenuDialogRef.current;
    if (!dlg) return;
    if (showWorkspaceMenu && !dlg.open) {
      dlg.showModal();
    } else if (!showWorkspaceMenu && dlg.open) {
      dlg.close();
    }
  }, [showWorkspaceMenu]);

  // Dual live workout & between-set rest timer ticker (resilient across reloads)
  useEffect(() => {
    if (!currentDay.workout.startedAt || currentDay.workout.endedAt) {
      setLiveElapsedSeconds(0);
      setRestElapsedSeconds(0);
      return;
    }
    const updateTicks = () => {
      const startedMs = Date.parse(currentDay.workout.startedAt || "");
      if (startedMs > 0) {
        setLiveElapsedSeconds(
          Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
        );
      }
      if (!currentDay.workout.inSetActive && currentDay.workout.restStartedAt) {
        const restMs = Date.parse(currentDay.workout.restStartedAt);
        if (restMs > 0) {
          setRestElapsedSeconds(
            Math.max(0, Math.floor((Date.now() - restMs) / 1000))
          );
        }
      }
    };
    updateTicks();
    const interval = setInterval(updateTicks, 1000);
    return () => clearInterval(interval);
  }, [
    currentDay.workout.startedAt,
    currentDay.workout.endedAt,
    currentDay.workout.inSetActive,
    currentDay.workout.restStartedAt,
  ]);

  const frequentStaples = useMemo(
    () => computeUserFrequentStaples(profile, 10),
    [profile]
  );

  const periodSummary = useMemo(
    () => computePeriodSummary(profile, selectedDate, historyWindowDays),
    [profile, selectedDate, historyWindowDays]
  );

  const previousWorkoutSession = useMemo(
    () =>
      findPreviousWorkoutSession(
        profile,
        selectedDate,
        currentDay.workout.sessionTitle
      ),
    [profile, selectedDate, currentDay.workout.sessionTitle]
  );

  const combinedCatalogMatches = (() => {
    const baseMatches = searchFoodsCatalog(foodSearchQuery);
    const merged = [...aiFoodResults, ...baseMatches];
    const seen = new Set<string>();
    return merged.filter((item) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      if (
        foodCategoryFilter !== "All" &&
        item.category !== foodCategoryFilter
      ) {
        return false;
      }
      if (!foodSearchQuery.trim()) return true;
      const hay = [item.name, item.category, ...item.aliases]
        .join(" ")
        .toLowerCase();
      return foodSearchQuery
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .every((tok) => hay.includes(tok));
    });
  })();

  const foodPreview = calculateFoodPortionNutrition(
    selectedFoodItem,
    customWeightGrams,
    foodQuantity
  );

  // =========================================================================
  // STRICT EXISTENCE GUARD VIEW ("Private Space Not Found")
  // =========================================================================
  if (workspaceNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <section
          aria-labelledby="not-found-heading"
          className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 id="not-found-heading" className="text-lg font-bold">
                Private Space Not Found
              </h1>
              <p className="text-xs font-mono text-[var(--text-muted)]">
                /u/{slug}
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            No saved workspace exists at{" "}
            <code className="text-[var(--text-primary)] font-semibold">
              /u/{slug}
            </code>
            . Check your link for a typo, or start a new private space from the
            Master Screen.
          </p>

          <button
            type="button"
            onClick={() => router.push("/?new=1")}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>Open Master Screen</span>
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleVerifyAndOpenSpace(
                notFoundLinkInput,
                setNotFoundLinkError,
                setCheckingNotFoundLink
              );
            }}
            className="space-y-2 border-t border-[var(--border-subtle)] pt-4"
          >
            <label
              htmlFor="paste-another-link"
              className="block text-xs font-semibold text-[var(--text-muted)]"
            >
              Paste Another Private Link or Space Code
            </label>
            <div className="flex gap-2">
              <input
                id="paste-another-link"
                type="text"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="rahul-k9m4x7p2q8 or full URL"
                value={notFoundLinkInput}
                onChange={(e) => {
                  setNotFoundLinkInput(e.target.value);
                  setNotFoundLinkError("");
                }}
                className="flex-1 min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono focus:border-sky-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={checkingNotFoundLink}
                className="rounded-lg bg-sky-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-60 transition"
              >
                {checkingNotFoundLink ? "Checking..." : "Open"}
              </button>
            </div>
            {notFoundLinkError && (
              <p role="alert" className="text-xs font-medium text-rose-400">
                {notFoundLinkError}
              </p>
            )}
          </form>
        </section>
      </div>
    );
  }

  // Visibility flags for Screen-by-Screen vs Optional Desktop Full View
  const showHome = desktopFullView || activeScreen === "home";
  const showWorkouts = desktopFullView || activeScreen === "workouts";
  const showNutrition = desktopFullView || activeScreen === "nutrition";
  const showMore = desktopFullView || activeScreen === "more";

  return (
    <div
      className={`min-h-screen transition-colors ${
        desktopFullView ? "pb-12" : "pb-24"
      }`}
    >
      {/* =========================================================
          COMPACT STICKY TOP HEADER (Single-row ergonomics, <12% vh)
         ========================================================= */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-3 py-2 sm:px-5 space-y-1.5">
          {/* Row 1: Editable Display Name + Sync Pill + Privacy/Space Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                <Activity className="h-4 w-4" aria-hidden="true" />
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
                    className="bg-transparent font-bold tracking-tight text-sm sm:text-base truncate max-w-[140px] sm:max-w-[220px] focus:outline-none border-b border-transparent focus:border-emerald-500"
                  />
                  <span className="hidden sm:inline rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-mono text-[var(--text-muted)] border border-[var(--border-subtle)] truncate max-w-[145px]">
                    /u/{slug}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    role="status"
                    aria-live="polite"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold"
                  >
                    {syncState === "saving" || syncState === "loading" ? (
                      <>
                        <RefreshCw
                          className="h-2.5 w-2.5 animate-spin text-amber-400"
                          aria-hidden="true"
                        />
                        <span className="text-[var(--text-muted)]">
                          {syncState === "loading" ? "Syncing..." : "Saving..."}
                        </span>
                      </>
                    ) : (
                      <>
                        <CloudCheck
                          className="h-3 w-3 text-emerald-400"
                          aria-hidden="true"
                        />
                        <span className="text-emerald-400">
                          {storageSource === "cloud-blob"
                            ? "Cloud Saved ✓"
                            : "Auto-Saved ✓"}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="sm:hidden text-[10px] font-mono text-[var(--text-muted)] truncate max-w-[110px]">
                    /u/{slug}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Controls: Date Picker + Theme + Consolidated Workspace Menu */}
            <div className="flex flex-wrap items-center gap-1.5">
              <DatePickerDialog
                selectedDate={selectedDate}
                todayStr={todayStr}
                loggedDates={loggedDates}
                onSelectDate={setSelectedDate}
                onShiftDate={shiftDate}
              />

              <button
                type="button"
                onClick={toggleColorScheme}
                aria-label={
                  colorSchemeOverride === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
                className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[11px] font-medium hover:border-emerald-500/40 transition"
              >
                {colorSchemeOverride === "dark" ? (
                  <>
                    <Sun className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                    <span className="hidden sm:inline">Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
                    <span className="hidden sm:inline">Dark Mode</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setDesktopFullView((v) => !v)}
                className="hidden lg:inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                title="Switch between Screen-by-Screen view and Full Desktop Overview"
              >
                {desktopFullView ? (
                  <>
                    <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Screen View</span>
                  </>
                ) : (
                  <>
                    <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Full View</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowWorkspaceMenu(true)}
                aria-label="Workspace, Backup & Sharing"
                title="Workspace, Backup & Sharing"
                aria-haspopup="dialog"
                aria-expanded={showWorkspaceMenu}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-emerald-500/40 transition"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Dedicated Live Region Outside Copy Buttons (per modern-web-guidance copy-button) */}
          <div
            role="status"
            aria-live="polite"
            className={`text-[11px] font-semibold text-emerald-400 transition-opacity ${
              copyStatusText ? "opacity-100 py-0.5" : "opacity-0 h-0 overflow-hidden"
            }`}
          >
            {copyStatusText}
          </div>
        </div>

        {/* Cross-Tab Active Workout Mini-Bar (Visible whenever timer is running & user switches screens) */}
        {isWorkoutLive && !showWorkouts && (
          <div className="border-t border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5">
            <div className="mx-auto max-w-4xl flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="tabular-nums">
                  LIVE WORKOUT {formatMMSS(liveElapsedSeconds)}
                </span>
                <span className="text-[11px] font-semibold text-amber-400 tabular-nums">
                  ·{" "}
                  {currentDay.workout.inSetActive
                    ? "ACTIVE SET"
                    : `REST ${formatMMSS(restElapsedSeconds)}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveScreen("workouts");
                  setWorkoutSubPage("sets");
                }}
                className="rounded-md bg-emerald-500 px-2.5 py-0.5 text-[11px] font-bold text-slate-950"
              >
                Return &rarr;
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-3 pt-3 sm:px-5 sm:pt-4">
        {/* Smartly Timed "Keep Your Private Link Safe" Dismissible Nudge (Only after first real log) */}
        {hasAnyMeaningfulLog && !linkNudgeDismissed && (
          <section
            aria-label="Save Your Private Link"
            className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 space-y-2.5 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Your private space is live &amp; cloud-saved! Save your
                    personal link to open it from any device:
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Tip: Tap Safari Share &rarr; <strong>Add to Home Screen</strong> (or Chrome Menu &rarr; Install) for 1-tap access.
                </p>
              </div>
              <button
                type="button"
                aria-label="Dismiss save link reminder"
                onClick={() => {
                  dismissLinkNudge(slug);
                  setLinkNudgeDismissed(true);
                }}
                className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={getWhatsAppPrivateHref()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  dismissLinkNudge(slug);
                  setLinkNudgeDismissed(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Send to My WhatsApp</span>
              </a>
              <button
                type="button"
                onClick={() => void handleCopyPrivateLink()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15 transition"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Copy Private Link</span>
              </button>
            </div>
          </section>
        )}

        {/* =========================================================
            SCREEN 1: HOME (1. Morning Check-In | 2. Home Summary)
           ========================================================= */}
        {showHome && (
          <section aria-label="Home Screen" className="space-y-3">
            {!desktopFullView && (
              <div
                role="tablist"
                aria-label="Home Sub-Pages"
                className="grid grid-cols-2 gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={homeSubPage === "checkin"}
                  onClick={() => setHomeSubPage("checkin")}
                  className={`rounded-lg py-1.5 text-xs font-bold transition ${
                    homeSubPage === "checkin"
                      ? "bg-indigo-500 text-slate-950 shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  1. Morning Check-In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={homeSubPage === "summary"}
                  onClick={() => setHomeSubPage("summary")}
                  className={`rounded-lg py-1.5 text-xs font-bold transition ${
                    homeSubPage === "summary"
                      ? "bg-indigo-500 text-slate-950 shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  2. Home Summary
                </button>
              </div>
            )}

            {/* SUB-PAGE 1A: MORNING CHECK-IN (Sleep Duration + Full 1-10 Grid + Empty Weight/BF Nudge) */}
            {(desktopFullView || homeSubPage === "checkin") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h1 className="text-base sm:text-lg font-extrabold tracking-tight">
                      Home · Morning Check-In
                    </h1>
                    <p className="text-xs text-[var(--text-muted)]">
                      Enter last night&apos;s sleep &amp; today&apos;s scale weight to calibrate Home readiness.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-indigo-500/35 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-400">
                    {selectedDate}
                  </span>
                </div>

                {/* Sleep Duration Card */}
                <div className="rounded-2xl border border-indigo-500/35 bg-[var(--bg-surface)] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="sleep-total"
                      className="text-xs font-bold text-[var(--text-primary)]"
                    >
                      Last Night&apos;s Sleep (0–23 hrs)
                    </label>
                    <div className="flex items-baseline gap-1.5">
                      <DecimalInput
                        id="sleep-total"
                        allowDecimal
                        min={0}
                        max={23}
                        value={currentDay.sleep.totalHours}
                        onValueChange={(nextHours) =>
                          updateSleepWith70kgIndianBaseline(
                            nextHours,
                            currentDay.sleep.sleepQuality
                          )
                        }
                        onBlur={() => void flushSaveNow()}
                        className="w-20 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-right text-xl font-extrabold tabular-nums text-indigo-400 focus:border-indigo-400 focus:outline-none"
                      />
                      <span className="text-xs text-[var(--text-muted)]">hrs</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                    {[5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map((hrs) => (
                      <button
                        key={hrs}
                        type="button"
                        aria-pressed={currentDay.sleep.totalHours === hrs}
                        onClick={() =>
                          updateSleepWith70kgIndianBaseline(
                            hrs,
                            currentDay.sleep.sleepQuality
                          )
                        }
                        className={`rounded-lg py-1.5 text-xs font-bold border transition ${
                          currentDay.sleep.totalHours === hrs
                            ? "border-indigo-400 bg-indigo-500 text-slate-950"
                            : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-indigo-400/50"
                        }`}
                      >
                        {hrs}h
                      </button>
                    ))}
                  </div>
                </div>

                {/* Full 1-10 Sleep Score (2 Rows x 5 Cols) */}
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold">Sleep Score (1–10)</span>
                    <span className="text-xs font-extrabold text-amber-400 tabular-nums">
                      {currentDay.sleep.sleepQuality} / 10
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((q) => (
                      <button
                        key={q}
                        type="button"
                        aria-label={`Rate sleep quality ${q} out of 10`}
                        aria-pressed={currentDay.sleep.sleepQuality === q}
                        onClick={() =>
                          updateSleepWith70kgIndianBaseline(
                            currentDay.sleep.totalHours,
                            q
                          )
                        }
                        className={`rounded-lg py-2 text-xs font-bold border transition ${
                          currentDay.sleep.sleepQuality === q
                            ? "border-amber-400 bg-amber-500 text-slate-950"
                            : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-amber-400/50"
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[var(--bg-elevated)] p-2 text-center text-[11px]">
                    <div>
                      <span className="text-[var(--text-muted)]">Deep </span>
                      <strong className="text-emerald-400 tabular-nums">
                        {currentDay.sleep.deepSleepHours}h
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">REM </span>
                      <strong className="text-sky-400 tabular-nums">
                        {currentDay.sleep.remSleepHours}h
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">RHR/HRV </span>
                      <strong className="text-teal-400 tabular-nums">
                        {currentDay.sleep.restingHeartRate || "--"}/
                        {currentDay.sleep.hrvMs || "--"}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Body Metrics Card (Empty Inputs + Staleness Nudge) */}
                <div
                  className={`rounded-2xl border bg-[var(--bg-surface)] p-3.5 space-y-2.5 ${
                    isWeightLoggedToday
                      ? "border-emerald-500/40"
                      : "border-amber-500/50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold">
                      Enter Today&apos;s Body Metrics
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        isWeightLoggedToday
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-amber-500/15 text-amber-400"
                      }`}
                    >
                      {isWeightLoggedToday
                        ? "✓ Weight logged today"
                        : lastWeightRef
                        ? `⚠ Weight not logged in ${lastWeightRef.daysAgo} ${
                            lastWeightRef.daysAgo === 1 ? "day" : "days"
                          }`
                        : "⚠ Weight not logged yet"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="checkin-body-weight"
                        className="block text-[11px] font-medium text-[var(--text-muted)]"
                      >
                        Weight ({profile.weightUnit})
                      </label>
                      <DecimalInput
                        id="checkin-body-weight"
                        allowDecimal
                        showEmptyWhenZero
                        min={0}
                        max={400}
                        placeholder={`Enter ${profile.weightUnit}`}
                        value={currentDay.bodyMetrics?.weight ?? 0}
                        onValueChange={(val) => {
                          updateCurrentDay((d) => ({
                            ...d,
                            bodyMetrics: {
                              ...d.bodyMetrics,
                              weight: val > 0 ? val : undefined,
                              updatedAt: new Date().toISOString(),
                            },
                          }));
                          if (val > 0) {
                            updateProfileMeta((p) => ({
                              ...p,
                              bodyweight: val,
                            }));
                          }
                        }}
                        onBlur={() => void flushSaveNow()}
                        className={`w-full rounded-xl border border-dashed bg-[var(--bg-elevated)] px-3 py-2 text-sm font-extrabold tabular-nums placeholder:font-medium placeholder:text-[var(--text-muted)] focus:outline-none ${
                          isWeightLoggedToday
                            ? "border-emerald-500/60 text-emerald-400"
                            : "border-amber-500/70 text-[var(--text-primary)]"
                        }`}
                      />
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {lastWeightRef
                          ? `Last: ${lastWeightRef.value} ${profile.weightUnit} · ${lastWeightRef.daysAgo}d ago`
                          : "Not logged on prior days"}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="checkin-body-fat"
                        className="block text-[11px] font-medium text-[var(--text-muted)]"
                      >
                        Body Fat (%) · Optional
                      </label>
                      <DecimalInput
                        id="checkin-body-fat"
                        allowDecimal
                        showEmptyWhenZero
                        min={0}
                        max={60}
                        placeholder="Enter %"
                        value={currentDay.bodyMetrics?.bodyFatPct ?? 0}
                        onValueChange={(val) => {
                          updateCurrentDay((d) => ({
                            ...d,
                            bodyMetrics: {
                              ...d.bodyMetrics,
                              bodyFatPct: val > 0 ? val : undefined,
                              updatedAt: new Date().toISOString(),
                            },
                          }));
                          if (val > 0) {
                            updateProfileMeta((p) => ({
                              ...p,
                              bodyFatPct: val,
                            }));
                          }
                        }}
                        onBlur={() => void flushSaveNow()}
                        className="w-full rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-extrabold tabular-nums text-sky-400 placeholder:font-medium placeholder:text-[var(--text-muted)] focus:border-sky-400 focus:outline-none"
                      />
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {lastBodyFatRef
                          ? `Last: ${lastBodyFatRef.value}% · ${lastBodyFatRef.daysAgo}d ago`
                          : "Log every week or two"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Check-In Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateCurrentDay((d) => ({
                        ...d,
                        checkIn: {
                          ...d.checkIn,
                          sleepSkipped: false,
                          morningCompletedAt: new Date().toISOString(),
                        },
                      }));
                      void flushSaveNow();
                      setHomeSubPage("summary");
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-3 text-xs sm:text-sm font-bold text-slate-950 hover:bg-emerald-400 transition shadow-xs"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>Save &amp; Go to Home &rarr;</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateCurrentDay((d) => ({
                        ...d,
                        checkIn: { ...d.checkIn, sleepSkipped: true },
                      }));
                      setHomeSubPage("summary");
                    }}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-3 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                  >
                    Skip Sleep
                  </button>
                </div>
              </div>
            )}

            {/* SUB-PAGE 1B: HOME SUMMARY (Readiness Gauges, 3 Pillars, Collapsible Note & Advanced Sleep) */}
            {(desktopFullView || homeSubPage === "summary") && (
              <div className="space-y-3">
                {/* Afternoon Sleep Nudge (>= 14:00 if unlogged) */}
                {!isSleepLogged &&
                  selectedDate === todayStr &&
                  currentHour >= 14 && (
                    <div
                      role="status"
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2 text-amber-300">
                        <Bell className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                        <span>
                          <strong>Afternoon Sleep Nudge:</strong> Enter last night&apos;s sleep to calibrate Readiness &amp; HRV.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHomeSubPage("checkin")}
                        className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-slate-950"
                      >
                        Enter Sleep
                      </button>
                    </div>
                  )}

                {/* Semantic Sufficiency Status Banner */}
                <div
                  className={`rounded-2xl border p-3.5 space-y-3 ${
                    isTodayBlank
                      ? "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
                      : analysis.verdictLevel === "optimal"
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : analysis.verdictLevel === "moderate"
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-rose-500/40 bg-rose-500/5"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                        isTodayBlank
                          ? "bg-sky-500/15 text-sky-400"
                          : analysis.verdictLevel === "optimal"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : analysis.verdictLevel === "moderate"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-rose-500/20 text-rose-400"
                      }`}
                    >
                      {isTodayBlank ? (
                        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : analysis.verdictLevel === "optimal" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : analysis.verdictLevel === "moderate" ? (
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <AlertOctagon className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {isTodayBlank
                        ? "Ready to Log Today"
                        : analysis.verdictLevel === "optimal"
                        ? "Optimal Recovery"
                        : analysis.verdictLevel === "moderate"
                        ? "Borderline Sufficiency"
                        : "Recovery / Fueling Deficit"}
                    </span>

                    <button
                      type="button"
                      onClick={() => setHomeSubPage("checkin")}
                      className="text-[11px] font-semibold text-indigo-400 hover:underline"
                    >
                      Edit Check-In
                    </button>
                  </div>

                  {/* 2x2 Big-Number Gauges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                      <div className="text-[11px] text-[var(--text-muted)]">
                        Readiness
                      </div>
                      <div className="text-xl font-extrabold tabular-nums text-emerald-400">
                        {analysis.readinessScore}%
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        HRV {currentDay.sleep.hrvMs || "--"} ms
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                      <div className="text-[11px] text-[var(--text-muted)]">
                        Workout Strain
                      </div>
                      <div className="text-xl font-extrabold tabular-nums text-sky-400">
                        {analysis.strainScore}
                        <span className="text-xs font-normal text-[var(--text-muted)]">
                          /21
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {analysis.totalSets} sets · {currentDay.workout.gymDurationMinutes}m
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                      <div className="text-[11px] text-[var(--text-muted)]">
                        Sleep vs Need
                      </div>
                      <div className="text-xl font-extrabold tabular-nums text-indigo-400">
                        {currentDay.sleep.totalHours}h
                        <span className="text-xs font-normal text-[var(--text-muted)]">
                          /{analysis.requiredSleepHours}h
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        Deep {currentDay.sleep.deepSleepHours}h ({analysis.deepSleepPercentage}%)
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                      <div className="text-[11px] text-[var(--text-muted)]">
                        Fuel &amp; Weight
                      </div>
                      <div className="text-xl font-extrabold tabular-nums text-amber-400">
                        {currentDay.nutrition.calories}
                        <span className="text-xs font-normal text-[var(--text-muted)]">
                          {" "}kcal
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {currentDay.nutrition.protein}g P ·{" "}
                        {isWeightLoggedToday
                          ? `${currentDay.bodyMetrics?.weight}${profile.weightUnit}`
                          : lastWeightRef
                          ? `Wt ${lastWeightRef.daysAgo}d ago`
                          : "Wt unlogged"}
                      </div>
                    </div>
                  </div>

                  {/* 3 Compact 1-Line Pillar Status Rows */}
                  <div className="space-y-1.5">
                    {Object.entries(analysis.clinicalPillarChecks).map(
                      ([key, check]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                check.status === "optimal"
                                  ? "bg-emerald-400"
                                  : check.status === "warning"
                                  ? "bg-amber-400"
                                  : "bg-rose-400"
                              }`}
                            />
                            <span className="font-semibold truncate">
                              {check.label}
                            </span>
                          </div>
                          <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                            {check.status === "optimal"
                              ? "Optimal ✓"
                              : check.status === "warning"
                              ? "Watch"
                              : "Deficit"}
                          </span>
                        </div>
                      )
                    )}
                  </div>

                  {/* Quick Jump Row */}
                  {!desktopFullView && (
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setActiveScreen("workouts")}
                        className="rounded-xl bg-sky-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-sky-400 transition"
                      >
                        Go to Workout &rarr;
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveScreen("nutrition")}
                        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2.5 text-xs font-bold hover:border-amber-400/50 transition"
                      >
                        Log Nutrition &rarr;
                      </button>
                    </div>
                  )}
                </div>

                {/* Collapsible Daily Summary Note (Native <details>, no heading inside <summary>) */}
                <details className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5">
                  <summary className="flex items-center justify-between gap-2 cursor-pointer list-none text-xs font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                      <span>Daily Summary Note</span>
                      {currentDay.dailyNote.trim() && (
                        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
                          Saved
                        </span>
                      )}
                    </span>
                    <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                  </summary>
                  <div className="mt-2.5 space-y-2">
                    <textarea
                      id="daily-master-note"
                      rows={2}
                      aria-label="Daily Master Note"
                      placeholder="Type a general daily comment, soreness check-in, or reminder..."
                      value={currentDay.dailyNote}
                      onChange={(e) =>
                        updateCurrentDay((d) => ({ ...d, dailyNote: e.target.value }))
                      }
                      onBlur={() => void flushSaveNow()}
                      className="auto-grow-textarea w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                      <span>
                        {lastSavedTimeLabel ? `Saved ${lastSavedTimeLabel}` : "Auto-saved"}
                      </span>
                      <button
                        type="button"
                        onClick={() => void flushSaveNow()}
                        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                </details>

                {/* Collapsible Advanced Sleep Biometrics & Wearable Overrides */}
                <details className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5">
                  <summary className="flex items-center justify-between gap-2 cursor-pointer list-none text-xs font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <Moon className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
                      <span>Advanced Sleep Biometrics &amp; Wearable Overrides</span>
                    </span>
                    <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <label htmlFor="baseline-sleep-need" className="text-[var(--text-muted)]">
                        Base Sleep Need (hrs):
                      </label>
                      <DecimalInput
                        id="baseline-sleep-need"
                        allowDecimal
                        min={4}
                        max={14}
                        value={profile.baselineSleepNeedHours}
                        onValueChange={(nextBase) =>
                          updateProfileMeta((p) => ({
                            ...p,
                            baselineSleepNeedHours: nextBase > 0 ? nextBase : 7.5,
                          }))
                        }
                        onBlur={() => void flushSaveNow()}
                        className="w-16 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-center font-bold text-indigo-400"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                        <label htmlFor="sleep-deep" className="block text-[10px] text-[var(--text-muted)]">
                          Deep Sleep (hrs)
                        </label>
                        <DecimalInput
                          id="sleep-deep"
                          allowDecimal
                          min={0}
                          max={12}
                          value={currentDay.sleep.deepSleepHours}
                          onValueChange={(val) =>
                            updateCurrentDay((d) => ({
                              ...d,
                              sleep: { ...d.sleep, deepSleepHours: val },
                            }))
                          }
                          onBlur={() => void flushSaveNow()}
                          className="mt-1 w-full bg-transparent text-lg font-extrabold tabular-nums text-emerald-400 focus:outline-none"
                        />
                      </div>
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                        <label htmlFor="sleep-rem" className="block text-[10px] text-[var(--text-muted)]">
                          REM Sleep (hrs)
                        </label>
                        <DecimalInput
                          id="sleep-rem"
                          allowDecimal
                          min={0}
                          max={12}
                          value={currentDay.sleep.remSleepHours}
                          onValueChange={(val) =>
                            updateCurrentDay((d) => ({
                              ...d,
                              sleep: { ...d.sleep, remSleepHours: val },
                            }))
                          }
                          onBlur={() => void flushSaveNow()}
                          className="mt-1 w-full bg-transparent text-lg font-bold tabular-nums text-sky-400 focus:outline-none"
                        />
                      </div>
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                        <label htmlFor="sleep-rhr" className="block text-[10px] text-[var(--text-muted)]">
                          Resting HR (bpm)
                        </label>
                        <DecimalInput
                          id="sleep-rhr"
                          allowDecimal={false}
                          min={0}
                          max={180}
                          value={currentDay.sleep.restingHeartRate}
                          onValueChange={(val) =>
                            updateCurrentDay((d) => ({
                              ...d,
                              sleep: { ...d.sleep, restingHeartRate: Math.round(val) },
                            }))
                          }
                          onBlur={() => void flushSaveNow()}
                          className="mt-1 w-full bg-transparent text-lg font-bold tabular-nums text-rose-400 focus:outline-none"
                        />
                      </div>
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                        <label htmlFor="sleep-hrv" className="block text-[10px] text-[var(--text-muted)]">
                          HRV (ms)
                        </label>
                        <DecimalInput
                          id="sleep-hrv"
                          allowDecimal={false}
                          min={0}
                          max={250}
                          value={currentDay.sleep.hrvMs}
                          onValueChange={(val) =>
                            updateCurrentDay((d) => ({
                              ...d,
                              sleep: { ...d.sleep, hrvMs: Math.round(val) },
                            }))
                          }
                          onBlur={() => void flushSaveNow()}
                          className="mt-1 w-full bg-transparent text-lg font-bold tabular-nums text-teal-400 focus:outline-none"
                        />
                      </div>
                    </div>
                    <textarea
                      id="sleep-note"
                      aria-label="Sleep Hygiene and Recovery Notes"
                      placeholder="Sleep hygiene notes (late meals, caffeine, room temp)..."
                      value={currentDay.sleep.note}
                      onChange={(e) =>
                        updateCurrentDay((d) => ({
                          ...d,
                          sleep: { ...d.sleep, note: e.target.value },
                        }))
                      }
                      onBlur={() => void flushSaveNow()}
                      className="auto-grow-textarea w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </details>
              </div>
            )}
          </section>
        )}

        {/* =========================================================
            SCREEN 2: WORKOUTS — STRENGTH TRAINER
           ========================================================= */}
        {showWorkouts && (
          <section aria-label="Workouts Screen" className="space-y-3">
            {/* Pinned Same-Screen Live Activity HUD */}
            {isWorkoutLive ? (
              <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          Strength · Live
                        </span>
                        <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-bold text-amber-400 tabular-nums">
                          {currentDay.workout.inSetActive
                            ? "ACTIVE SET"
                            : `REST ${formatMMSS(restElapsedSeconds)}`}
                        </span>
                      </div>
                      <div className="text-2xl font-extrabold tabular-nums leading-tight">
                        {formatMMSS(liveElapsedSeconds)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleActiveSetState}
                      className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                        currentDay.workout.inSetActive
                          ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                          : "bg-sky-500 text-slate-950 hover:bg-sky-400"
                      }`}
                    >
                      {currentDay.workout.inSetActive ? "✓ End Set" : "▶ Start Set"}
                    </button>
                    <button
                      type="button"
                      onClick={stopLiveWorkout}
                      className="inline-flex items-center gap-1 rounded-xl bg-rose-500 px-3 py-2 text-xs font-bold text-white hover:bg-rose-400 transition"
                    >
                      <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                      <span>End</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--text-muted)]">
                  <span>
                    Muscular Load{" "}
                    <strong className="text-sky-400 tabular-nums">
                      {muscularLoadPct}%
                    </strong>
                  </span>
                  <span>
                    Strain{" "}
                    <strong className="text-emerald-400 tabular-nums">
                      {analysis.strainScore}/21
                    </strong>
                  </span>
                  <span>
                    <strong className="text-[var(--text-primary)] tabular-nums">
                      {analysis.totalSets} sets
                    </strong>{" "}
                    ·{" "}
                    <strong className="text-[var(--text-primary)] tabular-nums">
                      {analysis.totalVolume.toLocaleString()} {profile.weightUnit}
                    </strong>
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                    <Dumbbell className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold truncate">
                      {currentDay.workout.sessionTitle || "Workouts · Strength"}
                    </h2>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {analysis.totalSets} sets · {analysis.totalVolume.toLocaleString()}{" "}
                      {profile.weightUnit} · Strain {analysis.strainScore}/21
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={startLiveWorkout}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    <span>Start Workout</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateProfileMeta((p) => ({
                        ...p,
                        weightUnit: p.weightUnit === "kg" ? "lbs" : "kg",
                      }))
                    }
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-2 text-xs font-bold"
                  >
                    Unit: {profile.weightUnit.toUpperCase()}
                  </button>
                  <button
                    type="button"
                    onClick={skipWorkoutToday}
                    className={`rounded-lg border px-2.5 py-2 text-xs font-medium ${
                      currentDay.workout.skipped
                        ? "border-sky-500/50 bg-sky-500/15 text-sky-400"
                        : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                    }`}
                  >
                    {currentDay.workout.skipped ? "Rest ✓" : "Rest"}
                  </button>
                </div>
              </div>
            )}

            {workoutStatusBanner && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-xs text-sky-300 flex items-center justify-between gap-2"
              >
                <span>{workoutStatusBanner}</span>
                <button
                  type="button"
                  onClick={() => setWorkoutStatusBanner("")}
                  aria-label="Dismiss workout notice"
                  className="text-sky-400"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            {!desktopFullView && (
              <div
                role="tablist"
                aria-label="Workouts Sub-Pages"
                className="grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1"
              >
                {(
                  [
                    { id: "routines", label: "1. Routines" },
                    {
                      id: "sets",
                      label: `2. Active Sets (${currentDay.workout.exercises.length})`,
                    },
                    { id: "finish", label: "3. Finish & Load" },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={workoutSubPage === p.id}
                    onClick={() => setWorkoutSubPage(p.id)}
                    className={`rounded-lg py-1.5 text-[11px] sm:text-xs font-bold transition ${
                      workoutSubPage === p.id
                        ? "bg-sky-500 text-slate-950 shadow-xs"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {/* SUB-PAGE 2A: ROUTINES & QUICK EXERCISE/CARDIO PICKER */}
            {(desktopFullView || workoutSubPage === "routines") && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-400">
                      <Layers className="h-4 w-4" aria-hidden="true" />
                      <span>1-Tap Routines (Carries Over Last Weights)</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {previousWorkoutSession && (
                        <button
                          type="button"
                          onClick={loadPreviousWorkoutIntoToday}
                          className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-400"
                        >
                          <Copy className="h-3 w-3" aria-hidden="true" />
                          <span>Load Prev</span>
                        </button>
                      )}
                      {currentDay.workout.exercises.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowSaveRoutineForm((v) => !v)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-semibold"
                        >
                          <Save className="h-3 w-3" aria-hidden="true" />
                          <span>Save Routine</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {effectiveRoutines.map((routine) => {
                      const isTagged = currentDay.workout.routineId === routine.id;
                      return (
                        <button
                          key={routine.id}
                          type="button"
                          onClick={() => applyWorkoutRoutine(routine)}
                          className={`rounded-xl border p-2.5 text-left transition ${
                            isTagged
                              ? "border-sky-400 bg-sky-500/15 text-sky-300"
                              : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-sky-500/45"
                          }`}
                        >
                          <div className="text-xs font-bold leading-snug">
                            {routine.name}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            {routine.exercises.length} exercises · {routine.environment}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {showSaveRoutineForm && (
                    <form
                      onSubmit={saveCurrentWorkoutAsRoutine}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 text-xs"
                    >
                      <input
                        type="text"
                        value={newRoutineName}
                        onChange={(e) => setNewRoutineName(e.target.value)}
                        placeholder="Routine name (e.g. Push Home)..."
                        className="flex-1 min-w-[140px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs"
                      />
                      <select
                        aria-label="Routine Environment"
                        value={newRoutineEnv}
                        onChange={(e) =>
                          setNewRoutineEnv(e.target.value as "home" | "external")
                        }
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs"
                      >
                        <option value="home">Home Gym</option>
                        <option value="external">External Gym</option>
                      </select>
                      <button
                        type="submit"
                        className="rounded-lg bg-sky-500 px-3 py-1.5 font-bold text-slate-950"
                      >
                        Save
                      </button>
                    </form>
                  )}
                </div>

                {/* Type-Filtered Quick Add Exercises & Cardio */}
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold">Quick Add Movement</span>
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          { id: "all", label: "All" },
                          { id: "strength", label: "Strength" },
                          { id: "bodyweight", label: "0-Wt BW" },
                          { id: "cardio", label: "Cardio" },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setPresetTypeFilter(f.id)}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                            presetTypeFilter === f.id
                              ? "bg-sky-500 text-slate-950"
                              : "border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIZED_EXERCISE_PRESETS.filter(
                      (p) =>
                        presetTypeFilter === "all" ||
                        p.exerciseType === presetTypeFilter
                    )
                      .slice(0, presetTypeFilter === "all" ? 10 : 14)
                      .map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            if (preset.exerciseType === "cardio") {
                              logQuickCardio(
                                preset.name,
                                preset.defaultDurationMinutes || quickCardioMins || 20
                              );
                            } else {
                              addExercise(preset.name, preset.muscleGroup, {
                                exerciseType: preset.exerciseType,
                                defaultWeight: preset.defaultWeight,
                                defaultReps: preset.defaultReps,
                              });
                            }
                          }}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                            preset.exerciseType === "bodyweight"
                              ? "border-teal-500/35 bg-teal-500/10 text-teal-300"
                              : preset.exerciseType === "cardio"
                              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                              : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-sky-500/50"
                          }`}
                        >
                          + {preset.name}
                          {preset.exerciseType === "bodyweight"
                            ? " (BW)"
                            : preset.exerciseType === "cardio"
                            ? ` (${preset.defaultDurationMinutes}m)`
                            : ""}
                        </button>
                      ))}
                  </div>

                  {/* Quick Cardio Bar */}
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border-subtle)] pt-2.5 text-xs">
                    <span className="text-[11px] font-bold text-emerald-400">
                      Cardio:
                    </span>
                    <input
                      type="text"
                      aria-label="Quick Cardio Activity"
                      value={quickCardioType}
                      onChange={(e) => setQuickCardioType(e.target.value)}
                      className="w-28 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-xs"
                    />
                    {[10, 15, 20, 30].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          setQuickCardioMins(mins);
                          logQuickCardio(quickCardioType, mins);
                        }}
                        className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-400"
                      >
                        {mins}m
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => addExercise()}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg bg-sky-500 px-2.5 py-1 text-[11px] font-bold text-slate-950"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      <span>Custom Lift</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-PAGE 2B: ACTIVE EXERCISES — COMPACT ACCORDION LIST */}
            {(desktopFullView || workoutSubPage === "sets") && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <span className="text-xs font-bold">
                    {currentDay.workout.sessionTitle || "Today's Exercises"}
                  </span>
                  <button
                    type="button"
                    onClick={() => addExercise()}
                    className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-2.5 py-1 text-[11px] font-bold text-slate-950"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    <span>Add Exercise</span>
                  </button>
                </div>

                {currentDay.workout.exercises.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 text-center space-y-2.5">
                    <div className="text-xs font-bold">No exercises added yet</div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Tap a 1-tap routine on Page 1 or add a custom exercise to start logging sets.
                    </p>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setWorkoutSubPage("routines")}
                        className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-400"
                      >
                        Choose Routine
                      </button>
                      <button
                        type="button"
                        onClick={() => addExercise()}
                        className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                      >
                        + Add Exercise
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentDay.workout.exercises.map((exercise, exIdx) => {
                      const isOpen =
                        desktopFullView || expandedExerciseId === exercise.id;
                      const doneSets = exercise.sets.filter((s) => s.completed).length;
                      const topSet = exercise.sets[0];
                      const prevSetsForEx = findPreviousExerciseSets(
                        profile,
                        selectedDate,
                        exercise.name
                      );
                      const isBodyweightEx =
                        exercise.exerciseType === "bodyweight" ||
                        (!exercise.exerciseType &&
                          (exercise.name.toLowerCase().includes("push-up") ||
                            exercise.name.toLowerCase().includes("pull-up") ||
                            exercise.name.toLowerCase().includes("chin-up") ||
                            exercise.name.toLowerCase().includes("bodyweight")));

                      if (!isOpen) {
                        return (
                          <button
                            key={exercise.id}
                            type="button"
                            onClick={() => setExpandedExerciseId(exercise.id)}
                            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:border-sky-500/45 transition"
                          >
                            <div className="min-w-0 truncate text-xs">
                              <span className="font-bold">
                                {exIdx + 1}. {exercise.name}
                              </span>
                              <span className="text-[var(--text-muted)] ml-1.5">
                                · {doneSets}/{exercise.sets.length} sets ·{" "}
                                {isBodyweightEx
                                  ? `${topSet?.reps ?? 0} reps (BW)`
                                  : `${topSet?.weight ?? 0}${profile.weightUnit} × ${topSet?.reps ?? 0}`}
                              </span>
                            </div>
                            <span
                              className={`shrink-0 text-xs font-bold ${
                                doneSets === exercise.sets.length && exercise.sets.length > 0
                                  ? "text-emerald-400"
                                  : "text-[var(--text-muted)]"
                              }`}
                            >
                              {doneSets === exercise.sets.length && exercise.sets.length > 0
                                ? "✓"
                                : "▸"}
                            </span>
                          </button>
                        );
                      }

                      return (
                        <div
                          key={exercise.id}
                          className="rounded-2xl border border-sky-500/45 bg-[var(--bg-surface)] p-3.5 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-[170px]">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-xs font-bold text-sky-400">
                                {exIdx + 1}
                              </span>
                              <input
                                type="text"
                                aria-label={`Exercise ${exIdx + 1} Name`}
                                value={exercise.name}
                                onChange={(e) =>
                                  updateExercise(exercise.id, {
                                    name: e.target.value,
                                  })
                                }
                                placeholder="Exercise name..."
                                className="w-full bg-transparent text-sm font-bold focus:outline-none border-b border-transparent focus:border-sky-500"
                              />
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  updateExercise(exercise.id, {
                                    exerciseType: isBodyweightEx
                                      ? "strength"
                                      : "bodyweight",
                                    sets: isBodyweightEx
                                      ? exercise.sets
                                      : exercise.sets.map((s) => ({
                                          ...s,
                                          weight: 0,
                                        })),
                                  })
                                }
                                className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${
                                  isBodyweightEx
                                    ? "border-teal-500/40 bg-teal-500/15 text-teal-300"
                                    : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                                }`}
                              >
                                {isBodyweightEx ? "0 Wt (BW)" : "Weighted"}
                              </button>
                              <button
                                type="button"
                                onClick={() => addSetToExercise(exercise.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-sky-500/35 bg-sky-500/10 px-2 py-1 text-[11px] font-bold text-sky-400"
                              >
                                <Plus className="h-3 w-3" aria-hidden="true" />
                                <span>Set</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => removeExercise(exercise.id)}
                                aria-label={`Delete ${exercise.name}`}
                                className="rounded-lg p-1 text-[var(--text-muted)] hover:text-rose-400"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </div>

                          {prevSetsForEx && (
                            <div className="text-[11px] text-sky-400">
                              Last ({prevSetsForEx.sourceDate}):{" "}
                              {prevSetsForEx.sets
                                .map((ps) =>
                                  isBodyweightEx
                                    ? `${ps.reps} reps (BW)`
                                    : `${ps.weight}${profile.weightUnit}×${ps.reps}`
                                )
                                .join(" · ")}
                            </div>
                          )}

                          {/* Set Table: Type (W/1/2/F) | Weight | Reps | Done */}
                          <div className="space-y-1.5">
                            <div className="grid grid-cols-[2.4rem_1fr_4.2rem_3.6rem] items-center gap-1.5 border-b border-[var(--border-subtle)] pb-1 text-[10px] font-semibold text-[var(--text-muted)]">
                              <span>Type</span>
                              <span>
                                {isBodyweightEx
                                  ? "Weight"
                                  : `Weight (${profile.weightUnit})`}
                              </span>
                              <span>Reps</span>
                              <span className="text-center">Done</span>
                            </div>

                            {exercise.sets.map((s, sIdx) => {
                              const st = s.setType || (sIdx === 0 ? "1" : "2");
                              return (
                                <div
                                  key={s.id}
                                  className={`grid grid-cols-[2.4rem_1fr_4.2rem_3.6rem] items-center gap-1.5 py-1 text-xs ${
                                    s.completed ? "" : "opacity-60"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      cycleExerciseSetType(exercise.id, s.id, st)
                                    }
                                    title="Tap to switch Warm-up (W) / Working (1,2) / Failure (F)"
                                    className={`rounded-md border py-1 text-center text-[11px] font-extrabold ${
                                      st === "W"
                                        ? "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                                        : st === "F"
                                        ? "border-rose-500/45 bg-rose-500/15 text-rose-400"
                                        : "border-sky-500/40 bg-sky-500/15 text-sky-400"
                                    }`}
                                  >
                                    {st}
                                  </button>

                                  {isBodyweightEx ? (
                                    <span className="rounded-lg border border-teal-500/30 bg-teal-500/10 py-1.5 text-center text-[11px] font-bold text-teal-300">
                                      0 (BW)
                                    </span>
                                  ) : (
                                    <DecimalInput
                                      allowDecimal
                                      min={0}
                                      aria-label={`Set ${sIdx + 1} Weight`}
                                      value={s.weight}
                                      onValueChange={(val) =>
                                        updateExerciseSet(exercise.id, s.id, {
                                          weight: val,
                                        })
                                      }
                                      onBlur={() => void flushSaveNow()}
                                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1.5 text-center font-bold tabular-nums focus:border-sky-400 focus:outline-none"
                                    />
                                  )}

                                  <DecimalInput
                                    allowDecimal={false}
                                    min={0}
                                    aria-label={`Set ${sIdx + 1} Reps`}
                                    value={s.reps}
                                    onValueChange={(val) =>
                                      updateExerciseSet(exercise.id, s.id, {
                                        reps: Math.round(val),
                                      })
                                    }
                                    onBlur={() => void flushSaveNow()}
                                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1.5 text-center font-bold tabular-nums focus:border-sky-400 focus:outline-none"
                                  />

                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      type="checkbox"
                                      aria-label={`Mark set ${sIdx + 1} completed`}
                                      checked={s.completed}
                                      onChange={(e) =>
                                        updateExerciseSet(exercise.id, s.id, {
                                          completed: e.target.checked,
                                        })
                                      }
                                      className="h-5 w-5 rounded accent-emerald-500 cursor-pointer"
                                    />
                                    {exercise.sets.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeExerciseSet(exercise.id, s.id)
                                        }
                                        aria-label={`Remove set ${sIdx + 1}`}
                                        className="text-xs text-[var(--text-muted)] hover:text-rose-400 px-0.5"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <input
                            type="text"
                            aria-label={`Note for ${exercise.name}`}
                            placeholder="1-line exercise cue (tempo, grip, joint feel)..."
                            value={exercise.note}
                            onChange={(e) =>
                              updateExercise(exercise.id, { note: e.target.value })
                            }
                            onBlur={() => void flushSaveNow()}
                            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] focus:text-[var(--text-primary)] focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SUB-PAGE 2C: FINISH, MUSCULAR VS CARDIO LOAD & FULL 1-10 EFFORT RATING */}
            {(desktopFullView || workoutSubPage === "finish") && (
              <div className="space-y-3">
                {/* Muscular Load vs Cardio Load Split */}
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-sky-400">
                      Muscular Load {muscularLoadPct}%
                    </span>
                    <span className="text-emerald-400">
                      Cardio Load{" "}
                      {muscularLoadPct > 0 ? 100 - muscularLoadPct : 0}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)] flex">
                    <div
                      className="h-full bg-sky-400 transition-all"
                      style={{ width: `${muscularLoadPct}%` }}
                    />
                    <div
                      className="h-full bg-emerald-400 transition-all"
                      style={{
                        width: `${muscularLoadPct > 0 ? 100 - muscularLoadPct : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Full 2x5 1-10 Post-Workout Effort Rating */}
                <div className="rounded-2xl border border-sky-500/35 bg-[var(--bg-surface)] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                      <Star className="h-4 w-4 text-amber-400" aria-hidden="true" />
                      <span>Rate Today&apos;s Effort (1–10)</span>
                    </span>
                    <span className="text-xs font-extrabold text-amber-400">
                      {currentDay.workout.workoutRating ??
                        currentDay.dailyWorkoutRating ??
                        analysis.effectiveWorkoutRating}{" "}
                      / 10
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => {
                      const activeRating =
                        currentDay.workout.workoutRating ??
                        currentDay.dailyWorkoutRating;
                      return (
                        <button
                          key={r}
                          type="button"
                          aria-label={`Rate workout ${r} out of 10`}
                          aria-pressed={activeRating === r}
                          onClick={() => setWorkoutRating(r)}
                          className={`rounded-lg py-2 text-xs font-bold border transition ${
                            activeRating === r
                              ? "border-amber-400 bg-amber-500 text-slate-950"
                              : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-amber-400/50"
                          }`}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duration & Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                    <label
                      htmlFor="gym-minutes"
                      className="block text-[10px] text-[var(--text-muted)]"
                    >
                      Gym Minutes
                    </label>
                    <DecimalInput
                      id="gym-minutes"
                      allowDecimal={false}
                      min={0}
                      value={currentDay.workout.gymDurationMinutes}
                      onValueChange={(v) =>
                        updateCurrentDay((d) => ({
                          ...d,
                          workout: { ...d.workout, gymDurationMinutes: Math.round(v) },
                        }))
                      }
                      onBlur={() => void flushSaveNow()}
                      className="mt-0.5 w-full bg-transparent text-center text-lg font-extrabold tabular-nums text-sky-400 focus:outline-none"
                    />
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                    <label
                      htmlFor="cardio-mins"
                      className="block text-[10px] text-[var(--text-muted)]"
                    >
                      Cardio Minutes
                    </label>
                    <DecimalInput
                      id="cardio-mins"
                      allowDecimal={false}
                      min={0}
                      value={currentDay.workout.cardioMinutes}
                      onValueChange={(v) =>
                        updateCurrentDay((d) => ({
                          ...d,
                          workout: { ...d.workout, cardioMinutes: Math.round(v) },
                        }))
                      }
                      onBlur={() => void flushSaveNow()}
                      className="mt-0.5 w-full bg-transparent text-center text-lg font-extrabold tabular-nums text-emerald-400 focus:outline-none"
                    />
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                    <div className="text-[10px] text-[var(--text-muted)]">
                      Intensity
                    </div>
                    <div className="mt-0.5 text-lg font-extrabold text-amber-400 tabular-nums">
                      {analysis.workoutIntensityScore}%
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                    <div className="text-[10px] text-[var(--text-muted)]">
                      Workout Strain
                    </div>
                    <div className="mt-0.5 text-lg font-extrabold text-emerald-400 tabular-nums">
                      {analysis.strainScore}/21
                    </div>
                  </div>
                </div>

                {/* Workout Session Note */}
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-1.5">
                  <label
                    htmlFor="workout-session-note"
                    className="block text-xs font-bold text-[var(--text-muted)]"
                  >
                    Workout Session Notes
                  </label>
                  <textarea
                    id="workout-session-note"
                    placeholder="PRs hit, pump, joint notes, or coaching remarks..."
                    value={currentDay.workout.note}
                    onChange={(e) =>
                      updateCurrentDay((d) => ({
                        ...d,
                        workout: { ...d.workout, note: e.target.value },
                      }))
                    }
                    onBlur={() => void flushSaveNow()}
                    className="auto-grow-textarea w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 text-xs focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* =========================================================
            SCREEN 3: NUTRITION — 2 SUB-PAGES ONLY (1. Favs | 2. Food Search)
           ========================================================= */}
        {showNutrition && (
          <section aria-label="Nutrition Screen" className="space-y-3">
            {!desktopFullView && (
              <div
                role="tablist"
                aria-label="Nutrition Sub-Pages"
                className="grid grid-cols-2 gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={nutritionSubPage === "favs"}
                  onClick={() => setNutritionSubPage("favs")}
                  className={`rounded-lg py-1.5 text-xs font-bold transition ${
                    nutritionSubPage === "favs"
                      ? "bg-amber-500 text-slate-950 shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  1. Favs
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={nutritionSubPage === "search"}
                  onClick={() => setNutritionSubPage("search")}
                  className={`rounded-lg py-1.5 text-xs font-bold transition ${
                    nutritionSubPage === "search"
                      ? "bg-amber-500 text-slate-950 shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  2. Food Search
                </button>
              </div>
            )}

            {/* SUB-PAGE 3A: 1. FAVS (Primary Fuel, 4-Pill Macros, Quick Totals, Frequent Staples + Collapsible Logged Today) */}
            {(desktopFullView || nutritionSubPage === "favs") && (
              <div className="space-y-3">
                {/* Primary Calories & Protein Cards */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    {
                      key: "calories",
                      targetKey: "calorieTarget",
                      label: "Calories",
                      unit: "kcal",
                      barColor: "bg-amber-400",
                      textColor: "text-amber-400",
                      border: "border-amber-500/40 bg-amber-500/5",
                    },
                    {
                      key: "protein",
                      targetKey: "proteinTarget",
                      label: "Protein",
                      unit: "g",
                      barColor: "bg-emerald-400",
                      textColor: "text-emerald-400",
                      border: "border-emerald-500/40 bg-emerald-500/5",
                    },
                  ].map((item) => {
                    const val =
                      Number(
                        currentDay.nutrition[
                          item.key as keyof typeof currentDay.nutrition
                        ]
                      ) || 0;
                    const target =
                      Number(
                        currentDay.nutrition[
                          item.targetKey as keyof typeof currentDay.nutrition
                        ]
                      ) || 1;
                    const pct = Math.min(100, Math.round((val / target) * 100));
                    return (
                      <div
                        key={item.key}
                        className={`rounded-2xl border p-3 space-y-1.5 ${item.border}`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span>{item.label}</span>
                          <span className={item.textColor}>{pct}%</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <DecimalInput
                            allowDecimal={false}
                            min={0}
                            aria-label={`${item.label} Consumed (${item.unit})`}
                            value={val}
                            onValueChange={(nextVal) =>
                              updateCurrentDay((d) => ({
                                ...d,
                                nutrition: {
                                  ...d.nutrition,
                                  useMealSum: false,
                                  [item.key]: Math.round(nextVal),
                                },
                              }))
                            }
                            onBlur={() => void flushSaveNow()}
                            className={`w-20 bg-transparent text-xl font-extrabold tabular-nums ${item.textColor} focus:outline-none`}
                          />
                          <span className="text-[11px] text-[var(--text-muted)]">
                            /
                          </span>
                          <DecimalInput
                            allowDecimal={false}
                            min={1}
                            aria-label={`${item.label} Target (${item.unit})`}
                            value={target}
                            onValueChange={(nextTarget) =>
                              updateCurrentDay((d) => ({
                                ...d,
                                nutrition: {
                                  ...d.nutrition,
                                  [item.targetKey]: Math.round(nextTarget),
                                },
                              }))
                            }
                            onBlur={() => void flushSaveNow()}
                            className="w-12 bg-transparent text-xs font-semibold tabular-nums text-[var(--text-muted)] focus:outline-none"
                          />
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                          <div
                            className={`h-full rounded-full ${item.barColor} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Compact 4-Pill Secondary Macro Strip */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { key: "carbs", label: "Carbs", unit: "g", dec: false, col: "text-sky-400" },
                    { key: "fats", label: "Fats", unit: "g", dec: false, col: "text-purple-400" },
                    { key: "waterLiters", label: "Water", unit: "L", dec: true, col: "text-cyan-400" },
                    { key: "fiberGrams", label: "Fiber", unit: "g", dec: true, col: "text-teal-400" },
                  ].map((m) => {
                    const val =
                      Number(
                        currentDay.nutrition[
                          m.key as keyof typeof currentDay.nutrition
                        ]
                      ) || 0;
                    return (
                      <div
                        key={m.key}
                        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 text-center"
                      >
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {m.label}
                        </div>
                        <div className="flex items-baseline justify-center gap-0.5">
                          <DecimalInput
                            allowDecimal={m.dec}
                            min={0}
                            aria-label={`${m.label} (${m.unit})`}
                            value={val}
                            onValueChange={(nextVal) =>
                              updateCurrentDay((d) => ({
                                ...d,
                                nutrition: {
                                  ...d.nutrition,
                                  useMealSum: false,
                                  [m.key]: m.dec
                                    ? Number(nextVal.toFixed(2))
                                    : Math.round(nextVal),
                                },
                              }))
                            }
                            onBlur={() => void flushSaveNow()}
                            className={`w-10 bg-transparent text-center text-xs font-extrabold tabular-nums ${m.col} focus:outline-none`}
                          />
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {m.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Totals Row */}
                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  {[250, 500].map((kcal) => (
                    <button
                      key={kcal}
                      type="button"
                      onClick={() =>
                        updateCurrentDay((d) => ({
                          ...d,
                          nutrition: {
                            ...d.nutrition,
                            useMealSum: false,
                            calories: d.nutrition.calories + kcal,
                          },
                          checkIn: { ...d.checkIn, nutritionSkipped: false },
                        }))
                      }
                      className="rounded-xl border border-amber-500/35 bg-amber-500/10 py-2 font-bold text-amber-400 hover:bg-amber-500/20 transition"
                    >
                      +{kcal} kcal
                    </button>
                  ))}
                  {[25, 40].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        updateCurrentDay((d) => ({
                          ...d,
                          nutrition: {
                            ...d.nutrition,
                            useMealSum: false,
                            protein: d.nutrition.protein + p,
                          },
                          checkIn: { ...d.checkIn, nutritionSkipped: false },
                        }))
                      }
                      className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 py-2 font-bold text-emerald-400 hover:bg-emerald-500/20 transition"
                    >
                      +{p}g P
                    </button>
                  ))}
                </div>

                {/* Your Favs (1-Tap Frequent Staples) */}
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-400">
                      Your Favs (1-Tap Staples)
                    </span>
                    <button
                      type="button"
                      onClick={() => setNutritionSubPage("search")}
                      className="text-[11px] font-semibold text-amber-400 hover:underline"
                    >
                      + Search Food &rarr;
                    </button>
                  </div>

                  {frequentStaples.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs text-[var(--text-muted)]">
                      No recurring Favs yet. Search any food and tap the Pin icon (or log foods across days) to populate your 1-tap Favs here.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {frequentStaples.slice(0, 6).map((staple) => {
                        const qty = stapleQuantities[staple.id] ?? 1;
                        return (
                          <div
                            key={staple.id}
                            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-bold truncate">
                                {staple.name}
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)]">
                                {Math.round(staple.calories * qty)} kcal ·{" "}
                                <strong className="text-emerald-400">
                                  {Math.round(staple.protein * qty)}g P
                                </strong>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <DecimalInput
                                allowDecimal
                                min={0.25}
                                max={20}
                                aria-label={`Quantity for ${staple.name}`}
                                value={qty}
                                onValueChange={(nextQ) =>
                                  setStapleQuantities((prev) => ({
                                    ...prev,
                                    [staple.id]: Math.max(0.25, nextQ || 1),
                                  }))
                                }
                                className="w-10 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1 py-0.5 text-center text-[11px] font-bold"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  addUserFrequentStapleMeal(staple, qty)
                                }
                                className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-emerald-400"
                              >
                                + Add
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Quick Custom Food Adder */}
                  <form
                    onSubmit={addQuickCustomFood}
                    className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border-subtle)] pt-2.5 text-xs"
                  >
                    <input
                      type="text"
                      aria-label="Quick food name"
                      value={quickFoodName}
                      onChange={(e) => setQuickFoodName(e.target.value)}
                      placeholder="Quick add food (e.g. 3 Eggs + Toast)..."
                      className="flex-1 min-w-[140px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs"
                    />
                    <DecimalInput
                      allowDecimal={false}
                      min={0}
                      showEmptyWhenZero
                      placeholder="kcal"
                      aria-label="Quick food calories"
                      value={quickFoodCalories}
                      onValueChange={(v) => setQuickFoodCalories(Math.round(v))}
                      className="w-14 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1.5 text-center text-xs font-bold"
                    />
                    <DecimalInput
                      allowDecimal={false}
                      min={0}
                      showEmptyWhenZero
                      placeholder="P(g)"
                      aria-label="Quick food protein"
                      value={quickFoodProtein}
                      onValueChange={(v) => setQuickFoodProtein(Math.round(v))}
                      className="w-12 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1.5 text-center text-xs font-bold"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-slate-950"
                    >
                      + Log
                    </button>
                  </form>
                </div>

                {/* Compact Collapsible Logged Today Drawer (Replaces 3. Meals Sub-Page) */}
                <details className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5">
                  <summary className="flex items-center justify-between gap-2 cursor-pointer list-none text-xs font-bold">
                    <span>
                      Logged Today ({currentDay.nutrition.meals.length} items)
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)]">
                      <span>View / Remove</span>
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </summary>

                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <label className="inline-flex items-center gap-1.5 text-[var(--text-muted)] cursor-pointer">
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
                          className="h-3.5 w-3.5 accent-emerald-500"
                        />
                        <span>Auto-sum totals from meal rows</span>
                      </label>
                      <button
                        type="button"
                        onClick={addMeal}
                        className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-400"
                      >
                        + Custom Meal
                      </button>
                    </div>

                    {currentDay.nutrition.meals.length === 0 ? (
                      <div className="text-xs text-[var(--text-muted)]">
                        No individual foods logged yet today.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {currentDay.nutrition.meals.map((meal) => (
                          <div
                            key={meal.id}
                            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 space-y-1.5 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                aria-label="Meal Description"
                                value={meal.name}
                                onChange={(e) =>
                                  updateMeal(meal.id, { name: e.target.value })
                                }
                                onBlur={() => void flushSaveNow()}
                                className="flex-1 min-w-0 bg-transparent font-bold focus:outline-none"
                              />
                              <div className="flex items-center gap-1.5 shrink-0">
                                <DecimalInput
                                  allowDecimal={false}
                                  min={0}
                                  aria-label={`${meal.name} kcal`}
                                  value={meal.calories}
                                  onValueChange={(val) =>
                                    updateMeal(meal.id, { calories: Math.round(val) })
                                  }
                                  className="w-12 rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-right font-bold text-amber-400"
                                />
                                <DecimalInput
                                  allowDecimal={false}
                                  min={0}
                                  aria-label={`${meal.name} protein`}
                                  value={meal.protein}
                                  onValueChange={(val) =>
                                    updateMeal(meal.id, { protein: Math.round(val) })
                                  }
                                  className="w-10 rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-right font-bold text-emerald-400"
                                />
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
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Custom Health Metrics */}
                    <div className="border-t border-[var(--border-subtle)] pt-2.5 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[var(--text-muted)]">
                          Custom Biomarkers &amp; Metrics
                        </span>
                        <button
                          type="button"
                          onClick={addCustomMetric}
                          className="text-emerald-400 font-semibold"
                        >
                          + Add Metric
                        </button>
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-3">
                        {currentDay.nutrition.customMetrics.map((cm) => (
                          <div
                            key={cm.id}
                            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <input
                                type="text"
                                aria-label="Custom Metric Name"
                                value={cm.label}
                                onChange={(e) =>
                                  updateCustomMetric(cm.id, { label: e.target.value })
                                }
                                className="w-full bg-transparent text-[11px] font-semibold text-[var(--text-muted)] focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => removeCustomMetric(cm.id)}
                                aria-label={`Delete ${cm.label}`}
                                className="text-[var(--text-muted)] hover:text-rose-400"
                              >
                                ×
                              </button>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <input
                                type="text"
                                aria-label={`${cm.label} Value`}
                                placeholder="0"
                                value={cm.value}
                                onChange={(e) =>
                                  updateCustomMetric(cm.id, { value: e.target.value })
                                }
                                onBlur={() => void flushSaveNow()}
                                className="w-16 bg-transparent font-bold text-emerald-400 focus:outline-none"
                              />
                              <input
                                type="text"
                                aria-label={`${cm.label} Unit`}
                                value={cm.unit}
                                onChange={(e) =>
                                  updateCustomMetric(cm.id, { unit: e.target.value })
                                }
                                className="w-12 bg-transparent text-[11px] text-[var(--text-muted)] focus:outline-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <textarea
                      id="nutrition-note"
                      aria-label="Nutrition Notes"
                      placeholder="Nutrition, hydration, or gut-health notes..."
                      value={currentDay.nutrition.note}
                      onChange={(e) =>
                        updateCurrentDay((d) => ({
                          ...d,
                          nutrition: { ...d.nutrition, note: e.target.value },
                        }))
                      }
                      onBlur={() => void flushSaveNow()}
                      className="auto-grow-textarea w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </details>
              </div>
            )}

            {/* SUB-PAGE 3B: 2. FOOD SEARCH (ICMR-NIN INDIA + USDA GLOBAL) */}
            {(desktopFullView || nutritionSubPage === "search") && (
              <div className="rounded-2xl border border-amber-500/30 bg-[var(--bg-surface)] p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                    <Utensils className="h-4 w-4 text-amber-400" aria-hidden="true" />
                    <span>Food Search (ICMR-NIN India + USDA Global)</span>
                  </span>
                  <span className="text-[10px] font-semibold text-amber-400">
                    {FOOD_DATABASE.length + aiFoodResults.length}+ Foods
                  </span>
                </div>

                <form
                  onSubmit={handleOpenAiFoodSearch}
                  className="flex flex-wrap items-center gap-2"
                >
                  <div className="flex-1 min-w-[180px] flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-2">
                    <Search className="h-4 w-4 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                    <input
                      id="food-search-input"
                      type="search"
                      aria-label="Search Global or Indian food"
                      value={foodSearchQuery}
                      onChange={(e) => setFoodSearchQuery(e.target.value)}
                      placeholder="Search Chapati, Dal, Paneer, Chicken, Salmon..."
                      className="w-full bg-transparent text-xs focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={foodSearchLoading || !foodSearchQuery.trim()}
                    className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{foodSearchLoading ? "Fetching..." : "Fetch Any Food"}</span>
                  </button>
                </form>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    "All",
                    "Indian Staples & Meals",
                    "Proteins, Poultry & Fish",
                    "Dairy, Eggs & Plant Protein",
                    "Hydration & Beverages",
                  ].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFoodCategoryFilter(cat)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        foodCategoryFilter === cat
                          ? "bg-amber-500 text-slate-950"
                          : "border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 lg:grid-cols-12">
                  <div className="lg:col-span-6 space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {combinedCatalogMatches.slice(0, 8).map((item) => {
                      const isSelected = selectedFoodItem.id === item.id;
                      const isPinned = (profile.pinnedStaples || []).some(
                        (p) =>
                          p.name.trim().toLowerCase() ===
                          item.name.trim().toLowerCase()
                      );
                      return (
                        <div
                          key={item.id}
                          className={`flex items-stretch rounded-xl border transition ${
                            isSelected
                              ? "border-amber-400 bg-amber-500/10"
                              : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectFoodItem(item)}
                            className="flex-1 p-2 text-left text-xs"
                          >
                            <div className="font-bold">{item.name}</div>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              100g: {item.caloriesPer100g} kcal ·{" "}
                              <span className="text-emerald-400">
                                {item.proteinPer100g}g P
                              </span>{" "}
                              · {item.source}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePinFoodItem(item)}
                            aria-label={
                              isPinned
                                ? `Unpin ${item.name} from Favs`
                                : `Pin ${item.name} to Favs`
                            }
                            className={`px-2.5 border-l border-[var(--border-subtle)] ${
                              isPinned
                                ? "text-emerald-400 bg-emerald-500/10"
                                : "text-[var(--text-muted)] hover:text-emerald-400"
                            }`}
                          >
                            <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Portion & Gram Calculator */}
                  <div className="lg:col-span-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{selectedFoodItem.name}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                        <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                        {foodPreview.totalGrams}g
                      </span>
                    </div>

                    <select
                      aria-label="Portion Size"
                      value={selectedPortionIndex}
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        setSelectedPortionIndex(idx);
                        if (idx >= 0 && selectedFoodItem.portions[idx]) {
                          setCustomWeightGrams(
                            selectedFoodItem.portions[idx].grams
                          );
                        }
                      }}
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs"
                    >
                      {selectedFoodItem.portions.map((p, idx) => (
                        <option key={p.label} value={idx}>
                          {p.label}
                        </option>
                      ))}
                      <option value={-1}>Custom Weight (g/ml)</option>
                    </select>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label
                          htmlFor="food-grams-input"
                          className="block text-[10px] text-[var(--text-muted)]"
                        >
                          Grams
                        </label>
                        <DecimalInput
                          id="food-grams-input"
                          allowDecimal
                          min={1}
                          value={customWeightGrams}
                          onValueChange={(nextGrams) => {
                            setSelectedPortionIndex(-1);
                            setCustomWeightGrams(Math.max(1, nextGrams));
                          }}
                          className="mt-0.5 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="food-quantity-input"
                          className="block text-[10px] text-[var(--text-muted)]"
                        >
                          Qty
                        </label>
                        <DecimalInput
                          id="food-quantity-input"
                          allowDecimal
                          min={0.25}
                          max={25}
                          value={foodQuantity}
                          onValueChange={(nextQty) =>
                            setFoodQuantity(Math.max(0.25, nextQty || 1))
                          }
                          className="mt-0.5 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="food-time-input"
                          className="block text-[10px] text-[var(--text-muted)]"
                        >
                          Time
                        </label>
                        <input
                          id="food-time-input"
                          type="time"
                          value={foodTime}
                          onChange={(e) => setFoodTime(e.target.value)}
                          className="mt-0.5 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-1 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1 rounded-lg bg-[var(--bg-surface)] p-2 text-center text-[11px]">
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)]">kcal</div>
                        <strong className="text-amber-400">{foodPreview.calories}</strong>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)]">Prot</div>
                        <strong className="text-emerald-400">{foodPreview.protein}g</strong>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)]">Carbs</div>
                        <strong className="text-sky-400">{foodPreview.carbs}g</strong>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)]">Fats</div>
                        <strong className="text-purple-400">{foodPreview.fats}g</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleAddFoodFromSearch();
                      }}
                      className="w-full rounded-xl bg-emerald-500 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
                    >
                      + Add {selectedFoodItem.name} ({foodPreview.totalGrams}g)
                    </button>
                  </div>
                </div>

                {foodSearchMessage && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400"
                  >
                    <span>{foodSearchMessage}</span>
                    <button
                      type="button"
                      onClick={() => setNutritionSubPage("favs")}
                      className="shrink-0 font-bold underline hover:text-emerald-300"
                    >
                      View Logged ({currentDay.nutrition.meals.length}) &rarr;
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* =========================================================
            SCREEN 4: HABITS JOURNAL, AI COACH & TRENDS
           ========================================================= */}
        {showMore && (
          <section aria-label="Habits, AI Coach and Trends" className="space-y-3">
            {!desktopFullView && (
              <div
                role="tablist"
                aria-label="Habits and AI Sub-Pages"
                className="grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1"
              >
                {(
                  [
                    {
                      id: "journal",
                      label: `1. Journal (${loggedHabitsCount}/${activeHabits.length})`,
                    },
                    { id: "ai", label: "2. AI Coach" },
                    { id: "trends", label: "3. History & Trends" },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={moreSubPage === p.id}
                    onClick={() => setMoreSubPage(p.id)}
                    className={`rounded-lg py-1.5 text-[11px] sm:text-xs font-bold transition ${
                      moreSubPage === p.id
                        ? "bg-purple-500 text-slate-950 shadow-xs"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {/* SUB-PAGE 4A: DAILY JOURNAL */}
            {(desktopFullView || moreSubPage === "journal") && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold">
                      Daily Journal · {loggedHabitsCount} of {activeHabits.length}{" "}
                      answered
                    </h2>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Daily habits mapped to next-day recovery
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHabitCatalogDialog(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-purple-500/40 bg-purple-500/15 px-2.5 py-1.5 text-xs font-bold text-purple-300"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Customize ({HABIT_CATALOG.length}+)</span>
                  </button>
                </div>

                {/* Speed Actions: Same as Yesterday + Clear + Skip */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!hasPriorHabitsToCopy}
                    onClick={applySameHabitsAsYesterday}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-purple-500/45 bg-purple-500/15 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500/25 disabled:opacity-45 transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Same as Yesterday</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearAllHabitsToday}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)]"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateCurrentDay((d) => ({
                        ...d,
                        checkIn: { ...d.checkIn, habitsSkipped: true },
                      }))
                    }
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)]"
                  >
                    {currentDay.checkIn?.habitsSkipped ? "Skipped ✓" : "Skip"}
                  </button>
                </div>

                <div className="space-y-2">
                  {activeHabits.map((habit) => {
                    const log = currentDay.habitLogs?.[habit.id];
                    const isYes =
                      log?.status === "yes" ||
                      (habit.inputType === "dosage" &&
                        log?.status !== "no" &&
                        Boolean(log?.value && log.value.trim().length > 0));
                    const isNo = log?.status === "no";
                    const impact = computeHabitRecoveryImpact(profile, habit.id);

                    return (
                      <div
                        key={habit.id}
                        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold truncate">{habit.name}</div>
                            <div
                              className={`text-[10px] font-semibold ${
                                impact.deltaPct === null
                                  ? "text-[var(--text-muted)]"
                                  : impact.deltaPct >= 0
                                  ? "text-emerald-400"
                                  : "text-rose-400"
                              }`}
                            >
                              {impact.deltaPct !== null
                                ? `${impact.deltaPct >= 0 ? "+" : ""}${impact.deltaPct}% Recovery Impact`
                                : `${habit.category} · Log ${impact.logsNeeded} more days for impact`}
                            </div>
                          </div>

                          {/* NO | YES Segmented Toggle */}
                          <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5 shrink-0">
                            <button
                              type="button"
                              aria-pressed={isNo}
                              onClick={() =>
                                updateHabitEntry(
                                  habit.id,
                                  isNo ? null : { status: "no", value: "" }
                                )
                              }
                              className={`rounded-lg px-3 py-1 text-[11px] font-bold transition ${
                                isNo
                                  ? "bg-rose-500 text-white"
                                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                              }`}
                            >
                              NO
                            </button>
                            <button
                              type="button"
                              aria-pressed={isYes}
                              onClick={() =>
                                updateHabitEntry(
                                  habit.id,
                                  isYes
                                    ? null
                                    : {
                                        status: "yes",
                                        ...(habit.inputType === "dosage"
                                          ? {
                                              value:
                                                log?.value ||
                                                habit.defaultValue ||
                                                "1",
                                              unit: habit.unit,
                                              time: log?.time || "09:00",
                                            }
                                          : {}),
                                      }
                                )
                              }
                              className={`rounded-lg px-3 py-1 text-[11px] font-bold transition ${
                                isYes
                                  ? "bg-emerald-500 text-slate-950"
                                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                              }`}
                            >
                              YES
                            </button>
                          </div>
                        </div>

                        {/* Conditional Dosage & Time Expansion when YES is selected */}
                        {habit.inputType === "dosage" && isYes && (
                          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5">
                            <span className="text-[11px] font-semibold text-emerald-400">
                              Dose:
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`${habit.name} dosage`}
                              value={log?.value ?? habit.defaultValue ?? ""}
                              onChange={(e) =>
                                updateHabitEntry(habit.id, {
                                  status: "yes",
                                  value: e.target.value,
                                  unit: habit.unit,
                                })
                              }
                              onBlur={() => void flushSaveNow()}
                              className="w-16 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-center text-xs font-bold text-emerald-400"
                            />
                            <span className="text-[11px] text-[var(--text-muted)]">
                              {habit.unit || "units"}
                            </span>
                            <input
                              type="time"
                              aria-label={`${habit.name} time`}
                              value={log?.time || "09:00"}
                              onChange={(e) =>
                                updateHabitEntry(habit.id, {
                                  status: "yes",
                                  time: e.target.value,
                                })
                              }
                              className="ml-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[11px]"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUB-PAGE 4B: AI RECOVERY COACH & SMART LOG */}
            {(desktopFullView || moreSubPage === "ai") && (
              <div className="rounded-2xl border border-emerald-500/30 bg-[var(--bg-surface)] p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    <h2 className="text-sm font-bold">AI Recovery Coach &amp; Smart Log</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="AI Coach Speed Mode"
                      value={geminiModel}
                      onChange={(e) =>
                        setGeminiModel(
                          e.target.value as "gemini-4-hydrogen" | "gemini-4-argon"
                        )
                      }
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold"
                    >
                      <option value="gemini-4-hydrogen">Fast</option>
                      <option value="gemini-4-argon">Deep</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleOptimizeDay}
                      disabled={geminiLoadingMode !== null}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-60"
                    >
                      <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {geminiLoadingMode === "optimize-day"
                          ? "Analyzing..."
                          : "Optimize Day"}
                      </span>
                    </button>
                  </div>
                </div>

                {geminiStatusMessage && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400"
                  >
                    {geminiStatusMessage}
                  </div>
                )}

                {currentDay.aiCoach?.prescription && (
                  <div className="rounded-xl border border-emerald-500/30 bg-[var(--bg-elevated)] p-3 space-y-2 text-xs">
                    <div className="font-bold text-emerald-400">
                      {currentDay.aiCoach.prescription.headline}
                    </div>
                    <p className="text-[var(--text-muted)]">
                      {currentDay.aiCoach.prescription.summary}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {currentDay.aiCoach.prescription.recommendedMeal && (
                        <button
                          type="button"
                          onClick={() =>
                            handleApplyRecommendedMeal(
                              currentDay.aiCoach!.prescription!.recommendedMeal!
                            )
                          }
                          className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-400"
                        >
                          + Log {currentDay.aiCoach.prescription.recommendedMeal.name}
                        </button>
                      )}
                      {currentDay.aiCoach.prescription.recommendedExercise && (
                        <button
                          type="button"
                          onClick={() =>
                            handleApplyRecommendedExercise(
                              currentDay.aiCoach!.prescription!.recommendedExercise!
                            )
                          }
                          className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-400"
                        >
                          + Add {currentDay.aiCoach.prescription.recommendedExercise.name}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid gap-3 lg:grid-cols-2">
                  <form onSubmit={handleSmartLogSubmit} className="space-y-2">
                    <label
                      htmlFor="smart-log-input"
                      className="block text-xs font-bold text-sky-400"
                    >
                      Natural-Language Smart Logger
                    </label>
                    <textarea
                      ref={smartLogTextareaRef}
                      id="smart-log-input"
                      value={smartLogInput}
                      onChange={(e) => {
                        setSmartLogInput(e.target.value);
                        if (smartLogError) setSmartLogError("");
                      }}
                      onKeyDown={handleTextareaKeyDown}
                      placeholder='e.g. "Did 4x8 Squats 82.5kg and drank a 30g whey shake (240 kcal)"'
                      className="auto-grow-textarea rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 text-xs focus:border-sky-500 focus:outline-none"
                    />
                    {smartLogError && (
                      <p role="alert" className="text-xs text-rose-400">
                        {smartLogError}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={geminiLoadingMode !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-60"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {geminiLoadingMode === "smart-log"
                          ? "Parsing..."
                          : "Smart Log"}
                      </span>
                    </button>
                  </form>

                  <form onSubmit={handleCoachSubmit} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="coach-chat-input"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400"
                      >
                        <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>AI Recovery Coach</span>
                      </label>
                      {(currentDay.aiCoach?.messages?.length || 0) > 0 && (
                        <button
                          type="button"
                          onClick={handleResetCoachThread}
                          className="text-[11px] text-[var(--text-muted)] hover:text-emerald-400"
                        >
                          New Thread
                        </button>
                      )}
                    </div>

                    {(currentDay.aiCoach?.messages?.length || 0) > 0 && (
                      <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-xs">
                        {currentDay.aiCoach!.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`rounded-lg px-2 py-1.5 ${
                              msg.role === "user"
                                ? "bg-emerald-500/10 border border-emerald-500/30"
                                : "bg-[var(--bg-surface)]"
                            }`}
                          >
                            <span className="font-bold">
                              {msg.role === "user" ? "You: " : "Coach: "}
                            </span>
                            <span className="whitespace-pre-wrap">{msg.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <textarea
                      ref={coachTextareaRef}
                      id="coach-chat-input"
                      value={coachInput}
                      onChange={(e) => {
                        setCoachInput(e.target.value);
                        if (coachError) setCoachError("");
                      }}
                      onKeyDown={handleTextareaKeyDown}
                      placeholder="Ask about recovery, protein gaps, or progression..."
                      className="auto-grow-textarea rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                    {coachError && (
                      <p role="alert" className="text-xs text-rose-400">
                        {coachError}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={geminiLoadingMode !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-60"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {geminiLoadingMode === "coach"
                          ? "Thinking..."
                          : "Ask Coach"}
                      </span>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* SUB-PAGE 4C: HISTORY & TRENDS + COLLAPSIBLE ABOUT US */}
            {(desktopFullView || moreSubPage === "trends") && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold">
                      <History className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                      <span>History &amp; Trends</span>
                    </span>
                    <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5 text-[11px]">
                      {([7, 14, 30] as const).map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setHistoryWindowDays(days)}
                          className={`rounded-md px-2.5 py-1 font-bold ${
                            historyWindowDays === days
                              ? "bg-emerald-500 text-slate-950"
                              : "text-[var(--text-muted)]"
                          }`}
                        >
                          {days}d
                        </button>
                      ))}
                    </div>
                  </div>

                  {periodSummary.loggedDaysCount === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      No logged days between {periodSummary.startDate} and{" "}
                      {periodSummary.endDate} yet. Log workouts, food, or sleep
                      to track multi-day averages and lift progression.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-2.5">
                          <div className="text-[10px] text-sky-400 font-bold">
                            Workouts ({historyWindowDays}d)
                          </div>
                          <div className="text-lg font-extrabold tabular-nums">
                            {periodSummary.workoutDaysCount} sessions
                          </div>
                        </div>
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5">
                          <div className="text-[10px] text-amber-400 font-bold">
                            Avg Fuel / Day
                          </div>
                          <div className="text-lg font-extrabold tabular-nums">
                            {periodSummary.avgCalories} kcal
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {periodSummary.avgProtein}g Protein
                          </div>
                        </div>
                        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-2.5">
                          <div className="text-[10px] text-indigo-400 font-bold">
                            Avg Sleep
                          </div>
                          <div className="text-lg font-extrabold tabular-nums">
                            {periodSummary.avgSleepHours}h
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {periodSummary.avgSleepQuality}/10 quality
                          </div>
                        </div>
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                          <div className="text-[10px] text-emerald-400 font-bold">
                            Avg Readiness
                          </div>
                          <div className="text-lg font-extrabold tabular-nums">
                            {periodSummary.avgReadinessScore}%
                          </div>
                        </div>
                      </div>

                      {periodSummary.exerciseProgression.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-bold text-sky-400">
                            Top Exercise Progression
                          </div>
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {periodSummary.exerciseProgression
                              .slice(0, 6)
                              .map((ex) => (
                                <div
                                  key={ex.name}
                                  className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs"
                                >
                                  <span className="font-semibold truncate">
                                    {ex.name}
                                  </span>
                                  <span className="font-bold text-emerald-400 tabular-nums shrink-0">
                                    {ex.latestWeight} {profile.weightUnit} ×{" "}
                                    {ex.latestReps}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        {periodSummary.dailyRows.slice(0, 7).map((row) => (
                          <div
                            key={row.date}
                            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-mono font-bold text-emerald-400">
                                {row.date}
                              </span>{" "}
                              <span className="text-[var(--text-muted)]">
                                · {row.readinessScore}% · {row.totalSets} sets ·{" "}
                                {row.calories} kcal · {row.sleepHours}h
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDate(row.date);
                                setActiveScreen("home");
                                setHomeSubPage("summary");
                              }}
                              className="shrink-0 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400"
                            >
                              Open
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Collapsible About Us & Industry Market Research */}
                <details className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-3">
                  <summary className="flex items-center justify-between gap-2 cursor-pointer list-none text-xs font-bold">
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                      <span>
                        About Us · Industry Market Research &amp; Clinical Best Practices Applied
                      </span>
                    </span>
                    <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                  </summary>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-3 text-xs text-[var(--text-muted)] leading-relaxed">
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-1">
                      <div className="font-bold text-emerald-400">
                        Strain-to-Sleep Sufficiency
                      </div>
                      <p>
                        Connects daily muscular strain (0–21) to required sleep hours, deep sleep repair, and 70 kg physiological HRV/RHR calibration without requiring expensive hardware.
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-1">
                      <div className="font-bold text-amber-400">
                        ICMR-NIN India &amp; USDA Global
                      </div>
                      <p>
                        Verified Indian kitchen staples and global foods with gram-weighted portions, auto-learned 1-tap Favs, and instant macro totals.
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-1">
                      <div className="font-bold text-sky-400">
                        Hardened Private Capability URLs
                      </div>
                      <p>
                        Zero-password onboarding with 50-bit cryptographic workspace URLs, cloud auto-save, and instant multi-day History &amp; Trends.
                      </p>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </section>
        )}
      </main>

      {/* =========================================================
          STICKY THUMB-FRIENDLY 4-TAB BOTTOM NAVIGATION BAR
         ========================================================= */}
      {!desktopFullView && (
        <nav
          aria-label="Primary Mobile Navigation"
          className="mobile-bottom-nav fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md"
        >
          <div className="mx-auto max-w-4xl grid grid-cols-4 gap-1 px-2 pt-1.5">
            {(
              [
                {
                  id: "home",
                  label: "1. Home",
                  Icon: Home,
                  activeClass:
                    "border-indigo-500/45 bg-indigo-500/15 text-indigo-400",
                },
                {
                  id: "workouts",
                  label: "2. Workouts",
                  Icon: Dumbbell,
                  activeClass: "border-sky-500/45 bg-sky-500/15 text-sky-400",
                },
                {
                  id: "nutrition",
                  label: "3. Nutrition",
                  Icon: Apple,
                  activeClass:
                    "border-amber-500/45 bg-amber-500/15 text-amber-400",
                },
                {
                  id: "more",
                  label: "4. Habits & AI",
                  Icon: ListChecks,
                  activeClass:
                    "border-purple-500/45 bg-purple-500/15 text-purple-400",
                },
              ] as const
            ).map(({ id, label, Icon, activeClass }) => {
              const isActive = activeScreen === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setActiveScreen(id)}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border py-1.5 text-[11px] font-bold transition ${
                    isActive
                      ? activeClass
                      : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* =========================================================
          100-HABIT CATALOG & CUSTOM TRACKER PICKER DIALOG
         ========================================================= */}
      <dialog
        ref={habitCatalogDialogRef}
        aria-labelledby="habit-catalog-title"
        {...({ closedby: "any" } as Record<string, string>)}
        onClose={() => {
          if (habitCatalogDialogRef.current) {
            habitCatalogDialogRef.current.returnValue = "";
          }
          setShowHabitCatalogDialog(false);
        }}
        onPointerDown={(e) => {
          if (!("closedBy" in HTMLDialogElement.prototype)) {
            habitPressedOutsideRef.current = isPointerOutsideDialog(
              e,
              habitCatalogDialogRef.current
            );
          }
        }}
        onPointerUp={(e) => {
          if (
            !("closedBy" in HTMLDialogElement.prototype) &&
            habitPressedOutsideRef.current &&
            isPointerOutsideDialog(e, habitCatalogDialogRef.current)
          ) {
            setShowHabitCatalogDialog(false);
          }
          habitPressedOutsideRef.current = false;
        }}
        className="habit-catalog-dialog shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 bg-[var(--bg-elevated)]/70">
          <div>
            <h2 id="habit-catalog-title" className="text-sm sm:text-base font-bold">
              Customize Daily Journal ({allHabitDefinitions.length} Available)
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Pick habits for your daily journal ({activeHabits.length} active).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowHabitCatalogDialog(false)}
            aria-label="Close Habits Catalog"
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-3.5 border-b border-[var(--border-subtle)] space-y-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5">
            <Search className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search 100 habits catalog"
              value={habitSearchQuery}
              onChange={(e) => setHabitSearchQuery(e.target.value)}
              placeholder="Search creatine, magnesium, sauna, alcohol..."
              className="w-full bg-transparent text-xs focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                "All",
                "Supplements",
                "Sleep Hygiene",
                "Recovery",
                "Nutrition",
                "Lifestyle",
              ] as const
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setHabitCategoryFilter(cat)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  habitCategoryFilter === cat
                    ? "bg-purple-500 text-slate-950"
                    : "border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <form
            onSubmit={handleAddCustomHabit}
            className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-xs"
          >
            <input
              type="text"
              value={customHabitName}
              onChange={(e) => setCustomHabitName(e.target.value)}
              placeholder="Add custom habit..."
              className="flex-1 min-w-[130px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs"
            />
            <select
              aria-label="Custom Habit Category"
              value={customHabitCategory}
              onChange={(e) =>
                setCustomHabitCategory(e.target.value as HabitCategory)
              }
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
            >
              <option value="Supplements">Supplements</option>
              <option value="Sleep Hygiene">Sleep Hygiene</option>
              <option value="Recovery">Recovery</option>
              <option value="Nutrition">Nutrition</option>
              <option value="Lifestyle">Lifestyle</option>
            </select>
            <select
              aria-label="Custom Habit Input Type"
              value={customHabitType}
              onChange={(e) =>
                setCustomHabitType(e.target.value as "yes_no" | "dosage")
              }
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
            >
              <option value="yes_no">Yes / No</option>
              <option value="dosage">Dosage</option>
            </select>
            {customHabitType === "dosage" && (
              <>
                <input
                  type="text"
                  aria-label="Custom Habit Unit"
                  value={customHabitUnit}
                  onChange={(e) => setCustomHabitUnit(e.target.value)}
                  placeholder="unit"
                  className="w-14 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
                />
                <input
                  type="text"
                  aria-label="Custom Habit Default Amount"
                  value={customHabitDefault}
                  onChange={(e) => setCustomHabitDefault(e.target.value)}
                  placeholder="5"
                  className="w-12 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
                />
              </>
            )}
            <button
              type="submit"
              className="rounded-lg bg-purple-500 px-2.5 py-1 font-bold text-slate-950"
            >
              + Add
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 grid gap-2 sm:grid-cols-2">
          {allHabitDefinitions
            .filter((h) => {
              if (
                habitCategoryFilter !== "All" &&
                h.category !== habitCategoryFilter
              ) {
                return false;
              }
              if (!habitSearchQuery.trim()) return true;
              const q = habitSearchQuery.trim().toLowerCase();
              return (
                h.name.toLowerCase().includes(q) ||
                h.category.toLowerCase().includes(q)
              );
            })
            .map((habit) => {
              const activeIds =
                profile.activeHabitIds && profile.activeHabitIds.length > 0
                  ? profile.activeHabitIds
                  : DEFAULT_ACTIVE_HABIT_IDS;
              const isSelected = activeIds.includes(habit.id);
              return (
                <button
                  key={habit.id}
                  type="button"
                  onClick={() => toggleActiveHabit(habit.id)}
                  className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-left text-xs transition ${
                    isSelected
                      ? "border-purple-500/50 bg-purple-500/10"
                      : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{habit.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      {habit.category} ·{" "}
                      {habit.inputType === "yes_no"
                        ? "Yes / No"
                        : `Dosage (${habit.defaultValue || "1"} ${habit.unit || "units"})`}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isSelected
                        ? "bg-purple-500 text-slate-950"
                        : "border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]"
                    }`}
                  >
                    {isSelected ? "Active ✓" : "+ Track"}
                  </span>
                </button>
              );
            })}
        </div>

        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/70 px-4 py-3 flex justify-end">
          <button
            type="button"
            onClick={() => setShowHabitCatalogDialog(false)}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950"
          >
            Done ({activeHabits.length} Active)
          </button>
        </div>
      </dialog>

      {/* =========================================================
          CONSOLIDATED WORKSPACE, BACKUP & SHARING DIALOG
         ========================================================= */}
      <dialog
        ref={workspaceMenuDialogRef}
        aria-labelledby="workspace-menu-title"
        {...({ closedby: "any" } as Record<string, string>)}
        onClose={() => {
          if (workspaceMenuDialogRef.current) {
            workspaceMenuDialogRef.current.returnValue = "";
          }
          setShowWorkspaceMenu(false);
        }}
        onPointerDown={(e) => {
          if (!("closedBy" in HTMLDialogElement.prototype)) {
            workspacePressedOutsideRef.current = isPointerOutsideDialog(
              e,
              workspaceMenuDialogRef.current
            );
          }
        }}
        onPointerUp={(e) => {
          if (
            !("closedBy" in HTMLDialogElement.prototype) &&
            workspacePressedOutsideRef.current &&
            isPointerOutsideDialog(e, workspaceMenuDialogRef.current)
          ) {
            setShowWorkspaceMenu(false);
          }
          workspacePressedOutsideRef.current = false;
        }}
        className="workspace-menu-dialog shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/70 px-4 py-3.5">
          <div>
            <h2 id="workspace-menu-title" className="text-sm sm:text-base font-bold">
              Workspace, Backup &amp; Sharing
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              Private capability link, device spaces, and JSON backup
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWorkspaceMenu(false)}
            aria-label="Close Workspace Menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          {copyStatusText && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-400"
            >
              {copyStatusText}
            </div>
          )}

          {/* Section 1: My Private Link & Backup */}
          <section aria-label="My Private Link and Backup" className="rounded-xl border border-emerald-500/35 bg-[var(--bg-elevated)] p-3 space-y-2.5">
            <div>
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>My Private Link — keep for your own devices only</span>
              </div>
              <div className="mt-1 font-mono text-[11px] break-all text-[var(--text-muted)]">
                {getPrivateUrl()}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCopyPrivateLink()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Copy Private Link</span>
              </button>
              <a
                href={getWhatsAppPrivateHref()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  dismissLinkNudge(slug);
                  setLinkNudgeDismissed(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Send to My WhatsApp</span>
              </a>
              <button
                type="button"
                onClick={handleDownloadJsonBackup}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold hover:border-emerald-500/40 transition"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Download JSON Backup</span>
              </button>
            </div>
          </section>

          {/* Section 2: My Spaces */}
          <section aria-label="My Spaces" className="rounded-xl border border-indigo-500/35 bg-[var(--bg-elevated)] p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>My Spaces on This Device</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowWorkspaceMenu(false);
                  router.push("/?new=1");
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-indigo-400 transition"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                <span>Create New Space</span>
              </button>
            </div>

            {savedSpaces.length > 0 && (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {savedSpaces.map((sp) => {
                  const isCurrent = sp.slug === slug;
                  return (
                    <button
                      key={sp.slug}
                      type="button"
                      onClick={() => {
                        setShowWorkspaceMenu(false);
                        if (!isCurrent) {
                          setActiveSlug(sp.slug);
                          router.push(`/u/${sp.slug}`);
                        }
                      }}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                        isCurrent
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-indigo-400/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold truncate">{sp.displayName}</div>
                        <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                          /u/{sp.slug}
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold text-emerald-400">
                        {isCurrent ? "Active" : "Switch →"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleVerifyAndOpenSpace(
                  existingSpaceInput,
                  setExistingSpaceError,
                  setCheckingSpaceLink
                );
              }}
              className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-2.5"
            >
              <Link2 className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
              <input
                type="text"
                aria-label="Open an existing private link"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Open existing link or slug..."
                value={existingSpaceInput}
                onChange={(e) => {
                  setExistingSpaceInput(e.target.value);
                  setExistingSpaceError("");
                }}
                className="flex-1 min-w-[160px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-mono"
              />
              <button
                type="submit"
                disabled={checkingSpaceLink}
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
              >
                {checkingSpaceLink ? "Checking..." : "Open Link"}
              </button>
              {existingSpaceError && (
                <p role="alert" className="w-full text-[11px] font-medium text-rose-400">
                  {existingSpaceError}
                </p>
              )}
            </form>
          </section>

          {/* Section 3: Invite a Friend */}
          <section aria-label="Invite a Friend" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sky-400 flex items-center gap-1.5">
                <Share2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Invite a Friend</span>
              </div>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                Copies the fresh sign-up link so friends get their own private space without accessing yours.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleInviteFriend()}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Copy Invite Link</span>
            </button>
          </section>
        </div>
      </dialog>
    </div>
  );
}
