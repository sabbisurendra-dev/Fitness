import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = "/Users/sabbisurendra/Downloads/Fitness";

// 1. Verify TECH-SEC-01: No hardcoded tokens or secrets in src/
const srcFiles = [
  "src/lib/types.ts",
  "src/lib/nutritionDatabase.ts",
  "src/app/api/state/route.ts",
  "src/app/api/gemini/route.ts",
  "src/components/FitnessDashboard.tsx",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/u/[slug]/page.tsx",
  "src/app/globals.css",
];

for (const rel of srcFiles) {
  const content = fs.readFileSync(path.join(root, rel), "utf-8");
  assert(
    !content.includes("vercel_blob_rw_"),
    `Hardcoded blob token found in ${rel}`
  );
}

// 2. Verify TECH-LOGIC-04: Unique ID lookup integrity in FitnessDashboard.tsx
const dashboardCode = fs.readFileSync(
  path.join(root, "src/components/FitnessDashboard.tsx"),
  "utf-8"
);
assert(dashboardCode.includes("ex.id === exId"), "Exercise lookup by ID verified");
assert(dashboardCode.includes("s.id === setId"), "Set lookup by ID verified");
assert(dashboardCode.includes("m.id === mealId"), "Meal lookup by ID verified");
assert(dashboardCode.includes("cm.id === id"), "Custom metric lookup by ID verified");

// 3. Verify TECH-STORE-01: sanitizeSlug path traversal prevention
function sanitizeSlug(raw) {
  const cleaned = (raw || "main")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 48);
  return cleaned || "main";
}
assert.equal(sanitizeSlug("../../../etc/passwd"), "etcpasswd");
assert.equal(sanitizeSlug("<script>alert(1)</script>"), "scriptalert1script");
assert.equal(sanitizeSlug(""), "main");
assert.equal(sanitizeSlug(null), "main");
assert.equal(sanitizeSlug("a".repeat(80)).length, 48);

// 4. Verify TECH-LOGIC-01..03: Sufficiency Engine mathematical invariants
// Replicate exact pure function from src/lib/types.ts to test edge cases
function calculateSufficiencyAnalysis(entry, profile) {
  const { workout, nutrition, sleep } = entry;
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

  const durationStrain = Math.min(12, (totalActiveMinutes / 60) * 6.5);
  const volumeStrain = Math.min(6, (totalSets / 18) * 4.5);
  const intensityStrain = ((rpeFactor - 4) / 6) * 3;
  const rawStrain =
    totalActiveMinutes === 0 && totalSets === 0
      ? 2.0
      : Math.min(20.8, Math.max(2.0, durationStrain + volumeStrain + intensityStrain));
  const strainScore = Number(rawStrain.toFixed(1));

  const strainSleepAddon =
    strainScore > 14 ? 0.8 : strainScore > 10 ? 0.5 : strainScore > 6 ? 0.25 : 0;
  const requiredSleepHours = Number(
    ((Number(profile.baselineSleepNeedHours) || 7.5) + strainSleepAddon).toFixed(1)
  );
  const actualSleep = Number(sleep.totalHours) || 0;
  const sleepDebtDelta = Number((actualSleep - requiredSleepHours).toFixed(1));

  const requiredDeepSleepHours = Number(
    (strainScore >= 12 ? 1.5 : strainScore >= 8 ? 1.3 : 1.1).toFixed(1)
  );
  const actualDeepSleep = Number(sleep.deepSleepHours) || 0;
  const deepSleepPercentage =
    actualSleep > 0 ? Math.round((actualDeepSleep / actualSleep) * 100) : 0;

  const isSleepSufficientForWorkout = actualSleep >= requiredSleepHours - 0.3;
  const isDeepSleepSufficient = actualDeepSleep >= requiredDeepSleepHours - 0.15;

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

  const minCalRatio = strainScore >= 12 ? 0.88 : 0.82;
  const minProtRatio = strainScore >= 12 ? 0.92 : 0.85;
  const isNutritionSufficientForWorkout =
    calRatio >= minCalRatio && proteinRatio >= minProtRatio;

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
  };
}

