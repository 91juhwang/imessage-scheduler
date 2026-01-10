# NEXT.md

## Purpose (SOT)
This file is the Source of Truth (SOT) for implementation planning.
Codex must implement the system in **small, phased steps**. Each phase should be shippable and testable.

---

## Global Rules for Codex (Mandatory)
- Follow in order.
- Keep changes small and focused. No bundling unrelated refactors.
- If anything is ambiguous, stop and ask the human (see checkpoints).
- Use shared types and zod schemas from `packages/shared`.
- Receipt tracking DELIVERED/RECEIVED is required to attempt (best-effort) and must be documented.
- UI state changes must be covered with Testing Library (user-centric behavior).

After EACH phase, Codex must output:
1) What changed (files + behavior)
2) How to run
3) Tests added/updated and how to run them
4) Manual checks required

---

## phase-by-phase Plan (Detailed)

### phase 00 — Monorepo structure + tooling baseline
Scope:
- Establish repo layout and consistent tooling so later phases are easy.
Status: [X] completed

Tasks:
- Ensure folders exist:
  - `apps/web` (Next.js app)
  - `apps/gateway` (Node service)
  - `packages/shared` (types/schemas)
- Ensure root `package.json` workspace config (pnpm workspaces).
- Add scripts (root):
  - `dev:web` -> runs Next.js
  - `dev:gateway` -> runs gateway
  - `dev` -> runs both concurrently
  - `db:migrate`, `db:seed`
  - `test`, `test:watch`
  - `e2e`
  - `lint`, `format`
- Add:
  - ESLint config
  - Prettier config
  - TSConfig strict base
- Add `.env.example` with placeholders.

Manual verify:
- `pnpm -w dev` starts web + gateway (gateway can be stubbed with /health only for now).

---

### phase 01 — packages/shared: status enums + zod schemas + helpers
Scope:
- Centralize contracts and validation early to prevent drift.
Status: [X] completed

Tasks:
- Create `packages/shared/src/status.ts`:
  - `MessageStatus` enum: QUEUED, SENDING, SENT, DELIVERED, RECEIVED, FAILED, CANCELED
- Create `packages/shared/src/schemas.ts`:
  - `LoginInputSchema`: email, password
  - `CreateMessageInputSchema`:
    - to_handle (string, min length)
    - body (string, min length, max length e.g. 2000)
    - scheduled_for_local (ISO string or structured fields)
    - timezone (IANA tz)
  - `UpdateMessageInputSchema` (same but optional fields)
  - `GatewaySendRequestSchema`: messageId, to, body
  - `GatewaySendResponseSchema`: status, gatewayMessageId?, error?
  - `GatewayStatusCallbackSchema`: messageId, status, payload?
- Create `packages/shared/src/crypto.ts`:
  - `hashBody(body)` -> sha256 hex
- Export barrel in `packages/shared/src/index.ts`.

Tests (Vitest):
- Schema acceptance/rejection cases:
  - invalid timezone rejected
  - missing to/body rejected
- `hashBody` deterministic output.

Manual verify:
- `pnpm -w test` runs shared tests.

---

### phase 02 — Web: env validation + db wiring (Drizzle)
Scope:
- Make web app able to connect to DB safely.
Status: [X] completed

Tasks:
- Add `apps/web/src/env.ts` with zod:
  - DATABASE_URL
  - GATEWAY_SECRET
  - (optional) WEB_BASE_URL
- Add Drizzle setup:
  - `apps/web/src/db/index.ts` exports drizzle client
- Add Drizzle migration tooling config in root or apps/web:
  - `drizzle.config.ts`
  - `db:migrate` script
- Add minimal “smoke” API route `/api/health` that checks DB connectivity (simple query).

Tests:
- Basic API test that /api/health returns ok when DB up (can be integration test optional).

Manual verify:
- `pnpm -w db:migrate` runs (even if no tables yet).
- `curl http://localhost:<port>/api/health`

---

