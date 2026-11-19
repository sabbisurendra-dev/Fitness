import {
  DailyEntry,
  ExerciseSet,
  PinnedFoodStaple,
  UserProfileStore,
  WorkoutExercise,
  WorkoutRoutineTemplate,
  calculateSufficiencyAnalysis,
} from "./types";

export interface DailyHistoryRow {
  date: string;
  readinessScore: number;
  strainScore: number;
  verdictLevel: "optimal" | "moderate" | "deficit";
  workoutTitle: string;
  gymMinutes: number;
  cardioMinutes: number;
  totalSets: number;
  totalReps: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  waterLiters: number;
  fiberGrams: number;
  mealsCount: number;
  sleepHours: number;
  sleepQuality: number;
  restingHeartRate: number;
  hrvMs: number;
  dailyNote: string;
  allNotesSummary: Array<{ area: string; text: string }>;
}

export interface ExerciseProgressionItem {
  name: string;
  sessionsCount: number;
  earliestWeight: number;
  latestWeight: number;
  weightDelta: number;
  latestReps: number;
  latestDate: string;
}

export interface PeriodSummaryResult {
  windowDays: 7 | 14 | 30;
  startDate: string;
  endDate: string;
  loggedDaysCount: number;
  workoutDaysCount: number;
  totalGymMinutes: number;
  totalCardioMinutes: number;
  totalSets: number;
  totalReps: number;
  nutritionDaysCount: number;
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFats: number;
  avgWaterLiters: number;
  avgFiberGrams: number;
  proteinTargetHitDays: number;
  sleepDaysCount: number;
  avgSleepHours: number;
  avgSleepQuality: number;
  avgRestingHr: number;
  avgHrvMs: number;
  avgReadinessScore: number;
  optimalDays: number;
  moderateDays: number;
  deficitDays: number;
  dailyRows: DailyHistoryRow[];
  exerciseProgression: ExerciseProgressionItem[];
}

export interface UserFrequentStaple {
  id: string;
  name: string;
  count: number;
  lastDate: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiberGrams: number;
  waterLiters: number;
  weightGrams: number;
  portionLabel: string;
  isPinned: boolean;
  pinnedData?: PinnedFoodStaple;
}

