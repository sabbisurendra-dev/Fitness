import {
  ExerciseType,
  HabitDefinition,
  UserProfileStore,
  WorkoutRoutineTemplate,
} from "./types";

export interface CategorizedExercisePreset {
  name: string;
  muscleGroup: string;
  exerciseType: ExerciseType;
  defaultWeight: number;
  defaultReps: number;
  defaultDurationMinutes?: number;
}

export const CATEGORIZED_EXERCISE_PRESETS: CategorizedExercisePreset[] = [
  // Strength / Gym (Weight + Reps)
  { name: "Barbell Squat", muscleGroup: "Legs", exerciseType: "strength", defaultWeight: 60, defaultReps: 8 },
  { name: "Barbell Bench Press", muscleGroup: "Chest", exerciseType: "strength", defaultWeight: 50, defaultReps: 8 },
  { name: "Romanian Deadlift", muscleGroup: "Hamstrings", exerciseType: "strength", defaultWeight: 60, defaultReps: 10 },
  { name: "Overhead Press", muscleGroup: "Shoulders", exerciseType: "strength", defaultWeight: 35, defaultReps: 8 },
  { name: "Lat Pulldown", muscleGroup: "Back", exerciseType: "strength", defaultWeight: 50, defaultReps: 10 },
  { name: "Seated Cable Row", muscleGroup: "Back", exerciseType: "strength", defaultWeight: 45, defaultReps: 10 },
  { name: "Incline Dumbbell Press", muscleGroup: "Chest", exerciseType: "strength", defaultWeight: 20, defaultReps: 10 },
  { name: "Dumbbell Lateral Raise", muscleGroup: "Shoulders", exerciseType: "strength", defaultWeight: 10, defaultReps: 12 },
  { name: "Cable Tricep Pushdown", muscleGroup: "Arms", exerciseType: "strength", defaultWeight: 25, defaultReps: 12 },
  { name: "Barbell Curl", muscleGroup: "Arms", exerciseType: "strength", defaultWeight: 25, defaultReps: 10 },
  { name: "Leg Press", muscleGroup: "Legs", exerciseType: "strength", defaultWeight: 120, defaultReps: 10 },
  { name: "Bulgarian Split Squat", muscleGroup: "Legs", exerciseType: "strength", defaultWeight: 16, defaultReps: 10 },

  // Bodyweight (Reps Only, weight = 0 automatically)
  { name: "Push-Ups", muscleGroup: "Chest", exerciseType: "bodyweight", defaultWeight: 0, defaultReps: 15 },
  { name: "Pull-Ups / Chin-Ups", muscleGroup: "Back", exerciseType: "bodyweight", defaultWeight: 0, defaultReps: 8 },
  { name: "Bodyweight Dips", muscleGroup: "Arms", exerciseType: "bodyweight", defaultWeight: 0, defaultReps: 12 },
  { name: "Bodyweight Squat", muscleGroup: "Legs", exerciseType: "bodyweight", defaultWeight: 0, defaultReps: 20 },
  { name: "Hanging Leg Raises", muscleGroup: "Core", exerciseType: "bodyweight", defaultWeight: 0, defaultReps: 12 },
  { name: "Bodyweight Calf Raises", muscleGroup: "Calves", exerciseType: "bodyweight", defaultWeight: 0, defaultReps: 20 },

  // Cardio (Duration minutes only)
  { name: "Running", muscleGroup: "Cardio", exerciseType: "cardio", defaultWeight: 0, defaultReps: 0, defaultDurationMinutes: 25 },
  { name: "Incline Treadmill Walk", muscleGroup: "Cardio", exerciseType: "cardio", defaultWeight: 0, defaultReps: 0, defaultDurationMinutes: 20 },
  { name: "Outdoor / Stationary Cycling", muscleGroup: "Cardio", exerciseType: "cardio", defaultWeight: 0, defaultReps: 0, defaultDurationMinutes: 30 },
  { name: "Indoor Rowing", muscleGroup: "Cardio", exerciseType: "cardio", defaultWeight: 0, defaultReps: 0, defaultDurationMinutes: 15 },
  { name: "HIIT Circuit", muscleGroup: "Cardio", exerciseType: "cardio", defaultWeight: 0, defaultReps: 0, defaultDurationMinutes: 15 },
  { name: "Jump Rope", muscleGroup: "Cardio", exerciseType: "cardio", defaultWeight: 0, defaultReps: 0, defaultDurationMinutes: 15 },
];

