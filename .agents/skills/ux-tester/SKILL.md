---
name: ux-tester
description: >-
  Project-scoped UX, accessibility, responsive layout, theme parity, and interactive
  flow verification skill for the PulseLoop Fitness, Nutrition & Sleep Sufficiency web app.
  Use this skill whenever researching UI changes, implementing or modifying components,
  updating workouts/nutrition/sleep modules, adjusting styles in globals.css, or running
  pre-completion visual and interactive verification in a browser.
---

# PulseLoop UX Tester & Interactive Verification Runbook

Use this skill to design, audit, and verify user-facing changes across `/` (`initialSlug="main"`) and `/u/[slug]` (`src/components/FitnessDashboard.tsx`, `src/app/globals.css`, `src/app/layout.tsx`). Every check below has an explicit **PASS / FAIL** criterion.

---

## 1. Responsive Layout & Zero Horizontal Overflow

Verify across all three canonical viewport widths (`360px` Mobile, `768px` Tablet, `1280px` Desktop):

- **UX-RESP-01 (Zero Horizontal Scroll)**:
  - **Check**: Evaluate `document.documentElement.scrollWidth <= window.innerWidth` at `360×800`, `768×1024`, and `1280×900` across all module tabs (`All Modules`, `Workouts`, `Nutrition`, `Sleep & Recovery`, `Market Benchmarks`).
  - **Pass**: `scrollWidth <= innerWidth` on every viewport; wide tables (such as the Hevy-style exercise set/rep/weight table) scroll horizontally inside their own `.overflow-x-auto` container without widening the page body.
  - **Fail**: Any viewport exhibits horizontal page overflow or clipped right-hand controls.
- **UX-RESP-02 (Sticky Header & Filter Pill Wrapping)**:
  - **Check**: Inspect the sticky `<header>` containing the editable dashboard title, `/u/{slug}` badge, `Auto-Saved ✓` pill, `Custom URL` button, `Share Link` button, theme toggle, date picker (`<`, `date`, `>`, `Today`), and module filter pills.
  - **Pass**: Controls wrap cleanly via `flex-wrap` at `360px` without overlapping, truncating button labels, or clipping focus rings.
  - **Fail**: Header elements collide, overflow off-screen, or obscure the top sufficiency banner.
