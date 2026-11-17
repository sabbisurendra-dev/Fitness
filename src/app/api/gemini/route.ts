import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  AiRecoveryPrescription,
  DailyEntry,
  SufficiencyAnalysis,
  UserProfileStore,
  calculateSufficiencyAnalysis,
} from "@/lib/types";
import {
  FoodDatabaseItem,
  searchFoodsCatalog,
} from "@/lib/nutritionDatabase";

export const dynamic = "force-dynamic";

const ALLOWED_MODELS = [
  "gemini-4-hydrogen",
  "gemini-4-argon",
  "gemini-4-carbon",
] as const;

type AllowedGeminiModel = (typeof ALLOWED_MODELS)[number];
type GeminiMode = "optimize-day" | "smart-log" | "coach" | "food-search";

interface SmartLogExercise {
  name: string;
  muscleGroup: string;
  weight: number;
  reps: number;
  sets: number;
  rpe: number;
  note: string;
}

interface SmartLogMeal {
  time: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  note: string;
}

interface SmartLogResult {
  summaryMessage: string;
  exercisesToAdd: SmartLogExercise[];
  mealsToAdd: SmartLogMeal[];
  sleepHoursDelta?: number;
  deepSleepHoursDelta?: number;
  gymMinutesDelta?: number;
  cardioMinutesDelta?: number;
}

function resolveModel(raw: unknown): AllowedGeminiModel {
  if (
    typeof raw === "string" &&
    (ALLOWED_MODELS as readonly string[]).includes(raw)
  ) {
    return raw as AllowedGeminiModel;
  }
  return "gemini-4-hydrogen";
}

function sanitizeSlug(raw: unknown): string {
  const cleaned = (typeof raw === "string" ? raw : "main")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 48);
  return cleaned || "main";
}

