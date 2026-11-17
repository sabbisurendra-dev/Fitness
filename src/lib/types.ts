export interface ExerciseSet {
  id: string;
  weight: number;
  reps: number;
  rpe?: number;
  completed: boolean;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  muscleGroup: string;
  sets: ExerciseSet[];
  note: string;
}

export interface WorkoutSession {
  gymDurationMinutes: number;
  sessionTitle: string;
  sessionRpe: number; // 1-10
  exercises: WorkoutExercise[];
  cardioMinutes: number;
  cardioType: string;
  note: string;
}

export interface MealEntry {
  id: string;
  time: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  note: string;
}

export interface CustomHealthMetric {
  id: string;
  label: string;
  value: string;
  unit: string;
  note: string;
}

export interface NutritionLog {
  calories: number;
  calorieTarget: number;
  protein: number;
  proteinTarget: number;
  carbs: number;
  carbTarget: number;
  fats: number;
  fatTarget: number;
  waterLiters: number;
  waterTargetLiters: number;
  fiberGrams: number;
  fiberTargetGrams: number;
  useMealSum: boolean;
  meals: MealEntry[];
  customMetrics: CustomHealthMetric[];
  note: string;
}

export interface SleepLog {
  totalHours: number;
  deepSleepHours: number;
  remSleepHours: number;
  lightSleepHours: number;
  awakeMinutes: number;
  sleepQuality: number; // 1-10
  bedtime: string;
  wakeTime: string;
  restingHeartRate: number;
  hrvMs: number;
  note: string;
}

export interface DailyEntry {
  date: string; // YYYY-MM-DD
  dailyNote: string;
  workout: WorkoutSession;
  nutrition: NutritionLog;
  sleep: SleepLog;
  updatedAt: string;
}

export interface UserProfileStore {
  slug: string;
  displayName: string;
  weightUnit: "kg" | "lbs";
  bodyweight: number;
  baselineSleepNeedHours: number;
  days: Record<string, DailyEntry>;
  updatedAt: string;
}

export interface SufficiencyAnalysis {
  readinessScore: number; // 0-100
  strainScore: number; // 0-21 (WHOOP scale)
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  requiredSleepHours: number;
  sleepDebtDelta: number; // actual - required
  requiredDeepSleepHours: number;
  deepSleepPercentage: number;
  isSleepSufficientForWorkout: boolean;
  isDeepSleepSufficient: boolean;
  isNutritionSufficientForWorkout: boolean;
  verdictLevel: "optimal" | "moderate" | "deficit";
  verdictHeadline: string;
  verdictExplanation: string;
  clinicalPillarChecks: {
    sleepVsStrain: {
      status: "optimal" | "warning" | "deficit";
      label: string;
      detail: string;
    };
    deepSleepRepair: {
      status: "optimal" | "warning" | "deficit";
      label: string;
      detail: string;
    };
    nutritionVsStrain: {
      status: "optimal" | "warning" | "deficit";
      label: string;
      detail: string;
    };
  };
}

