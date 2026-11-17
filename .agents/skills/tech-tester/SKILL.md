---
name: tech-tester
description: >-
  Project-scoped technical QA, static analysis, business-logic verification, storage
  compatibility, bundle discipline, and security hygiene skill for the PulseLoop
  Fitness, Nutrition & Sleep Sufficiency web app. Use this skill whenever researching
  architecture changes, modifying TypeScript types or sufficiency formulas, editing
  API routes, changing storage logic, or running final build/type/logic verification.
---

# PulseLoop Technical Tester & Invariant Verification Runbook

Use this skill to verify technical correctness, mathematical invariants, storage safety, and build health across `src/lib/types.ts`, `src/app/api/state/route.ts`, `src/components/FitnessDashboard.tsx`, and Next.js configuration files. Every check below has an explicit **PASS / FAIL** criterion.

---

## 1. Git & Branch Hygiene

- **TECH-GIT-01 (Branch Safety & Clean Working State)**:
  - **Check**: Run `git status` and `git branch --show-current` before and after edits.
  - **Pass**: All work respects the active working branch; no destructive git operations (`git reset --hard`, `git push --force`) or unauthorized pushes to protected/remote branches are executed unless explicitly requested by the user.
  - **Fail**: Unintended modifications outside project scope or untracked build artifacts (`.next/`, `node_modules/`, `.env*.local`) staged in git.

---

## 2. Static Checks & Production Build Integrity

- **TECH-BUILD-01 (TypeScript Strict Verification)**:
  - **Check**: Run `npx tsc --noEmit` after the final code edit.
  - **Pass**: Exits with code `0` and zero TypeScript errors under `"strict": true`.
  - **Fail**: Any type mismatch, implicit `any`, or Next.js route signature error (e.g., `params: Promise<{ slug: string }>` in Next.js 15 App Router).
- **TECH-BUILD-02 (Next.js Production Build)**:
  - **Check**: Run `npm run build` (`next build`).
  - **Pass**: Compiles cleanly, generates static/dynamic routes (`/`, `/u/[slug]`, `/api/state`) with zero build or prerender errors.
  - **Fail**: Build fails or top-level module evaluation throws when optional env vars (like `BLOB_READ_WRITE_TOKEN`) are unset at build time.

---

## 3. Pure Business Logic & Data Contract Invariants (`src/lib/types.ts`)

Verify the mathematical and state invariants of `calculateSufficiencyAnalysis(entry, profile)`:

- **TECH-LOGIC-01 (Strain Score & Volume Math Bounds)**:
  - **Check**: Test `calculateSufficiencyAnalysis` with:
    1. Zero gym minutes, zero cardio, and zero completed sets -> `strainScore` must equal `2.0` (rest-day baseline) and `totalVolume = 0`, `totalSets = 0`, `totalReps = 0`.
    2. Extreme workout (`gymDurationMinutes: 180`, `cardioMinutes: 60`, `sessionRpe: 10`, `30` completed sets) -> `strainScore` must clamp at `<= 20.8` (within the `0–21` WHOOP scale).
    3. Mixed completed/uncompleted sets (`completed: false`) -> only sets with `completed === true` contribute to `totalSets`, `totalReps`, and `totalVolume`.
  - **Pass**: All bounds and set completion filters hold with zero `NaN` or negative outputs.
  - **Fail**: Uncompleted sets inflate volume/strain, or extreme inputs exceed `21.0` / produce `NaN`.
- **TECH-LOGIC-02 (Strain-Adjusted Sleep Need & Deep Sleep Thresholds)**:
  - **Check**: Verify `requiredSleepHours` and `requiredDeepSleepHours` across strain tiers:
    - `strainScore <= 6`: `strainSleepAddon = 0`, `requiredDeepSleepHours = 1.1`
    - `6 < strainScore <= 10`: `strainSleepAddon = 0.25`, `requiredDeepSleepHours = 1.1` (or `1.3` when `>= 8`)
    - `10 < strainScore <= 14`: `strainSleepAddon = 0.5`, `requiredDeepSleepHours = 1.3` (or `1.5` when `>= 12`)
    - `strainScore > 14`: `strainSleepAddon = 0.8`, `requiredDeepSleepHours = 1.5`
  - **Pass**: `requiredSleepHours === Number((baselineSleepNeedHours + strainSleepAddon).toFixed(1))` and `deepSleepPercentage` safely returns `0` when `totalHours === 0` (no division-by-zero `NaN`).
  - **Fail**: Division by zero when `totalHours` is `0`, or sleep need ignores workout strain.
- **TECH-LOGIC-03 (Nutrition-to-Strain Sufficiency & Readiness Clamping)**:
  - **Check**: Verify high-strain days (`strainScore >= 12`) require `calRatio >= 0.88` and `proteinRatio >= 0.92`, whereas lower-strain days require `calRatio >= 0.82` and `proteinRatio >= 0.85`; verify `readinessScore` is always an integer clamped within `[12, 99]`.
  - **Pass**: `verdictLevel` transitions deterministically between `"optimal"`, `"moderate"`, and `"deficit"` matching `clinicalPillarChecks`.
  - **Fail**: Zero targets (`calorieTarget: 0` or `proteinTarget: 0`) cause `Infinity`/`NaN`, or `readinessScore` falls outside `[12, 99]`.
- **TECH-LOGIC-04 (Strict Unique ID Lookup Integrity — No Array-Index Fallbacks)**:
  - **Check**: Inspect all CRUD helpers in `src/components/FitnessDashboard.tsx` (`updateExercise`, `removeExercise`, `addSetToExercise`, `updateExerciseSet`, `removeExerciseSet`, `updateMeal`, `removeMeal`, `updateCustomMetric`, `removeCustomMetric`).
  - **Pass**: Every update and deletion targets items strictly by their unique `id` (`ex.id`, `s.id`, `m.id`, `cm.id`), never by array index.
  - **Fail**: Any mutation or deletion uses array index fallback.

