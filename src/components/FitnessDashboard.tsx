"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  ChevronUp,
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
  Search,
  Scale,
  Utensils,
  ShieldCheck,
  History,
  Pin,
  Copy,
  Calendar,
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
  computeUserFrequentStaples,
  UserFrequentStaple,
} from "@/lib/historyAndStaples";

interface FitnessDashboardProps {
  initialSlug?: string;
}

type ActiveTab =
  | "all"
  | "workout"
  | "nutrition"
  | "sleep"
  | "history"
  | "research";

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
}

/**
 * Controlled decimal/integer input that preserves raw user typing (e.g. "1.", "1.2", "0.5")
 * while focused and normalizes/clamps only on commit or valid parse.
 */
function DecimalInput({
  value,
  onValueChange,
  min = 0,
  max,
  allowDecimal = true,
  emptyAsZero = true,
  onFocus,
  onBlur,
  ...rest
}: DecimalInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>(
    Number.isFinite(value) ? String(value) : "0"
  );

  useEffect(() => {
    if (!focused) {
      setDraft(Number.isFinite(value) ? String(value) : "0");
    }
  }, [value, focused]);

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
      value={focused ? draft : Number.isFinite(value) ? String(value) : "0"}
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
        setDraft(String(committed));
        onBlur?.(e);
      }}
    />
  );
}

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

  // Open Food Search & Portion Customizer state (Global USDA + Indian ICMR-NIN)
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

  const smartLogTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const coachTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);
  const hasUserEditedRef = useRef(false);
  const latestProfileRef = useRef<UserProfileStore>(profile);

  useEffect(() => {
    latestProfileRef.current = profile;
  }, [profile]);

  // Sync theme override with <meta name="color-scheme"> and cross-tab storage events
  useEffect(() => {
    const applyScheme = (scheme: "dark" | "light") => {
      setColorSchemeOverride(scheme);
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) {
        meta.setAttribute("content", scheme);
      }
    };
    try {
      const stored = localStorage.getItem("color-scheme") as
        | "dark"
        | "light"
        | null;
      applyScheme(stored === "light" ? "light" : "dark");
    } catch {
      // ignore storage restrictions
    }
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "color-scheme" && (e.newValue === "light" || e.newValue === "dark")) {
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
    if (meta) {
      meta.setAttribute("content", nextScheme);
    }
    try {
      localStorage.setItem("color-scheme", nextScheme);
    } catch {
      // ignore
    }
  };

  // Load initial profile from Cloud API + LocalStorage fallback without clobbering active user edits
  useEffect(() => {
    let cancelled = false;
    hasUserEditedRef.current = false;
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
          if (!cancelled && data?.profile) {
            const serverProfile = data.profile as UserProfileStore;
            setStorageSource(data.source || "cloud");

            // Never clobber edits typed while fetch was in-flight
            if (hasUserEditedRef.current) {
              return;
            }

            const localTs = localData?.updatedAt
              ? Date.parse(localData.updatedAt) || 0
              : 0;
            const serverTs = serverProfile?.updatedAt
              ? Date.parse(serverProfile.updatedAt) || 0
              : 0;

            if (
              localData &&
              localData.updatedAt &&
              (data.source === "default" || localTs > serverTs)
            ) {
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

  const flushSaveNow = useCallback(
    async (profileOverride?: UserProfileStore, keepalive = false) => {
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
    [slug]
  );

  // Flush pending local edits on tab close / mobile Safari backgrounding
  useEffect(() => {
    const handlePageHide = () => {
      if (hasUserEditedRef.current || saveTimerRef.current) {
        void flushSaveNow(latestProfileRef.current, true);
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [flushSaveNow]);

  // Debounced auto-save on any profile state change
  const triggerAutoSave = useCallback(
    (nextProfile: UserProfileStore) => {
      hasUserEditedRef.current = true;
      latestProfileRef.current = nextProfile;
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

      saveTimerRef.current = setTimeout(() => {
        void flushSaveNow(nextProfile);
      }, 320);
    },
    [slug, flushSaveNow]
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

        // If useMealSum is enabled, recalculate daily calories, macros, fiber & hydration from meals
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

  // Workout helpers with automatic progressive overload carryover from prior sessions
  const addExercise = (presetName = "", presetGroup = "Strength") => {
    const prev = presetName
      ? findPreviousExerciseSets(profile, selectedDate, presetName)
      : null;
    const carriedSets: ExerciseSet[] =
      prev && prev.sets.length > 0
        ? prev.sets.map((s, idx) => ({
            id: `s-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            completed: true,
          }))
        : [{ id: `s-${Date.now()}`, weight: 40, reps: 10, rpe: 8, completed: true }];

    const newEx: WorkoutExercise = {
      id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: presetName || "New Exercise",
      muscleGroup: presetGroup,
      note: prev ? `Carried over from ${prev.sourceDate}` : "",
      sets: carriedSets,
    };
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        exercises: [...d.workout.exercises, newEx],
      },
    }));
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
    }));
    setFoodSearchMessage(
      `Added ${newMeal.name} (${calc.totalGrams}g · ${calc.calories} kcal, ${Math.round(calc.protein)}g P, ${calc.fiberGrams}g fiber, ${calc.waterLiters}L water) and updated daily totals.`
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
        `Loaded standardized macros for "${fetched.name}" (${fetched.source}). Select portion/grams below and click Add Food.`
      );
    } catch (err) {
      setFoodSearchMessage(
        err instanceof Error ? err.message : "Failed to look up custom food."
      );
    } finally {
      setFoodSearchLoading(false);
    }
  };

  // Sleep 70 kg Indian male auto-approximation helper (supports 0-23h decimals)
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
        meals: [...d.nutrition.meals, meal],
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

  // Gemini Interactions API helpers (wired to /api/gemini for /, /u/[slug])
  const handleTextareaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (e.nativeEvent.isComposing || e.keyCode === 229) {
        return;
      }
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
        `Gemini (${data.model || geminiModel}) generated recovery prescription: ${prescription.headline}`
      );
    } catch (err) {
      setGeminiStatusMessage(
        err instanceof Error ? err.message : "Failed to run Gemini optimizer."
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
      note: meal.note || "Added from Gemini Prescription",
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
    setGeminiStatusMessage(
      `Logged recommended meal "${newMeal.name}" (${newMeal.calories} kcal, ${newMeal.protein}g P).`
    );
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
      completed: true,
    }));
    const newExercise: WorkoutExercise = {
      id: `ex-${stamp}-${Math.random().toString(36).slice(2, 5)}`,
      name: ex.name,
      muscleGroup: ex.muscleGroup || "Strength",
      sets,
      note: ex.note || "Added from Gemini Prescription",
    };
    updateCurrentDay((d) => ({
      ...d,
      workout: {
        ...d.workout,
        exercises: [...d.workout.exercises, newExercise],
      },
    }));
    setGeminiStatusMessage(
      `Added exercise "${newExercise.name}" (${numSets} sets) to Workouts.`
    );
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
      setCoachError("Enter a question for your Gemini coach.");
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
        throw new Error(data?.error || "Gemini coach request failed.");
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
        `Gemini coach (${data.model || geminiModel}) replied.`
      );
    } catch (err) {
      setCoachError(
        err instanceof Error ? err.message : "Failed to reach Gemini coach."
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
    setGeminiStatusMessage("Started a fresh Gemini Interactions thread.");
  };

  const analysis = calculateSufficiencyAnalysis(currentDay, profile);

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

  const isTodayBlank = !isDailyEntryLogged(currentDay);

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
          </div>

          {/* Expandable Per-User Custom URL Bar */}
          {showSlugSwitcher && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-[var(--bg-elevated)] p-2.5 text-xs">
              <div className="text-[var(--text-muted)]">
                Every custom URL gets its own isolated auto-saved profile (e.g.{" "}
                <code className="text-emerald-400">/u/rahul</code>,{" "}
                <code className="text-emerald-400">/u/client-ananya</code>):
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
          <div className="mt-2.5 flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            {/* Date Picker */}
            <div className="flex items-center justify-between sm:justify-start gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
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
              className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1"
            >
              {(
                [
                  { id: "all", label: "All Modules" },
                  { id: "workout", label: "1. Workouts" },
                  { id: "nutrition", label: "2. Nutrition" },
                  { id: "sleep", label: "3. Sleep & Recovery" },
                  { id: "history", label: "History & Trends" },
                  { id: "research", label: "About Us" },
                ] as { id: ActiveTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
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

      <main className="mx-auto max-w-5xl space-y-5 px-3.5 pt-4 sm:px-6 sm:pt-5">
        {/* TOP DAILY RECOVERY & SUFFICIENCY SUMMARY (Hidden on About Us & History tabs) */}
        {(activeTab === "all" ||
          activeTab === "workout" ||
          activeTab === "nutrition" ||
          activeTab === "sleep") && (
          <section
            aria-label="Daily Sufficiency and Readiness Summary"
            className={`rounded-2xl border p-4 sm:p-5 transition ${
              isTodayBlank
                ? "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
                : analysis.verdictLevel === "optimal"
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
                      ? "Optimal Recovery Loop"
                      : analysis.verdictLevel === "moderate"
                      ? "Borderline Sufficiency"
                      : "Recovery / Fueling Deficit"}
                  </span>

                  <span className="text-xs text-[var(--text-muted)]">
                    Daily Check-In · {selectedDate}
                  </span>
                </div>

                <h1 className="text-lg font-bold tracking-tight sm:text-xl">
                  {isTodayBlank
                    ? "Start logging today's workouts, meals, or sleep"
                    : analysis.verdictHeadline}
                </h1>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                  {isTodayBlank
                    ? "Nothing is pre-filled. Add your lifts, search your food or tap one of your frequent staples, and enter last night's sleep hours to compute Readiness & Recovery."
                    : analysis.verdictExplanation}
                </p>
              </div>

              {/* 4 Key Summary Gauges */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 shrink-0">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-center">
                  <div className="text-[11px] font-medium text-[var(--text-muted)]">
                    Readiness
                  </div>
                  <div className="mt-0.5 text-xl font-extrabold tabular-nums text-emerald-400">
                    {analysis.readinessScore}%
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    Sleep + Strain + Fuel
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-center">
                  <div className="text-[11px] font-medium text-[var(--text-muted)]">
                    Gym Strain
                  </div>
                  <div className="mt-0.5 text-xl font-extrabold tabular-nums text-sky-400">
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
                  <div className="mt-0.5 text-xl font-extrabold tabular-nums text-indigo-400">
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
                    Fuel &amp; Protein
                  </div>
                  <div className="mt-0.5 text-xl font-extrabold tabular-nums text-amber-400">
                    {currentDay.nutrition.calories}
                    <span className="text-xs font-normal text-[var(--text-muted)]">
                      {" "}kcal
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    Protein: <strong className="text-[var(--text-primary)]">{currentDay.nutrition.protein}g</strong> / {currentDay.nutrition.proteinTarget}g
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Pillar Checks: Sleep vs Training Load, Deep Sleep Repair, Fuel & Protein */}
            <div className="mt-3.5 grid gap-2 sm:grid-cols-3">
              {Object.entries(analysis.clinicalPillarChecks).map(
                ([key, check]) => (
                  <div
                    key={key}
                    className="flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 p-2.5 text-xs"
                  >
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
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

            {/* Daily Master Note (Auto-Saved + Explicit Cloud Flush on Blur) */}
            <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <label
                  htmlFor="daily-master-note"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)]"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Daily Summary Comment / Check-In</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {syncState === "saving"
                      ? "Saving..."
                      : syncState === "local-only"
                      ? "Saved on device"
                      : lastSavedTimeLabel
                      ? `Saved ${lastSavedTimeLabel}`
                      : "Auto-saved"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void flushSaveNow()}
                    className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-semibold text-emerald-400 hover:border-emerald-500/40 transition"
                  >
                    Save Note
                  </button>
                </div>
              </div>
              <textarea
                id="daily-master-note"
                rows={1}
                aria-label="Daily Master Note"
                placeholder="Type a general daily comment, energy check-in, soreness, or coaching reminder..."
                value={currentDay.dailyNote}
                onChange={(e) =>
                  updateCurrentDay((d) => ({ ...d, dailyNote: e.target.value }))
                }
                onBlur={() => void flushSaveNow()}
                className="auto-grow-textarea w-full bg-transparent text-xs sm:text-sm focus:outline-none"
              />
            </div>
          </section>
        )}

        {/* =========================================================
            GEMINI INTERACTIONS API AI HUB (Per-URL & Per-Date Stateful Coach)
           ========================================================= */}
        {activeTab === "all" && (
          <section
            id="gemini-ai-hub"
            aria-labelledby="heading-gemini-hub"
            className="rounded-2xl border border-emerald-500/30 bg-[var(--bg-surface)] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="heading-gemini-hub"
                    className="text-base font-bold sm:text-lg"
                  >
                    Gemini Interactions AI Hub
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Stateful Gemini 4 coaching, smart logging &amp; recovery prescriptions synced to{" "}
                    <code className="text-emerald-400">/u/{slug}</code>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAiHub((v) => !v)}
                  aria-expanded={showAiHub}
                  aria-controls="gemini-ai-hub-body"
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                >
                  {showAiHub ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Collapse</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Expand AI Hub</span>
                    </>
                  )}
                </button>

                <fieldset className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5">
                  <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Model
                  </legend>
                  <div className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      id="model-hydrogen"
                      name="geminiModel"
                      value="gemini-4-hydrogen"
                      checked={geminiModel === "gemini-4-hydrogen"}
                      onChange={() => setGeminiModel("gemini-4-hydrogen")}
                      className="h-3.5 w-3.5 accent-emerald-500"
                    />
                    <label
                      htmlFor="model-hydrogen"
                      className="text-xs font-medium cursor-pointer"
                    >
                      gemini-4-hydrogen
                    </label>
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      id="model-argon"
                      name="geminiModel"
                      value="gemini-4-argon"
                      checked={geminiModel === "gemini-4-argon"}
                      onChange={() => setGeminiModel("gemini-4-argon")}
                      className="h-3.5 w-3.5 accent-emerald-500"
                    />
                    <label
                      htmlFor="model-argon"
                      className="text-xs font-medium cursor-pointer"
                    >
                      gemini-4-argon
                    </label>
                  </div>
                </fieldset>

                <button
                  type="button"
                  onClick={handleOptimizeDay}
                  disabled={geminiLoadingMode !== null}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 transition"
                >
                  {geminiLoadingMode === "optimize-day" ? (
                    <>
                      <RefreshCw
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Optimize Day with Gemini</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {showAiHub && (
              <div id="gemini-ai-hub-body" className="space-y-4">
                {/* Crystal-Clear Background Workflow Explainer */}
                <div className="grid gap-2 sm:grid-cols-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/70 p-3 text-[11px] leading-relaxed">
                  <div>
                    <span className="font-bold text-emerald-400">
                      1. Optimize Day with Gemini:
                    </span>{" "}
                    Reads today&apos;s workouts, protein/calories &amp; sleep debt on{" "}
                    <code className="text-[var(--text-primary)]">/api/gemini</code> and generates 3 actionable priorities plus 1-click meal &amp; recovery finishers.
                  </div>
                  <div>
                    <span className="font-bold text-sky-400">
                      2. Natural-Language Smart Logger:
                    </span>{" "}
                    Type plain text like &ldquo;4x8 Squats 90kg + paneer bowl 520 kcal&rdquo;; parses sets, macros, cardio &amp; sleep directly into today&apos;s logs.
                  </div>
                  <div>
                    <span className="font-bold text-indigo-400">
                      3. Stateful Gemini Coach:
                    </span>{" "}
                    Multi-turn recovery chat chained via{" "}
                    <code>previous_interaction_id</code>. Runs Gemini 4 live when API key is set, or automatic local calculation fallback offline.
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

            {/* Recovery Prescription Output (from Optimize Day) */}
            {currentDay.aiCoach?.prescription && (
              <div className="rounded-xl border border-emerald-500/30 bg-[var(--bg-elevated)] p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                      Daily Recovery Prescription
                    </div>
                    <h3 className="text-sm font-bold sm:text-base">
                      {currentDay.aiCoach.prescription.headline}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)] max-w-full">
                    {currentDay.aiCoach.prescription.model && (
                      <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono">
                        {currentDay.aiCoach.prescription.model}
                      </span>
                    )}
                    {currentDay.aiCoach.prescription.interactionId && (
                      <span
                        title={currentDay.aiCoach.prescription.interactionId}
                        className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono truncate max-w-[160px]"
                      >
                        {currentDay.aiCoach.prescription.interactionId}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                  {currentDay.aiCoach.prescription.summary}
                </p>

                {currentDay.aiCoach.prescription.actionItems?.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 text-xs text-[var(--text-primary)]">
                    {currentDay.aiCoach.prescription.actionItems.map(
                      (item, idx) => (
                        <li key={idx}>{item}</li>
                      )
                    )}
                  </ul>
                )}

                <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
                  {currentDay.aiCoach.prescription.recommendedMeal && (
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-amber-400">
                            Recommended Recovery Meal
                          </div>
                          <div className="text-xs font-bold">
                            {currentDay.aiCoach.prescription.recommendedMeal.name}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleApplyRecommendedMeal(
                              currentDay.aiCoach!.prescription!.recommendedMeal!
                            )
                          }
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/25 transition"
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" />
                          <span>Log Recommended Meal</span>
                        </button>
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {currentDay.aiCoach.prescription.recommendedMeal.calories} kcal ·{" "}
                        {currentDay.aiCoach.prescription.recommendedMeal.protein}g P ·{" "}
                        {currentDay.aiCoach.prescription.recommendedMeal.carbs}g C ·{" "}
                        {currentDay.aiCoach.prescription.recommendedMeal.fats}g F
                      </div>
                    </div>
                  )}

                  {currentDay.aiCoach.prescription.recommendedExercise && (
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-sky-400">
                            Recommended Exercise
                          </div>
                          <div className="text-xs font-bold">
                            {currentDay.aiCoach.prescription.recommendedExercise.name}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleApplyRecommendedExercise(
                              currentDay.aiCoach!.prescription!.recommendedExercise!
                            )
                          }
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-400 hover:bg-sky-500/25 transition"
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" />
                          <span>Add Recommended Exercise</span>
                        </button>
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {currentDay.aiCoach.prescription.recommendedExercise.sets} sets ×{" "}
                        {currentDay.aiCoach.prescription.recommendedExercise.reps} reps @{" "}
                        {currentDay.aiCoach.prescription.recommendedExercise.weight}{" "}
                        {profile.weightUnit}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2-Column Interactive Tools: Smart Logger + Stateful Coach */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Smart Logger Form */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-3 min-w-0">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-sky-400" aria-hidden="true" />
                  <h3
                    id="heading-smart-logger"
                    className="text-sm font-bold"
                  >
                    Natural-Language Smart Logger
                  </h3>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setSmartLogInput(
                        "Did 4x8 Barbell Squats at 90kg and drank a 40g protein shake (320 kcal)"
                      )
                    }
                    className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] hover:text-sky-400 hover:border-sky-500/40 transition"
                  >
                    Sample: Squat + Shake
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSmartLogInput(
                        "Added 20 min Zone 2 walk and 0.5h extra sleep"
                      )
                    }
                    className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] hover:text-sky-400 hover:border-sky-500/40 transition"
                  >
                    Sample: Cardio + Sleep
                  </button>
                </div>

                <form
                  aria-labelledby="heading-smart-logger"
                  onSubmit={handleSmartLogSubmit}
                  className="space-y-2"
                >
                  <label
                    htmlFor="smart-log-input"
                    className="block text-xs font-medium text-[var(--text-muted)]"
                  >
                    Describe workouts, meals, or sleep updates
                  </label>
                  <textarea
                    ref={smartLogTextareaRef}
                    id="smart-log-input"
                    name="smartLog"
                    value={smartLogInput}
                    onChange={(e) => {
                      setSmartLogInput(e.target.value);
                      if (smartLogError) setSmartLogError("");
                    }}
                    onKeyDown={handleTextareaKeyDown}
                    aria-invalid={Boolean(smartLogError)}
                    aria-describedby={
                      smartLogError ? "smart-log-error" : "smart-log-hint"
                    }
                    placeholder="e.g., Did 3x10 Romanian Deadlift at 80kg and ate a chicken bowl (650 kcal, 52g protein)"
                    className="auto-grow-textarea rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-xs sm:text-sm focus:border-sky-500 focus:outline-none"
                  />
                  <p
                    id="smart-log-hint"
                    className="text-[11px] text-[var(--text-muted)]"
                  >
                    Press Enter to log with Gemini · Shift+Enter for a new line.
                  </p>
                  {smartLogError && (
                    <p
                      id="smart-log-error"
                      role="alert"
                      className="text-xs font-medium text-rose-400"
                    >
                      {smartLogError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={geminiLoadingMode !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60 transition"
                  >
                    {geminiLoadingMode === "smart-log" ? (
                      <>
                        <RefreshCw
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                        <span>Parsing...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Smart Log to /u/{slug}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Stateful Gemini Coach Form */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-3 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bot
                      className="h-4 w-4 text-emerald-400"
                      aria-hidden="true"
                    />
                    <h3
                      id="heading-coach-chat"
                      className="text-sm font-bold"
                    >
                      Stateful Gemini Coach
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentDay.aiCoach?.lastInteractionId && (
                      <span
                        title={currentDay.aiCoach.lastInteractionId}
                        className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-mono text-[var(--text-muted)] truncate max-w-[120px]"
                      >
                        {currentDay.aiCoach.lastInteractionId}
                      </span>
                    )}
                    {(currentDay.aiCoach?.messages?.length || 0) > 0 && (
                      <button
                        type="button"
                        onClick={handleResetCoachThread}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-emerald-400 transition"
                      >
                        <RotateCcw className="h-3 w-3" aria-hidden="true" />
                        <span>New Thread</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Conversation Thread */}
                <div className="max-h-56 overflow-y-auto space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                  {!currentDay.aiCoach?.messages?.length ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      Ask about today&apos;s {analysis.strainScore}/21 strain,
                      how much protein/sleep you still need, or progression for{" "}
                      <code className="text-emerald-400">/u/{slug}</code>. Follow-ups automatically chain via{" "}
                      <code>previous_interaction_id</code>.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {currentDay.aiCoach.messages.map((msg) => (
                        <li
                          key={msg.id}
                          className={`rounded-lg px-2.5 py-2 text-xs leading-relaxed ${
                            msg.role === "user"
                              ? "border border-emerald-500/30 bg-emerald-500/10"
                              : "border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                          }`}
                        >
                          <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            <span>
                              {msg.role === "user" ? "You" : "Gemini Coach"}
                            </span>
                            {msg.model && <span>{msg.model}</span>}
                          </div>
                          <div className="whitespace-pre-wrap break-words">
                            {msg.text}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <form
                  aria-labelledby="heading-coach-chat"
                  onSubmit={handleCoachSubmit}
                  className="space-y-2"
                >
                  <label
                    htmlFor="coach-chat-input"
                    className="block text-xs font-medium text-[var(--text-muted)]"
                  >
                    Ask your Gemini coach (multi-turn memory)
                  </label>
                  <textarea
                    ref={coachTextareaRef}
                    id="coach-chat-input"
                    name="coachPrompt"
                    value={coachInput}
                    onChange={(e) => {
                      setCoachInput(e.target.value);
                      if (coachError) setCoachError("");
                    }}
                    onKeyDown={handleTextareaKeyDown}
                    aria-invalid={Boolean(coachError)}
                    aria-describedby={
                      coachError ? "coach-chat-error" : "coach-chat-hint"
                    }
                    placeholder="e.g., Is my 1.6h deep sleep enough for today's bench & pulldown volume?"
                    className="auto-grow-textarea rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <p
                    id="coach-chat-hint"
                    className="text-[11px] text-[var(--text-muted)]"
                  >
                    Press Enter to send · Shift+Enter for a new line.
                  </p>
                  {coachError && (
                    <p
                      id="coach-chat-error"
                      role="alert"
                      className="text-xs font-medium text-rose-400"
                    >
                      {coachError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={geminiLoadingMode !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 transition"
                  >
                    {geminiLoadingMode === "coach" ? (
                      <>
                        <RefreshCw
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                        <span>Thinking...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Ask Coach</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
              </div>
            )}
          </section>
        )}

        {/* =========================================================
            HISTORY & MULTI-DAY PERFORMANCE TRENDS (7d / 14d / 30d)
           ========================================================= */}
        {activeTab === "history" && (
          <section
            aria-labelledby="heading-history"
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <History className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="heading-history"
                    className="text-base font-bold sm:text-lg"
                  >
                    History &amp; Multi-Day Trends
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Consolidated performance across Workouts, Nutrition &amp; Sleep ending{" "}
                    <strong className="text-[var(--text-primary)]">{selectedDate}</strong>
                  </p>
                </div>
              </div>

              {/* Timeframe Switcher: Week / 2 Weeks / Month */}
              <div
                role="group"
                aria-label="History Timeframe"
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1"
              >
                {(
                  [
                    { days: 7, label: "7 Days (Week)" },
                    { days: 14, label: "14 Days (2 Weeks)" },
                    { days: 30, label: "30 Days (Month)" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => setHistoryWindowDays(opt.days)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      historyWindowDays === opt.days
                        ? "bg-emerald-500 text-slate-950"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {periodSummary.loggedDaysCount === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 text-center space-y-2">
                <div className="text-sm font-semibold">
                  No logged days found between {periodSummary.startDate} and {periodSummary.endDate}
                </div>
                <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                  Log workouts, meals, or sleep on any day and switch back here to inspect weekly, 2-week, and monthly averages, lift weight progression, and saved notes.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
                >
                  Log Today&apos;s Data
                </button>
              </div>
            ) : (
              <>
                {/* Consolidated KPI Grid */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                      Workouts ({historyWindowDays}d)
                    </div>
                    <div className="mt-1 text-2xl font-extrabold tabular-nums">
                      {periodSummary.workoutDaysCount} sessions
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {periodSummary.totalSets} sets · {periodSummary.totalReps} reps · {periodSummary.totalGymMinutes}m gym + {periodSummary.totalCardioMinutes}m cardio
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                      Nutrition Avg / Day
                    </div>
                    <div className="mt-1 text-2xl font-extrabold tabular-nums">
                      {periodSummary.avgCalories} kcal
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      Avg Protein: <strong className="text-[var(--text-primary)]">{periodSummary.avgProtein}g</strong> · Carbs {periodSummary.avgCarbs}g · Fats {periodSummary.avgFats}g ({periodSummary.proteinTargetHitDays}/{periodSummary.nutritionDaysCount} days &ge;90% goal)
                    </div>
                  </div>

                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
                      Sleep Avg / Night
                    </div>
                    <div className="mt-1 text-2xl font-extrabold tabular-nums">
                      {periodSummary.avgSleepHours}h · {periodSummary.avgSleepQuality}/10
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      Avg RHR: {periodSummary.avgRestingHr || "--"} bpm · Avg HRV: {periodSummary.avgHrvMs || "--"} ms
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                      Recovery Consistency
                    </div>
                    <div className="mt-1 text-2xl font-extrabold tabular-nums">
                      {periodSummary.avgReadinessScore}% avg
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {periodSummary.optimalDays} Optimal · {periodSummary.moderateDays} Moderate · {periodSummary.deficitDays} Deficit days
                    </div>
                  </div>
                </div>

                {/* Lift Progression Tracker */}
                {periodSummary.exerciseProgression.length > 0 && (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                        Top Exercise Progression ({periodSummary.startDate} to {periodSummary.endDate})
                      </h3>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Comparing first vs. latest top set
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {periodSummary.exerciseProgression.slice(0, 9).map((ex) => (
                        <div
                          key={ex.name}
                          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{ex.name}</div>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              {ex.sessionsCount} sessions · Latest {ex.latestDate}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold tabular-nums">
                              {ex.latestWeight} {profile.weightUnit} × {ex.latestReps}
                            </div>
                            <div
                              className={`text-[10px] font-semibold ${
                                ex.weightDelta > 0
                                  ? "text-emerald-400"
                                  : ex.weightDelta < 0
                                  ? "text-amber-400"
                                  : "text-[var(--text-muted)]"
                              }`}
                            >
                              {ex.weightDelta > 0
                                ? `+${ex.weightDelta} ${profile.weightUnit}`
                                : ex.weightDelta < 0
                                ? `${ex.weightDelta} ${profile.weightUnit}`
                                : `Matched ${ex.earliestWeight} ${profile.weightUnit}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Day-by-Day In-Depth Overview */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Day-by-Day Breakdown &amp; Saved Notes ({periodSummary.dailyRows.length} logged days)
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {periodSummary.dailyRows.map((row) => (
                      <div
                        key={row.date}
                        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-emerald-400">
                              {row.date}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                row.verdictLevel === "optimal"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : row.verdictLevel === "moderate"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-rose-500/20 text-rose-400"
                              }`}
                            >
                              Readiness {row.readinessScore}% · Strain {row.strainScore}/21
                            </span>
                            <span className="text-xs font-medium truncate max-w-[240px]">
                              {row.workoutTitle}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDate(row.date);
                              setActiveTab("all");
                            }}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
                          >
                            Open Day
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div className="rounded-lg bg-[var(--bg-surface)] px-2.5 py-1.5">
                            <span className="text-[var(--text-muted)]">Workouts: </span>
                            <strong>{row.totalSets} sets</strong> · {row.totalReps} reps · {row.gymMinutes + row.cardioMinutes}m
                          </div>
                          <div className="rounded-lg bg-[var(--bg-surface)] px-2.5 py-1.5">
                            <span className="text-[var(--text-muted)]">Fuel: </span>
                            <strong>{row.calories} kcal</strong> · {row.protein}g P ({row.mealsCount} meals)
                          </div>
                          <div className="rounded-lg bg-[var(--bg-surface)] px-2.5 py-1.5">
                            <span className="text-[var(--text-muted)]">Sleep: </span>
                            <strong>{row.sleepHours}h</strong> ({row.sleepQuality}/10) · HRV {row.hrvMs}ms
                          </div>
                        </div>

                        {row.allNotesSummary.length > 0 && (
                          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 space-y-1 text-[11px]">
                            {row.allNotesSummary.map((n, nIdx) => (
                              <div key={nIdx}>
                                <span className="font-semibold text-emerald-400">
                                  {n.area}:{" "}
                                </span>
                                <span className="text-[var(--text-muted)]">
                                  {n.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* =========================================================
            MODULE 1: WORKOUTS (Simple Exercise, Weight & Reps Tracker)
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
                    1. Workouts
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Simple Exercise, Weight &amp; Reps logger ·{" "}
                    <strong className="text-[var(--text-primary)]">
                      {analysis.totalSets} sets
                    </strong>{" "}
                    ({analysis.totalReps} completed reps)
                  </p>
                </div>
              </div>

              {/* Weight Unit Toggle + Previous Session Carryover + Add Exercise */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateProfileMeta((p) => ({
                      ...p,
                      weightUnit: p.weightUnit === "kg" ? "lbs" : "kg",
                    }))
                  }
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-semibold hover:border-sky-500/40"
                >
                  Unit: {profile.weightUnit.toUpperCase()}
                </button>
                {previousWorkoutSession && (
                  <button
                    type="button"
                    onClick={loadPreviousWorkoutIntoToday}
                    title={`Load ${previousWorkoutSession.sessionTitle} from ${previousWorkoutSession.sourceDate} with previous weights & reps`}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      Load Prev ({previousWorkoutSession.sourceDate.slice(5)})
                    </span>
                  </button>
                )}
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

            {/* Session Summary Inputs (Workout Split, Gym Time, Cardio) */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
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
              {currentDay.workout.exercises.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 text-center space-y-2">
                  <div className="text-xs sm:text-sm font-semibold">
                    No exercises logged yet for {selectedDate}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Tap a Quick Add movement above, add a custom exercise, or{" "}
                    {previousWorkoutSession
                      ? `load your previous session (${previousWorkoutSession.sessionTitle} from ${previousWorkoutSession.sourceDate}) to beat your previous weights and reps.`
                      : "enter your sets, weights, and reps to start progressive overload tracking."}
                  </p>
                  {previousWorkoutSession && (
                    <button
                      type="button"
                      onClick={loadPreviousWorkoutIntoToday}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        Carry Over {previousWorkoutSession.sessionTitle} (
                        {previousWorkoutSession.exercises.length} exercises)
                      </span>
                    </button>
                  )}
                </div>
              )}
              {currentDay.workout.exercises.map((exercise, exIdx) => {
                const prevSetsForEx = findPreviousExerciseSets(
                  profile,
                  selectedDate,
                  exercise.name
                );
                return (
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
                        className="hidden sm:block w-24 shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-center text-[11px] text-[var(--text-muted)]"
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

                  {prevSetsForEx && (
                    <div className="text-[11px] text-sky-400/90">
                      Previous ({prevSetsForEx.sourceDate}):{" "}
                      {prevSetsForEx.sets
                        .map((ps) => `${ps.weight}${profile.weightUnit}×${ps.reps}`)
                        .join(" · ")}
                    </div>
                  )}

                  {/* Crisp Mobile-First Set Grid (Set | Weight | Reps | Done) with zero wasted horizontal gaps */}
                  <div
                    role="region"
                    aria-label={`${exercise.name || `Exercise ${exIdx + 1}`} sets`}
                    className="max-w-md space-y-1.5"
                  >
                    <div className="grid grid-cols-[2.25rem_5.5rem_4.5rem_1fr] items-center gap-2 border-b border-[var(--border-subtle)] pb-1 text-[11px] font-medium text-[var(--text-muted)]">
                      <span>Set</span>
                      <span>Weight ({profile.weightUnit})</span>
                      <span>Reps</span>
                      <span className="text-left">Done</span>
                    </div>
                    <div className="divide-y divide-[var(--border-subtle)]/50">
                      {exercise.sets.map((s, sIdx) => (
                        <div
                          key={s.id}
                          className={`grid grid-cols-[2.25rem_5.5rem_4.5rem_1fr] items-center gap-2 py-1.5 text-xs ${
                            s.completed ? "" : "opacity-55"
                          }`}
                        >
                          <span className="font-semibold text-[var(--text-muted)] tabular-nums">
                            #{sIdx + 1}
                          </span>
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
                            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-center font-semibold tabular-nums focus:border-sky-400 focus:outline-none"
                          />
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
                            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-center font-semibold tabular-nums focus:border-sky-400 focus:outline-none"
                          />
                          <div className="flex items-center gap-2">
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
                                className="rounded p-1 text-sm text-[var(--text-muted)] hover:bg-rose-500/15 hover:text-rose-400"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
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
                      onBlur={() => void flushSaveNow()}
                      className="w-full rounded-lg border border-[var(--border-subtle)]/70 bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] focus:text-[var(--text-primary)] focus:outline-none"
                    />
                  </div>
                </div>
                );
              })}
            </div>

            {/* Overall Workout Session Note */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="workout-session-note"
                  className="block text-xs font-medium text-[var(--text-muted)]"
                >
                  Workout Session Notes &amp; Gym Summary
                </label>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Auto-saved &amp; visible in History
                </span>
              </div>
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
                onBlur={() => void flushSaveNow()}
                className="auto-grow-textarea w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs sm:text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </section>
        )}

        {/* =========================================================
            MODULE 2: NUTRITION & HEALTH METRICS (Open Food Search, Portion Selector, 6-Macro Totals)
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
                    2. Nutrition
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Open Global (USDA) &amp; Indian (ICMR-NIN) food search with portion weights — auto-sums Calories, Macros, Hydration &amp; Fiber
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

            {/* 2-Tier Visual Hierarchy: Primary (Calories + Protein) -> Secondary (Carbs, Fats, Hydration, Fiber) */}
            <div className="space-y-2.5">
              {/* Tier 1: Calories (Most Prominent) & Protein (2nd Prominent) */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {[
                  {
                    key: "calories",
                    targetKey: "calorieTarget",
                    label: "Total Calories",
                    unit: "kcal",
                    color: "bg-amber-400",
                    textColor: "text-amber-400",
                    cardBorder: "border-amber-500/40 bg-amber-500/5",
                    numberClass: "text-2xl sm:text-3xl font-extrabold",
                  },
                  {
                    key: "protein",
                    targetKey: "proteinTarget",
                    label: "Protein",
                    unit: "g",
                    color: "bg-emerald-400",
                    textColor: "text-emerald-400",
                    cardBorder: "border-emerald-500/35 bg-emerald-500/5",
                    numberClass: "text-xl sm:text-2xl font-extrabold",
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
                      className={`rounded-xl border p-3.5 space-y-2 ${item.cardBorder}`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[var(--text-primary)]">
                          {item.label}
                        </span>
                        <span className={item.textColor}>{pct}% of goal</span>
                      </div>

                      <div className="flex items-baseline gap-1.5">
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
                          className={`w-24 bg-transparent tabular-nums ${item.numberClass} ${item.textColor} focus:outline-none`}
                        />
                        <span className="text-xs text-[var(--text-muted)]">
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
                          className="w-16 bg-transparent text-sm font-semibold tabular-nums text-[var(--text-muted)] focus:outline-none"
                        />
                        <span className="text-xs text-[var(--text-muted)]">
                          {item.unit}
                        </span>
                      </div>

                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                        <div
                          className={`h-full rounded-full ${item.color} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tier 2: Compact Secondary Macros & Hydration / Fiber */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {
                    key: "carbs",
                    targetKey: "carbTarget",
                    label: "Carbs",
                    unit: "g",
                    color: "bg-sky-400",
                    textColor: "text-sky-400",
                    allowDecimal: false,
                  },
                  {
                    key: "fats",
                    targetKey: "fatTarget",
                    label: "Fats",
                    unit: "g",
                    color: "bg-purple-400",
                    textColor: "text-purple-400",
                    allowDecimal: false,
                  },
                  {
                    key: "waterLiters",
                    targetKey: "waterTargetLiters",
                    label: "Hydration",
                    unit: "L",
                    color: "bg-cyan-400",
                    textColor: "text-cyan-400",
                    allowDecimal: true,
                  },
                  {
                    key: "fiberGrams",
                    targetKey: "fiberTargetGrams",
                    label: "Fiber",
                    unit: "g",
                    color: "bg-teal-400",
                    textColor: "text-teal-400",
                    allowDecimal: true,
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
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                        <span>{item.label}</span>
                        <span>{pct}%</span>
                      </div>

                      <div className="flex items-baseline gap-1">
                        <DecimalInput
                          allowDecimal={item.allowDecimal}
                          min={0}
                          aria-label={`${item.label} Consumed (${item.unit})`}
                          value={val}
                          onValueChange={(nextVal) =>
                            updateCurrentDay((d) => ({
                              ...d,
                              nutrition: {
                                ...d.nutrition,
                                useMealSum: false,
                                [item.key]: item.allowDecimal
                                  ? Number(nextVal.toFixed(2))
                                  : Math.round(nextVal),
                              },
                            }))
                          }
                          onBlur={() => void flushSaveNow()}
                          className={`w-12 bg-transparent text-sm font-bold tabular-nums ${item.textColor} focus:outline-none`}
                        />
                        <span className="text-[10px] text-[var(--text-muted)]">
                          /
                        </span>
                        <DecimalInput
                          allowDecimal={item.allowDecimal}
                          min={0.5}
                          aria-label={`${item.label} Target (${item.unit})`}
                          value={target}
                          onValueChange={(nextTarget) =>
                            updateCurrentDay((d) => ({
                              ...d,
                              nutrition: {
                                ...d.nutrition,
                                [item.targetKey]: item.allowDecimal
                                  ? Number(nextTarget.toFixed(2))
                                  : Math.round(nextTarget),
                              },
                            }))
                          }
                          onBlur={() => void flushSaveNow()}
                          className="w-10 bg-transparent text-[11px] tabular-nums text-[var(--text-muted)] focus:outline-none"
                        />
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {item.unit}
                        </span>
                      </div>

                      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                        <div
                          className={`h-full rounded-full ${item.color} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Your Frequently Eaten Daily Staples (Top 5-10 from Actual History + Pins) */}
            <div className="rounded-xl border border-emerald-500/25 bg-[var(--bg-elevated)] p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-emerald-400">
                    Your Frequently Eaten Staples (Top 5–10 From Your Logs)
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Built automatically from meals you repeatedly log across days (plus any items you pin with ★ below). Adjust quantity and tap Add.
                  </p>
                </div>
              </div>

              {frequentStaples.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs text-[var(--text-muted)]">
                  No recurring personal staples yet. As you add meals below across your days—or click the pin (★) button next to any food in Search—your core 5–10 daily meals appear here for 1-tap logging.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {frequentStaples.map((staple) => {
                    const qty = stapleQuantities[staple.id] ?? 1;
                    return (
                      <div
                        key={staple.id}
                        className="flex flex-col justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-xs"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="font-bold leading-snug">
                              {staple.name}
                            </span>
                            <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                              {staple.isPinned && staple.count <= 1
                                ? "Pinned"
                                : `Logged ${staple.count}×`}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                            {staple.portionLabel} ·{" "}
                            <strong className="text-amber-400">
                              {Math.round(staple.calories * qty)} kcal
                            </strong>{" "}
                            ·{" "}
                            <strong className="text-emerald-400">
                              {Math.round(staple.protein * qty)}g P
                            </strong>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)]/60">
                          <label className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                            <span>Qty:</span>
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
                              className="w-12 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-center font-bold text-[var(--text-primary)]"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              addUserFrequentStapleMeal(staple, qty)
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 transition"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                            <span>Add</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Open Food Search & Portion Customizer (MyFitnessPal / ICMR-NIN / USDA Standard) */}
            <div className="rounded-xl border border-amber-500/30 bg-[var(--bg-elevated)] p-3.5 sm:p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Utensils className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  <h3
                    id="heading-food-search"
                    className="text-xs sm:text-sm font-bold"
                  >
                    Open Food Search &amp; Portion Calculator (ICMR-NIN India + USDA Global)
                  </h3>
                </div>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  {FOOD_DATABASE.length + aiFoodResults.length}+ Standardized Foods + Open Lookup
                </span>
              </div>

              <search>
                <form
                  aria-labelledby="heading-food-search"
                  onSubmit={handleOpenAiFoodSearch}
                  className="flex flex-wrap items-end gap-2"
                >
                  <div className="flex-1 min-w-[220px] space-y-1">
                    <label
                      htmlFor="food-search-input"
                      className="block text-[11px] font-medium text-[var(--text-muted)]"
                    >
                      Search any Global or Indian food (e.g. Grilled Chicken Breast, Salmon Fillet, Chapati, Dal Tadka, Paneer Tikka, Idli)
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 focus-within:border-amber-400">
                      <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                      <input
                        id="food-search-input"
                        name="foodQuery"
                        type="search"
                        value={foodSearchQuery}
                        onChange={(e) => setFoodSearchQuery(e.target.value)}
                        placeholder="Type any food name to search or fetch macros..."
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        className="w-full bg-transparent text-xs sm:text-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={foodSearchLoading || !foodSearchQuery.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition"
                  >
                    {foodSearchLoading ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        <span>Looking up...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Fetch Any Food</span>
                      </>
                    )}
                  </button>
                </form>
              </search>

              {/* Category Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
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
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                      foodCategoryFilter === cat
                        ? "bg-amber-500 text-slate-950 font-semibold"
                        : "border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search Results + Portion & Gram Customizer Split */}
              <div className="grid gap-3 lg:grid-cols-12">
                {/* Matching Foods List */}
                <div className="lg:col-span-6 space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {combinedCatalogMatches.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-xs text-[var(--text-muted)]">
                      No exact local catalog match for &ldquo;{foodSearchQuery}&rdquo;. Click{" "}
                      <strong className="text-amber-400">Fetch Any Food</strong> above to pull standardized ICMR-NIN / USDA macros automatically.
                    </div>
                  ) : (
                    combinedCatalogMatches.slice(0, 10).map((item) => {
                      const isSelected = selectedFoodItem.id === item.id;
                      const isPinned = (profile.pinnedStaples || []).some(
                        (p) =>
                          p.name.trim().toLowerCase() ===
                          item.name.trim().toLowerCase()
                      );
                      return (
                        <div
                          key={item.id}
                          className={`flex items-stretch gap-1 rounded-lg border transition ${
                            isSelected
                              ? "border-amber-400 bg-amber-500/10"
                              : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-amber-500/40"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectFoodItem(item)}
                            className="flex-1 text-left p-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[var(--text-primary)]">
                                {item.name}
                              </span>
                              <span className="shrink-0 rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                                {item.source}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
                              <span>Per 100g:</span>
                              <strong className="text-amber-400">
                                {item.caloriesPer100g} kcal
                              </strong>
                              <span className="text-emerald-400">
                                {item.proteinPer100g}g P
                              </span>
                              <span className="text-sky-400">
                                {item.carbsPer100g}g C
                              </span>
                              <span className="text-purple-400">
                                {item.fatsPer100g}g F
                              </span>
                              <span className="text-teal-400">
                                {item.fiberPer100g}g Fib
                              </span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePinFoodItem(item)}
                            title={
                              isPinned
                                ? `Unpin ${item.name} from Your Staples`
                                : `Pin ${item.name} to Your Staples`
                            }
                            aria-label={
                              isPinned
                                ? `Unpin ${item.name} from staples`
                                : `Pin ${item.name} to staples`
                            }
                            className={`px-2 flex items-center justify-center border-l border-[var(--border-subtle)]/60 rounded-r-lg transition ${
                              isPinned
                                ? "text-emerald-400 bg-emerald-500/10"
                                : "text-[var(--text-muted)] hover:text-emerald-400"
                            }`}
                          >
                            <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Selected Food Portion & Weight Customizer */}
                <div className="lg:col-span-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                        Customize Portion &amp; Weight
                      </div>
                      <div className="text-xs sm:text-sm font-bold">
                        {selectedFoodItem.name}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {selectedFoodItem.category} · {selectedFoodItem.source}
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-semibold text-amber-400">
                      <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{foodPreview.totalGrams} g/ml</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="food-portion-select"
                        className="block text-[11px] font-medium text-[var(--text-muted)] mb-1"
                      >
                        Portion Size (with Weight Indicator)
                      </label>
                      <select
                        id="food-portion-select"
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
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-medium focus:border-amber-400 focus:outline-none"
                      >
                        {selectedFoodItem.portions.map((p, idx) => (
                          <option key={p.label} value={idx}>
                            {p.label}
                          </option>
                        ))}
                        <option value={-1}>
                          Custom Weight (grams / ml)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="food-grams-input"
                        className="block text-[11px] font-medium text-[var(--text-muted)] mb-1"
                      >
                        Base Weight (grams / ml)
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
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor="food-quantity-input"
                          className="block text-[11px] font-medium text-[var(--text-muted)] mb-1"
                        >
                          Qty / Servings
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
                          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-bold focus:border-amber-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="food-time-input"
                          className="block text-[11px] font-medium text-[var(--text-muted)] mb-1"
                        >
                          Time
                        </label>
                        <input
                          id="food-time-input"
                          type="time"
                          value={foodTime}
                          onChange={(e) => setFoodTime(e.target.value)}
                          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs font-medium focus:border-amber-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live Portion Nutrition Breakdown */}
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-center text-[11px]">
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Calories</div>
                      <div className="font-bold text-amber-400">{foodPreview.calories}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Protein</div>
                      <div className="font-bold text-emerald-400">{foodPreview.protein}g</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Carbs</div>
                      <div className="font-bold text-sky-400">{foodPreview.carbs}g</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Fats</div>
                      <div className="font-bold text-purple-400">{foodPreview.fats}g</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Fiber</div>
                      <div className="font-bold text-teal-400">{foodPreview.fiberGrams}g</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Water</div>
                      <div className="font-bold text-cyan-400">{foodPreview.waterLiters}L</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddFoodFromSearch}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      Add {selectedFoodItem.name} ({foodPreview.totalGrams}g) to Daily Totals
                    </span>
                  </button>
                </div>
              </div>

              {foodSearchMessage && (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400"
                >
                  {foodSearchMessage}
                </div>
              )}
            </div>

            {/* Meal Log Breakdown */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Meals &amp; Timed Nutrition Log
                </h3>
                <button
                  type="button"
                  onClick={addMeal}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  <span>Add Custom Meal</span>
                </button>
              </div>

              <div className="space-y-2">
                {currentDay.nutrition.meals.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-4 text-center text-xs text-[var(--text-muted)]">
                    No meals logged for {selectedDate} yet. Use{" "}
                    <strong className="text-emerald-400">Your Frequently Eaten Staples</strong> above, search any food, or click{" "}
                    <strong className="text-amber-400">Add Custom Meal</strong>.
                  </div>
                )}
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
                      <div className="flex-1 min-w-[180px] flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          aria-label="Meal Description"
                          value={meal.name}
                          onChange={(e) =>
                            updateMeal(meal.id, { name: e.target.value })
                          }
                          onBlur={() => void flushSaveNow()}
                          placeholder="Meal / food items..."
                          className="flex-1 min-w-[140px] bg-transparent text-xs sm:text-sm font-semibold focus:outline-none"
                        />
                        {meal.weightGrams ? (
                          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                            {meal.weightGrams}g
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <label className="flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2 py-1">
                          <span className="text-[10px] text-amber-400">kcal</span>
                          <DecimalInput
                            allowDecimal={false}
                            min={0}
                            value={meal.calories}
                            onValueChange={(val) =>
                              updateMeal(meal.id, { calories: Math.round(val) })
                            }
                            onBlur={() => void flushSaveNow()}
                            className="w-12 bg-transparent font-bold text-right tabular-nums focus:outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2 py-1">
                          <span className="text-[10px] text-emerald-400">P(g)</span>
                          <DecimalInput
                            allowDecimal={false}
                            min={0}
                            value={meal.protein}
                            onValueChange={(val) =>
                              updateMeal(meal.id, { protein: Math.round(val) })
                            }
                            onBlur={() => void flushSaveNow()}
                            className="w-10 bg-transparent font-bold text-right tabular-nums focus:outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2 py-1">
                          <span className="text-[10px] text-sky-400">C(g)</span>
                          <DecimalInput
                            allowDecimal={false}
                            min={0}
                            value={meal.carbs}
                            onValueChange={(val) =>
                              updateMeal(meal.id, { carbs: Math.round(val) })
                            }
                            onBlur={() => void flushSaveNow()}
                            className="w-10 bg-transparent font-bold text-right tabular-nums focus:outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2 py-1">
                          <span className="text-[10px] text-purple-400">F(g)</span>
                          <DecimalInput
                            allowDecimal={false}
                            min={0}
                            value={meal.fats}
                            onValueChange={(val) =>
                              updateMeal(meal.id, { fats: Math.round(val) })
                            }
                            onBlur={() => void flushSaveNow()}
                            className="w-10 bg-transparent font-bold text-right tabular-nums focus:outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2 py-1">
                          <span className="text-[10px] text-teal-400">Fib(g)</span>
                          <DecimalInput
                            allowDecimal
                            min={0}
                            value={meal.fiberGrams ?? 0}
                            onValueChange={(val) =>
                              updateMeal(meal.id, { fiberGrams: val })
                            }
                            onBlur={() => void flushSaveNow()}
                            className="w-10 bg-transparent font-bold text-right tabular-nums focus:outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2 py-1">
                          <span className="text-[10px] text-cyan-400">H2O(L)</span>
                          <DecimalInput
                            allowDecimal
                            min={0}
                            value={meal.waterLiters ?? 0}
                            onValueChange={(val) =>
                              updateMeal(meal.id, { waterLiters: val })
                            }
                            onBlur={() => void flushSaveNow()}
                            className="w-10 bg-transparent font-bold text-right tabular-nums focus:outline-none"
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
                      placeholder="Meal note (digestion, pre/post workout context, portion details)..."
                      value={meal.note}
                      onChange={(e) =>
                        updateMeal(meal.id, { note: e.target.value })
                      }
                      onBlur={() => void flushSaveNow()}
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
                        placeholder="0"
                        value={cm.value}
                        onChange={(e) =>
                          updateCustomMetric(cm.id, { value: e.target.value })
                        }
                        onBlur={() => void flushSaveNow()}
                        className="w-24 bg-transparent text-base font-bold text-emerald-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        aria-label={`${cm.label} Unit`}
                        value={cm.unit}
                        onChange={(e) =>
                          updateCustomMetric(cm.id, { unit: e.target.value })
                        }
                        onBlur={() => void flushSaveNow()}
                        placeholder="unit"
                        className="w-16 bg-transparent text-xs text-[var(--text-muted)] focus:outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      aria-label={`Note for ${cm.label}`}
                      placeholder="Optional note..."
                      value={cm.note}
                      onChange={(e) =>
                        updateCustomMetric(cm.id, { note: e.target.value })
                      }
                      onBlur={() => void flushSaveNow()}
                      className="w-full rounded-md bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-muted)] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Overall Nutrition Note */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="nutrition-note"
                  className="block text-xs font-medium text-[var(--text-muted)]"
                >
                  Nutrition, Hydration &amp; Gut Health Notes
                </label>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Auto-saved &amp; visible in History
                </span>
              </div>
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
                onBlur={() => void flushSaveNow()}
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
                    3. Sleep &amp; Recovery
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Enter your total sleep hours &amp; 1–10 sleep quality rating — Resting HR, HRV, Deep &amp; REM stages auto-approximate for a 70 kg Indian man
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
                  className="w-14 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-center font-bold text-indigo-400"
                />
              </div>
            </div>

            {/* Direct Sleep Hours + Quality Logger (Calibrated for 70 kg Indian Adult Male) */}
            <div className="rounded-xl border border-indigo-500/30 bg-[var(--bg-elevated)] p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-indigo-400">
                  Direct Sleep Entry · 70 kg Indian Male Baseline Approximation
                </div>
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                  0–23 hrs supported (decimals like 1.5h or 7.5h allowed)
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="sleep-total"
                      className="text-xs font-semibold text-[var(--text-primary)]"
                    >
                      Total Sleep Duration (0–23 hrs)
                    </label>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Strain Need: {analysis.requiredSleepHours}h
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
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
                      className="w-24 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-2xl font-extrabold tabular-nums text-indigo-400 focus:border-indigo-400 focus:outline-none"
                    />
                    <span className="text-xs text-[var(--text-muted)]">
                      hours slept
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
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
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                          currentDay.sleep.totalHours === hrs
                            ? "bg-indigo-500 text-slate-950"
                            : "border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-indigo-400/50"
                        }`}
                      >
                        {hrs}h
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="sleep-quality"
                      className="text-xs font-semibold text-[var(--text-primary)]"
                    >
                      Rate Sleep Quality (1 to 10)
                    </label>
                    <span className="text-[11px] text-amber-400 font-semibold">
                      {currentDay.sleep.sleepQuality} / 10
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <DecimalInput
                      id="sleep-quality"
                      allowDecimal={false}
                      min={1}
                      max={10}
                      emptyAsZero={false}
                      value={currentDay.sleep.sleepQuality}
                      onValueChange={(nextQ) =>
                        updateSleepWith70kgIndianBaseline(
                          currentDay.sleep.totalHours,
                          Math.max(1, Math.min(10, Math.round(nextQ || 1)))
                        )
                      }
                      onBlur={() => void flushSaveNow()}
                      className="w-20 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-2xl font-extrabold tabular-nums text-amber-400 focus:border-amber-400 focus:outline-none"
                    />
                    <span className="text-xs text-[var(--text-muted)]">
                      out of 10
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
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
                        className={`min-w-[28px] rounded-md px-2 py-1 text-[11px] font-bold transition ${
                          currentDay.sleep.sleepQuality === q
                            ? "bg-amber-500 text-slate-950"
                            : "border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-amber-400/50"
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[var(--text-muted)]">
                <strong>Standard Indian 70 kg Man Approximation Active:</strong>{" "}
                Changing sleep duration or 1–10 quality automatically updates estimated Deep Sleep (SWS), REM, Resting HR (~62 bpm baseline), and HRV (~60 ms baseline). Override any individual wearable value below if needed.
              </p>
            </div>

            {/* Approximated / Wearable Override Biometrics Inline Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                <label
                  htmlFor="sleep-deep"
                  className="block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  Deep Sleep / SWS (hrs · est.)
                </label>
                <div className="mt-1 flex items-baseline gap-1.5">
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
                    className="w-16 bg-transparent text-xl font-extrabold tabular-nums text-emerald-400 focus:outline-none"
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
                  REM Sleep (hrs · est.)
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
                  className="mt-1 w-full bg-transparent text-xl font-bold tabular-nums text-sky-400 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                <label
                  htmlFor="sleep-rhr"
                  className="block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  Resting HR (bpm · 70kg est.)
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
                      sleep: {
                        ...d.sleep,
                        restingHeartRate: Math.round(val),
                      },
                    }))
                  }
                  onBlur={() => void flushSaveNow()}
                  className="mt-1 w-full bg-transparent text-xl font-bold tabular-nums text-rose-400 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                <label
                  htmlFor="sleep-hrv"
                  className="block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  HRV (ms · 70kg est.)
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
                  className="mt-1 w-full bg-transparent text-xl font-bold tabular-nums text-teal-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Upgraded 3-Signal Actionable Recovery & Sleep Sufficiency Diagnostic */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold">
                  Cross-Module Sufficiency Diagnostic (Sleep × Training × Fuel)
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Physiological Check · Actionable Next-Day Calibration
                </span>
              </div>

              <div className="grid gap-2.5 md:grid-cols-3 text-xs">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-1">
                  <div className="font-semibold text-indigo-400">
                    1. Sleep vs. Training Load ({analysis.strainScore}/21 Strain)
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    {currentDay.sleep.totalHours === 0
                      ? "Enter your total sleep hours above to see whether rest covers today's workout demand."
                      : analysis.isSleepSufficientForWorkout &&
                        analysis.isDeepSleepSufficient
                      ? `Covered — ${currentDay.sleep.totalHours}h total and ${currentDay.sleep.deepSleepHours}h deep sleep meet the ${analysis.requiredSleepHours}h need for ${analysis.totalSets} sets. Keep progressive overload active.`
                      : `Sleep Debt (${Math.abs(analysis.sleepDebtDelta).toFixed(1)}h short) — Tonight aim for ${analysis.requiredSleepHours}h total sleep, finish dinner 90m before bed, or hold RIR at 2 reps in reserve tomorrow.`}
                  </p>
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-1">
                  <div className="font-semibold text-emerald-400">
                    2. Protein &amp; Energy Synthesis Check
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    {currentDay.nutrition.calories === 0 &&
                    currentDay.nutrition.protein === 0
                      ? "Log meals in Module 2 to verify whether overnight amino acid & glycogen supply supports muscle repair."
                      : analysis.isNutritionSufficientForWorkout
                      ? `Optimal Anabolic Window — ${currentDay.nutrition.protein}g protein (~${(currentDay.nutrition.protein / 70).toFixed(1)} g/kg for 70 kg) and ${currentDay.nutrition.calories} kcal fuel overnight tissue repair.`
                      : `Under-Fueled — You are ${Math.max(0, currentDay.nutrition.proteinTarget - currentDay.nutrition.protein)}g protein and ${Math.max(0, currentDay.nutrition.calorieTarget - currentDay.nutrition.calories)} kcal below target; add a protein-rich evening meal before sleeping.`}
                  </p>
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-1">
                  <div className="font-semibold text-teal-400">
                    3. Autonomic Read (70 kg RHR &amp; HRV Proxy)
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    {currentDay.sleep.totalHours === 0
                      ? "Waiting for sleep duration + 1–10 rating to model morning Resting HR and HRV balance."
                      : `Est. RHR ${currentDay.sleep.restingHeartRate} bpm & HRV ${currentDay.sleep.hrvMs} ms (Quality ${currentDay.sleep.sleepQuality}/10). ${
                          currentDay.sleep.hrvMs >= 58 &&
                          currentDay.sleep.restingHeartRate <= 64
                            ? "Parasympathetic rebound looks healthy—cleared for heavy compound intensity + 3L hydration."
                            : "Elevated sympathetic tone suspected—prioritize morning sunlight, electrolytes, and a 20m Zone 2 walk."
                        }`}
                  </p>
                </div>
              </div>
            </div>

            {/* Sleep Free-Text Note */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="sleep-note"
                  className="block text-xs font-medium text-[var(--text-muted)]"
                >
                  Sleep Hygiene, Dreams &amp; Recovery Notes
                </label>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Auto-saved &amp; visible in History
                </span>
              </div>
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
                onBlur={() => void flushSaveNow()}
                className="auto-grow-textarea w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs sm:text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </section>
        )}

        {/* =========================================================
            ABOUT US: PITCH, CORE USP, CLINICAL RESEARCH & FAQS
           ========================================================= */}
        {(activeTab === "all" || activeTab === "research") && (
          <section
            aria-labelledby="heading-research"
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5 space-y-5"
          >
            <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="heading-research"
                  className="text-base font-bold sm:text-lg"
                >
                  About Us — Why PulseLoop &amp; Core Value Proposition
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Hardware-free closed-loop fitness, nutrition &amp; sleep recovery built for Indian and global lifters
                </p>
              </div>
            </div>

            {/* Product Pitch & Core USP Cards */}
            <div className="grid gap-3 md:grid-cols-3 text-xs">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-1.5">
                <div className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
                  The Pitch
                </div>
                <div className="text-sm font-bold text-[var(--text-primary)]">
                  One Connected Recovery Loop Instead of 3 Siloed Apps
                </div>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  Gym trackers ignore protein and sleep. Calorie apps ignore training load. PulseLoop connects Workouts, Nutrition, and Sleep in one mobile-first view so you know immediately whether your food and rest support tomorrow&apos;s performance.
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-1.5">
                <div className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                  Our Core USP
                </div>
                <div className="text-sm font-bold text-[var(--text-primary)]">
                  Global + Indian Nutrition &amp; 70 kg Physiological Calibration
                </div>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  No ₹25,000+ wearable lock-in. Search both USDA global foods and Indian kitchen staples with gram-weighted portions, auto-learn your top 5–10 recurring daily foods, carry over previous workout weights, and approximate Resting HR &amp; HRV from simple sleep hours and a 1–10 rating.
                </p>
              </div>

              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5 space-y-1.5">
                <div className="font-bold text-sky-400 uppercase tracking-wider text-[11px]">
                  Core Value Addition
                </div>
                <div className="text-sm font-bold text-[var(--text-primary)]">
                  Zero-Friction Custom URLs + Multi-Day Trends + Gemini 4 Coach
                </div>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  Skip sign-up walls: bookmark a personal URL like <code className="text-sky-400">/u/rahul</code>, inspect 7-day, 14-day, and 30-day trends across Workouts, Nutrition &amp; Sleep, save comments on every module, and run Gemini 4 AI coaching or natural-language logging in one tap.
                </p>
              </div>
            </div>

            {/* Industry Market Research & Clinical Best Practices Applied (Retained & Aligned with USP) */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                <h3 className="text-sm font-bold">
                  Industry Market Research &amp; Clinical Best Practices Applied
                </h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-1.5">
                  <div className="font-bold text-emerald-400">
                    Strain-to-Sleep Sufficiency Modeling
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    <strong>Best Practice Applied:</strong> Sleep is evaluated against training stress, not an arbitrary fixed number. Entering sleep duration (0–23 hrs) and 1–10 quality calibrates estimated Deep Sleep, REM, Resting HR (~62 bpm baseline), and HRV (~60 ms baseline) for a 70 kg Indian adult male and compares them with daily Gym Strain.
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-1.5">
                  <div className="font-bold text-amber-400">
                    ICMR-NIN India &amp; USDA Global Nutrition Standards
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    <strong>Best Practice Applied:</strong> Open search combines ICMR-NIN Indian nutrition tables with USDA FoodData Central so home meals and gym staples use verified portion weights and automatically sum into Calories, Protein, Carbs, Fats, Hydration, and Fiber.
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-1.5">
                  <div className="font-bold text-sky-400">
                    Progressive Overload &amp; Frictionless Mobile Logging
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    <strong>Best Practice Applied:</strong> Compact iPhone-friendly Exercise × Weight × Reps rows automatically pull forward your previous session&apos;s numbers so every workout starts where you left off—free of bloated charts or sluggish forms.
                  </p>
                </div>
              </div>
            </div>

            {/* Simple How-To & FAQs (With Real Custom URL Example) */}
            <div className="space-y-3 pt-1">
              <h3 className="text-sm font-bold text-emerald-400">
                Quick Guide &amp; Frequently Asked Questions (FAQs)
              </h3>
              <div className="grid gap-2.5 md:grid-cols-2 text-xs">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-1">
                  <div className="font-bold text-[var(--text-primary)]">
                    Q1. How does &ldquo;Custom URL&rdquo; work? (Real Example)
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    Click <strong>Custom URL</strong> in the top bar and type a name like <code className="text-emerald-400">rahul</code> to open <code className="text-emerald-400">/u/rahul</code>. Bookmark that link on your iPhone home screen—every workout, meal, sleep entry, and saved note stays in its own private workspace. Coaches can create <code className="text-emerald-400">/u/client-ananya</code> to share a separate tracker with a client with zero login friction.
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-1">
                  <div className="font-bold text-[var(--text-primary)]">
                    Q2. Why does a new day start empty, and how do my Food Staples work?
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    Nothing is fake or pre-filled so your calorie and strain numbers reflect real intake only. As you log foods across days (or click the Pin icon next to a search result), your top 5–10 recurring meals automatically populate under <strong>Your Frequently Eaten Staples</strong> for 1-tap logging with adjustable quantity.
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-1">
                  <div className="font-bold text-[var(--text-primary)]">
                    Q3. How are Gym Strain (/21) and Readiness (%) scored?
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    <strong>Gym Strain (0–21)</strong> rises logarithmically with gym duration, completed sets/reps, and cardio minutes (so going from 0 to 12 sets moves fast, while marathon sessions taper near 21). <strong>Readiness (12–99%)</strong> blends Sleep Duration &amp; Deep Sleep ratio against strain-adjusted need, protein &amp; calorie fueling coverage, and subjective sleep quality.
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-1">
                  <div className="font-bold text-[var(--text-primary)]">
                    Q4. How do I view multi-week progress &amp; carry over previous weights?
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    Open the <strong>History &amp; Trends</strong> tab to switch between 7-Day (Week), 14-Day (2 Weeks), and 30-Day (Month) consolidated totals, lift progression, and all saved notes. Inside <strong>1. Workouts</strong>, tap <strong>Load Prev</strong> or add an exercise by name to automatically pre-fill your last logged weights and reps.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