export const DEFAULT_WORKOUT_ROUTINES: WorkoutRoutineTemplate[] = [
  {
    id: "upper-home",
    name: "Upper Body Home Gym",
    environment: "home",
    focus: "Chest, Back, Shoulders & Arms (Dumbbells + Bodyweight)",
    exercises: [
      {
        id: "uh-1",
        name: "Dumbbell Floor / Bench Press",
        muscleGroup: "Chest",
        exerciseType: "strength",
        defaultSets: 3,
        repRange: "8-12",
        baselineWeight: 20,
        baselineReps: 10,
      },
      {
        id: "uh-2",
        name: "One-Arm Dumbbell Row",
        muscleGroup: "Back",
        exerciseType: "strength",
        defaultSets: 3,
        repRange: "8-12",
        baselineWeight: 22,
        baselineReps: 10,
      },
      {
        id: "uh-3",
        name: "Seated Dumbbell Shoulder Press",
        muscleGroup: "Shoulders",
        exerciseType: "strength",
        defaultSets: 3,
        repRange: "8-12",
        baselineWeight: 16,
        baselineReps: 10,
      },
      {
        id: "uh-4",
        name: "Push-Ups",
        muscleGroup: "Chest",
        exerciseType: "bodyweight",
        defaultSets: 3,
        repRange: "12-20",
        baselineWeight: 0,
        baselineReps: 15,
      },
      {
        id: "uh-5",
        name: "Dumbbell Bicep Curl",
        muscleGroup: "Arms",
        exerciseType: "strength",
        defaultSets: 3,
        repRange: "10-12",
        baselineWeight: 12,
        baselineReps: 12,
      },
      {
        id: "uh-6",
        name: "Overhead Dumbbell Tricep Extension",
        muscleGroup: "Arms",
        exerciseType: "strength",
        defaultSets: 3,
        repRange: "10-15",
        baselineWeight: 14,
        baselineReps: 12,
      },
    ],
  },
  {
    id: "lower-home",
    name: "Lower Body Home Gym",
    environment: "home",
    focus: "Quads, Hamstrings, Glutes & Calves (Dumbbells + Bodyweight)",
    exercises: [
      {
        id: "lh-1",
        name: "Dumbbell Goblet Squat",
        muscleGroup: "Legs",
        exerciseType: "strength",
        defaultSets: 4,
        repRange: "10-12",
        baselineWeight: 24,
        baselineReps: 10,
      },
      {
        id: "lh-2",
        name: "Dumbbell Romanian Deadlift",
        muscleGroup: "Hamstrings",
        exerciseType: "strength",
        defaultSets: 4,
        repRange: "8-12",
        baselineWeight: 28,
        baselineReps: 10,
      },
      {
        id: "lh-3",
        name: "Bulgarian Split Squat",
        muscleGroup: "Legs",
        exerciseType: "strength",
        defaultSets: 3,
        repRange: "10-12",
        baselineWeight: 16,
        baselineReps: 10,
      },
      {
        id: "lh-4",
        name: "Dumbbell Glute Bridge / Hip Thrust",
        muscleGroup: "Glutes",
        exerciseType: "strength",
        defaultSets: 3,
        repRange: "12-15",
        baselineWeight: 24,
        baselineReps: 12,
      },
      {
        id: "lh-5",
        name: "Bodyweight Calf Raises",
        muscleGroup: "Calves",
        exerciseType: "bodyweight",
        defaultSets: 3,
        repRange: "15-25",
        baselineWeight: 0,
        baselineReps: 20,
      },
    ],
  },
  {
    id: "upper-external",
    name: "Upper Body External Gym",
    environment: "external",
    focus: "Barbell, Cable & Machine Upper Hypertrophy",
    exercises: [
      {
        id: "ue-1",
        name: "Barbell Bench Press",
        muscleGroup: "Chest",
        exerciseType: "strength",
        defaultSets: 4,
        repRange: "6-10",
        baselineWeight: 60,
        baselineReps: 8,
      },
      {
        id: "ue-2",
        name: "Lat Pulldown",
        muscleGroup: "Back",
        exerciseType: "strength",
        defaultSets: 4,
        repRange: "8-12",
        baselineWeight: 55,
        baselineReps: 10,
      },
      {
        id: "ue-3",
        name: "Incline Dumbbell Press",
        muscleGroup: "Chest",
        exerciseType: "strength",
        defaultSets: 3,
        repRange: "8-12",
        baselineWeight: 24,
        baselineReps: 10,
      },
      {
        id: "ue-4",
        name: "Seated Cable Row",
        muscleGroup: "Back",
        exerciseType: "strength",
        defaultSets: 3,
        repRange: "8-12",
        baselineWeight: 50,
        baselineReps: 10,
      },
      {
        id: "ue-5",
        name: "Dumbbell Lateral Raise",
        muscleGroup: "Shoulders",
        exerciseType: "strength",
        defaultSets: 3,
        repRange: "12-15",
        baselineWeight: 10,
        baselineReps: 12,
      },
      {
        id: "ue-6",
        name: "Cable Tricep Pushdown",
        muscleGroup: "Arms",
        exerciseType: "strength",
        defaultSets: 3,
        repRange: "10-15",
        baselineWeight: 25,
        baselineReps: 12,
      },
    ],
  },
  {
    id: "lower-external",
    name: "Lower Body External Gym",
    environment: "external",
    focus: "Barbell & Machine Lower Strength",
    exercises: [
      {
        id: "le-1",
        name: "Barbell Squat",
        muscleGroup: "Legs",
        exerciseType: "strength",
        defaultSets: 4,
        repRange: "6-10",
        baselineWeight: 80,
        baselineReps: 8,
      },
      {
        id: "le-2",
        name: "Romanian Deadlift",
        muscleGroup: "Hamstrings",
        exerciseType: "strength",
        defaultSets: 4,
        repRange: "8-10",
        baselineWeight: 75,
        baselineReps: 8,
      },
      {
        id: "le-3",
        name: "Leg Press",
        muscleGroup: "Legs",
        exerciseType: "strength",
        defaultSets: 3,
        repRange: "10-12",
        baselineWeight: 140,
        baselineReps: 10,
      },
      {
        id: "le-4",
        name: "Seated Leg Curl",
        muscleGroup: "Hamstrings",
        exerciseType: "strength",
        defaultSets: 3,
        repRange: "10-15",
        baselineWeight: 45,
        baselineReps: 12,
      },
      {
        id: "le-5",
        name: "Leg Extension",
        muscleGroup: "Quads",
        exerciseType: "strength",
        defaultSets: 3,
        repRange: "12-15",
        baselineWeight: 50,
        baselineReps: 12,
      },
      {
        id: "le-6",
        name: "Standing Machine Calf Raise",
        muscleGroup: "Calves",
        exerciseType: "strength",
        defaultSets: 4,
        repRange: "12-15",
        baselineWeight: 60,
        baselineReps: 15,
      },
    ],
  },
];

