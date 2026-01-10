# AGENTS.md

## Purpose
This file defines **global rules for any AI agent (Codex, assistants, codegen tools)** working in this repository.

It establishes the **Sources of Truth (SOT)**, the **UI implementation rules (shadcn/ui strict)**, and required behaviors around planning, commits, tests, and ambiguity.

Agents must read this file before making changes.

---

## Sources of Truth (SOT)
The following two files are the **ONLY Sources of Truth** for this project:

1) **ARCHITECTURE.md**
- system architecture & components
- data model and tables
- state machine and transitions
- gateway/worker contracts
- FIFO and rate-limiting rules
- receipt tracking requirements

2) **NEXT.md**
- committable execution plan
- required human checkpoints
- agent workflow expectations per commit

If there is any conflict between:
- existing code
- comments
- README
- prior agent messages
- “best practices” suggestions

➡️ **ARCHITECTURE.md and NEXT.md win.**

---

## Mandatory Agent Workflow

### 1) Commit discipline (small, committable steps)
- Follow `NEXT.md` commits in order.
- Each commit must be minimal and focused.
- No “big bang” refactors.

After each commit, the agent must provide:
1. Summary of changes
2. How to run
3. Tests added/updated and commands to run them
4. Manual verification steps

### 2) No invented product decisions
Agents must not invent or silently change:
- statuses/state transitions
- FIFO ordering/eligibility rules
- per-user rate limit logic (free vs paid)
- receipt tracking requirement (DELIVERED/RECEIVED)
- timeline grid being required

If ambiguous or missing:
➡️ **STOP and ask the human.**

### 3) Local-only constraints
This app is **local-only** on a single macOS machine.
Do not introduce:
- Vercel/serverless assumptions
- cloud queues or hosted infra
- third-party SaaS dependencies

---

## UI Rules (shadcn/ui Strict Mode)

### Core rule
**Use shadcn/ui components strictly for UI structure whenever possible.**
Do NOT build large UI surfaces from raw HTML `<div class="...">` unless:
- it’s a simple layout wrapper required by shadcn components, OR
- shadcn has no suitable component, OR
- the human explicitly approves custom markup.

### What agents must do before adding UI
1) **Prefer existing shadcn components already installed in the repo**
   - If a component exists in `components/ui/*`, use it.
2) If a component is not present:
   - **Ask the human to add it** using the shadcn CLI, OR
   - If the human previously approved auto-adding components, then add via CLI.
3) Do not “invent” a new design system or custom component library.

### Allowed minimal raw markup
Raw `<div class="...">` is allowed only for:
- page/grid layout containers (e.g. `flex`, `grid`, spacing)
- positioning wrappers required by components
- timeline grid cells and drag overlays (where shadcn does not provide primitives)
- small structural wrappers inside a Card/Popover/Dialog content

Even in these cases:
- keep Tailwind usage minimal
- avoid bespoke styling that duplicates a shadcn component

### Prohibited behaviors
- Creating custom Button/Input/Card styles with raw divs
- Replacing shadcn Dialog/Popover/Dropdown with custom overlays
- Introducing random utility classes for “design language” without referencing shadcn defaults

### Component source of truth
Agents should treat shadcn as the UI “catalog.”
If the agent believes a component is needed:
- it must either:
  - ask the human to add it, OR
  - add it via shadcn CLI (only if pre-approved by the human)

**Default behavior: ask the human.**

---

## What the agent should ask the human for (UI)
If any of these become necessary and not present in the repo, ask the human to add them:
- `button`, `input`, `textarea`
- `dialog`
- `popover`
- `dropdown-menu`
- `select`
- `tabs`
- `tooltip`
- `toast/sonner` (for notifications)
- `table`
- `badge`
- `card`
- `calendar` (if using date picking)
- `separator`
- `sheet` (optional for side panel)

(Agents must check the repo first — only ask if missing.)

---

## Testing Rules
- If NEXT.md says “add tests,” they must be included in that commit.
- Time-based logic (worker/rate limits) must be tested with deterministic time control/mocks where possible.

---

## Security / Secrets Rules (Local-only but still required)
- Never hardcode secrets.
- Use env vars for:
  - DATABASE_URL
  - GATEWAY_SECRET
- Gateway callbacks must validate the secret header.

---

## Required “Stop and Ask Human” Triggers
Agents must pause and ask before:
- changing rate limit numbers or logic
- changing status/state transitions
- changing timeline behavior (granularity, cancel display)
- finalizing receipt tracking logic if chat.db schema differs
- adding new shadcn components (unless explicitly approved to auto-add)

---

## TL;DR for Agents
- **Read ARCHITECTURE.md**
- **Execute NEXT.md**
- **Keep commits small**
- **Ask the human on ambiguity**
- **Use shadcn/ui strictly**
- **Do not invent UI with raw divs unless necessary**
