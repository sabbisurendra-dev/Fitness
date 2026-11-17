# PulseLoop — Workouts, Nutrition & Sleep Sufficiency Hub (MVP v1)

**PulseLoop** is a URL-first, zero-login mobile and desktop fitness telemetry workspace that unifies **Workouts**, **Nutrition & Macros**, and **Sleep Architecture** inside a real-time **Closed-Loop Recovery & Sufficiency Engine** powered by **Gemini 4 Interactions API** and **3-tier auto-save persistence**.

- **Live Production App:** [https://pulse-loop-fitness.vercel.app](https://pulse-loop-fitness.vercel.app)
- **Custom Athlete Workspaces:** `https://pulse-loop-fitness.vercel.app/u/<slug>` (root `/` defaults to `/u/main`)
- **GitHub Repository:** [https://github.com/sabbisurendra-dev/pulse-loop-fitness](https://github.com/sabbisurendra-dev/pulse-loop-fitness)
- **Vercel Blob Store:** `pulse-loop-fitness-store`

---

## Documentation Index

| Document | Purpose |
| :--- | :--- |
| [docs/MVP_V1_SPECIFICATION.md](docs/MVP_V1_SPECIFICATION.md) | Complete MVP v1 Product, Sufficiency Formula, UI Module, Storage, AI & Resume-Work Specification |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Market Research Synthesis (WHOOP, Oura, Apple, Garmin, Samsung, Fitbit, Hevy, MacroFactor, Cronometer, TrueCoach) & Architectural Decisions |
| [docs/MARKET_RESEARCH_AI_EMPLOYEES.md](docs/MARKET_RESEARCH_AI_EMPLOYEES.md) | Project-Scoped AI Employee Organization, File Ownership Matrix & Top 1% Operating Playbooks |
| [AGENTS.md](AGENTS.md) | Gemini 4 SDK (`@google/genai`) & Secret Hygiene Rules |
| [.agents/rules/qa-gates.md](.agents/rules/qa-gates.md) | Mandatory Post-Edit UX & Technical QA Verification Gates |
| [.agents/rules/ai-employees-org.md](.agents/rules/ai-employees-org.md) | Progressive Disclosure & Multi-Employee Routing Protocol |

---

## Core Features Built in MVP v1

1. **Top Closed-Loop Sufficiency & Readiness Engine (`src/lib/types.ts` — `calculateSufficiencyAnalysis`)**
   - Computes WHOOP-inspired **0–21 Strain** from gym/cardio minutes, completed sets (`completed === true`), and session RPE.
   - Dynamically raises **Strain-Adjusted Sleep Need** (`+0` to `+0.8 hrs`) and **Deep Sleep (SWS) Repair Threshold** (`1.1h–1.5h`) as workout load rises.
   - Checks **Nutrition-to-Strain Sufficiency** (`82–88%` calories and `85–92%` protein by strain tier) and outputs a bounded **Readiness Score (12–99%)**, 3 clinical pillar checks, and a plain-English verdict (`Optimal Recovery Loop`, `Borderline Sufficiency`, or `Recovery / Fueling Deficit`).
2. **Module 1: Workouts & Gym Session (`src/components/FitnessDashboard.tsx`)**
   - Inline session title, gym minutes, session RPE, cardio minutes/type, `KG`/`LBS` unit toggle, and 8 quick-add exercise presets.
   - Hevy-style inline `Set × Weight × Reps × RPE × Volume × Done ✓` table with per-exercise notes and auto-growing session notes.
3. **Module 2: Nutrition, Macros & Health Metrics**
   - 6 inline editable cards (**Calories, Protein, Carbs, Fats, Hydration, Fiber**) with target tracking and progress bars.
   - Hybrid **`useMealSum`** mode: auto-sums from meal rows when enabled, or automatically yields to direct manual overrides when typing into top macro cards.
   - Custom health/supplement metrics (`Creatine`, `Daily Steps`, `Electrolytes`) and inline notes everywhere.
4. **Module 3: Sleep Architecture & Recovery Diagnostic**
   - Configurable **Base Sleep Need**, **Total Sleep**, **Deep Sleep (SWS)**, **REM**, **Sleep Quality**, **Resting HR**, **HRV**, **Bedtime/Wake**, cross-pillar diagnostics, and sleep hygiene notes.
5. **Module 4 & Gemini 4 Interactions AI Hub (`src/app/api/gemini/route.ts`)**
   - Uses official `@google/genai` (`^3.4.0`) `client.interactions.create` with Gemini 4 models (`gemini-4-hydrogen`, `gemini-4-argon`, `gemini-4-carbon`) and deterministic offline fallbacks.
   - Supports **`optimize-day`** (structured recovery prescription + 1-click meal/exercise logging), **`smart-log`** (NLP parser updating workouts, meals, and sleep), and stateful multi-turn **`coach`** (`previous_interaction_id`).
6. **Multi-User URLs & 3-Tier Auto-Save (`src/app/api/state/route.ts`)**
   - Instant `0ms` `localStorage` cache + `380ms` debounced sync -> `/tmp/pulse-loop-fitness-<slug>.json` -> Vercel Blob (`pulse-loop-fitness-store`, `fitness-profiles/<slug>.json`).
   - Adaptive `light-dark()` Dark/Light theme with zero FOUC and mobile-first responsive grids (`360px` / `768px` / `1280px`).

---

## Quickstart & Resume Work

### 1. Install & Configure
```bash
git clone https://github.com/sabbisurendra-dev/pulse-loop-fitness.git
cd pulse-loop-fitness
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
