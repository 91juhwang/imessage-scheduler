# ARCHITECTURE.md

## Purpose (SOT)
This document is the Source of Truth (SOT) for the **local-only iMessage Scheduler** implementation.

**SOT files:**
- `ARCHITECTURE.md` (this file): architecture, contracts, data model, state machine
- `NEXT.md`: detailed, committable execution plan and required human checkpoints

Everything runs **locally on one macOS machine** over `localhost`.

Runtime requirements:
- Node.js 22.x (native sqlite module build)

---

## Confirmed Requirements
- Stack: Next.js (App Router), Drizzle ORM, MySQL, Tailwind, shadcn/ui
- **Browser UI** for scheduling iMessages
- **Timeline grid scheduling UI is required** (drag-to-create and drag-to-move)
- Backend processes scheduled messages as a **FIFO queue**
- Send rate limiting is **per signed-in user**
  - free vs paid determined by `users.paid_user`
- iMessage sending via **local macOS gateway** using AppleScript
- Gateway reports statuses back:
  - QUEUED, SENDING, SENT, DELIVERED, RECEIVED, FAILED, CANCELED
- Dashboard shows queue/history and failures
- Tests for endpoints and key UI functionality
- README explains architecture, how to run locally, and tradeoffs
 - **Recipients are US phone numbers only** (normalized to E.164)

---

## Simplification Strategy (Scope Control)
To keep this manageable for MVP:
- Only **3 core tables** for the domain:
  1) `users`
  2) `messages` (single table combining schedule + execution job)
  3) `user_rate_limit` (per-user throttle bookkeeping)
  4) `sessions`: server-side sessions for fake auth

We do NOT implement:
- Separate scheduled_messages/message_jobs split
- Separate gateway_events audit log table (we’ll store last_error + receipt_correlation JSON in messages)

Worker:
- Runs locally; simplest is to **embed the worker loop inside the gateway process** so you start one gateway process and it both serves HTTP and drains the queue.

---

## High-Level Components

### 1) Web App (Next.js)
Responsibilities:
- Simple multi-user fake auth (seed user1 free, user2 paid)
- Timeline grid scheduling UI (single day, 30-minute slots)
- Dashboard UI
- API routes:
  - auth
  - CRUD messages
  - gateway status callback

### 2) Database (MySQL)
Responsibilities:
- Persist users, sessions, messages, rate limit state
- Support FIFO queries + locking update

### 3) Gateway + Worker (macOS Node process)
Responsibilities:
- AppleScript send via Messages.app
- Embedded worker loop:
  - FIFO select + per-user rate limit
  - lock + mark SENDING
  - send
  - callback to web app with SENT/FAILED
- Worker updates `user_rate_limit` on successful send
- Receipt tracking attempt:
  - correlate message in Messages storage (likely chat.db)
  - detect and callback DELIVERED/RECEIVED

---

## Data Model (Authoritative)

### users
- `id` uuid pk
- `email` varchar unique
- `password_hash` varchar
- `paid_user` boolean default false
- `created_at` datetime

Seed:
- user1 (free)
- user2 (paid)

### sessions (recommended for take-home clarity)
- `id` uuid pk (session id)
- `user_id` uuid fk -> users.id
- `expires_at` datetime
- `created_at` datetime

Cookie stores session id.

### messages (single table for schedule + job)
- `id` uuid pk
- `user_id` uuid fk -> users.id
- `to_handle` varchar
- `body` text
- `scheduled_for_utc` datetime
- `timezone` varchar

Status:
- `status` enum:
  - `QUEUED`
  - `SENDING`
  - `SENT`
  - `DELIVERED`
  - `RECEIVED`
  - `FAILED`
  - `CANCELED`

Retry & error:
- `attempt_count` int default 0
- `last_error` text nullable

Locking:
- `locked_at` datetime nullable
- `locked_by` varchar nullable

Gateway fields:
- `gateway_message_id` varchar nullable

Receipt fields:
- `delivered_at` datetime nullable
- `received_at` datetime nullable
- `receipt_correlation` json nullable
  - recommended keys:
    `{ method, handle, bodyHash, sentAt, chatDbPath?, messageRowId?, chatGuid?, confidence?, notes? }`

Timestamps:
- `created_at` datetime
- `updated_at` datetime
- `canceled_at` datetime nullable

### user_rate_limit
- `user_id` uuid pk fk -> users.id
- `last_sent_at` datetime nullable
- `window_started_at` datetime nullable
- `sent_in_window` int default 0

---

## Status Semantics & State Machine
Statuses are persisted and must be explicit.

- QUEUED: ready when scheduled_for_utc <= now
- SENDING: locked by worker and currently sending
- SENT: AppleScript send succeeded (Messages accepted)
- DELIVERED: receipt tracker observed delivery (best-effort attempt required)
- RECEIVED: receipt tracker observed read/received (best-effort attempt required)
- FAILED: send failed and retries exhausted OR hard failure (including rate limit)
- CANCELED: user canceled prior to sending

Allowed transitions:
- QUEUED -> SENDING
- QUEUED -> FAILED (rate limit failure)
- SENDING -> SENT | FAILED
- SENT -> DELIVERED (when detected)
- DELIVERED -> RECEIVED (when detected)
- QUEUED -> CANCELED

Terminal:
- FAILED, CANCELED, RECEIVED (for MVP)

---

## FIFO Rules
Eligible message:
- status = QUEUED
- scheduled_for_utc <= now
- canceled_at IS NULL

Order:
1) scheduled_for_utc ASC
2) created_at ASC

---

## Locking Strategy
Even though local single worker is expected, implement safe locking.

