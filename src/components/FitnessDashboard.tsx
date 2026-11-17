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
  Search,
  Scale,
  Utensils,
  ShieldCheck,
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

  // Sleep 70 kg Indian male auto-approximation helper
  const updateSleepWith70kgIndianBaseline = (
    nextHours: number,
    nextQuality: number
  ) => {
    const safeHours = Math.max(0, Math.min(16, Number(nextHours) || 0));
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
                  { id: "workout", label: "1. Workouts" },
                  { id: "nutrition", label: "2. Nutrition" },
                  { id: "sleep", label: "3. Sleep & Recovery" },
                  { id: "research", label: "About Us" },
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

                <button
                  type="button"
                  onClick={() => {
                    if (activeTab !== "all") {
                      setActiveTab("all");
                      setShowAiHub(true);
                    } else {
                      setShowAiHub((v) => !v);
                    }
                  }}
                  aria-expanded={activeTab === "all" && showAiHub}
                  aria-controls="gemini-ai-hub"
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
                >
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  <span>
                    {activeTab === "all" && showAiHub
                      ? "Hide Gemini AI Hub"
                      : "Open Gemini AI Hub"}
                  </span>
                </button>
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
            GEMINI INTERACTIONS API AI HUB (Per-URL & Per-Date Stateful Coach)
           ========================================================= */}
        {activeTab === "all" && showAiHub && (
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

              <div className="flex flex-wrap items-center gap-2.5">
                <fieldset className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5">
                  <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Gemini Model
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

                  {/* Sets Inline Table (Clean Exercise, Weight, Reps, Done) */}
                  <div
                    tabIndex={0}
                    role="region"
                    aria-label={`${exercise.name || `Exercise ${exIdx + 1}`} sets`}
                    className="overflow-x-auto"
                  >
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
                          <th scope="col" className="py-1.5 pr-2 w-12">Set</th>
                          <th scope="col" className="py-1.5 px-2">
                            Weight ({profile.weightUnit})
                          </th>
                          <th scope="col" className="py-1.5 px-2">Reps</th>
                          <th scope="col" className="py-1.5 pl-2 text-right">Done</th>
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
                                className="w-24 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 font-semibold focus:border-sky-400 focus:outline-none"
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
                                className="w-20 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 font-semibold focus:border-sky-400 focus:outline-none"
                              />
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
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectFoodItem(item)}
                          className={`w-full text-left rounded-lg border p-2.5 transition ${
                            isSelected
                              ? "border-amber-400 bg-amber-500/10"
                              : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-amber-500/40"
                          }`}
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
                            <strong className="text-amber-400">{item.caloriesPer100g} kcal</strong>
                            <span className="text-emerald-400">{item.proteinPer100g}g P</span>
                            <span className="text-sky-400">{item.carbsPer100g}g C</span>
                            <span className="text-purple-400">{item.fatsPer100g}g F</span>
                            <span className="text-teal-400">{item.fiberPer100g}g Fib</span>
                          </div>
                        </button>
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
                      <input
                        id="food-grams-input"
                        type="text"
                        inputMode="numeric"
                        value={customWeightGrams}
                        onChange={(e) => {
                          setSelectedPortionIndex(-1);
                          setCustomWeightGrams(
                            Number(e.target.value.replace(/[^0-9.]/g, "")) || 0
                          );
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
                        <input
                          id="food-quantity-input"
                          type="text"
                          inputMode="decimal"
                          value={foodQuantity}
                          onChange={(e) =>
                            setFoodQuantity(
                              Math.max(
                                0.25,
                                Number(
                                  e.target.value.replace(/[^0-9.]/g, "")
                                ) || 1
                              )
                            )
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
                        <label className="flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2 py-1">
                          <span className="text-[10px] text-teal-400">Fib(g)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={meal.fiberGrams ?? 0}
                            onChange={(e) =>
                              updateMeal(meal.id, {
                                fiberGrams:
                                  Number(
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  ) || 0,
                              })
                            }
                            className="w-10 bg-transparent font-bold text-right focus:outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2 py-1">
                          <span className="text-[10px] text-cyan-400">H2O(L)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={meal.waterLiters ?? 0}
                            onChange={(e) =>
                              updateMeal(meal.id, {
                                waterLiters:
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
                      placeholder="Meal note (digestion, pre/post workout context, portion details)..."
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

            {/* Direct Sleep Hours + Quality Logger (Calibrated for 70 kg Indian Adult Male) */}
            <div className="rounded-xl border border-indigo-500/30 bg-[var(--bg-elevated)] p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-indigo-400">
                  Direct Sleep Entry · 70 kg Indian Male Baseline Approximation
                </div>
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                  Start/Stop sleep timer coming in V2
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="sleep-total"
                      className="text-xs font-semibold text-[var(--text-primary)]"
                    >
                      Total Sleep Duration (hrs)
                    </label>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Strain Need: {analysis.requiredSleepHours}h
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <input
                      id="sleep-total"
                      type="text"
                      inputMode="decimal"
                      value={currentDay.sleep.totalHours}
                      onChange={(e) =>
                        updateSleepWith70kgIndianBaseline(
                          Number(e.target.value.replace(/[^0-9.]/g, "")) || 0,
                          currentDay.sleep.sleepQuality
                        )
                      }
                      className="w-24 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-2xl font-extrabold text-indigo-400 focus:border-indigo-400 focus:outline-none"
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
                    <input
                      id="sleep-quality"
                      type="text"
                      inputMode="numeric"
                      value={currentDay.sleep.sleepQuality}
                      onChange={(e) => {
                        const raw =
                          Number(e.target.value.replace(/[^0-9.]/g, "")) || 1;
                        updateSleepWith70kgIndianBaseline(
                          currentDay.sleep.totalHours,
                          Math.max(1, Math.min(10, Math.round(raw)))
                        );
                      }}
                      className="w-20 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-2xl font-extrabold text-amber-400 focus:border-amber-400 focus:outline-none"
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
                    className="w-16 bg-transparent text-xl font-extrabold text-emerald-400 focus:outline-none"
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
                  className="mt-1 w-full bg-transparent text-xl font-bold text-sky-400 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                <label
                  htmlFor="sleep-rhr"
                  className="block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  Resting HR (bpm · 70kg est.)
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
                  className="mt-1 w-full bg-transparent text-xl font-bold text-rose-400 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
                <label
                  htmlFor="sleep-hrv"
                  className="block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  HRV (ms · 70kg est.)
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
                  className="mt-1 w-full bg-transparent text-xl font-bold text-teal-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Sleep Stage Visual Bar & Sufficiency Verdict Box */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold">
                  Cross-Module Sufficiency Diagnostic (Sleep × Workout × Nutrition)
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Start &amp; Stop Sleep Timings scheduled for V2
                </span>
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
                    Is Nutrition Sufficient for Sleep &amp; Muscle Repair?
                  </div>
                  <p className="mt-1 text-[var(--text-muted)] leading-relaxed">
                    {analysis.isNutritionSufficientForWorkout
                      ? `Yes — ${currentDay.nutrition.protein}g protein and ${currentDay.nutrition.calories} kcal provide sufficient amino acid & glycogen availability so overnight growth hormone during deep sleep can repair muscle tissue.`
                      : `Deficit Detected — With ${analysis.totalSets} sets (${analysis.totalReps} reps) logged today, your current intake (${currentDay.nutrition.calories} kcal, ${currentDay.nutrition.protein}g protein) risks blunting overnight HRV and deep-sleep muscle synthesis.`}
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
            ABOUT US: PITCH, CORE USP, VALUE ADDITION & CLINICAL RESEARCH
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
                  About Us — Our Pitch, Core USP &amp; Why PulseLoop Exists
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Hardware-free closed-loop fitness sufficiency built for Indian &amp; global lifters
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
                  Gym trackers ignore protein and sleep. Calorie counters ignore training load. PulseLoop connects your Workouts, Nutrition, and Sleep on a single live screen so you know in seconds whether today&apos;s fueling and rest actually support tomorrow&apos;s lift.
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
                  Zero ₹25,000+ ring or band lock-in. Search both global USDA foods and Indian staples (Chapati, Dal, Paneer, Idli, Chicken) with real portion gram weights, log clean Exercise × Weight × Reps, and get instant 70 kg Indian adult male RHR, HRV &amp; sleep-stage approximations from simple sleep hours and a 1–10 rating.
                </p>
              </div>

              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5 space-y-1.5">
                <div className="font-bold text-sky-400 uppercase tracking-wider text-[11px]">
                  Core Value Addition
                </div>
                <div className="text-sm font-bold text-[var(--text-primary)]">
                  Zero-Friction Custom URLs + Stateful Gemini 4 Coaching
                </div>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  No sign-up walls or cluttered charts: open any personal or client workspace at <code className="text-sky-400">/u/your-name</code> with instant offline-first auto-save, automatic 6-pillar nutrition totals (Calories, Protein, Carbs, Fats, Hydration, Fiber), and stateful Gemini 4 recovery guidance.
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
                    WHOOP &amp; Oura Ring — Strain-to-Sleep Sufficiency
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    <strong>Best Practice Applied to Our USP:</strong> Sleep isn&apos;t judged in isolation. Even without a wearable, entering your total sleep hours and 1–10 quality triggers our 70 kg Indian male physiological model (Resting HR, HRV, Deep &amp; REM estimates) and checks it against your daytime gym strain.
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-1.5">
                  <div className="font-bold text-amber-400">
                    MyFitnessPal, Livestrong &amp; ICMR-NIN / USDA Standards
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    <strong>Best Practice Applied to Our USP:</strong> Open food discovery shouldn&apos;t miss home-cooked Indian meals or Western staples. Searching any food returns standardized ICMR-NIN &amp; USDA macros with gram-weighted portions that automatically roll up into Calories, Protein, Carbs, Fats, Hydration, and Fiber.
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-1.5">
                  <div className="font-bold text-sky-400">
                    Hevy &amp; Clinical Coaching — Zero-Bloat Inline Execution
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    <strong>Best Practice Applied to Our USP:</strong> Lifters want fast Exercise, Weight, and Reps tracking—not distracting RPE/volume math on every row. Paired with instant <code className="text-sky-400">Optimal</code> / <code className="text-amber-400">Borderline</code> / <code className="text-rose-400">Deficit</code> status banners and ubiquitous inline notes, tracking takes under 15 seconds.
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
