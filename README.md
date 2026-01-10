# iMessage Scheduler

## Steps to run

```bash
# installs both packages in ./ & ./gateway
pnpm run setup
```

#### 1) Start MySQL (required)

**Option A:** Docker

```bash
docker run --name imessage-mysql \
  -e MYSQL_ROOT_PASSWORD=pass \
  -e MYSQL_DATABASE=imessage_scheduler \
  -p 3306:3306 -d mysql:8
```

**Option B:** Homebrew MySQL

```bash
brew install mysql
brew services start mysql
mysql -uroot -e "CREATE DATABASE imessage_scheduler;"
```

#### 2) Configure env

```bash
cp .env.example .env
```

Example `.env`:

```bash
DATABASE_URL=mysql://root@localhost:3306/imessage_scheduler
GATEWAY_SECRET=dev-secret
GATEWAY_PORT=4001
WEB_PORT=3000
WEB_BASE_URL=http://localhost:3000
```

IF your local MySQL user has a password, include it in the URL: (default should be no password, most likely above .env should work.)
```bash
DATABASE_URL=mysql://root:<password>@localhost:3306/imessage_scheduler
```

Docker users should use the default Docker password:
```bash
DATABASE_URL=mysql://root:pass@localhost:3306/imessage_scheduler
```

#### 3) Migrate + seed

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

#### 4) Run the app

```bash
# runs pnpm dev:web && pnpm dev:gateway
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

### Usage

- Create a schedule by clicking on the timeline
- **Drag & Drop** to modify the schedule
- Click to edit or cancel
- Go to Dashboard to see the history & status

## Tech Stack

- NextJS
- MySql + Drizzle ORM

### Web App
**Next.js (React + Node)** to keep UI and API logic cohesive and to demonstrate similar patterns used in Node/React production environments.

### Database
**MySQL with Drizzle ORM** for its simplicity, easier setup and migration support, keeps local setup lightweight.

## Project Structure

- `./db`
- `./app/api/` API endpoints (auth, messages,  )