export function createDefaultDailyEntry(date: string): DailyEntry {
  return {
    date,
    dailyNote: "",
    workout: {
      gymDurationMinutes: 65,
      sessionTitle: "Upper Body Strength & Hypertrophy",
      sessionRpe: 8,
      cardioMinutes: 15,
      cardioType: "Incline Treadmill Walk",
      note: "Felt strong on pressing movements. Focused on 2-second controlled eccentrics.",
      exercises: [
        {
          id: "ex-1",
          name: "Barbell Bench Press",
          muscleGroup: "Chest",
          note: "Paused 1s on chest; wrists stacked",
          sets: [
            { id: "s-1", weight: 80, reps: 10, rpe: 7.5, completed: true },
            { id: "s-2", weight: 85, reps: 8, rpe: 8.5, completed: true },
            { id: "s-3", weight: 85, reps: 8, rpe: 9, completed: true },
          ],
        },
        {
          id: "ex-2",
          name: "Lat Pulldown (Wide Grip)",
          muscleGroup: "Back",
          note: "Full stretch at top, pull to upper chest",
          sets: [
            { id: "s-4", weight: 65, reps: 12, rpe: 8, completed: true },
            { id: "s-5", weight: 70, reps: 10, rpe: 8.5, completed: true },
            { id: "s-6", weight: 70, reps: 10, rpe: 9, completed: true },
          ],
        },
        {
          id: "ex-3",
          name: "Incline Dumbbell Press",
          muscleGroup: "Chest / Shoulders",
          note: "30-degree bench angle",
          sets: [
            { id: "s-7", weight: 30, reps: 10, rpe: 8, completed: true },
            { id: "s-8", weight: 32.5, reps: 9, rpe: 9, completed: true },
          ],
        },
      ],
    },
    nutrition: {
      calories: 2350,
      calorieTarget: 2450,
      protein: 175,
      proteinTarget: 170,
      carbs: 250,
      carbTarget: 260,
      fats: 72,
      fatTarget: 75,
      waterLiters: 3.4,
      waterTargetLiters: 3.5,
      fiberGrams: 32,
      fiberTargetGrams: 30,
      useMealSum: false,
      note: "Pre-workout carbs 90m before gym; high-protein dinner 3h before bed.",
      meals: [
        {
          id: "m-1",
          time: "08:30",
          name: "Oats, Whey Isolate, Berries & Chia",
          calories: 620,
          protein: 48,
          carbs: 78,
          fats: 14,
          note: "Pre-workout fuel",
        },
        {
          id: "m-2",
          time: "13:15",
          name: "Grilled Chicken Breast, Jasmine Rice & Avocado",
          calories: 840,
          protein: 64,
          carbs: 88,
          fats: 24,
          note: "Post-workout recovery meal",
        },
        {
          id: "m-3",
          time: "19:30",
          name: "Salmon Fillet, Sweet Potato & Steamed Broccoli",
          calories: 890,
          protein: 63,
          carbs: 84,
          fats: 34,
          note: "Finished eating 3 hrs before sleep for HRV optimization",
        },
      ],
      customMetrics: [
        {
          id: "cm-1",
          label: "Creatine Monohydrate",
          value: "5",
          unit: "g",
          note: "Taken post-workout",
        },
        {
          id: "cm-2",
          label: "Daily Steps",
          value: "10,850",
          unit: "steps",
          note: "Active outdoor recovery walk",
        },
        {
          id: "cm-3",
          label: "Electrolytes / Sodium",
          value: "1,000",
          unit: "mg",
          note: "Intra-workout hydration",
        },
      ],
    },
    sleep: {
      totalHours: 7.8,
      deepSleepHours: 1.6,
      remSleepHours: 1.9,
      lightSleepHours: 4.3,
      awakeMinutes: 18,
      sleepQuality: 9,
      bedtime: "22:45",
      wakeTime: "06:35",
      restingHeartRate: 54,
      hrvMs: 78,
      note: "Cool room (19°C), magnesium glycinate 400mg before bed. Woke up refreshed without alarm.",
    },
    updatedAt: new Date().toISOString(),
  };
}

export function createDefaultUserProfile(slug: string): UserProfileStore {
  const today = new Date().toISOString().slice(0, 10);
  const cleanName =
    slug === "main" || slug === "default"
      ? "Personal Performance Hub"
      : `${slug.charAt(0).toUpperCase() + slug.slice(1)}'s Performance Hub`;

  return {
    slug,
    displayName: cleanName,
    weightUnit: "kg",
    bodyweight: 76,
    baselineSleepNeedHours: 7.5,
    days: {
      [today]: createDefaultDailyEntry(today),
    },
    updatedAt: new Date().toISOString(),
  };
}