### phase 03 — DB schema: users + sessions + user_rate_limit + seed
Scope:
- Implement auth foundations early.
Status: [X] completed

Tasks:
- Create Drizzle schema files (location: `apps/web/src/db/schema/*`):
  - `users` table
  - `sessions` table
  - `user_rate_limit` table
- Add indices:
  - users.email unique
  - sessions.user_id index
  - user_rate_limit.user_id pk
- Add `db:seed` script:
  - creates user1 (paid_user=false)
  - creates user2 (paid_user=true)
  - sets known passwords (document in README later)
  - initializes user_rate_limit rows with null timestamps and 0 count
- Add password hashing helper (bcrypt) and verify helper.

Tests:
- Unit tests for:
  - password hashing and compare works
- Optional integration test:
  - seed creates 2 users.

Manual verify:
- Run seed and confirm rows in DB.

---

### phase 04 — DB schema: messages table + migrations
Scope:
- Single table that powers scheduling + queue.
Status: [X] completed

Tasks:
- Add `messages` table with all fields from ARCHITECTURE.md.
- Add indices:
  - (user_id, scheduled_for_utc)
  - status
  - scheduled_for_utc
- Add migration and run.

Tests:
- Smoke test:
  - insert a QUEUED message and select it
  - ensure defaults: attempt_count=0, status=QUEUED.

Manual verify:
- Inspect DB table schema.

---

### phase 05 — Web auth API + auth utilities
Scope:
- Minimal session auth required for “multi-user per-user rate limit”.
Status: [X] completed

Tasks:
- API routes:
  - `POST /api/auth/login`
    - validate with LoginInputSchema
    - verify user password
    - create session row with expiry (e.g., 7 days)
    - set HttpOnly cookie `sid=<session_id>`
  - `POST /api/auth/logout`
    - delete session row
    - clear cookie
  - `GET /api/auth/me`
    - returns { id, email, paid_user }
- Add server helpers:
  - `getUserFromRequest()` reads cookie and joins session->user
  - `requireUser()` throws 401
- Add middleware or per-route guard for app pages:
  - timeline + dashboard require auth.

Tests (API):
- login ok
- login invalid password fails
- me requires cookie
- logout clears session.

Manual verify:
- Login via curl or simple page.
- Cookie set and persists.

---

### phase 06 — Web messages API: create + list (scoped)
Scope:
- Backend endpoints for timeline and dashboard.
Status: [X] completed

Tasks:
- `POST /api/messages`
  - require auth user
  - validate CreateMessageInputSchema
  - convert scheduled_for_local + timezone -> scheduled_for_utc
    - store timezone string too
  - insert messages row:
    - status=QUEUED
    - attempt_count=0
- `GET /api/messages`
  - require auth
  - query params:
    - from (UTC ISO) optional
    - to (UTC ISO) optional
    - status optional
  - always scoped to user_id (unless you add admin later)
  - return minimal list for timeline: id, scheduled_for_utc, to_handle, status
  - include body preview optionally.

Tests (API):
- create returns id and stores UTC correctly
- list returns only current user rows.

Manual verify:
- Create message and see it in GET list.

---

### phase 07 — Web messages API: update + cancel + transition guards
Scope:
- Needed for timeline drag-to-move and cancel.
Status: [X] completed

Tasks:
- `PATCH /api/messages/:id`
  - require auth
  - validate UpdateMessageInputSchema
  - only allow if status is QUEUED (and not canceled)
  - update scheduled_for_utc, to_handle, body as requested
- `POST /api/messages/:id/cancel`
  - require auth
  - only allow if status=QUEUED
  - set status=CANCELED and canceled_at=now

Transition guard rules:
- if status in SENT/DELIVERED/RECEIVED/FAILED/CANCELED => 409 conflict

Tests:
- Update allowed when QUEUED
- Update blocked when SENT
- Cancel works and blocks further updates.

Manual verify:
- cancel reflects in DB.

HUMAN CHECKPOINT A:
- Confirm UI behavior for canceled messages:
  - Default: hide on timeline, show in dashboard.