---

## 4. Storage, Multi-Slug Isolation & Backward Compatibility (`src/app/api/state/route.ts`)

- **TECH-STORE-01 (Slug Sanitization & Path Traversal Prevention)**:
  - **Check**: Test `sanitizeSlug(raw)` with malicious or malformed inputs (`"../../../etc/passwd"`, `"<script>alert(1)</script>"`, `""`, `null`, and 100-character strings).
  - **Pass**: `sanitizeSlug` lowercases, strips all characters outside `[a-z0-9-_]`, truncates to `<= 48` chars, and falls back to `"main"` if empty—preventing arbitrary file writes in `/tmp/pulse-loop-fitness-${slug}.json` or Vercel Blob `fitness-profiles/${slug}.json`.
  - **Fail**: Unsanitized slug reaches `fs.readFile`, `fs.writeFile`, or Vercel Blob `put()`.
- **TECH-STORE-02 (3-Tier Storage Fallback Resilience)**:
  - **Check**: Verify `GET /api/state?slug=<slug>` and `POST /api/state` when `BLOB_READ_WRITE_TOKEN` is unset, invalid, or network-restricted.
  - **Pass**: Gracefully falls back from `cloud-blob` -> `local-fs` (`/tmp`) -> `default` (`createDefaultUserProfile(slug)`) on read, and writes to `/tmp` + `localStorage` (`pulse-loop-profile-${slug}`) without throwing `500` errors.
  - **Fail**: Missing `BLOB_READ_WRITE_TOKEN` crashes the API route or blocks local persistence.
- **TECH-STORE-03 (Namespace Scoping)**:
  - **Check**: Verify `localStorage` keys (`pulse-loop-profile-${slug}`) and `/tmp` filenames (`pulse-loop-fitness-${slug}.json`) are strictly scoped by `slug`, and date entries (`profile.days[selectedDate]`) are keyed by `YYYY-MM-DD`.
  - **Pass**: Updating or resetting one date or user slug never mutates another date or user slug.
  - **Fail**: Unscoped storage keys overwrite other profiles.

---

## 5. Bundle, Performance & Security Hygiene

- **TECH-PERF-01 (Debounced Auto-Save & Lightweight Dependencies)**:
  - **Check**: Verify `triggerAutoSave` writes to `localStorage` synchronously (`0ms`) for instant UI recovery while debouncing `POST /api/state` network calls (`~380ms` timer cleared on rapid keystrokes).
  - **Pass**: Rapid typing in any input or textarea sends only a single coalesced `POST /api/state` request after typing pauses.
  - **Fail**: Every keystroke fires an un-debounced `POST` request.
- **TECH-SEC-01 (Zero Hardcoded Secrets or PII Leaks)**:
  - **Check**: Scan `src/`, `public/`, and git-tracked files for tokens (`BLOB_READ_WRITE_TOKEN`, `VERCEL_`, API keys) and verify `.gitignore` excludes `.env*.local`, `.vercel/`, `node_modules/`, and `.next/`.
  - **Pass**: Zero secrets or tokens in source or build output; no `dangerouslySetInnerHTML` used with user-supplied data.
  - **Fail**: Any credential committed or user input injected unsanitized into HTML.

---

## Custom Project Tech Test Cases (User-Added)

<!-- Append new user-spoken or user-typed technical test cases below this line using the TECH-CUSTOM-XX format -->

- **TECH-CUSTOM-01 (Default Workout Routines & Previous Session Carryover)**:
  - **Check**: Verify `DEFAULT_WORKOUT_ROUTINES` in `src/lib/routinesAndHabits.ts` contains `Upper Body Home Gym`, `Lower Body Home Gym`, `Upper Body External Gym`, and `Lower Body External Gym`, and `buildRoutineExercisesWithHistory` in `src/lib/historyAndStaples.ts` carries over prior weights/reps while locking `bodyweight` exercises to `weight: 0`.
  - **Pass**: All 4 core routines resolve with valid exercise templates and bodyweight exercises enforce `weight: 0`.
  - **Fail**: Missing routine template or bodyweight carryover applies non-zero weights.

- **TECH-CUSTOM-02 (100-Habit Catalog & Additive Storage Compatibility)**:
  - **Check**: Verify `HABIT_CATALOG` in `src/lib/routinesAndHabits.ts` defines `>= 100` unique habits supporting `"yes_no"` and `"dosage"` formats, and new fields on `DailyEntry` (`bodyMetrics`, `habitLogs`, `checkIn`, `dailyWorkoutRating`) and `UserProfileStore` (`workoutRoutines`, `activeHabitIds`, `customHabitDefinitions`, `bodyFatPct`) are optional.
  - **Pass**: Legacy profiles without new fields load cleanly without runtime errors.
  - **Fail**: Missing optional guards cause undefined crashes on legacy JSON profiles.

- **TECH-CUSTOM-03 (Post-Workout 1–10 Rating Strain & Intensity Math)**:
  - **Check**: Verify `calculateSufficiencyAnalysis` factors `workout.workoutRating ?? entry.dailyWorkoutRating ?? workout.sessionRpe` into `strainScore` and `workoutIntensityScore` while preserving rest-day `2.0` strain and `<= 20.8` max strain bounds.
  - **Pass**: `node scripts/verify-tech.mjs` passes all existing and custom invariants.
  - **Fail**: Any invariant fails or breaks backward-compatible bounds.