export const HABIT_CATALOG: HabitDefinition[] = [
  // Supplements (20)
  { id: "creatine-monohydrate", name: "Creatine Monohydrate", category: "Supplements", inputType: "dosage", unit: "g", defaultValue: "5" },
  { id: "magnesium-glycinate", name: "Magnesium Glycinate", category: "Supplements", inputType: "dosage", unit: "mg", defaultValue: "400" },
  { id: "vitamin-d3", name: "Vitamin D3", category: "Supplements", inputType: "dosage", unit: "IU", defaultValue: "2000" },
  { id: "omega-3-fish-oil", name: "Omega-3 Fish Oil", category: "Supplements", inputType: "dosage", unit: "mg", defaultValue: "1000" },
  { id: "whey-protein-scoop", name: "Whey Protein Supplement", category: "Supplements", inputType: "dosage", unit: "g", defaultValue: "30" },
  { id: "electrolytes-sodium", name: "Electrolytes / Sodium", category: "Supplements", inputType: "dosage", unit: "mg", defaultValue: "1000" },
  { id: "zinc-picolinate", name: "Zinc Picolinate", category: "Supplements", inputType: "dosage", unit: "mg", defaultValue: "15" },
  { id: "ashwagandha-ksm66", name: "Ashwagandha KSM-66", category: "Supplements", inputType: "dosage", unit: "mg", defaultValue: "600" },
  { id: "l-theanine", name: "L-Theanine", category: "Supplements", inputType: "dosage", unit: "mg", defaultValue: "200" },
  { id: "vitamin-c", name: "Vitamin C", category: "Supplements", inputType: "dosage", unit: "mg", defaultValue: "500" },
  { id: "vitamin-b12", name: "Vitamin B12", category: "Supplements", inputType: "dosage", unit: "mcg", defaultValue: "500" },
  { id: "b-complex", name: "B-Complex Vitamin", category: "Supplements", inputType: "yes_no" },
  { id: "multivitamin", name: "Daily Multivitamin", category: "Supplements", inputType: "yes_no" },
  { id: "coq10", name: "CoQ10", category: "Supplements", inputType: "dosage", unit: "mg", defaultValue: "100" },
  { id: "collagen-peptides", name: "Collagen Peptides", category: "Supplements", inputType: "dosage", unit: "g", defaultValue: "15" },
  { id: "probiotic", name: "Probiotic Capsule", category: "Supplements", inputType: "yes_no" },
  { id: "tart-cherry-extract", name: "Tart Cherry Extract", category: "Supplements", inputType: "dosage", unit: "mg", defaultValue: "500" },
  { id: "iron-supplement", name: "Iron Supplement", category: "Supplements", inputType: "dosage", unit: "mg", defaultValue: "18" },
  { id: "pre-workout-caffeine", name: "Pre-Workout Taken", category: "Supplements", inputType: "yes_no" },
  { id: "melatonin", name: "Melatonin", category: "Supplements", inputType: "dosage", unit: "mg", defaultValue: "1" },

  // Sleep Hygiene (20)
  { id: "morning-sunlight", name: "Morning Sunlight Exposure", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "no-screens-before-bed", name: "Screens Off 45m Before Bed", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "blue-light-glasses", name: "Blue-Light Blocking Glasses", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "cool-bedroom", name: "Cool Bedroom (< 20°C)", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "dark-room-sleep", name: "Blackout Room / Sleep Mask", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "consistent-bedtime", name: "Consistent Bedtime Window", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "consistent-wake-time", name: "Consistent Wake Time", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "caffeine-cutoff-2pm", name: "No Caffeine After 2:00 PM", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "late-meal-avoided", name: "No Heavy Meal Within 2h of Bed", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "reading-before-sleep", name: "Read Book Before Sleep", category: "Sleep Hygiene", inputType: "dosage", unit: "min", defaultValue: "20" },
  { id: "mouth-taping", name: "Nasal Breathing / Mouth Tape", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "white-noise-sleep", name: "White Noise / Sound Machine", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "nsdr-yoga-nidra", name: "NSDR / Yoga Nidra", category: "Sleep Hygiene", inputType: "dosage", unit: "min", defaultValue: "15" },
  { id: "evening-wind-down", name: "Evening Wind-Down Routine", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "napping-taken", name: "Daytime Nap", category: "Sleep Hygiene", inputType: "dosage", unit: "min", defaultValue: "20" },
  { id: "no-alcohol-before-bed", name: "Zero Alcohol Before Bed", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "warm-shower-evening", name: "Warm Shower 60m Before Bed", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "phone-outside-bedroom", name: "Phone Charged Outside Bedroom", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "magnesium-bath", name: "Epsom Salt / Magnesium Bath", category: "Sleep Hygiene", inputType: "yes_no" },
  { id: "sleep-debt-recovery", name: "Early Lights-Out Recovery", category: "Sleep Hygiene", inputType: "yes_no" },

  // Recovery (20)
  { id: "cold-shower-plunge", name: "Cold Shower / Ice Plunge", category: "Recovery", inputType: "dosage", unit: "min", defaultValue: "3" },
  { id: "sauna-session", name: "Sauna Session", category: "Recovery", inputType: "dosage", unit: "min", defaultValue: "20" },
  { id: "mobility-stretching", name: "Mobility & Stretching", category: "Recovery", inputType: "dosage", unit: "min", defaultValue: "15" },
  { id: "foam-rolling", name: "Foam Rolling / Myofascial Release", category: "Recovery", inputType: "dosage", unit: "min", defaultValue: "10" },
  { id: "zone-2-recovery-walk", name: "Zone 2 Recovery Walk", category: "Recovery", inputType: "dosage", unit: "min", defaultValue: "30" },
  { id: "massage-percussion", name: "Massage Gun / Deep Tissue", category: "Recovery", inputType: "dosage", unit: "min", defaultValue: "10" },
  { id: "breathwork-box", name: "Breathwork / Box Breathing", category: "Recovery", inputType: "dosage", unit: "min", defaultValue: "10" },
  { id: "compression-boots", name: "Compression Recovery Boots", category: "Recovery", inputType: "dosage", unit: "min", defaultValue: "20" },
  { id: "contrast-therapy", name: "Hot / Cold Contrast Therapy", category: "Recovery", inputType: "yes_no" },
  { id: "active-rest-day", name: "Planned Active Rest Day", category: "Recovery", inputType: "yes_no" },
  { id: "deload-intensity", name: "Low-RPE Deload Session", category: "Recovery", inputType: "yes_no" },
  { id: "post-workout-cooldown", name: "5–10m Post-Workout Cooldown", category: "Recovery", inputType: "yes_no" },
  { id: "red-light-therapy", name: "Red Light Therapy", category: "Recovery", inputType: "dosage", unit: "min", defaultValue: "15" },
  { id: "elevated-legs-recovery", name: "Legs-Up-The-Wall Recovery", category: "Recovery", inputType: "dosage", unit: "min", defaultValue: "10" },
  { id: "joint-warmup-prep", name: "Full Joint Warm-Up Completed", category: "Recovery", inputType: "yes_no" },
  { id: "physio-rehab-drills", name: "Physio / Prehab Drills", category: "Recovery", inputType: "yes_no" },
  { id: "neck-back-decompression", name: "Spine & Neck Decompression", category: "Recovery", inputType: "yes_no" },
  { id: "hrv-morning-check", name: "Morning HRV / Pulse Check", category: "Recovery", inputType: "yes_no" },
  { id: "low-stress-evening", name: "Low-Stress Recovery Evening", category: "Recovery", inputType: "yes_no" },
  { id: "soreness-doms-high", name: "High Muscle Soreness (DOMS)", category: "Recovery", inputType: "yes_no" },

  // Nutrition (20)
  { id: "protein-target-hit", name: "Hit Daily Protein Target", category: "Nutrition", inputType: "yes_no" },
  { id: "calorie-target-hit", name: "Within Daily Calorie Goal", category: "Nutrition", inputType: "yes_no" },
  { id: "water-intake-liters", name: "Total Water Consumed", category: "Nutrition", inputType: "dosage", unit: "L", defaultValue: "3.5" },
  { id: "caffeine-intake-mg", name: "Total Caffeine Consumed", category: "Nutrition", inputType: "dosage", unit: "mg", defaultValue: "150" },
  { id: "alcohol-drinks", name: "Alcoholic Drinks Consumed", category: "Nutrition", inputType: "dosage", unit: "drinks", defaultValue: "0" },
  { id: "added-sugar-free", name: "Zero Refined Sugar / Sweets", category: "Nutrition", inputType: "yes_no" },
  { id: "whole-foods-80pct", name: "80%+ Whole Foods Intake", category: "Nutrition", inputType: "yes_no" },
  { id: "veggies-servings", name: "Vegetable Servings", category: "Nutrition", inputType: "dosage", unit: "servings", defaultValue: "4" },
  { id: "fruit-servings", name: "Fruit Servings", category: "Nutrition", inputType: "dosage", unit: "servings", defaultValue: "2" },
  { id: "fermented-foods", name: "Fermented Foods (Curd / Kefir)", category: "Nutrition", inputType: "yes_no" },
  { id: "post-workout-protein", name: "Post-Workout Protein Within 90m", category: "Nutrition", inputType: "yes_no" },
  { id: "pre-workout-carbs", name: "Pre-Workout Carb Fueling", category: "Nutrition", inputType: "yes_no" },
  { id: "intermittent-fasting", name: "Fasting Window Completed", category: "Nutrition", inputType: "dosage", unit: "hrs", defaultValue: "14" },
  { id: "home-cooked-meals", name: "All Meals Home-Cooked", category: "Nutrition", inputType: "yes_no" },
  { id: "high-fiber-day", name: "Fiber Intake >= 30g", category: "Nutrition", inputType: "yes_no" },
  { id: "omega-rich-meal", name: "Fatty Fish / Walnuts / Chia", category: "Nutrition", inputType: "yes_no" },
  { id: "electrolyte-morning", name: "Morning Hydration + Pinch Salt", category: "Nutrition", inputType: "yes_no" },
  { id: "no-seed-oils-fried", name: "Avoided Deep-Fried / Fast Food", category: "Nutrition", inputType: "yes_no" },
  { id: "herbal-tea-evening", name: "Chamomile / Herbal Tea", category: "Nutrition", inputType: "yes_no" },
  { id: "creatine-with-meal", name: "Took Supplements With Meal", category: "Nutrition", inputType: "yes_no" },

  // Lifestyle (20)
  { id: "daily-steps", name: "Daily Step Count", category: "Lifestyle", inputType: "dosage", unit: "steps", defaultValue: "8000" },
  { id: "outdoor-time", name: "Outdoor Fresh Air Time", category: "Lifestyle", inputType: "dosage", unit: "min", defaultValue: "30" },
  { id: "meditation-mindfulness", name: "Meditation / Mindfulness", category: "Lifestyle", inputType: "dosage", unit: "min", defaultValue: "10" },
  { id: "journaling-gratitude", name: "Evening Reflection / Journaling", category: "Lifestyle", inputType: "yes_no" },
  { id: "deep-work-hours", name: "Focused Deep Work Hours", category: "Lifestyle", inputType: "dosage", unit: "hrs", defaultValue: "4" },
  { id: "posture-desk-breaks", name: "Hourly Standing / Desk Breaks", category: "Lifestyle", inputType: "yes_no" },
  { id: "high-work-stress", name: "High Mental / Work Stress Day", category: "Lifestyle", inputType: "yes_no" },
  { id: "social-connection", name: "Meaningful Social / Family Time", category: "Lifestyle", inputType: "yes_no" },
  { id: "travel-commute-heavy", name: "Heavy Travel / Long Commute", category: "Lifestyle", inputType: "yes_no" },
  { id: "screen-time-controlled", name: "Recreational Screen Time < 2h", category: "Lifestyle", inputType: "yes_no" },
  { id: "morning-routine-done", name: "Morning Routine Completed", category: "Lifestyle", inputType: "yes_no" },
  { id: "ergonomic-standing-desk", name: "Standing Desk Used", category: "Lifestyle", inputType: "dosage", unit: "hrs", defaultValue: "2" },
  { id: "sunlight-lunch-walk", name: "Post-Lunch 10m Walk", category: "Lifestyle", inputType: "yes_no" },
  { id: "evening-walk-dinner", name: "Post-Dinner 10m Walk", category: "Lifestyle", inputType: "yes_no" },
  { id: "illness-symptoms", name: "Mild Illness / Cold Symptoms", category: "Lifestyle", inputType: "yes_no" },
  { id: "allergies-flared", name: "Seasonal Allergies / Congestion", category: "Lifestyle", inputType: "yes_no" },
  { id: "hydration-carry-bottle", name: "Carried Water Bottle All Day", category: "Lifestyle", inputType: "yes_no" },
  { id: "music-relaxation", name: "Relaxing Music / Downtime", category: "Lifestyle", inputType: "yes_no" },
  { id: "nature-time-weekend", name: "Park / Nature Walk", category: "Lifestyle", inputType: "yes_no" },
  { id: "clean-workspace", name: "Prepared Next-Day Gym / Gear", category: "Lifestyle", inputType: "yes_no" },
];