---

### phase 08 — Web gateway callback route (status updates)
Scope:
- Gateway must be able to update message status.
Status: [X] completed

Tasks:
- `POST /api/gateway/status`
  - verify header `X-Gateway-Secret`
  - validate GatewayStatusCallbackSchema
  - update message row:
    - SENT => status=SENT
    - DELIVERED => status=DELIVERED + delivered_at
    - RECEIVED => status=RECEIVED + received_at
    - FAILED => status=FAILED + last_error from payload
  - merge payload into receipt_correlation if present (json merge)
- Ensure idempotency:
  - if already at later state, ignore older updates (e.g., don’t downgrade)

Tests:
- rejects wrong secret
- updates status correctly
- does not downgrade state.

Manual verify:
- curl POST SENT and see message updated.

---

### phase 09 — Web UI: skeleton + navigation + login page
Scope:
- First usable UI for the take-home.

Tasks:
- Add shadcn/ui setup and global styles.
- App layout:
  - nav links: Timeline, Dashboard
  - user badge (free/paid)
  - logout button
- Login page:
  - email/password inputs
  - quick login buttons for seeded users (optional)
- Auth guard:
  - redirect to /login if no session
- On login success:
  - redirect to /timeline

Tests:
- Playwright: login user1 -> redirected to timeline.

Manual verify:
- UI loads and session persists on refresh.

---

### phase 10 — Timeline UI v1: week grid render-only
Scope:
- Timeline grid foundation.

Tasks:
- Create `/timeline` page:
  - week header with dates
  - 24-hour grid
  - fetch messages for visible week:
    - from = startOfWeek UTC
    - to = endOfWeek UTC
- Render messages as blocks positioned within day/hour cell:
  - simplest: place in the hour cell as a chip/list (MVP)
- Provide week navigation:
  - prev week / next week buttons
- Show status indicator on each block (color + label)

Manual verify:
- Create via API and see blocks appear.

---

### phase 11 — Timeline UI v2: drag-to-create flow
Scope:
- Required feature.

Tasks:
- Add interaction:
  - click or drag on a cell creates a draft time
  - open modal (shadcn Dialog)
- Modal fields:
  - to_handle
  - body
  - scheduled time (derived from clicked slot; allow editing)
  - timezone display
- On submit:
  - call POST /api/messages
  - update local state and re-render
- UX details:
  - loading state
  - error toast

Tests:
- Playwright:
  - create from timeline -> appears
  - refresh -> still appears

Manual verify:
- Timezone conversion is correct (America/Chicago user, but store timezone).

---

### phase 12 — Timeline UI v3: drag-to-move + click-to-edit + cancel
Scope:
- Required feature.

Tasks:
- Drag-to-move:
  - drag block to another hour/day cell
  - call PATCH /api/messages/:id updating scheduled time
- Click-to-edit:
  - click block opens modal prefilled
  - allow edit body/to/time
  - save uses PATCH
- Cancel:
  - cancel button in modal calls POST cancel endpoint
  - timeline hides or mutes canceled messages (per checkpoint A)

Tests:
- Playwright:
  - drag-to-move persists after reload
  - edit body persists
  - cancel removes/mutes and shows canceled in dashboard later

Manual verify:
- Drag feels acceptable and doesn’t misplace time.

HUMAN CHECKPOINT B:
- Confirm whether timeline is:
  - hour-slot only (MVP) OR
  - supports 15/30 minute increments
Default: hour-slot only for take-home simplicity.

---

### phase 13 — Dashboard UI: table + filters + detail view
Scope:
- Required visibility.

Tasks:
- `/dashboard` page:
  - filters:
    - status dropdown
    - date range (this week / last week / custom)
  - table columns:
    - scheduled_for (local display)
    - to_handle
    - status
    - attempt_count
    - last_error (truncate)
    - delivered_at
    - received_at
  - row click opens side panel:
    - full message body
    - receipt_correlation pretty JSON
- Data fetching:
  - use GET /api/messages with params
