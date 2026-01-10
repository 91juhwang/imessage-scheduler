# iMessage Scheduler

## Steps to run

```bash
# installs both packages in ./ & ./gateway
# Use Node: 22.13.1 --> See .nvmrc
pnpm run setup
```

#### 1) Start MySQL

via Homebrew

```bash
brew install mysql
brew services start mysql
mysql -uroot -e "CREATE DATABASE imessage_scheduler;"
```

#### 2) Configure env

Add `.env`

```bash
DATABASE_URL=mysql://root@localhost:3306/imessage_scheduler
GATEWAY_SECRET=dev-secret
GATEWAY_PORT=4001
WEB_PORT=3000
WEB_BASE_URL=http://localhost:3000
```

If your local MySQL user has a password, include it in the URL: (default should be no password, use above .env)
```bash
DATABASE_URL=mysql://root:<password>@localhost:3306/imessage_scheduler
```

#### 3) Migrate + seed

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

#### 4) Run the app

```bash
# starts gateaway & web
pnpm run dev
```

#### 5) Enable Full Disk Access (for receipt correlation)

The gateway reads Messages.app data from `~/Library/Messages/chat.db` to attempt delivery/read correlation.

On macOS:
- System Settings → Privacy & Security → Full Disk Access
- Add your terminal app (Terminal / iTerm) or your IDE (VS Code) and enable it
- Restart the terminal/IDE, then re-run the gateway

Seeded users:
- user1@example.com (free) / password123
- user2@example.com (paid) / password123

### Features

- CRUD schedules
- **Drag & Drop** to modify the scheduled message
- Duplicate a scheduled message
- Go to Dashboard to see the history & status with filters
- Free & Paid user rate limiting (free = 2, paid = 30, reset limit button for test purposes)

## Tech Stack

- NextJS
- MySql + Drizzle ORM

### Web App
**Next.js (React + Node)** to keep UI and API logic cohesive and to demonstrate similar patterns used in Node/React production environments.

### Database
**MySQL with Drizzle ORM** for its simplicity, easier setup and migration support, keeps local setup lightweight.

## Project Structure

- `./db`
- `./app/api/` API endpoints 
- `./gateway/` Gateway: inclues the worker, handles polling and callback to web
- `./packages/shared` Shared types, utils