function buildTelemetryContext(params: {
  slug: string;
  date: string;
  entry: DailyEntry;
  profile: UserProfileStore;
  analysis: SufficiencyAnalysis;
}): string {
  const { slug, date, entry, profile, analysis } = params;
  const exercisesSummary =
    entry.workout.exercises.length > 0
      ? entry.workout.exercises
          .map(
            (ex) =>
              `- ${ex.name} (${ex.muscleGroup}): ${ex.sets.length} sets (${ex.sets
                .map((s) => `${s.weight}${profile.weightUnit}x${s.reps}`)
                .join(", ")})`
          )
          .join("\n")
      : "- No exercises logged yet";

  const mealsSummary =
    entry.nutrition.meals.length > 0
      ? entry.nutrition.meals
          .map(
            (m) =>
              `- [${m.time}] ${m.name}: ${m.calories} kcal, ${m.protein}g P, ${m.carbs}g C, ${m.fats}g F`
          )
          .join("\n")
      : "- No meals logged yet";

  return [
    `Workspace URL: /u/${slug}`,
    `Date: ${date}`,
    `Athlete Profile: ${profile.displayName}, Unit: ${profile.weightUnit}, Bodyweight: ${profile.bodyweight} ${profile.weightUnit}, Base Sleep Need: ${profile.baselineSleepNeedHours}h`,
    `Sufficiency Verdict: ${analysis.verdictLevel.toUpperCase()} — ${analysis.verdictHeadline}`,
    `Key Scores: Readiness ${analysis.readinessScore}%, Strain ${analysis.strainScore}/21, Total Volume ${analysis.totalVolume} ${profile.weightUnit} across ${analysis.totalSets} sets (${analysis.totalReps} reps)`,
    `Workout: "${entry.workout.sessionTitle}" | Gym ${entry.workout.gymDurationMinutes}m (RPE ${entry.workout.sessionRpe}/10) | Cardio ${entry.workout.cardioMinutes}m (${entry.workout.cardioType || "None"})`,
    `Exercises:\n${exercisesSummary}`,
    `Nutrition: ${entry.nutrition.calories}/${entry.nutrition.calorieTarget} kcal, ${entry.nutrition.protein}/${entry.nutrition.proteinTarget}g protein, ${entry.nutrition.carbs}/${entry.nutrition.carbTarget}g carbs, ${entry.nutrition.fats}/${entry.nutrition.fatTarget}g fats, ${entry.nutrition.waterLiters}/${entry.nutrition.waterTargetLiters}L water, ${entry.nutrition.fiberGrams}g fiber`,
    `Meals:\n${mealsSummary}`,
    `Sleep: ${entry.sleep.totalHours}h total (need ${analysis.requiredSleepHours}h), ${entry.sleep.deepSleepHours}h deep (${analysis.deepSleepPercentage}%, need ${analysis.requiredDeepSleepHours}h), ${entry.sleep.remSleepHours}h REM, Quality ${entry.sleep.sleepQuality}/10, HRV ${entry.sleep.hrvMs}ms, RHR ${entry.sleep.restingHeartRate}bpm`,
    entry.dailyNote ? `Daily Note: ${entry.dailyNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildFallbackPrescription(
  entry: DailyEntry,
  profile: UserProfileStore,
  analysis: SufficiencyAnalysis,
  model: AllowedGeminiModel
): AiRecoveryPrescription {
  const proteinGap = Math.max(
    0,
    entry.nutrition.proteinTarget - entry.nutrition.protein
  );
  const calorieGap = Math.max(
    0,
    entry.nutrition.calorieTarget - entry.nutrition.calories
  );
  const sleepGap = Math.max(0, Number((-analysis.sleepDebtDelta).toFixed(1)));
  const mealProtein = Math.max(25, Math.min(60, proteinGap || 35));
  const mealCalories = Math.max(280, Math.min(750, calorieGap || 420));
  const mealCarbs = Math.max(20, Math.round((mealCalories - mealProtein * 4 - 90) / 4));

  return {
    headline:
      analysis.verdictLevel === "optimal"
        ? `Maintain Peak Loop (${analysis.readinessScore}% Readiness)`
        : `Close ${sleepGap > 0 ? `${sleepGap}h Sleep` : "Fueling"} Gap for Strain ${analysis.strainScore}/21`,
    summary: analysis.verdictExplanation,
    actionItems: [
      sleepGap > 0
        ? `Target ${analysis.requiredSleepHours}h total sleep tonight (+${sleepGap}h vs logged) and dim screens 45m before ${entry.sleep.bedtime || "22:45"}.`
        : `Lock in ${analysis.requiredDeepSleepHours}h+ deep sleep tonight to sustain your ${analysis.readinessScore}% readiness.`,
      proteinGap > 0 || calorieGap > 0
        ? `Add +${proteinGap}g protein and +${calorieGap} kcal to hit your daily targets for ${analysis.totalSets} working sets.`
        : `Protein (${entry.nutrition.protein}g) and calories (${entry.nutrition.calories} kcal) are on target; maintain ${entry.nutrition.waterTargetLiters}L hydration.`,
      `Keep next session volume progressive with controlled eccentrics (${profile.weightUnit}) while monitoring morning HRV (${entry.sleep.hrvMs}ms).`,
    ],
    recommendedMeal: {
      name:
        proteinGap > 20
          ? "Greek Yogurt, Whey Isolate, Blueberries & Honey Bowl"
          : "Casein & Cottage Cheese Overnight Recovery Bowl",
      time: "20:30",
      calories: mealCalories,
      protein: mealProtein,
      carbs: mealCarbs,
      fats: 10,
      note: "Prescribed to support overnight amino-acid availability and deep sleep recovery.",
    },
    recommendedExercise: {
      name:
        analysis.strainScore >= 13
          ? "Incline Walking Mobility & Band Pull-Aparts"
          : "Face Pulls & Rear Delt Recovery Finisher",
      muscleGroup: "Upper Back / Posture",
      weight: profile.weightUnit === "lbs" ? 45 : 20,
      reps: 15,
      sets: 3,
      rpe: 7,
      note: "Low-CNS-fatigue finisher tailored to today's gym strain.",
    },
    model,
    interactionId: `offline_fallback_${Date.now()}`,
    generatedAt: new Date().toISOString(),
  };
}

function buildFallbackSmartLog(
  prompt: string,
  profile: UserProfileStore
): SmartLogResult {
  const lower = prompt.toLowerCase();
  const exercisesToAdd: SmartLogExercise[] = [];
  const mealsToAdd: SmartLogMeal[] = [];
  let gymMinutesDelta = 0;
  let cardioMinutesDelta = 0;
  let sleepHoursDelta = 0;

  const weightMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|lb|lbs)/i);
  const setsRepsMatch = prompt.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (
    lower.includes("squat") ||
    lower.includes("bench") ||
    lower.includes("deadlift") ||
    lower.includes("press") ||
    lower.includes("row") ||
    lower.includes("curl") ||
    setsRepsMatch
  ) {
    exercisesToAdd.push({
      name: prompt.split(",")[0].trim().slice(0, 48) || "Logged Strength Movement",
      muscleGroup: lower.includes("squat") || lower.includes("leg") ? "Legs" : "Strength",
      weight: weightMatch ? Number(weightMatch[1]) : profile.weightUnit === "lbs" ? 135 : 60,
      sets: setsRepsMatch ? Math.min(8, Math.max(1, Number(setsRepsMatch[1]))) : 3,
      reps: setsRepsMatch ? Math.min(30, Math.max(1, Number(setsRepsMatch[2]))) : 10,
      rpe: 8,
      note: `Parsed offline from: "${prompt.slice(0, 80)}"`,
    });
  }

  const kcalMatch = prompt.match(/(\d+)\s*(kcal|cal|calories)/i);
  const protMatch = prompt.match(/(\d+)\s*g?\s*(protein|prot|p\b)/i);
  if (
    kcalMatch ||
    protMatch ||
    lower.includes("shake") ||
    lower.includes("meal") ||
    lower.includes("chicken") ||
    lower.includes("eggs") ||
    lower.includes("salmon") ||
    lower.includes("oat")
  ) {
    const protein = protMatch ? Number(protMatch[1]) : 35;
    const calories = kcalMatch ? Number(kcalMatch[1]) : protein * 8 + 140;
    mealsToAdd.push({
      time: new Date().toTimeString().slice(0, 5),
      name: prompt.slice(0, 60),
      calories,
      protein,
      carbs: Math.round((calories * 0.4) / 4),
      fats: Math.round((calories * 0.25) / 9),
      note: "Parsed offline smart log entry",
    });
  }

  const minMatch = prompt.match(/(\d+)\s*(min|mins|minutes)/i);
  if (minMatch) {
    if (lower.includes("walk") || lower.includes("run") || lower.includes("cardio") || lower.includes("bike")) {
      cardioMinutesDelta = Number(minMatch[1]);
    } else {
      gymMinutesDelta = Number(minMatch[1]);
    }
  }

  const sleepMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours)\s*sleep/i);
  if (sleepMatch) {
    sleepHoursDelta = Number(sleepMatch[1]);
  }

  return {
    summaryMessage: `Logged updates from "${prompt.slice(0, 70)}" (offline heuristic fallback).`,
    exercisesToAdd,
    mealsToAdd,
    sleepHoursDelta,
    deepSleepHoursDelta: 0,
    gymMinutesDelta,
    cardioMinutesDelta,
  };
}

function buildFallbackFoodSearch(query: string): FoodDatabaseItem {
  const localMatches = searchFoodsCatalog(query);
  if (localMatches.length > 0) {
    return localMatches[0];
  }

  const lower = query.toLowerCase();
  const isBeverage =
    lower.includes("juice") ||
    lower.includes("lassi") ||
    lower.includes("smoothie") ||
    lower.includes("shake") ||
    lower.includes("tea") ||
    lower.includes("coffee") ||
    lower.includes("milk") ||
    lower.includes("water") ||
    lower.includes("soup");
  const isHighProtein =
    lower.includes("chicken") ||
    lower.includes("fish") ||
    lower.includes("mutton") ||
    lower.includes("egg") ||
    lower.includes("paneer") ||
    lower.includes("tofu") ||
    lower.includes("prawns") ||
    lower.includes("soy") ||
    lower.includes("steak") ||
    lower.includes("turkey") ||
    lower.includes("whey");

  const title = query
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 64)
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (isBeverage) {
    return {
      id: `food-custom-${Date.now()}`,
      name: title,
      aliases: [lower],
      category: "Hydration & Beverages",
      source: "ICMR-NIN & USDA",
      caloriesPer100g: 48,
      proteinPer100g: 2.2,
      carbsPer100g: 7.5,
      fatsPer100g: 0.9,
      fiberPer100g: 0.4,
      waterLitersPer100g: 0.09,
      portions: [
        { label: "1 glass / cup (250ml)", grams: 250 },
        { label: "1 small cup (150ml)", grams: 150 },
        { label: "1 large bottle (400ml)", grams: 400 },
      ],
    };
  }

  if (isHighProtein) {
    return {
      id: `food-custom-${Date.now()}`,
      name: title,
      aliases: [lower],
      category: "Proteins, Poultry & Fish",
      source: "ICMR-NIN & USDA",
      caloriesPer100g: 175,
      proteinPer100g: 22.0,
      carbsPer100g: 2.5,
      fatsPer100g: 8.2,
      fiberPer100g: 0.4,
      waterLitersPer100g: 0.064,
      portions: [
        { label: "1 medium portion (150g)", grams: 150 },
        { label: "100g portion (100g)", grams: 100 },
        { label: "1 large serving (220g)", grams: 220 },
      ],
    };
  }

  return {
    id: `food-custom-${Date.now()}`,
    name: title,
    aliases: [lower],
    category: "Indian Staples & Meals",
    source: "ICMR-NIN & USDA",
    caloriesPer100g: 145,
    proteinPer100g: 5.5,
    carbsPer100g: 21.0,
    fatsPer100g: 4.2,
    fiberPer100g: 2.8,
    waterLitersPer100g: 0.068,
    portions: [
      { label: "1 medium katori / bowl (150g)", grams: 150 },
      { label: "100g standard serving (100g)", grams: 100 },
      { label: "1 full plate serving (250g)", grams: 250 },
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = body?.mode as GeminiMode;
    const model = resolveModel(body?.model);
    const slug = sanitizeSlug(body?.slug || body?.profile?.slug);
    const date =
      typeof body?.date === "string" && body.date
        ? body.date
        : new Date().toISOString().slice(0, 10);
    const prompt =
      typeof body?.prompt === "string"
        ? body.prompt.trim()
        : typeof body?.query === "string"
        ? body.query.trim()
        : "";
    const previousInteractionId =
      typeof body?.previousInteractionId === "string" &&
      body.previousInteractionId &&
      !body.previousInteractionId.startsWith("offline_fallback_")
        ? body.previousInteractionId
        : undefined;

    if (!["optimize-day", "smart-log", "coach", "food-search"].includes(mode)) {
      return NextResponse.json(
        { error: "Unsupported Gemini interaction mode." },
        { status: 400 }
      );
    }

    if (
      (mode === "smart-log" || mode === "coach" || mode === "food-search") &&
      !prompt
    ) {
      return NextResponse.json(
        { error: "Please enter a query or prompt before sending." },
        { status: 400 }
      );
    }

    const entry = body?.entry as DailyEntry | undefined;
    const profile = body?.profile as UserProfileStore | undefined;

    if (mode !== "food-search" && (!entry || !profile)) {
      return NextResponse.json(
        { error: "Missing entry or profile telemetry payload." },
        { status: 400 }
      );
    }

    const analysis =
      entry && profile ? calculateSufficiencyAnalysis(entry, profile) : null;
    const telemetryContext =
      entry && profile && analysis
        ? buildTelemetryContext({
            slug,
            date,
            entry,
            profile,
            analysis,
          })
        : "";

    const buildFallbackResponse = () => {
      if (mode === "food-search") {
        return NextResponse.json({
          ok: true,
          mode,
          source: "local-fallback",
          model,
          interactionId: `offline_fallback_${Date.now()}`,
          food: buildFallbackFoodSearch(prompt),
        });
      }
      if (mode === "optimize-day" && entry && profile && analysis) {
        return NextResponse.json({
          ok: true,
          mode,
          source: "local-fallback",
          model,
          interactionId: `offline_fallback_${Date.now()}`,
          prescription: buildFallbackPrescription(entry, profile, analysis, model),
        });
      }
      if (mode === "smart-log" && profile) {
        return NextResponse.json({
          ok: true,
          mode,
          source: "local-fallback",
          model,
          interactionId: `offline_fallback_${Date.now()}`,
          parsed: buildFallbackSmartLog(prompt, profile),
        });
      }
      return NextResponse.json({
        ok: true,
        mode,
        source: "local-fallback",
        model,
        interactionId: `offline_fallback_${Date.now()}`,
        reply: analysis
          ? `Offline coach summary for /u/${slug} (${date}): Readiness is ${analysis.readinessScore}% against Strain ${analysis.strainScore}/21. ${analysis.verdictExplanation}`
          : "Offline coach summary unavailable without telemetry payload.",
      });
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return buildFallbackResponse();
    }

    const client = new GoogleGenAI({ apiKey });

    const runGeminiInteraction = async (activeModel: AllowedGeminiModel) => {
      if (mode === "food-search") {
        const interaction = await client.interactions.create({
          model: activeModel,
          system_instruction:
            "You are a clinical nutritionist database using official ICMR-NIN Indian Food Composition Tables (IFCT) and USDA FoodData Central standards. Given any food or beverage query, return accurate nutritional values per 100g (or 100ml) including calories, protein, carbs, fats, dietary fiber, water content in liters (waterLitersPer100g, e.g., 0.085 for 85ml water per 100g), and 3 realistic standard portion sizes with exact gram weights.",
          input: `Lookup standardized global (USDA) and Indian (ICMR-NIN) nutritional data for: "${prompt}"`,
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                category: {
                  type: "string",
                  enum: [
                    "Indian Staples & Meals",
                    "Proteins, Poultry & Fish",
                    "Dairy, Eggs & Plant Protein",
                    "Grains, Oats & Breads",
                    "Fruits, Veggies & Salads",
                    "Nuts, Seeds & Healthy Fats",
                    "Hydration & Beverages",
                  ],
                },
                source: {
                  type: "string",
                  enum: ["ICMR-NIN (India)", "USDA Global", "ICMR-NIN & USDA"],
                },
                caloriesPer100g: { type: "number" },
                proteinPer100g: { type: "number" },
                carbsPer100g: { type: "number" },
                fatsPer100g: { type: "number" },
                fiberPer100g: { type: "number" },
                waterLitersPer100g: { type: "number" },
                portions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      grams: { type: "number" },
                    },
                    required: ["label", "grams"],
                  },
                },
              },
              required: [
                "name",
                "category",
                "source",
                "caloriesPer100g",
                "proteinPer100g",
                "carbsPer100g",
                "fatsPer100g",
                "fiberPer100g",
                "waterLitersPer100g",
                "portions",
              ],
            },
          },
        });

        const parsedFood = JSON.parse(interaction.output_text || "{}") as Omit<
          FoodDatabaseItem,
          "id" | "aliases"
        >;
        const food: FoodDatabaseItem = {
          id: `food-ai-${Date.now()}`,
          aliases: [prompt.toLowerCase()],
          name: parsedFood.name || prompt,
          category: parsedFood.category || "Indian Staples & Meals",
          source: parsedFood.source || "ICMR-NIN & USDA",
          caloriesPer100g: Math.max(0, Number(parsedFood.caloriesPer100g) || 0),
          proteinPer100g: Math.max(0, Number(parsedFood.proteinPer100g) || 0),
          carbsPer100g: Math.max(0, Number(parsedFood.carbsPer100g) || 0),
          fatsPer100g: Math.max(0, Number(parsedFood.fatsPer100g) || 0),
          fiberPer100g: Math.max(0, Number(parsedFood.fiberPer100g) || 0),
          waterLitersPer100g: Math.min(
            0.1,
            Math.max(0, Number(parsedFood.waterLitersPer100g) || 0)
          ),
          portions:
            Array.isArray(parsedFood.portions) && parsedFood.portions.length > 0
              ? parsedFood.portions.map((p) => ({
                  label: p.label,
                  grams: Math.max(1, Number(p.grams) || 100),
                }))
              : [
                  { label: "100g standard serving (100g)", grams: 100 },
                  { label: "1 medium serving (150g)", grams: 150 },
                ],
        };

        return NextResponse.json({
          ok: true,
          mode,
          source: "gemini-interactions-api",
          model: interaction.model || activeModel,
          interactionId: interaction.id,
          food,
        });
      }

      if (mode === "optimize-day") {
        const interaction = await client.interactions.create({
          model: activeModel,
          system_instruction:
            "You are an elite clinical sports physiologist and recovery coach inside PulseLoop Fitness. Analyze the athlete's real-time workout strain, nutrition macros, and sleep architecture, then prescribe concrete recovery steps, one optimal recovery meal, and one accessory/recovery exercise matching their exact weight unit.",
          input: `Analyze this daily telemetry for workspace /u/${slug} on ${date} and return a recovery prescription:\n\n${telemetryContext}`,
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: {
              type: "object",
              properties: {
                headline: { type: "string" },
                summary: { type: "string" },
                actionItems: {
                  type: "array",
                  items: { type: "string" },
                },
                recommendedMeal: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    time: { type: "string" },
                    calories: { type: "number" },
                    protein: { type: "number" },
                    carbs: { type: "number" },
                    fats: { type: "number" },
                    note: { type: "string" },
                  },
                  required: [
                    "name",
                    "time",
                    "calories",
                    "protein",
                    "carbs",
                    "fats",
                    "note",
                  ],
                },
                recommendedExercise: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    muscleGroup: { type: "string" },
                    weight: { type: "number" },
                    reps: { type: "number" },
                    sets: { type: "number" },
                    rpe: { type: "number" },
                    note: { type: "string" },
                  },
                  required: [
                    "name",
                    "muscleGroup",
                    "weight",
                    "reps",
                    "sets",
                    "rpe",
                    "note",
                  ],
                },
              },
              required: [
                "headline",
                "summary",
                "actionItems",
                "recommendedMeal",
                "recommendedExercise",
              ],
            },
          },
        });

        const parsed = JSON.parse(interaction.output_text || "{}") as Omit<
          AiRecoveryPrescription,
          "model" | "interactionId" | "generatedAt"
        >;

        const prescription: AiRecoveryPrescription = {
          ...parsed,
          model: interaction.model || activeModel,
          interactionId: interaction.id,
          generatedAt: new Date().toISOString(),
        };

        return NextResponse.json({
          ok: true,
          mode,
          source: "gemini-interactions-api",
          model: interaction.model || activeModel,
          interactionId: interaction.id,
          prescription,
        });
      }

      if (mode === "smart-log") {
        const interaction = await client.interactions.create({
          model: activeModel,
          system_instruction: `You are a structured fitness, nutrition, and sleep log parser for PulseLoop (/u/${slug}). Convert the user's natural language into structured exercises (${profile?.weightUnit || "kg"}), meals (kcal/protein/carbs/fats), and numeric deltas for sleepHoursDelta, deepSleepHoursDelta, gymMinutesDelta, and cardioMinutesDelta (default deltas to 0 if not mentioned).`,
          input: `Current athlete context:\n${telemetryContext}\n\nNatural-language log input to parse:\n"${prompt}"`,
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: {
              type: "object",
              properties: {
                summaryMessage: { type: "string" },
                exercisesToAdd: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      muscleGroup: { type: "string" },
                      weight: { type: "number" },
                      reps: { type: "number" },
                      sets: { type: "number" },
                      rpe: { type: "number" },
                      note: { type: "string" },
                    },
                    required: [
                      "name",
                      "muscleGroup",
                      "weight",
                      "reps",
                      "sets",
                      "rpe",
                      "note",
                    ],
                  },
                },
                mealsToAdd: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      time: { type: "string" },
                      name: { type: "string" },
                      calories: { type: "number" },
                      protein: { type: "number" },
                      carbs: { type: "number" },
                      fats: { type: "number" },
                      note: { type: "string" },
                    },
                    required: [
                      "time",
                      "name",
                      "calories",
                      "protein",
                      "carbs",
                      "fats",
                      "note",
                    ],
                  },
                },
                sleepHoursDelta: { type: "number" },
                deepSleepHoursDelta: { type: "number" },
                gymMinutesDelta: { type: "number" },
                cardioMinutesDelta: { type: "number" },
              },
              required: ["summaryMessage", "exercisesToAdd", "mealsToAdd"],
            },
          },
        });

        const parsed = JSON.parse(
          interaction.output_text || "{}"
        ) as SmartLogResult;

        return NextResponse.json({
          ok: true,
          mode,
          source: "gemini-interactions-api",
          model: interaction.model || activeModel,
          interactionId: interaction.id,
          parsed,
        });
      }

      // mode === "coach" (Stateful Interactions API with previous_interaction_id)
      const interaction = await client.interactions.create({
        model: activeModel,
        system_instruction:
          "You are the PulseLoop AI Performance Coach embedded directly inside the athlete's live workspace URL. Give concise, practical, evidence-based guidance grounded in their current strain, sleep architecture, and nutrition numbers. Use short bullet points when recommending adjustments.",
        input: `Latest workspace telemetry (/u/${slug}, ${date}):\n${telemetryContext}\n\nAthlete question: ${prompt}`,
        ...(previousInteractionId
          ? { previous_interaction_id: previousInteractionId }
          : {}),
      });

      return NextResponse.json({
        ok: true,
        mode,
        source: "gemini-interactions-api",
        model: interaction.model || activeModel,
        interactionId: interaction.id,
        reply: interaction.output_text || "No response generated.",
      });
    };

    try {
      return await runGeminiInteraction(model);
    } catch (apiErr) {
      if (model !== "gemini-4-hydrogen") {
        try {
          console.warn(
            `Model ${model} failed, retrying with gemini-4-hydrogen:`,
            apiErr
          );
          return await runGeminiInteraction("gemini-4-hydrogen");
        } catch (retryErr) {
          console.warn(
            "Gemini Interactions API retry fallback:",
            retryErr
          );
          return buildFallbackResponse();
        }
      }
      console.warn("Gemini Interactions API network/API fallback:", apiErr);
      return buildFallbackResponse();
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to process Gemini request", detail: String(err) },
      { status: 500 }
    );
  }
}