- Add “Retry” button (optional):
  - only if FAILED, sets status back to QUEUED and scheduled_for_utc=now+1min
  - If you add this, document it and test it.

Tests:
- Playwright:
  - filter FAILED shows only FAILED rows (can seed by forcing status via API in test)

Manual verify:
- Dashboard matches statuses.

---

### phase 14 — Gateway service v1: server scaffold + auth + /health
Scope:
- Build the gateway process that will later run worker + AppleScript.

Tasks:
- apps/gateway Node server (TypeScript):
  - env validation (zod)
  - routes:
    - POST /send (stubbed for now)
    - POST /health
- Shared secret middleware: `X-Gateway-Secret`
- Use shared zod schema for /send request/response.

Tests:
- Unit tests:
  - rejects missing/invalid secret
  - validates request

Manual verify:
- `curl localhost:<gateway_port>/health` ok.

---

### phase 15 — Gateway service v2: AppleScript send + callback SENT/FAILED
Scope:
- Actually send iMessage.

Tasks:
- Implement AppleScript invocation:
  - send iMessage to handle (phone/email) with body
  - capture stdout/stderr
- On success:
  - call web callback `/api/gateway/status` with status=SENT
  - include payload: { gateway_message_id?, sentAt, method:'applescript' }
- On failure:
  - callback FAILED with payload error
- Add strong logging with messageId and handle.

Tests:
- Unit tests for:
  - script command builder (no real send)
  - callback client uses correct headers and body
Manual verify (required):
- Send to your own iMessage handle and confirm it appears in Messages.

HUMAN CHECKPOINT C:
- Confirm whether your “to_handle” will be:
  - phone numbers only,
  - email only,
  - or both (default: both allowed).

---

### phase 16 — Gateway embedded worker v1: FIFO polling + locking + send integration
Scope:
- Worker loop inside gateway, drains DB queue.

Tasks:
- Add DB connection in gateway (Drizzle to same MySQL).
- Implement polling loop:
  - every WORKER_POLL_INTERVAL_MS:
    1) select next eligible message:
       - status=QUEUED and scheduled_for_utc <= now
       - order by scheduled_for_utc, created_at
       - limit 1
    2) attempt lock:
       - update status=SENDING, locked_at, locked_by
       - only if status still QUEUED
    3) if locked:
       - call internal send handler (same code as /send)
- Failure handling:
  - if send fails:
    - attempt_count++
    - if attempt_count < MAX_ATTEMPTS:
      - status back to QUEUED
      - scheduled_for_utc bumped by exponential backoff
      - last_error set
    - else:
      - status FAILED + last_error
- Ensure worker does NOT process messages for other users differently yet (rate limit next phase).

Tests:
- Unit tests:
  - FIFO selection ordering (mock query results)
  - lock update behavior (simulate 0 vs 1 rows)
  - backoff calculation for attempts

Manual verify:
- Create QUEUED messages and watch them become SENT/FAILED.

---

### phase 17 — Rate limiting v1: per-user free vs paid (enforced by worker)
Scope:
- Enforce required behavior.

Tasks:
- Implement rate limit helper:
  - input: user {paid_user}, rate_limit_state row, now
  - output: { allowed: boolean, reason, nextAllowedAt }
- Before locking a message:
  - read message.user_id -> fetch user + user_rate_limit
  - evaluate:
    - min interval
    - max/hour window
  - If not allowed:
    - do NOT lock
    - optionally log and move on (to check other eligible messages)
      - worker should scan a small batch (e.g., next 10 eligible) to avoid head-of-line blocking
- On successful SENT:
  - update user_rate_limit:
    - reset window if needed
    - increment sent_in_window
    - set last_sent_at

Implementation detail (avoid HOL blocking):
- Query up to N eligible messages FIFO (N=10)
- For each:
  - check rate limit
  - lock first allowed
  - if none allowed, sleep until next poll

Tests:
- Unit tests for free vs paid:
  - free blocks second send within hour
  - paid allows more
  - min interval enforced
