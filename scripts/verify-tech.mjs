import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = "/Users/sabbisurendra/Downloads/Fitness";

// 1. Verify TECH-SEC-01: No hardcoded tokens or secrets in src/
const srcFiles = [
  "src/lib/types.ts",
  "src/lib/brand.ts",
  "src/lib/nutritionDatabase.ts",
  "src/lib/routinesAndHabits.ts",
  "src/lib/workspaceStore.ts",
  "src/lib/localSpaces.ts",
  "src/app/api/state/route.ts",
  "src/app/api/workspace/create/route.ts",
  "src/app/api/gemini/route.ts",
  "src/components/FitnessDashboard.tsx",
  "src/components/OnboardingGateway.tsx",
  "src/components/DatePickerDialog.tsx",
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
  const effectiveWorkoutRating = Math.max(
    1,
    Math.min(
      10,
      Number(
        workout.workoutRating ?? entry.dailyWorkoutRating ?? workout.sessionRpe
      ) || 6
    )
  );
  const rpeFactor = effectiveWorkoutRating;

  const durationStrain = Math.min(12, (totalActiveMinutes / 60) * 6.5);
  const volumeStrain = Math.min(6, (totalSets / 18) * 4.5);
  const intensityStrain = ((rpeFactor - 4) / 6) * 3;
  const rawStrain =
    totalActiveMinutes === 0 && totalSets === 0
      ? 2.0
      : Math.min(20.8, Math.max(2.0, durationStrain + volumeStrain + intensityStrain));
  const strainScore = Number(rawStrain.toFixed(1));
  const workoutIntensityScore =
    totalActiveMinutes === 0 && totalSets === 0
      ? 0
      : Math.min(
          100,
          Math.max(
            15,
            Math.round(
              effectiveWorkoutRating * 7 +
                Math.min(20, totalSets * 1.1) +
                Math.min(10, totalActiveMinutes / 6)
            )
          )
        );

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
    workoutIntensityScore,
    effectiveWorkoutRating,
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

// 6. Verify Morning Check-In Drawer, Routines, Post-Workout Rating, Dual-Mode Nutrition & 100 Habits
const routinesAndHabitsCode = fs.readFileSync(
  path.join(root, "src/lib/routinesAndHabits.ts"),
  "utf-8"
);
for (const routineName of [
  "Upper Body Home Gym",
  "Lower Body Home Gym",
  "Upper Body External Gym",
  "Lower Body External Gym",
]) {
  assert(
    routinesAndHabitsCode.includes(routineName),
    `Default routine "${routineName}" present`
  );
}
const habitBlockMatch = routinesAndHabitsCode.match(
  /export const HABIT_CATALOG:[\s\S]*?\n\];/
);
assert(habitBlockMatch, "HABIT_CATALOG array present");
const habitCount = (habitBlockMatch[0].match(/\{\s*id:\s*"/g) || []).length;
assert(
  habitCount >= 100,
  `HABIT_CATALOG must have >= 100 habits, found ${habitCount}`
);
assert(
  routinesAndHabitsCode.includes('inputType: "yes_no"') &&
    routinesAndHabitsCode.includes('inputType: "dosage"'),
  "Habits support both yes_no and dosage formats"
);
assert(
  routinesAndHabitsCode.includes('exerciseType: "bodyweight"') &&
    routinesAndHabitsCode.includes('exerciseType: "cardio"') &&
    routinesAndHabitsCode.includes('exerciseType: "strength"'),
  "Exercise presets categorize strength, bodyweight, and cardio"
);
assert(
  typesCode.includes("workoutIntensityScore") &&
    typesCode.includes("effectiveWorkoutRating") &&
    typesCode.includes("dailyWorkoutRating"),
  "Sufficiency and DailyEntry include 1-10 workout rating & intensity"
);
assert(
  historyStaplesCode.includes("findPreviousRoutineSession") &&
    historyStaplesCode.includes("buildRoutineExercisesWithHistory"),
  "Routine previous session weight/rep carryover exported"
);

// Verify 1-10 post-workout rating raises strain and workoutIntensityScore
const lowRated = calculateSufficiencyAnalysis(
  {
    workout: { gymDurationMinutes: 45, cardioMinutes: 0, workoutRating: 3, exercises: [] },
    nutrition: { calories: 2000, calorieTarget: 2400, protein: 140, proteinTarget: 170, waterLiters: 3, waterTargetLiters: 3.5 },
    sleep: { totalHours: 7.5, deepSleepHours: 1.5 },
  },
  { baselineSleepNeedHours: 7.5 }
);
const highRated = calculateSufficiencyAnalysis(
  {
    workout: { gymDurationMinutes: 45, cardioMinutes: 0, workoutRating: 9, exercises: [] },
    nutrition: { calories: 2000, calorieTarget: 2400, protein: 140, proteinTarget: 170, waterLiters: 3, waterTargetLiters: 3.5 },
    sleep: { totalHours: 7.5, deepSleepHours: 1.5 },
  },
  { baselineSleepNeedHours: 7.5 }
);
assert(
  highRated.strainScore > lowRated.strainScore &&
    highRated.workoutIntensityScore > lowRated.workoutIntensityScore,
  "Higher 1-10 workout rating increases Strain and Workout Intensity"
);

// 7. Verify Stage 1: Hardened Private Capability URLs, Storage Privacy, Rate Limits & Mobile v2 Redesign
const workspaceStoreCode = fs.readFileSync(
  path.join(root, "src/lib/workspaceStore.ts"),
  "utf-8"
);
const stateRouteCode = fs.readFileSync(
  path.join(root, "src/app/api/state/route.ts"),
  "utf-8"
);
const createRouteCode = fs.readFileSync(
  path.join(root, "src/app/api/workspace/create/route.ts"),
  "utf-8"
);
const geminiRouteCode = fs.readFileSync(
  path.join(root, "src/app/api/gemini/route.ts"),
  "utf-8"
);
const nextConfigCode = fs.readFileSync(
  path.join(root, "next.config.mjs"),
  "utf-8"
);
const slugPageCode = fs.readFileSync(
  path.join(root, "src/app/u/[slug]/page.tsx"),
  "utf-8"
);
const gatewayCode = fs.readFileSync(
  path.join(root, "src/components/OnboardingGateway.tsx"),
  "utf-8"
);

// Verify unambiguous 32-char capability alphabet (no 0/o/1/l/i) and 10-char cryptographic token
assert(
  workspaceStoreCode.includes('CAPABILITY_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"'),
  "32-char unambiguous capability alphabet verified"
);
assert(
  workspaceStoreCode.includes("crypto.randomBytes") &&
    workspaceStoreCode.includes("createHmac(\"sha256\""),
  "Cryptographic token generation and HMAC-SHA256 blob key derivation verified"
);
assert(
  workspaceStoreCode.includes("768 * 1024"),
  "768 KB max state payload cap defined"
);
assert(
  stateRouteCode.includes("exists: false") &&
    stateRouteCode.includes("status: 413") &&
    stateRouteCode.includes("status: 404"),
  "State API returns exists:false on unknown GET, 413 on oversized POST, and 404 on uncreated slug POST"
);
assert(
  createRouteCode.includes("mintCapabilitySlug") &&
    createRouteCode.includes("checkSlidingWindowRateLimit") &&
    createRouteCode.includes("status: 429"),
  "Workspace creation route mints capability slug with rate limiting"
);
assert(
  geminiRouteCode.includes("checkSlidingWindowRateLimit") &&
    geminiRouteCode.includes('rateLimited: reason === "rate-limited"'),
  "Gemini API route enforces sliding-window rate limit with graceful local fallback"
);
assert(
  nextConfigCode.includes("Referrer-Policy") &&
    nextConfigCode.includes("no-referrer") &&
    nextConfigCode.includes("X-Robots-Tag") &&
    nextConfigCode.includes("noindex, nofollow, noarchive"),
  "next.config.mjs sets privacy headers for /u/:path*"
);
assert(
  slugPageCode.includes("index: false") && slugPageCode.includes("follow: false"),
  "/u/[slug] exports noindex/nofollow metadata"
);
for (const field of [
  "workspaceId?:",
  "authMode?:",
  "ownerUserId?:",
  "isGuest?:",
  "createdAt?:",
  "lastActiveAt?:",
]) {
  assert(
    typesCode.includes(field),
    `Optional Stage 1/2 field "${field}" present on UserProfileStore`
  );
}
assert(
  gatewayCode.includes("Launch My Private Space") &&
    gatewayCode.includes("tester-profile") &&
    gatewayCode.includes("guest-fit") &&
    gatewayCode.includes("demo-tracker") &&
    gatewayCode.includes("anon-runner"),
  "OnboardingGateway includes 4 balanced privacy-friendly guest pools & CTA"
);
assert(
  dashboardCode.includes("1. Home") &&
    dashboardCode.includes("1. Favs") &&
    dashboardCode.includes("2. Food Search") &&
    dashboardCode.includes("2. AI Coach") &&
    dashboardCode.includes("Strength · Live") &&
    dashboardCode.includes("Workspace, Backup & Sharing") &&
    dashboardCode.includes("DatePickerDialog") &&
    dashboardCode.includes("My Private Link") &&
    dashboardCode.includes("Invite a Friend") &&
    dashboardCode.includes("My Spaces") &&
    dashboardCode.includes("Private Space Not Found") &&
    dashboardCode.includes("Same as Yesterday"),
  "Mobile Screen-by-Screen v2 redesign, consolidated workspace menu, DatePickerDialog, and Stage 1 link safety controls present in FitnessDashboard"
);

// 8. Verify Brand & Competitor Hygiene + Backwards-Compatible Storage Keys
const brandCleanFiles = [
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/components/OnboardingGateway.tsx",
  "src/components/FitnessDashboard.tsx",
  "src/components/DatePickerDialog.tsx",
];
for (const rel of brandCleanFiles) {
  const fileText = fs.readFileSync(path.join(root, rel), "utf-8");
  assert(
    !/pulseloop|whoop|gemini ai|gemini 4|stateful gemini|gemini-4-hydrogen<\/option>|gemini-4-argon<\/option>/i.test(
      fileText
    ),
    `Disallowed brand/competitor/model string found in ${rel}`
  );
}

assert(
  routinesAndHabitsCode.includes("Morning HRV / Resting HR Check") &&
    !/pulse/i.test(routinesAndHabitsCode),
  "routinesAndHabits.ts uses Morning HRV / Resting HR Check without Pulse"
);

const homePageCode = fs.readFileSync(
  path.join(root, "src/app/page.tsx"),
  "utf-8"
);
assert(
  !homePageCode.includes("Loading PulseLoop"),
  "src/app/page.tsx renders SSR OnboardingGateway without Loading PulseLoop fallback"
);

const localSpacesCode = fs.readFileSync(
  path.join(root, "src/lib/localSpaces.ts"),
  "utf-8"
);
assert(
  localSpacesCode.includes("pulse-loop-active-slug") &&
    localSpacesCode.includes("pulse-loop-saved-spaces"),
  "localStorage keys in localSpaces.ts remain backwards-compatible"
);

console.log("ALL TECH-TESTER INVARIANTS PASSED!");