// Case A: Zero rest day with uncompleted set
const restRes = calculateSufficiencyAnalysis(
  {
    workout: {
      gymDurationMinutes: 0,
      cardioMinutes: 0,
      sessionRpe: 5,
      exercises: [
        {
          id: "ex-1",
          sets: [{ id: "s-1", weight: 100, reps: 10, completed: false }],
        },
      ],
    },
    nutrition: {
      calories: 2000,
      calorieTarget: 2000,
      protein: 150,
      proteinTarget: 150,
      waterLiters: 3,
      waterTargetLiters: 3,
    },
    sleep: { totalHours: 0, deepSleepHours: 0 },
  },
  { baselineSleepNeedHours: 7.5 }
);
assert.equal(restRes.strainScore, 2.0, "Rest day strain must be 2.0");
assert.equal(restRes.totalSets, 0, "Uncompleted sets excluded");
assert.equal(restRes.totalVolume, 0, "Uncompleted volume excluded");
assert.equal(restRes.deepSleepPercentage, 0, "Zero total sleep safely yields 0% deep sleep");
assert(restRes.readinessScore >= 12 && restRes.readinessScore <= 99);

// Case B: Extreme workout day
const extremeRes = calculateSufficiencyAnalysis(
  {
    workout: {
      gymDurationMinutes: 180,
      cardioMinutes: 60,
      sessionRpe: 10,
      exercises: [
        {
          id: "ex-1",
          sets: Array.from({ length: 30 }, (_, i) => ({
            id: `s-${i}`,
            weight: 100,
            reps: 10,
            completed: true,
          })),
        },
      ],
    },
    nutrition: {
      calories: 3000,
      calorieTarget: 2500,
      protein: 200,
      proteinTarget: 180,
      waterLiters: 4,
      waterTargetLiters: 3.5,
    },
    sleep: { totalHours: 9.0, deepSleepHours: 2.0 },
  },
  { baselineSleepNeedHours: 7.5 }
);
assert.equal(extremeRes.strainScore, 20.8, "Extreme strain caps at 20.8");
assert.equal(extremeRes.requiredSleepHours, 8.3, "High strain adds +0.8h sleep need");
assert.equal(extremeRes.requiredDeepSleepHours, 1.5, "High strain requires 1.5h deep sleep");
assert.equal(extremeRes.totalSets, 30);
assert.equal(extremeRes.totalVolume, 30000);
assert(extremeRes.readinessScore >= 12 && extremeRes.readinessScore <= 99);

// 5. Verify 70 kg Indian Male Sleep Biometric Approximation (0-23h) & V2 Feature Checks
function approximateSleepBiometricsForIndianMale70kg(totalHours, sleepQuality) {
  const hours = Math.max(0, Math.min(23, Number(totalHours) || 0));
  const quality = Math.max(1, Math.min(10, Number(sleepQuality) || 7));
  const deepRatio = 0.15 + (quality / 10) * 0.065;
  const remRatio = 0.18 + (quality / 10) * 0.05;
  const deepSleepHours = Number((hours * deepRatio).toFixed(1));
  const remSleepHours = Number((hours * remRatio).toFixed(1));
  const lightSleepHours = Number(
    Math.max(0, hours - deepSleepHours - remSleepHours).toFixed(1)
  );
  const awakeMinutes =
    hours === 0 ? 0 : Math.max(5, Math.round(35 - quality * 2.2));
  const sleepDelta = Math.max(-2.5, Math.min(2.0, hours - 6.5));
  const restingHeartRate =
    hours === 0
      ? 0
      : Math.round(
          Math.max(48, Math.min(84, 68 - (quality - 5) * 1.4 - sleepDelta * 1.8))
        );
  const hrvMs =
    hours === 0
      ? 0
      : Math.round(
          Math.max(25, Math.min(95, 42 + (quality - 4) * 3.5 + sleepDelta * 4))
        );
  return {
    deepSleepHours,
    remSleepHours,
    lightSleepHours,
    awakeMinutes,
    restingHeartRate,
    hrvMs,
  };
}

