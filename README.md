# PulseLoop — Workouts, Nutrition & Sleep Sufficiency Hub (MVP v1)

**PulseLoop** is a URL-first, zero-login mobile and desktop fitness telemetry workspace that unifies **Workouts**, **Nutrition & Macros**, and **Sleep Architecture** inside a real-time **Closed-Loop Recovery & Sufficiency Engine** powered by **Gemini 4 Interactions API** and **3-tier auto-save persistence**.

- **Live Production App:** [https://pulse-loop-fitness.vercel.app](https://pulse-loop-fitness.vercel.app)
- **Custom Athlete Workspaces:** `https://pulse-loop-fitness.vercel.app/u/<slug>` (root `/` defaults to `/u/main`)
- **GitHub Repository:** [https://github.com/sabbisurendra-dev/Fitness](https://github.com/sabbisurendra-dev/Fitness)
- **Vercel Blob Store:** `pulse-loop-fitness-store`

---

## Documentation Index

| Document | Purpose |
| :--- | :--- |
| [docs/MVP_V1_SPECIFICATION.md](docs/MVP_V1_SPECIFICATION.md) | Complete MVP v1 Product, Sufficiency Formula, UI Module, Storage, AI & Resume-Work Specification |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Market Research Synthesis (WHOOP, Oura, Apple, Garmin, Samsung, Fitbit, Hevy, MacroFactor, Cronometer, TrueCoach) & Architectural Decisions |
| [docs/MARKET_RESEARCH_AI_EMPLOYEES.md](docs/MARKET_RESEARCH_AI_EMPLOYEES.md) | Project-Scoped AI Employee Organization, File Ownership Matrix & Top 1% Operating Playbooks |
| [docs/MVP_V1.md](docs/MVP_V1.md) | Product Manager Cumulative Prompt Ledger, OST, JTBD, Updated 3-Feature V1 Specs & Acceptance Criteria |
| [artifacts/](artifacts/) | Preserved Antigravity Brain Artifacts (`MVP_V1.md`, `Market_Research_AI_Employees.md`, `mvp_v1_document.md`, `implementation_plan.md`) & Browser Verification Evidence (`final_step_18.png`) |
| [AGENTS.md](AGENTS.md) | Gemini 4 SDK (`@google/genai`) & Secret Hygiene Rules |
| [.agents/rules/qa-gates.md](.agents/rules/qa-gates.md) | Mandatory Post-Edit UX & Technical QA Verification Gates |
| [.agents/rules/ai-employees-org.md](.agents/rules/ai-employees-org.md) | Progressive Disclosure & Multi-Employee Routing Protocol |

---

## Core Features Built in MVP v1

1. **Top Closed-Loop Sufficiency & Readiness Engine (`src/lib/types.ts` — `calculateSufficiencyAnalysis`)**
   - Computes WHOOP-inspired **0–21 Strain** from gym/cardio minutes and completed sets (`completed === true`).
   - Dynamically raises **Strain-Adjusted Sleep Need** (`+0` to `+0.8 hrs`) and **Deep Sleep (SWS) Repair Threshold** (`1.1h–1.5h`) as workout load rises.
   - Checks **Nutrition-to-Strain Sufficiency** (`82–88%` calories and `85–92%` protein by strain tier) and outputs a bounded **Readiness Score (12–99%)**, 3 clinical pillar checks, and a plain-English verdict (`Optimal Recovery Loop`, `Borderline Sufficiency`, or `Recovery / Fueling Deficit`).
2. **Feature 1: `1. Workouts` (`src/components/FitnessDashboard.tsx`)**
   - Simple, zero-bloat **Exercise Name, Weight & Reps** logger (RPE and Volume UI removed per V1 feedback) with `KG`/`LBS` toggle, `+ Set` / Delete buttons, 8 quick-add presets, gym & cardio minutes, per-exercise notes, and auto-growing session notes.
3. **Feature 2: `2. Nutrition` (`src/lib/nutritionDatabase.ts`, `src/app/api/gemini/route.ts`)**
   - **Open Food Search & Portion Calculator** backed by **ICMR-NIN (India)** + **USDA Global** standards plus live Gemini 4 `food-search` lookup (`Fetch Any Food` with offline fallback).
   - Select portion sizes with explicit gram/ml weights, adjust servings or custom grams, and automatically combine and sum all 6 cards (**Calories, Protein, Carbs, Fats, Hydration, Fiber**).
   - Hybrid **`useMealSum`** mode automatically yields to manual overrides when typing directly into top macro cards.
4. **Feature 3: `3. Sleep & Recovery` (`src/lib/types.ts` — `approximateSleepBiometricsForIndianMale70kg`)**
   - Direct **Total Sleep Duration (hrs)** entry with quick-tap hour pills (`5.5h`–`9h`) and **1–10 Sleep Quality** rating selector (start/stop sleep timer scheduled for V2).
   - Automatically approximates **Deep Sleep (SWS)**, **REM Sleep**, **Resting HR (~62 bpm baseline)**, and **HRV (~60 ms baseline)** calibrated for a standard **70 kg Indian man**, with inline overrides if wearing a tracker.
5. **Feature 4: `About Us` & Gemini 4 Interactions AI Hub (`src/app/api/gemini/route.ts`)**
   - Replaces `Market Benchmarks` tab with **`About Us`**, presenting **The Pitch**, **Our Core USP**, **Core Value Addition**, and the retained & USP-aligned **Industry Market Research & Clinical Best Practices Applied**.
   - Official `@google/genai` (`^3.4.0`) `client.interactions.create` with Gemini 4 models (`gemini-4-hydrogen`, `gemini-4-argon`, `gemini-4-carbon`) supporting **`optimize-day`**, **`smart-log`**, and stateful **`coach`** (`previous_interaction_id`) with deterministic offline fallbacks.
6. **Multi-User URLs & 3-Tier Auto-Save (`src/app/api/state/route.ts`)**
   - Instant `0ms` `localStorage` cache + `380ms` debounced sync -> `/tmp/pulse-loop-fitness-<slug>.json` -> Vercel Blob (`pulse-loop-fitness-store`, `fitness-profiles/<slug>.json`).
   - Adaptive `light-dark()` Dark/Light theme with zero FOUC and mobile-first responsive grids (`360px` / `768px` / `1280px`).

---

## Quickstart & Resume Work

### 1. Install & Configure
```bash
git clone https://github.com/sabbisurendra-dev/Fitness.git
cd Fitness
npm install
```

Create `.env.local` (never commit `.env*.local`):
```bash
GEMINI_API_KEY="your-gemini-api-key"
# Optional locally; falls back cleanly to /tmp local-fs when omitted
BLOB_READ_WRITE_TOKEN="your-vercel-blob-read-write-token"
```

### 2. Run Locally
```bash
npm run dev
```
Visit `http://localhost:3000` (maps to `/u/main`) or `http://localhost:3000/u/<your-name>`.

### 3. Verify Types, Invariants & Build (Mandatory QA Gate)
```bash
npx tsc --noEmit
node scripts/verify-tech.mjs
npm run build
```

### 4. Resume Development with Project-Scoped AI Employees
Address individual PulseLoop AI employees directly in Antigravity IDE (`.agents/skills/<role>/SKILL.md` & `.agents/agents/<role>.md`):
- `@ceo`, `@product-manager`, `@market-analyst`, `@finance-planner`, `@architect`, `@full-stack-builder`, `@ai-engineer`, `@designer`
- Mandatory QA evaluators after every edit: [`ux-tester`](.agents/skills/ux-tester/SKILL.md) and [`tech-tester`](.agents/skills/tech-tester/SKILL.md).
