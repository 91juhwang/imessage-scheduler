# iMessage Scheduler

## Getting Started

```bash
pnpm i
pnpm run dev // runs pnpm dev:web && pnpm dev:gateway
```

## Tech Stack Decisions

### Web App
I chose **Next.js (React + Node)** to keep UI and API logic cohesive and to demonstrate similar patterns used in Node/React production environments.

### Database
I used **MySQL with Drizzle ORM** for its simplicity, easier setup and migration support. For this take-home, the data model and queue logic do not rely on Postgres-specific features, so MySQL keeps local setup lightweight.

### Gateway
Because iMessage automation requires macOS, the gateway runs locally and sends messages via AppleScript, reporting status updates back to the web app.

## Future improvements:
- Full event/audit log
- Clean separation of “intent vs execution”