export const DEFAULT_ACTIVE_HABIT_IDS: string[] = [
  "creatine-monohydrate",
  "magnesium-glycinate",
  "vitamin-d3",
  "morning-sunlight",
  "daily-steps",
];

export function getEffectiveRoutines(
  profile: UserProfileStore
): WorkoutRoutineTemplate[] {
  const custom = profile.workoutRoutines || [];
  if (custom.length === 0) return DEFAULT_WORKOUT_ROUTINES;
  const customIds = new Set(custom.map((r) => r.id));
  return [
    ...custom,
    ...DEFAULT_WORKOUT_ROUTINES.filter((d) => !customIds.has(d.id)),
  ];
}

export function getAllHabitDefinitions(
  profile: UserProfileStore
): HabitDefinition[] {
  const custom = profile.customHabitDefinitions || [];
  const customIds = new Set(custom.map((h) => h.id));
  return [
    ...custom,
    ...HABIT_CATALOG.filter((h) => !customIds.has(h.id)),
  ];
}

export function getActiveHabitsForProfile(
  profile: UserProfileStore
): HabitDefinition[] {
  const activeIds =
    profile.activeHabitIds && profile.activeHabitIds.length > 0
      ? profile.activeHabitIds
      : DEFAULT_ACTIVE_HABIT_IDS;
  const all = getAllHabitDefinitions(profile);
  const byId = new Map(all.map((h) => [h.id, h]));
  return activeIds
    .map((id) => byId.get(id))
    .filter((h): h is HabitDefinition => Boolean(h));
}