export function isDailyEntryLogged(entry: DailyEntry | undefined): boolean {
  if (!entry) return false;
  const hasWorkout =
    entry.workout.exercises.length > 0 ||
    entry.workout.gymDurationMinutes > 0 ||
    entry.workout.cardioMinutes > 0 ||
    Boolean(entry.workout.note.trim()) ||
    Boolean(entry.workout.sessionTitle.trim());
  const hasNutrition =
    entry.nutrition.meals.length > 0 ||
    entry.nutrition.calories > 0 ||
    entry.nutrition.protein > 0 ||
    entry.nutrition.waterLiters > 0 ||
    Boolean(entry.nutrition.note.trim());
  const hasSleep =
    entry.sleep.totalHours > 0 ||
    entry.sleep.restingHeartRate > 0 ||
    entry.sleep.hrvMs > 0 ||
    Boolean(entry.sleep.note.trim());
  const hasDailyNote = Boolean(entry.dailyNote.trim());
  const hasBodyMetrics = Boolean(
    entry.bodyMetrics &&
      (Number(entry.bodyMetrics.weight) > 0 ||
        Number(entry.bodyMetrics.bodyFatPct) > 0)
  );
  const hasHabits = Boolean(
    entry.habitLogs &&
      Object.values(entry.habitLogs).some(
        (h) =>
          h &&
          (h.status === "yes" ||
            h.status === "no" ||
            (typeof h.value === "string" && h.value.trim().length > 0))
      )
  );
  return hasWorkout || hasNutrition || hasSleep || hasDailyNote || hasBodyMetrics || hasHabits;
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const dt = new Date(`${isoDate}T12:00:00`);
  dt.setDate(dt.getDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

export function computePeriodSummary(
  profile: UserProfileStore,
  endDate: string,
  windowDays: 7 | 14 | 30
): PeriodSummaryResult {
  const startDate = shiftIsoDate(endDate, -(windowDays - 1));
  const matchingDates = Object.keys(profile.days)
    .filter((d) => d >= startDate && d <= endDate && isDailyEntryLogged(profile.days[d]))
    .sort((a, b) => b.localeCompare(a));

  const dailyRows: DailyHistoryRow[] = [];
  let workoutDaysCount = 0;
  let totalGymMinutes = 0;
  let totalCardioMinutes = 0;
  let totalSets = 0;
  let totalReps = 0;

  let nutritionDaysCount = 0;
  let sumCalories = 0;
  let sumProtein = 0;
  let sumCarbs = 0;
  let sumFats = 0;
  let sumWater = 0;
  let sumFiber = 0;
  let proteinTargetHitDays = 0;

  let sleepDaysCount = 0;
  let sumSleepHours = 0;
  let sumSleepQuality = 0;
  let sumRhr = 0;
  let rhrCount = 0;
  let sumHrv = 0;
  let hrvCount = 0;

  let sumReadiness = 0;
  let optimalDays = 0;
  let moderateDays = 0;
  let deficitDays = 0;

  // Chronological ascending map for exercise progression tracking
  const exerciseHistory = new Map<
    string,
    Array<{ date: string; maxWeight: number; repsAtMax: number }>
  >();

  for (const date of [...matchingDates].reverse()) {
    const entry = profile.days[date];
    if (!entry) continue;
    for (const ex of entry.workout.exercises) {
      const nameKey = ex.name.trim();
      if (!nameKey) continue;
      const completed = ex.sets.filter((s) => s.completed);
      const sourceSets = completed.length > 0 ? completed : ex.sets;
      if (sourceSets.length === 0) continue;
      let maxWeight = 0;
      let repsAtMax = sourceSets[0].reps || 0;
      for (const s of sourceSets) {
        const w = Number(s.weight) || 0;
        if (w >= maxWeight) {
          maxWeight = w;
          repsAtMax = Number(s.reps) || 0;
        }
      }
      const list = exerciseHistory.get(nameKey.toLowerCase()) || [];
      list.push({ date, maxWeight, repsAtMax });
      exerciseHistory.set(nameKey.toLowerCase(), list);
    }
  }

  for (const date of matchingDates) {
    const entry = profile.days[date];
    if (!entry) continue;
    const analysis = calculateSufficiencyAnalysis(entry, profile);

    const hasWorkout =
      entry.workout.exercises.length > 0 ||
      entry.workout.gymDurationMinutes > 0 ||
      entry.workout.cardioMinutes > 0;
    if (hasWorkout) {
      workoutDaysCount += 1;
      totalGymMinutes += Number(entry.workout.gymDurationMinutes) || 0;
      totalCardioMinutes += Number(entry.workout.cardioMinutes) || 0;
      totalSets += analysis.totalSets;
      totalReps += analysis.totalReps;
    }

    const hasNutrition =
      entry.nutrition.meals.length > 0 ||
      entry.nutrition.calories > 0 ||
      entry.nutrition.protein > 0;
    if (hasNutrition) {
      nutritionDaysCount += 1;
      sumCalories += Number(entry.nutrition.calories) || 0;
      sumProtein += Number(entry.nutrition.protein) || 0;
      sumCarbs += Number(entry.nutrition.carbs) || 0;
      sumFats += Number(entry.nutrition.fats) || 0;
      sumWater += Number(entry.nutrition.waterLiters) || 0;
      sumFiber += Number(entry.nutrition.fiberGrams) || 0;
      if (
        entry.nutrition.proteinTarget > 0 &&
        entry.nutrition.protein >= entry.nutrition.proteinTarget * 0.9
      ) {
        proteinTargetHitDays += 1;
      }
    }

    if (entry.sleep.totalHours > 0) {
      sleepDaysCount += 1;
      sumSleepHours += Number(entry.sleep.totalHours) || 0;
      sumSleepQuality += Number(entry.sleep.sleepQuality) || 0;
      if (entry.sleep.restingHeartRate > 0) {
        sumRhr += Number(entry.sleep.restingHeartRate);
        rhrCount += 1;
      }
      if (entry.sleep.hrvMs > 0) {
        sumHrv += Number(entry.sleep.hrvMs);
        hrvCount += 1;
      }
    }

    sumReadiness += analysis.readinessScore;
    if (analysis.verdictLevel === "optimal") optimalDays += 1;
    else if (analysis.verdictLevel === "moderate") moderateDays += 1;
    else deficitDays += 1;

    const allNotesSummary: Array<{ area: string; text: string }> = [];
    if (entry.dailyNote.trim()) {
      allNotesSummary.push({ area: "Daily Summary", text: entry.dailyNote.trim() });
    }
    if (entry.workout.note.trim()) {
      allNotesSummary.push({ area: "Workouts", text: entry.workout.note.trim() });
    }
    if (entry.nutrition.note.trim()) {
      allNotesSummary.push({ area: "Nutrition", text: entry.nutrition.note.trim() });
    }
    if (entry.sleep.note.trim()) {
      allNotesSummary.push({ area: "Sleep", text: entry.sleep.note.trim() });
    }

    dailyRows.push({
      date,
      readinessScore: analysis.readinessScore,
      strainScore: analysis.strainScore,
      verdictLevel: analysis.verdictLevel,
      workoutTitle:
        entry.workout.sessionTitle.trim() ||
        (entry.workout.exercises.length > 0
          ? entry.workout.exercises.map((e) => e.name).slice(0, 2).join(", ")
          : "Rest / Unlogged"),
      gymMinutes: Number(entry.workout.gymDurationMinutes) || 0,
      cardioMinutes: Number(entry.workout.cardioMinutes) || 0,
      totalSets: analysis.totalSets,
      totalReps: analysis.totalReps,
      calories: Math.round(Number(entry.nutrition.calories) || 0),
      protein: Math.round(Number(entry.nutrition.protein) || 0),
      carbs: Math.round(Number(entry.nutrition.carbs) || 0),
      fats: Math.round(Number(entry.nutrition.fats) || 0),
      waterLiters: Number((Number(entry.nutrition.waterLiters) || 0).toFixed(1)),
      fiberGrams: Number((Number(entry.nutrition.fiberGrams) || 0).toFixed(1)),
      mealsCount: entry.nutrition.meals.length,
      sleepHours: Number(entry.sleep.totalHours) || 0,
      sleepQuality: Number(entry.sleep.sleepQuality) || 0,
      restingHeartRate: Number(entry.sleep.restingHeartRate) || 0,
      hrvMs: Number(entry.sleep.hrvMs) || 0,
      dailyNote: entry.dailyNote.trim(),
      allNotesSummary,
    });
  }

  // Build display names for exercise progression
  const exerciseProgression: ExerciseProgressionItem[] = [];
  const displayNameMap = new Map<string, string>();
  for (const date of matchingDates) {
    const entry = profile.days[date];
    if (!entry) continue;
    for (const ex of entry.workout.exercises) {
      const k = ex.name.trim().toLowerCase();
      if (k && !displayNameMap.has(k)) {
        displayNameMap.set(k, ex.name.trim());
      }
    }
  }

  for (const [key, records] of exerciseHistory.entries()) {
    if (records.length === 0) continue;
    const first = records[0];
    const last = records[records.length - 1];
    exerciseProgression.push({
      name: displayNameMap.get(key) || key,
      sessionsCount: records.length,
      earliestWeight: first.maxWeight,
      latestWeight: last.maxWeight,
      weightDelta: Number((last.maxWeight - first.maxWeight).toFixed(1)),
      latestReps: last.repsAtMax,
      latestDate: last.date,
    });
  }
  exerciseProgression.sort((a, b) => b.sessionsCount - a.sessionsCount);

  return {
    windowDays,
    startDate,
    endDate,
    loggedDaysCount: matchingDates.length,
    workoutDaysCount,
    totalGymMinutes,
    totalCardioMinutes,
    totalSets,
    totalReps,
    nutritionDaysCount,
    avgCalories:
      nutritionDaysCount > 0 ? Math.round(sumCalories / nutritionDaysCount) : 0,
    avgProtein:
      nutritionDaysCount > 0 ? Math.round(sumProtein / nutritionDaysCount) : 0,
    avgCarbs:
      nutritionDaysCount > 0 ? Math.round(sumCarbs / nutritionDaysCount) : 0,
    avgFats:
      nutritionDaysCount > 0 ? Math.round(sumFats / nutritionDaysCount) : 0,
    avgWaterLiters:
      nutritionDaysCount > 0
        ? Number((sumWater / nutritionDaysCount).toFixed(1))
        : 0,
    avgFiberGrams:
      nutritionDaysCount > 0
        ? Number((sumFiber / nutritionDaysCount).toFixed(1))
        : 0,
    proteinTargetHitDays,
    sleepDaysCount,
    avgSleepHours:
      sleepDaysCount > 0 ? Number((sumSleepHours / sleepDaysCount).toFixed(1)) : 0,
    avgSleepQuality:
      sleepDaysCount > 0
        ? Number((sumSleepQuality / sleepDaysCount).toFixed(1))
        : 0,
    avgRestingHr: rhrCount > 0 ? Math.round(sumRhr / rhrCount) : 0,
    avgHrvMs: hrvCount > 0 ? Math.round(sumHrv / hrvCount) : 0,
    avgReadinessScore:
      matchingDates.length > 0 ? Math.round(sumReadiness / matchingDates.length) : 0,
    optimalDays,
    moderateDays,
    deficitDays,
    dailyRows,
    exerciseProgression: exerciseProgression.slice(0, 8),
  };
}

export function findPreviousWorkoutSession(
  profile: UserProfileStore,
  beforeDate: string,
  preferredTitle?: string
): {
  sourceDate: string;
  sessionTitle: string;
  gymDurationMinutes: number;
  cardioMinutes: number;
  cardioType: string;
  exercises: WorkoutExercise[];
} | null {
  const prevDates = Object.keys(profile.days)
    .filter((d) => d < beforeDate)
    .sort((a, b) => b.localeCompare(a));

  const candidates = prevDates.filter(
    (d) => (profile.days[d]?.workout.exercises.length || 0) > 0
  );
  if (candidates.length === 0) return null;

  const cleanPref = (preferredTitle || "").trim().toLowerCase();
  const matchedDate =
    (cleanPref &&
      candidates.find((d) =>
        profile.days[d].workout.sessionTitle.trim().toLowerCase().includes(cleanPref)
      )) ||
    candidates[0];

  const source = profile.days[matchedDate];
  if (!source) return null;

  const stamp = Date.now();
  const clonedExercises: WorkoutExercise[] = source.workout.exercises.map(
    (ex, exIdx) => ({
      id: `ex-${stamp}-${exIdx}-${Math.random().toString(36).slice(2, 5)}`,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      note: ex.note,
      sets: ex.sets.map((s, sIdx) => ({
        id: `s-${stamp}-${exIdx}-${sIdx}-${Math.random().toString(36).slice(2, 5)}`,
        weight: s.weight,
        reps: s.reps,
        completed: true,
      })),
    })
  );

  return {
    sourceDate: matchedDate,
    sessionTitle: source.workout.sessionTitle,
    gymDurationMinutes: source.workout.gymDurationMinutes,
    cardioMinutes: source.workout.cardioMinutes,
    cardioType: source.workout.cardioType,
    exercises: clonedExercises,
  };
}

export function findPreviousExerciseSets(
  profile: UserProfileStore,
  beforeDate: string,
  exerciseName: string
): { sourceDate: string; sets: ExerciseSet[] } | null {
  const target = exerciseName.trim().toLowerCase();
  if (!target) return null;

  const prevDates = Object.keys(profile.days)
    .filter((d) => d < beforeDate)
    .sort((a, b) => b.localeCompare(a));

  const stamp = Date.now();
  for (const d of prevDates) {
    const match = profile.days[d]?.workout.exercises.find(
      (ex) => ex.name.trim().toLowerCase() === target
    );
    if (match && match.sets.length > 0) {
      return {
        sourceDate: d,
        sets: match.sets.map((s, idx) => ({
          id: `s-${stamp}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          weight: s.weight,
          reps: s.reps,
          completed: true,
        })),
      };
    }
  }
  return null;
}

export function findPreviousRoutineSession(
  profile: UserProfileStore,
  beforeDate: string,
  routineId: string,
  routineName: string
): {
  sourceDate: string;
  gymDurationMinutes: number;
  workoutRating?: number;
  exercises: WorkoutExercise[];
} | null {
  const cleanName = routineName.trim().toLowerCase();
  const prevDates = Object.keys(profile.days)
    .filter((d) => d < beforeDate)
    .sort((a, b) => b.localeCompare(a));

  for (const d of prevDates) {
    const w = profile.days[d]?.workout;
    if (!w || w.exercises.length === 0) continue;
    const matchesId = routineId && w.routineId === routineId;
    const matchesTitle =
      cleanName && w.sessionTitle.trim().toLowerCase() === cleanName;
    if (matchesId || matchesTitle) {
      return {
        sourceDate: d,
        gymDurationMinutes: w.gymDurationMinutes,
        workoutRating: w.workoutRating ?? profile.days[d]?.dailyWorkoutRating,
        exercises: w.exercises,
      };
    }
  }
  return null;
}

export function buildRoutineExercisesWithHistory(
  profile: UserProfileStore,
  beforeDate: string,
  routine: WorkoutRoutineTemplate
): { sourceDate: string | null; exercises: WorkoutExercise[] } {
  const prevSession = findPreviousRoutineSession(
    profile,
    beforeDate,
    routine.id,
    routine.name
  );
  const stamp = Date.now();
  let matchedSourceDate: string | null = prevSession?.sourceDate || null;

  const exercises: WorkoutExercise[] = routine.exercises.map((tpl, exIdx) => {
    const prevFromSession = prevSession?.exercises.find(
      (ex) => ex.name.trim().toLowerCase() === tpl.name.trim().toLowerCase()
    );
    const prevAnywhere = prevFromSession
      ? { sourceDate: prevSession!.sourceDate, sets: prevFromSession.sets }
      : findPreviousExerciseSets(profile, beforeDate, tpl.name);

    if (prevAnywhere && !matchedSourceDate) {
      matchedSourceDate = prevAnywhere.sourceDate;
    }

    const isBodyweight = tpl.exerciseType === "bodyweight";
    const sets: ExerciseSet[] =
      prevAnywhere && prevAnywhere.sets.length > 0
        ? prevAnywhere.sets.map((s, sIdx) => ({
            id: `s-${stamp}-${exIdx}-${sIdx}-${Math.random().toString(36).slice(2, 5)}`,
            weight: isBodyweight ? 0 : Number(s.weight) || 0,
            reps: Number(s.reps) || tpl.baselineReps,
            completed: true,
          }))
        : Array.from({ length: Math.max(1, tpl.defaultSets) }, (_, sIdx) => ({
            id: `s-${stamp}-${exIdx}-${sIdx}-${Math.random().toString(36).slice(2, 5)}`,
            weight: isBodyweight ? 0 : tpl.baselineWeight,
            reps: tpl.baselineReps,
            completed: true,
          }));

    return {
      id: `ex-${stamp}-${exIdx}-${Math.random().toString(36).slice(2, 5)}`,
      name: tpl.name,
      muscleGroup: tpl.muscleGroup,
      exerciseType: tpl.exerciseType,
      targetRepRange: tpl.repRange,
      note: prevAnywhere
        ? `Previous (${prevAnywhere.sourceDate}) · Target ${tpl.repRange} reps`
        : `Target ${tpl.repRange} reps`,
      sets,
    };
  });

  return { sourceDate: matchedSourceDate, exercises };
}

export function computeUserFrequentStaples(
  profile: UserProfileStore,
  limit = 10
): UserFrequentStaple[] {
  const map = new Map<string, UserFrequentStaple>();
  const pinnedList = profile.pinnedStaples || [];
  const pinnedByName = new Map<string, PinnedFoodStaple>();
  for (const pin of pinnedList) {
    pinnedByName.set(pin.name.trim().toLowerCase(), pin);
  }

  const dates = Object.keys(profile.days).sort((a, b) => b.localeCompare(a));
  for (const date of dates) {
    const entry = profile.days[date];
    if (!entry) continue;
    for (const meal of entry.nutrition.meals) {
      const rawName = meal.name.trim();
      if (!rawName) continue;
      const key = rawName.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (date > existing.lastDate) {
          existing.lastDate = date;
          existing.calories = meal.calories;
          existing.protein = meal.protein;
          existing.carbs = meal.carbs;
          existing.fats = meal.fats;
          existing.fiberGrams = meal.fiberGrams ?? existing.fiberGrams;
          existing.waterLiters = meal.waterLiters ?? existing.waterLiters;
          existing.weightGrams = meal.weightGrams ?? existing.weightGrams;
          existing.portionLabel = meal.portionLabel || existing.portionLabel;
        }
      } else {
        const pinMatch = pinnedByName.get(key);
        map.set(key, {
          id: `freq-${key.replace(/[^a-z0-9]/g, "").slice(0, 20)}-${map.size}`,
          name: rawName,
          count: 1,
          lastDate: date,
          calories: Number(meal.calories) || 0,
          protein: Number(meal.protein) || 0,
          carbs: Number(meal.carbs) || 0,
          fats: Number(meal.fats) || 0,
          fiberGrams: Number(meal.fiberGrams) || 0,
          waterLiters: Number(meal.waterLiters) || 0,
          weightGrams: Number(meal.weightGrams) || 100,
          portionLabel:
            meal.portionLabel ||
            (meal.weightGrams ? `${meal.weightGrams}g serving` : "1 serving"),
          isPinned: Boolean(pinMatch),
          pinnedData: pinMatch,
        });
      }
    }
  }

  // Also include pinned staples that haven't been logged yet
  for (const pin of pinnedList) {
    const key = pin.name.trim().toLowerCase();
    if (!map.has(key)) {
      const scale = (pin.defaultGrams || 100) / 100;
      map.set(key, {
        id: pin.id,
        name: pin.name,
        count: 0,
        lastDate: "",
        calories: Math.round(pin.caloriesPer100g * scale),
        protein: Math.round(pin.proteinPer100g * scale),
        carbs: Math.round(pin.carbsPer100g * scale),
        fats: Math.round(pin.fatsPer100g * scale),
        fiberGrams: Number((pin.fiberPer100g * scale).toFixed(1)),
        waterLiters: Number((pin.waterLitersPer100g * scale).toFixed(2)),
        weightGrams: pin.defaultGrams || 100,
        portionLabel: pin.defaultPortionLabel || `${pin.defaultGrams || 100}g`,
        isPinned: true,
        pinnedData: pin,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.lastDate.localeCompare(a.lastDate);
    })
    .slice(0, limit);
}

export function findLastBodyMetricEntry(
  profile: UserProfileStore,
  beforeDate: string,
  field: "weight" | "bodyFatPct"
): { value: number; date: string; daysAgo: number } | null {
  const prevDates = Object.keys(profile.days)
    .filter((d) => d < beforeDate)
    .sort((a, b) => b.localeCompare(a));

  const targetMs = Date.parse(`${beforeDate}T12:00:00Z`);
  for (const d of prevDates) {
    const val = Number(profile.days[d]?.bodyMetrics?.[field]);
    if (Number.isFinite(val) && val > 0) {
      const prevMs = Date.parse(`${d}T12:00:00Z`);
      const daysAgo = Math.max(1, Math.round((targetMs - prevMs) / 86400000));
      return { value: val, date: d, daysAgo };
    }
  }
  return null;
}

export function computeHabitRecoveryImpact(
  profile: UserProfileStore,
  habitId: string
): {
  yesCount: number;
  noCount: number;
  deltaPct: number | null;
  logsNeeded: number;
} {
  let yesCount = 0;
  let yesSum = 0;
  let noCount = 0;
  let noSum = 0;

  for (const date of Object.keys(profile.days)) {
    const entry = profile.days[date];
    if (!entry || entry.sleep.totalHours <= 0) continue;
    const log = entry.habitLogs?.[habitId];
    if (!log) continue;
    const isYes =
      log.status === "yes" ||
      (log.status !== "no" &&
        typeof log.value === "string" &&
        log.value.trim().length > 0);
    const isNo = log.status === "no";
    if (!isYes && !isNo) continue;
    const { readinessScore } = calculateSufficiencyAnalysis(entry, profile);
    if (isYes) {
      yesCount += 1;
      yesSum += readinessScore;
    } else if (isNo) {
      noCount += 1;
      noSum += readinessScore;
    }
  }

  if (yesCount >= 5 && noCount >= 5) {
    const deltaPct = Math.round(yesSum / yesCount - noSum / noCount);
    return { yesCount, noCount, deltaPct, logsNeeded: 0 };
  }

  return {
    yesCount,
    noCount,
    deltaPct: null,
    logsNeeded: Math.max(0, 5 - yesCount) + Math.max(0, 5 - noCount),
  };
}
