# PulseLoop AI Employees Organization & Routing Protocol

This project operates as a **project-scoped AI Employee organization** isolated to `/Users/sabbisurendra/Downloads/Fitness`. Each AI employee has a dedicated domain skill (`.agents/skills/<role>/SKILL.md`), a subagent persona (`.agents/agents/<role>.md`), an explicit codebase file-access map, and Top 1% industry best practices documented in `docs/MARKET_RESEARCH_AI_EMPLOYEES.md`.

## 1. Active Project AI Employee Roster

| Role ID | Title | Skill Path | Subagent Path | Primary Domain |
| :--- | :--- | :--- | :--- | :--- |
| `ceo` | Chief Executive Officer | `.agents/skills/ceo/SKILL.md` | `.agents/agents/ceo.md` | Strategy, scope, RICE prioritization, go/no-go |
| `product-manager` | Staff Product Manager | `.agents/skills/product-manager/SKILL.md` | `.agents/agents/product-manager.md` | JTBD, Shape Up pitches, acceptance criteria |
| `market-analyst` | Principal Market Analyst | `.agents/skills/market-analyst/SKILL.md` | `.agents/agents/market-analyst.md` | Wearable benchmarks, positioning, Module 4 |
| `finance-planner` | Strategic Finance & FinOps Lead | `.agents/skills/finance-planner/SKILL.md` | `.agents/agents/finance-planner.md` | Unit economics, Gemini 4 token & Blob FinOps |
| `architect` | Principal System Architect | `.agents/skills/architect/SKILL.md` | `.agents/agents/architect.md` | `src/lib/types.ts`, storage resilience, security |
| `full-stack-builder` | Principal Full-Stack Builder | `.agents/skills/full-stack-builder/SKILL.md` | `.agents/agents/full-stack-builder.md` | Next.js 15 / React 19 UI state, CRUD & APIs |
| `ai-engineer` | Principal AI Engineer | `.agents/skills/ai-engineer/SKILL.md` | `.agents/agents/ai-engineer.md` | `@google/genai`, Gemini 4 Interactions API |
| `designer` | Staff Product Designer | `.agents/skills/designer/SKILL.md` | `.agents/agents/designer.md` | `globals.css`, `light-dark()`, 360px/768px/1280px, A11y |
| `ux-tester` | Principal UX QA Gatekeeper | `.agents/skills/ux-tester/SKILL.md` | — | Responsive, theme parity, interactive UX flows |
| `tech-tester` | Principal Tech QA Gatekeeper | `.agents/skills/tech-tester/SKILL.md` | — | TypeScript, math invariants, storage & security |

## 2. Individual Instruction & Delegation Rules

1. **Progressive Disclosure Routing:** When the user gives an instruction targeting a specific employee (e.g., *"As `designer`..."*, *"@ai-engineer..."*, *"Ask our `finance-planner`..."*) or a single domain, immediately read that employee's `.agents/skills/<role>/SKILL.md` (or delegate to `.agents/agents/<role>.md`) instead of loading unrelated role playbooks.
2. **Respect File Ownership Boundaries:** Operate strictly within the addressed employee's File Ownership & Access Map. When a change crosses boundaries (e.g., `product-manager` needing a new field in `src/lib/types.ts`), hand off explicitly to the owning employee (`architect`).
3. **Multi-Employee Collaboration:** For cross-functional tasks spanning multiple roles (e.g., launching a new module), execute in SOP order (`ceo`/`product-manager` -> `market-analyst`/`finance-planner` -> `architect`/`designer` -> `full-stack-builder`/`ai-engineer` -> `ux-tester`/`tech-tester`) or spawn non-colliding workers via `/teamwork`.
4. **Mandatory QA Gates:** Any code, UI, formula, or API modification by any AI employee MUST pass `.agents/rules/qa-gates.md` (`ux-tester` + `tech-tester`) before reporting completion.