Atomic lock:
- select candidate id by FIFO
- then update:
  - set status=SENDING, locked_at=NOW(), locked_by='gateway-worker'
  - only when status=QUEUED

If update affected rows = 1 => locked.
Else => someone else took it; retry.

---

## Retry Strategy (Simple)
- MAX_ATTEMPTS (default 5)
- BASE_BACKOFF_SECONDS (default 30)
- On send failure:
  - attempt_count++
  - if attempt_count < MAX_ATTEMPTS:
    - set status back to QUEUED
    - scheduled_for_utc = now + backoff (exponential, capped)
    - last_error set
  - else:
    - set status FAILED and last_error set

---

## Per-User Rate Limiting (Free vs Paid)
Per signed-in user’s plan:
- free vs paid determined by users.paid_user

Two checks:

### A) Minimum interval between sends
- FREE_MIN_INTERVAL_SECONDS (default 0)
- PAID_MIN_INTERVAL_SECONDS (default 0)

If last_sent_at exists and now - last_sent_at < min_interval => cannot send.

### B) Max sends per hour window
- FREE_MAX_PER_HOUR (default 2)
- PAID_MAX_PER_HOUR (default 30)

If now > window_started_at + 1 hour => reset:
- window_started_at = now
- sent_in_window = 0

If sent_in_window >= max => cannot send.

When message becomes SENT:
- last_sent_at = now
- sent_in_window++ (reset window if needed)

If a message is disallowed by rate limit:
- mark status FAILED
- set last_error = rate_limit_reached

Pre-queue guard:
- When creating or rescheduling, the web app rejects with 429 if the current window is already fully reserved.
- “Reserved” includes QUEUED or SENDING messages whose scheduled_for_utc falls within the current window.
- This prevents scheduling more than the max-per-hour capacity inside the active window.

---

## Gateway Contract (Localhost)
Gateway runs on localhost and serves both:
- HTTP endpoints
- embedded worker loop

Auth:
- Header `X-Gateway-Secret: <GATEWAY_SECRET>`

### POST /send
Request:
- messageId (uuid)
- to (string)
- body (string)

Response:
- status: SENT | FAILED
- gatewayMessageId?: string
- error?: string
- meta?: json

### POST /health
- returns ok, timestamp, workerEnabled, version

---

## Gateway -> Web App Status Callback
Gateway updates web app (Next.js) via:
POST `http://localhost:<WEB_PORT>/api/gateway/status`

Auth:
- `X-Gateway-Secret` same secret

Body:
- messageId
- status: SENT | DELIVERED | RECEIVED | FAILED
- payload?: json

Web app updates messages row accordingly.
On SENT:
- Web app applies rate limit bookkeeping once per message and records
  `receiptCorrelation.rateLimitApplied=true`.

---

## Receipt Tracking (DELIVERED / RECEIVED)
Required: implement first attempt. Best-effort allowed, but must try.

Approach:
- After SENT:
  - compute bodyHash and store in receipt_correlation
- Correlate in Messages storage (likely `~/Library/Messages/chat.db`)
  - gateway reads chat.db directly with sqlite (requires Full Disk Access for the gateway process)
  - locate message row by handle + exact body + is_from_me within a ±5 minute window
  - store messageRowId/chatGuid if found
- Retry correlation up to 8 attempts (2s delay) when no match is found
- Poll for fields indicating delivered/read if available
  - uses `is_delivered` / `date_delivered` / `is_read` / `date_read` when present
  - polling queries inspect available columns via `PRAGMA table_info(message)`
  - polling interval default 10s, timeout default 30 minutes
- When detected, call gateway/status callback with DELIVERED/RECEIVED

If schema differs:
- stop and ask for macOS version and sample query output.

---

## UI Requirements

### Timeline Grid (Required)
MVP timeline:
- Select a day (calendar)
- 48 rows for 30-minute slots
- Drag-to-create message at a slot
- Drag-to-move existing message
- Click to edit/cancel
- Duplicate button to clone a scheduled message
- Multiple messages can exist in the same slot

### Dashboard (Required)
- Filter by status + date range
- Table columns:
  - scheduled time
  - recipient
  - status
  - attempts
  - last_error
  - delivered_at/received_at
- Detail panel:
  - body preview
  - receipt_correlation json

---

## Testing Requirements
- Vitest unit tests:
  - rate limit functions
  - FIFO selector query builder
  - zod validations & expected data types for any function returns
- Testing Library UI tests:
  - cover UI interactions with state changes (create/edit/move/cancel)
  - keep tests focused on user-visible behavior
- API tests:
  - auth endpoints
  - messages create/update/cancel/list
  - gateway status callback auth + updates

---

## Env Vars (Local)
Required:
- DATABASE_URL
- WEB_PORT (optional; Next default)
- GATEWAY_PORT
- GATEWAY_SECRET

Rate limits defaults:
- FREE_MIN_INTERVAL_SECONDS=0
- PAID_MIN_INTERVAL_SECONDS=0
- FREE_MAX_PER_HOUR=2
- PAID_MAX_PER_HOUR=30

Worker:
- WORKER_ENABLED=true
- WORKER_POLL_INTERVAL_MS=2000
- MAX_ATTEMPTS=5
- BASE_BACKOFF_SECONDS=30
- RECEIPT_POLL_INTERVAL_MS=10000
- RECEIPT_POLL_TIMEOUT_MS=1800000

---

## Resolved Decisions
- Rate limit defaults are 0/0 min interval and 2/30 max per hour.
- Timeline hides canceled messages.
- Timeline uses 30-minute slots.
- Recipients are US phone numbers only.
- Receipt tracking uses `~/Library/Messages/chat.db` with schema-aware polling.