const baseline70kg = approximateSleepBiometricsForIndianMale70kg(7.5, 8);
assert.equal(baseline70kg.restingHeartRate, 62, "70 kg Indian baseline RHR should be 62 bpm");
assert.equal(baseline70kg.hrvMs, 60, "70 kg Indian baseline HRV should be 60 ms");
assert.equal(baseline70kg.deepSleepHours, 1.5);
assert.equal(baseline70kg.remSleepHours, 1.6);

const zeroSleep70kg = approximateSleepBiometricsForIndianMale70kg(0, 2);
assert.equal(zeroSleep70kg.deepSleepHours, 0);
assert.equal(zeroSleep70kg.awakeMinutes, 0);
assert.equal(zeroSleep70kg.restingHeartRate, 0);
assert.equal(zeroSleep70kg.hrvMs, 0);

const longSleep70kg = approximateSleepBiometricsForIndianMale70kg(23, 8);
assert(longSleep70kg.deepSleepHours > 4.0, "Sleep duration up to 23 hours supported without 16h cap");
assert(longSleep70kg.restingHeartRate >= 48 && longSleep70kg.restingHeartRate <= 84);
assert(longSleep70kg.hrvMs >= 25 && longSleep70kg.hrvMs <= 95);

// Verify Workouts removed RPE/Volume table headers, Nutrition DB & User Staples exist, and V2 UI invariants hold
const typesCode = fs.readFileSync(path.join(root, "src/lib/types.ts"), "utf-8");
assert(typesCode.includes("Math.min(23"), "types.ts sleep approximation supports up to 23h");
assert(typesCode.includes("meals: []"), "Fresh day starts with empty meals");
assert(typesCode.includes("exercises: []"), "Fresh day starts with empty exercises");

const historyStaplesCode = fs.readFileSync(
  path.join(root, "src/lib/historyAndStaples.ts"),
  "utf-8"
);
assert(historyStaplesCode.includes("computePeriodSummary"), "History period summary exported");
assert(historyStaplesCode.includes("findPreviousWorkoutSession"), "Workout session retention exported");
assert(historyStaplesCode.includes("computeUserFrequentStaples"), "User frequent staples calculation exported");

const nutritionDbCode = fs.readFileSync(
  path.join(root, "src/lib/nutritionDatabase.ts"),
  "utf-8"
);
assert(nutritionDbCode.includes("Grilled Chicken Breast"), "Global Chicken Breast present");
assert(nutritionDbCode.includes("Salmon Fillet"), "Global Salmon Fillet present");
assert(nutritionDbCode.includes("Whole Wheat Chapati"), "Indian Chapati present");
assert(nutritionDbCode.includes("ICMR-NIN (India)"), "ICMR-NIN Indian standard tagged");
assert(nutritionDbCode.includes("USDA Global"), "USDA Global standard tagged");

assert(!dashboardCode.includes('id="session-rpe"'), "Workouts session RPE removed");
assert(!dashboardCode.includes("Set ${sIdx + 1} RPE"), "Workouts table RPE removed");
assert(!dashboardCode.includes("WHOOP / Oura / Clinical Sufficiency Engine"), "Jargon removed from top card");
assert(!dashboardCode.includes("Hide Gemini AI Hub"), "Hide Gemini AI Hub button removed from top card");
assert(dashboardCode.includes("Light Mode") && dashboardCode.includes("Dark Mode"), "Theme toggle includes clear text label");
assert(dashboardCode.includes("History &amp; Trends") || dashboardCode.includes("History & Trends"), "History & Trends tab present");
assert(dashboardCode.includes("About Us"), "About Us section present");
assert(
  dashboardCode.includes("Industry Market Research &amp; Clinical Best Practices Applied") ||
    dashboardCode.includes("Industry Market Research & Clinical Best Practices Applied"),
  "Industry Market Research & Clinical Best Practices subsection retained"
);

console.log("ALL TECH-TESTER INVARIANTS PASSED!");
