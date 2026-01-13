# iMessage Scheduler

Local-only iMessage scheduler for macOS. 
1. Web app schedules messages,
2. Gateway sends via AppleScript
3. Worker updates delivery status by reading `~/Library/Messages/chat.db`.

## Objective
This project was built to practice systems design under hard constraints, not to build another CRUD app.

Because iMessage has no public API or delivery webhooks, the system is designed around time, state, and ownership of execution. A gateway worker polls, enforces FIFO ordering, applies locking for idempotency, and infers delivery status from local data instead of relying on events.

The goal is to demonstrate reliable workflow design, polling vs event-driven tradeoffs, and stateful systems consideration when standard APIs don’t exist.

## Quick Start

### 1) Install dependencies (Node 22 required)
```bash
# Use Node 22.x (see .nvmrc) 
# installs both dependencies web & gateway
pnpm run setup
```

### 2) Start MySQL
```bash
brew install mysql
brew services start mysql
mysql -uroot -e "CREATE DATABASE imessage_scheduler;"
```

### 3) Configure env
Create `.env` in repo root:
```bash
DATABASE_URL=mysql://root@localhost:3306/imessage_scheduler
GATEWAY_SECRET=dev-secret
GATEWAY_PORT=4001
WEB_PORT=3000
WEB_BASE_URL=http://localhost:3000
```
If your local MySQL user has a password:
```bash
DATABASE_URL=mysql://root:<password>@localhost:3306/imessage_scheduler
```

### 4) Migrate + seed
```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 5) Run the app
```bash
# starts gateway & web 
pnpm run dev
```

### 6) Enable Full Disk Access (receipt tracking)
The gateway reads Messages.app data from `~/Library/Messages/chat.db`.
On macOS:
- System Settings → Privacy & Security → Full Disk Access
- Add your terminal app (Terminal / iTerm) or your IDE (VS Code) and enable it
- Restart the terminal/IDE, then re-run the gateway

Seeded users:
- user1@example.com (free) / password123
- user2@example.com (paid) / password123

---

## Scope & Behavior

- **Local-only**: runs on a single macOS machine, no cloud dependencies.
- **Recipients**: US phone numbers only (normalized to E.164).
- **Timeline**: single-day view, 30‑minute slots, drag-to-create/move, edit/cancel, duplicate.
- **Gateway**: AppleScript send, FIFO worker, per-user rate limiting.
- **Receipts**: best-effort correlation with chat.db and polling for DELIVERED/RECEIVED.
- **UX**: Default scrolling to current time on today's date. Duplicate button for easy creation of mutiple schedules.

Rate limits:
- FREE: 0s min interval, 2 per hour
- PAID: 0s min interval, 30 per hour

---

## Core Logic (High-Level)

1) Web app schedules a message (status = QUEUED).
2) Gateway worker picks next eligible message FIFO, locks it, sends via AppleScript.
3) Web app receives SENT callback and stores receipt correlation metadata.
4) Gateway polls chat.db for delivery/read indicators (receipt) and posts DELIVERED/RECEIVED when detected.

schedule → queued → worker → status callbacks → receipts

---

## Tech Stack

- Next.js (App Router)
- MySQL + Drizzle ORM
- Tailwind + shadcn/ui

---

## Project Structure

- `app/` Next.js app + API routes
- `gateway/` Node gateway + worker + receipt polling
- `packages/shared/` shared types, schemas, helpers
- `docs/` Source of Truth & implementation plans
- `app/lib/db` db logic including .models for shared db queries