- Integration-ish test (optional):
  - seed user1 with last_sent_at and verify worker skips their messages but processes others.

Manual verify:
- Login as user1 create 2 messages now -> only 1 sends
- Login as user2 create multiple -> more sends.

HUMAN CHECKPOINT D (required):
- Confirm final rate limit numbers:
  - FREE_MIN_INTERVAL_SECONDS
  - PAID_MIN_INTERVAL_SECONDS
  - FREE_MAX_PER_HOUR
  - PAID_MAX_PER_HOUR

---

### phase 18 — Receipt tracking v1: correlation attempt + store receipt_correlation
Scope:
- Required first attempt for DELIVERED/RECEIVED.

Tasks:
- After SENT callback:
  - compute bodyHash and store into messages.receipt_correlation via web API OR DB direct update
  - also store sentAt in correlation
- Implement correlation attempt (best-effort):
  - locate chat.db path: `~/Library/Messages/chat.db` (likely)
  - open read-only sqlite connection
  - attempt to find message row for handle within time window
  - store identifiers into receipt_correlation (messageRowId, chatGuid)
- If correlation fails:
  - store receipt_correlation.notes with reason
  - continue (do not fail message)

Tests:
- Unit test correlation function with mocked sqlite layer
- Manual-only step documented for real chat.db access

Manual verify (required):
- Provide small manual instructions to confirm chat.db accessible (Full Disk Access).

HUMAN CHECKPOINT E (required if correlation fails):
- Provide:
  - macOS version
  - chat.db schema snippets (tables/columns)
  - sample query results

---

### phase 19 — Receipt tracking v2: DELIVERED and RECEIVED detection + callbacks
Scope:
- Required attempt.

Tasks:
- Based on correlated row, poll for:
  - delivery indicator
  - read/received indicator
- Poll loop:
  - interval (e.g., 10s) for up to N minutes/hours
- On delivery/read detection:
  - call web callback with DELIVERED/RECEIVED
  - update timestamps
- Guard rules:
  - don’t downgrade status
  - don’t spam callbacks (send only once per status)
- Add timeout behavior:
  - if not detected in time, leave as SENT and record note in receipt_correlation

Tests:
- Unit test poll loop state machine with mocks
Manual verify:
- Send to a second device account and confirm transitions update.

---

### phase 20 — Web polish: show rate limit & next send time in UI
Scope:
- Makes take-home clearer.

Tasks:
- Dashboard:
  - show user paid/free badge
  - show computed “next allowed send time” (optional)
- Timeline:
  - show tooltip with status and scheduled time
- Error handling improvements

Tests:
- Minimal UI regression test or snapshot.

---

### phase 21 — End-to-end tests (Playwright) + reliability
Scope:
- Ensure core flows are covered.

Tasks:
- Playwright E2E:
  1) login user1
  2) create message on timeline
  3) move message
  4) cancel message
  5) (optional) simulate gateway callback for delivered/received
- Add helper to create messages via API for tests.

Manual verify:
- `pnpm -w e2e` runs locally.

---

### phase 22 — Documentation: README + final SOT sync
Scope:
- Finish the take-home submission quality.

Tasks:
- README sections:
  - Architecture overview (reference ARCHITECTURE.md)
  - How to run locally:
    - MySQL setup
    - migrate
    - seed users
    - start web + gateway (worker embedded)
  - How scheduling works (FIFO + per-user rate limit)
  - Receipt tracking approach + macOS permissions (Automation, Full Disk Access)
  - Known limitations (if any) and how you’d improve
- Ensure code matches SOT; update SOT if implementation required a small change.

---

## Mandatory Human Checkpoints Summary
Codex must stop and ask before finalizing:
- A) canceled messages visibility on timeline (hide vs muted)
- B) timeline granularity (hour vs 15/30 minute slots)
- C) allowed handle types (phone/email/both)
- D) final rate limit numbers for free vs paid
- E) chat.db schema differences if receipt tracking fails