- **UX-RESP-03 (Grid Adaptation Across Modules)**:
  - **Check**: Verify the 4-card Readiness/Strain/Sleep/Fuel gauge strip (`grid-cols-2 sm:grid-cols-4`), the 6-card Nutrition macro grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`), and the 8-column Sleep Architecture grid (`grid-cols-2 sm:grid-cols-4 lg:grid-cols-8`).
  - **Pass**: Cards stack in 2 columns on mobile (`360px`) with legible numbers and expand cleanly at `sm` and `lg` breakpoints.
  - **Fail**: Numeric inputs or unit labels (`kcal`, `hrs`, `kg`/`lbs`) get squished to zero width or overlap adjacent text.

---

## 2. Theme Parity (Dark & Light Modes) & Visual Contrast

- **UX-THEME-01 (Live Dark / Light Mode Toggle & FOUC Prevention)**:
  - **Check**: Click the header theme toggle button (`Switch to light theme` / `Switch to dark theme`) and reload the page.
  - **Pass**: `<meta name="color-scheme">` updates between `"dark"` and `"light"`, `localStorage.getItem("color-scheme")` persists the choice across reloads, `:root` CSS variables (`--bg-canvas`, `--bg-surface`, `--bg-elevated`, `--text-primary`, `--text-muted`, `--border-subtle`) adapt immediately via `light-dark()`, and native browser controls (date/time inputs, scrollbars, checkboxes) match the active scheme.
  - **Fail**: Flash of un-themed content on reload, stuck dark/light surfaces, or unreadable low-contrast text in either mode.
- **UX-THEME-02 (Semantic Sufficiency Banner States)**:
  - **Check**: Trigger all three `verdictLevel` states (`optimal` -> Emerald, `moderate` -> Amber, `deficit` -> Rose) in both Dark and Light themes.
  - **Pass**: Status badges (`Optimal Recovery Loop`, `Borderline Sufficiency`, `Recovery / Fueling Deficit`), icons (`CheckCircle2`, `AlertTriangle`, `AlertOctagon`), and 3 clinical pillar dots communicate state via both text/icons and high-contrast color tokens.
  - **Fail**: Status relies on color alone or becomes illegible in Light Mode.

---

## 3. End-to-End Interactive Flows & Persistence

- **UX-FLOW-01 (Closed-Loop Sufficiency Reactivity)**:
  - **Check**: Edit Workout `Time Spent in Gym (min)` (e.g., `65` -> `120`), add sets/reps, or lower Sleep `Total Sleep Duration (hrs)` (e.g., `7.8` -> `5.5`) and `Deep Sleep / SWS (hrs)` (`1.6` -> `0.8`).
  - **Pass**: The top banner immediately recalculates `Readiness %`, `Gym Strain (/21)`, `Sleep vs Need`, `Deep %`, and the plain-English clinical explanations without requiring a page refresh or "Calculate" button.
  - **Fail**: Stale summary numbers or NaN/Infinity values rendered when inputs are cleared or set to `0`.
- **UX-FLOW-02 (Workouts Inline Logging & Unit Toggle)**:
  - **Check**: Toggle weight unit (`Unit: KG` <-> `Unit: LBS`), click a Quick-Add preset pill (e.g., `+ Barbell Squat`), edit exercise name, muscle group, set weight, reps, RPE, toggle set `Done` checkbox, add/delete a set, and type into per-exercise and session notes.
  - **Pass**: Unchecking a set's `Done` checkbox dims the row (`opacity-50`) and immediately subtracts its sets, reps, and volume (`weight * reps`) from the header total; deleting an exercise or set removes only that target item.
  - **Fail**: Volume math includes unchecked sets, or deleting a set removes the wrong row.
- **UX-FLOW-03 (Nutrition Hybrid Mode — Direct Override vs. Meal Auto-Sum)**:
  - **Check**:
    1. Check `Auto-sum totals from meal rows` (`useMealSum: true`) and edit a meal's `kcal` or `P(g)`. Verify top macro cards update automatically to the sum of all meals.
    2. Directly type a new value into the top `Calories` or `Protein` card. Verify `useMealSum` automatically unchecks (`false`) and preserves the direct manual override.
    3. Add, edit, and remove a Custom Health Metric (`Creatine`, `Daily Steps`, etc.).
  - **Pass**: Both direct macro entry and meal-sum mode work seamlessly without overwriting user intent; progress bars clamp cleanly at `0%–100%`.
  - **Fail**: Typing directly into daily Calories/Macros gets overwritten by meal sums, or division by zero occurs when a target is set to `0`.
- **UX-FLOW-04 (Ubiquitous Inline Notes & Auto-Growing Textareas)**:
  - **Check**: Type multi-line notes into the Daily Master Note, per-exercise note, Workout Session Note, per-meal note, custom metric note, Nutrition Note, and Sleep Note.
  - **Pass**: Every note persists inline; `.auto-grow-textarea` elements expand vertically (`field-sizing: content`, `min-block-size: 2.75lh`, `max-block-size: 10lh`) without horizontal layout shift.
  - **Fail**: Textareas shrink horizontally when typing or lose focus mid-keystroke.
- **UX-FLOW-05 (Auto-Save Persistence, Date Navigation & Custom URL Switcher)**:
  - **Check**:
    1. Edit any metric, observe header badge transition `Saving...` -> `Auto-Saved ✓` / `Cloud Saved ✓` within `~400ms`, reload the page, and verify all edits remain intact.
    2. Switch dates using `< Previous Day`, `Next Day >`, and `Today`, verifying each date maintains its own independent log.
    3. Open `Custom URL`, enter a new slug (e.g., `test-athlete`), submit, and verify navigation to `/u/test-athlete` loads an isolated workspace with `/u/test-athlete` in the header.
  - **Pass**: State persists across reloads per date and per user slug without cross-contaminating `/u/main`.
  - **Fail**: Reloading loses recent edits, or switching dates overwrites today's log.

---

## 4. Accessibility, Mobile Ergonomics & Zero Console/Network Errors

- **UX-A11Y-01 (Keyboard, ARIA Labels & Mobile Keypads)**:
  - **Check**: Audit all inputs and icon-only buttons (`Previous Day`, `Next Day`, `Delete <exercise>`, `Switch to light/dark theme`). Verify numeric fields use `inputMode="numeric"` or `inputMode="decimal"`, and coarse pointer rules set `font-size: max(1rem, 1em)` and `min-block-size: 40px`.
  - **Pass**: Every control has an explicit `<label>` or `aria-label`; live sync badge has `role="status" aria-live="polite"`; tapping inputs on iOS Safari / Android Chrome triggers the right keypad without viewport zoom.
  - **Fail**: Unlabeled icon buttons, missing focus outlines, or `<16px` mobile input font sizes that trigger iOS auto-zoom.
- **UX-CONSOLE-01 (Zero Runtime, Hydration, or Network Errors)**:
  - **Check**: Inspect browser console and network tab during initial load, tab switching, theme toggling, and auto-saving (`GET /api/state`, `POST /api/state`).
  - **Pass**: Zero `console.error`, zero uncaught exceptions, zero React hydration mismatches, and zero failed (`4xx`/`5xx`) asset or API requests.
  - **Fail**: Any console error, hydration warning, or failed `/api/state` request.

---

## Custom Project UX Test Cases (User-Added)

<!-- Append new user-spoken or user-typed UX test cases below this line using the UX-CUSTOM-XX format -->

- **UX-CUSTOM-01 (Morning Check-In Drawer, Completion & 2 PM Sleep Nudge)**:
  - **Check**: Open the conversational slide-over Morning Check-In `<dialog>` drawer when Sleep is unlogged, test `Skip Sleep for Now`, then re-open, enter `Total Sleep Duration` + `Sleep Score (1–10)` + optional `Body Weight` / `Body Fat %`, and click `Complete Check-In`.
  - **Pass**: Auto-approximated sleep metrics update live; once Sleep is logged (`totalHours > 0`), the prominent check-in prompt hides (`Morning Check-In Done`), and the status indicator shows Sleep logged; if Sleep is unlogged at/after 14:00 local time, the Afternoon Sleep Nudge banner appears.
  - **Fail**: Drawer blocks scrolling on body via `overflow: hidden`, fails to hide prominent prompt after sleep is entered, or loses body metrics edits.

- **UX-CUSTOM-02 (WHOOP 5 Workout Routines, Live Timer, Type-Aware Presets & 1–10 Rating)**:
  - **Check**: Tag `Upper Body Home Gym` (verify exercises & rep ranges load with previous session weights if available), toggle `Start Workout` -> `Stop Workout`, select a `Bodyweight` preset (`Push-Ups` showing `0 (BW)`), log quick `Cardio` duration (`15m`), and select a `1–10` post-workout effort rating.
  - **Pass**: Live timer ticks cleanly, stopping captures duration in minutes, bodyweight exercises lock weight to `0` (`0 (BW)`), cardio updates `cardioMinutes`, and selecting `1–10` immediately updates Workout Intensity % and Workout Strain (/21).
  - **Fail**: Bodyweight preset forces manual weight entry or non-zero default weight, or rating does not update Strain/Intensity.

- **UX-CUSTOM-03 (Dual-Mode Quick Nutrition & Pending Indicators)**:
  - **Check**: Toggle between `Quick Totals (kcal + Protein)` and `Log 3–4 Foods Consumed`, add a quick food item, and test `Skip Nutrition`. Check the top Daily Rhythm pending indicator chips.
  - **Pass**: `Nutrition: Not logged yet` indicator updates to logged macros once calories/protein or meals are added; skipping sets neutral skipped state without blocking other modules.
  - **Fail**: Toggling mode overwrites user values unexpectedly or fails to show pending status when unlogged.

- **UX-CUSTOM-04 (WHOOP-Style 100-Habit Journal)**:
  - **Check**: Log a `Yes / No / Blank` habit (e.g., `Morning Sunlight`) and a `Dosage` habit (`Creatine Monohydrate` `5 g` quick chip), open `Choose Habits (100+ Catalog)`, filter/search, toggle active habits, and add a custom habit.
  - **Pass**: At least 100 catalog habits are searchable across 5 categories; active habits persist per profile; individual habits can be left blank or cleared without affecting other days.
  - **Fail**: Catalog shows fewer than 100 habits, blank habits coerce to `"no"`/`"0"`, or dialog overflows at `360px`.

- **UX-CUSTOM-05 (Stage 1 Onboarding Gateway, Auto-Redirect & Link Safety)**:
  - **Check**: Visit `/` on a fresh browser session (verify Welcome Screen + 4 random guest chips + `Refresh` button + zero horizontal overflow at `360px`/`768px`/`1280px`), click `Launch My Private Space →`, verify URL changes to `/u/<prefix>-<10-char-token>`, log an entry and confirm the dismissible "Save Your Private Link" nudge appears, revisit `/` (verify auto-redirect back to `/u/<slug>`), visit `/?new=1` (verify Welcome Screen + Resume Existing Space list without redirect loop), visit `/u/nonexistent-slug-xyz` (verify "Private Space Not Found" with zero console/network errors), and verify `My Private Link` vs `Invite a Friend` copy distinct URLs.
  - **Pass**: Every onboarding, redirect, not-found, and privacy link flow works cleanly in both Dark and Light modes with zero horizontal scroll or console errors.
  - **Fail**: `/` collides on `/u/main`, `/?new=1` traps the user in a redirect loop, typo slugs silently open a blank profile, or `Invite a Friend` leaks the user's private edit URL.

- **UX-CUSTOM-06 (Mobile Screen-by-Screen v2 Layout, Home Check-In & WHOOP 5.0 Flows)**:
  - **Check**: Verify bottom 4-tab bar (`1. Home`, `2. Workouts`, `3. Nutrition`, `4. Habits & AI`), `1–10` Sleep Score 2×5 grid, empty Weight/Body Fat inputs with days-since-logged nudge, WHOOP 5.0 Live Workout dual stopwatch (`01:04` + `REST 00:45`) & Compact Accordion exercise rows with `W/1/2/F` badges, 2-page Nutrition (`1. Favs` + collapsible `Logged Today` | `2. Food Search`), and WHOOP 5.0 Journal (`Same as Yesterday` + `NO|YES` + conditional dosage/time).
  - **Pass**: Each sub-page fits compactly on mobile without 3–4 page vertical scrolling, live stopwatch ticks on the same Workout screen (and shows mini-bar cross-tab), and optional Desktop `Full View` toggle works cleanly.
  - **Fail**: Any tab still reads `"Pulse"`, Sleep Score omits numbers, Weight pre-fills old values as today's input, or `3. Meals` tab remains.