export function calculateSufficiencyAnalysis(
  entry: DailyEntry,
  profile: UserProfileStore
): SufficiencyAnalysis {
  const { workout, nutrition, sleep } = entry;

  // 1. Workout Volume & Strain Calculation (WHOOP / Garmin inspired)
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;

  for (const ex of workout.exercises) {
    for (const s of ex.sets) {
      if (s.completed) {
        totalSets += 1;
        totalReps += Number(s.reps) || 0;
        totalVolume += (Number(s.weight) || 0) * (Number(s.reps) || 0);
      }
    }
  }

  const totalActiveMinutes =
    (Number(workout.gymDurationMinutes) || 0) +
    (Number(workout.cardioMinutes) || 0);
  const rpeFactor = Math.max(1, Math.min(10, Number(workout.sessionRpe) || 6));

  // Strain on 0-21 scale
  const durationStrain = Math.min(12, (totalActiveMinutes / 60) * 6.5);
  const volumeStrain = Math.min(6, (totalSets / 18) * 4.5);
  const intensityStrain = ((rpeFactor - 4) / 6) * 3;
  const rawStrain =
    totalActiveMinutes === 0 && totalSets === 0
      ? 2.0
      : Math.min(20.8, Math.max(2.0, durationStrain + volumeStrain + intensityStrain));
  const strainScore = Number(rawStrain.toFixed(1));

  // 2. Strain-Adjusted Sleep Need (WHOOP / Oura clinical formula)
  // Base sleep need + extra sleep required for gym strain & CNS load
  const strainSleepAddon =
    strainScore > 14 ? 0.8 : strainScore > 10 ? 0.5 : strainScore > 6 ? 0.25 : 0;
  const requiredSleepHours = Number(
    ((Number(profile.baselineSleepNeedHours) || 7.5) + strainSleepAddon).toFixed(1)
  );
  const actualSleep = Number(sleep.totalHours) || 0;
  const sleepDebtDelta = Number((actualSleep - requiredSleepHours).toFixed(1));

  // Deep sleep clinical threshold: 16-22% of total sleep, minimum ~1.2h on rest days, ~1.4-1.6h on heavy lift days
  const requiredDeepSleepHours = Number(
    (strainScore >= 12 ? 1.5 : strainScore >= 8 ? 1.3 : 1.1).toFixed(1)
  );
  const actualDeepSleep = Number(sleep.deepSleepHours) || 0;
  const deepSleepPercentage =
    actualSleep > 0 ? Math.round((actualDeepSleep / actualSleep) * 100) : 0;

  const isSleepSufficientForWorkout = actualSleep >= requiredSleepHours - 0.3;
  const isDeepSleepSufficient = actualDeepSleep >= requiredDeepSleepHours - 0.15;

  // 3. Nutrition Sufficiency relative to Workout Strain & Recovery
  const calRatio =
    nutrition.calorieTarget > 0
      ? nutrition.calories / nutrition.calorieTarget
      : 1;
  const proteinRatio =
    nutrition.proteinTarget > 0
      ? nutrition.protein / nutrition.proteinTarget
      : 1;
  const waterRatio =
    nutrition.waterTargetLiters > 0
      ? nutrition.waterLiters / nutrition.waterTargetLiters
      : 1;

  // High strain demands at least 85% calorie target and 90% protein target
  const minCalRatio = strainScore >= 12 ? 0.88 : 0.82;
  const minProtRatio = strainScore >= 12 ? 0.92 : 0.85;
  const isNutritionSufficientForWorkout =
    calRatio >= minCalRatio && proteinRatio >= minProtRatio;

  // 4. Composite Readiness Score (0-100%)
  const sleepDurationScore = Math.min(
    45,
    (actualSleep / Math.max(1, requiredSleepHours)) * 42
  );
  const deepSleepScore = Math.min(
    25,
    (actualDeepSleep / Math.max(0.5, requiredDeepSleepHours)) * 22
  );
  const nutritionScore = Math.min(
    30,
    Math.min(1.1, proteinRatio) * 15 +
      Math.min(1.1, calRatio) * 10 +
      Math.min(1.1, waterRatio) * 5
  );

  const readinessScore = Math.max(
    12,
    Math.min(99, Math.round(sleepDurationScore + deepSleepScore + nutritionScore))
  );

  // Pillar checks
  const sleepVsStrainStatus: "optimal" | "warning" | "deficit" =
    sleepDebtDelta >= -0.2
      ? "optimal"
      : sleepDebtDelta >= -0.9
      ? "warning"
      : "deficit";

  const deepSleepStatus: "optimal" | "warning" | "deficit" =
    actualDeepSleep >= requiredDeepSleepHours
      ? "optimal"
      : actualDeepSleep >= requiredDeepSleepHours - 0.3
      ? "warning"
      : "deficit";

  const nutritionVsStrainStatus: "optimal" | "warning" | "deficit" =
    isNutritionSufficientForWorkout
      ? "optimal"
      : calRatio >= 0.7 && proteinRatio >= 0.75
      ? "warning"
      : "deficit";

  // Overall Verdict
  let verdictLevel: "optimal" | "moderate" | "deficit" = "optimal";
  let verdictHeadline = "Sleep & Nutrition Are Sufficient for Today's Strain";
  let verdictExplanation = `Your ${actualSleep}h total sleep (${actualDeepSleep}h deep) and ${nutrition.protein}g protein / ${nutrition.calories} kcal intake fully cover your ${totalActiveMinutes}m gym load (Strain ${strainScore}/21).`;

  if (
    sleepVsStrainStatus === "deficit" ||
    deepSleepStatus === "deficit" ||
    nutritionVsStrainStatus === "deficit"
  ) {
    verdictLevel = "deficit";
    const reasons: string[] = [];
    if (sleepVsStrainStatus === "deficit") {
      reasons.push(
        `sleep is ${Math.abs(sleepDebtDelta)}h below your strain-adjusted need (${requiredSleepHours}h)`
      );
    }
    if (deepSleepStatus === "deficit") {
      reasons.push(
        `deep sleep (${actualDeepSleep}h) is below the ${requiredDeepSleepHours}h muscle-repair threshold`
      );
    }
    if (nutritionVsStrainStatus === "deficit") {
      reasons.push(
        `fueling (${nutrition.calories} kcal / ${nutrition.protein}g protein) is under-recovering your ${totalSets}-set workout`
      );
    }
    verdictHeadline = "Recovery Deficit Relative to Workout & Fueling Load";
    verdictExplanation = `Attention needed: ${reasons.join("; ")}. Prioritize extra sleep tonight or top up protein/calories.`;
  } else if (
    sleepVsStrainStatus === "warning" ||
    deepSleepStatus === "warning" ||
    nutritionVsStrainStatus === "warning"
  ) {
    verdictLevel = "moderate";
    verdictHeadline = "Near-Sufficient Recovery — Minor Adjustment Needed";
    verdictExplanation = `With a ${strainScore}/21 workout strain (${totalActiveMinutes}m gym, ${totalSets} sets), aim for ${requiredSleepHours}h total sleep (${requiredDeepSleepHours}h deep) and ${nutrition.proteinTarget}g protein for 100% replenishment.`;
  }

  return {
    readinessScore,
    strainScore,
    totalVolume,
    totalSets,
    totalReps,
    requiredSleepHours,
    sleepDebtDelta,
    requiredDeepSleepHours,
    deepSleepPercentage,
    isSleepSufficientForWorkout,
    isDeepSleepSufficient,
    isNutritionSufficientForWorkout,
    verdictLevel,
    verdictHeadline,
    verdictExplanation,
    clinicalPillarChecks: {
      sleepVsStrain: {
        status: sleepVsStrainStatus,
        label: `Total Sleep vs. Strain (${actualSleep}h / ${requiredSleepHours}h needed)`,
        detail:
          sleepDebtDelta >= 0
            ? `+${sleepDebtDelta}h surplus for ${totalActiveMinutes}m gym strain`
            : `${sleepDebtDelta}h sleep debt for ${totalActiveMinutes}m gym strain`,
      },
      deepSleepRepair: {
        status: deepSleepStatus,
        label: `Deep Sleep SWS Repair (${actualDeepSleep}h · ${deepSleepPercentage}%)`,
        detail:
          actualDeepSleep >= requiredDeepSleepHours
            ? `Meets ${requiredDeepSleepHours}h clinical muscle-repair target`
            : `Target ${requiredDeepSleepHours}h+ deep sleep after ${totalSets} working sets`,
      },
      nutritionVsStrain: {
        status: nutritionVsStrainStatus,
        label: `Fuel & Protein Availability (${nutrition.protein}g P · ${nutrition.calories} kcal)`,
        detail: isNutritionSufficientForWorkout
          ? `Sufficient protein & energy availability for hypertrophy`
          : `Need +${Math.max(0, nutrition.proteinTarget - nutrition.protein)}g P & +${Math.max(0, nutrition.calorieTarget - nutrition.calories)} kcal for strain recovery`,
      },
    },
  };
}
