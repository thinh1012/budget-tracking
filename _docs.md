# budget-tracking — Project Docs

## Overview
Telegram bot + web dashboard for personal/household budget tracking. Users log income and expenses via Telegram; the dashboard visualizes everything.

## Deployment
- **Server:** Ubuntu LXC `192.168.1.131`, path `/root/budget-tracking`
- **Dashboard:** `http://192.168.1.131:3110`
- **PM2 process:** `budget-bot` (always-on, no sleep cycle)
- **SSH:** `ssh -i H:/.ssh/id_ed25519 root@192.168.1.131`

## Stack
- **Backend:** Node.js + Express, CommonJS modules
- **Database:** SQLite via `better-sqlite3`, file at `data/budget.db`
- **Frontend:** Vanilla HTML/JS/CSS in `public/` (no build step)
- **Bot:** `node-telegram-bot-api`, webhook mode via nginx 8443 → port 3110 (`/budget/webhook/budget`)
- **Session:** `express-session` (24h cookie, server-side)

## Entry Points
- `src/server.js` — main Express app, boots DB + bot + HTTP server
- `src/bot/bot.js` — Telegram bot init and message routing
- `src/database/database.js` + `src/database/schema.sql` — DB init and schema
- `monitor-bridge-batch.js` — **do not change** — sends health data to server-monitor

## Key Source Files
```
src/
  bot/
    bot.js               — bot init, message handler wiring
    conversationState.js — per-user conversation state machine
    keyboards.js         — Telegram inline keyboards
    messageParser.js     — parses freeform messages into transactions
    messageTemplates.js  — reply message templates
  database/
    database.js          — initDatabase(), getDatabase()
    schema.sql           — full schema (users, chats, transactions, categories, budgets, dashboard_accounts)
  middleware/
    auth.js              — requireAuth, redirectIfAuthenticated
  routes/
    api.js               — all /api/* endpoints (summary, transactions, categories, trends, export, etc.)
    auth.js              — /api/auth/* (login, logout, session check)
  services/
    budgetService.js     — budget limit logic
    ocrService.js        — receipt OCR via tesseract.js
    reportService.js     — report generation
    transactionService.js — core query functions (getTransactions, getSummary, etc.)
public/
  index.html             — dashboard SPA (tabs: overview, monthly, transactions, analytics)
  login.html             — login page
  styles.css             — shared styles, dark/light mode via CSS vars
manage-accounts.js       — CLI to manage dashboard login accounts
```

## Database Schema (key tables)
| Table | Purpose |
|---|---|
| `users` | Telegram users (telegram_id, username, first_name) |
| `chats` | Telegram groups = households (telegram_chat_id is the isolation key) |
| `dashboard_accounts` | Web login accounts; `chat_id=NULL` means admin (sees all) |
| `transactions` | Income/expense records, linked to user + chat |
| `categories` | Dynamic category list (type: income or expense) |
| `budgets` | Monthly budget limits per category per chat |

## Multi-User / Household Isolation
- Each Telegram group chat maps to a `chats` row via `telegram_chat_id`
- All transactions are scoped by `chat_id`
- Dashboard login accounts are linked to a `chat_id`; admins (`chat_id = NULL`) see all data
- Session stores `telegramChatId`; API routes read it via `sessionChatId(req)`

## Account Management (on Ubuntu)
```bash
cd /root/budget-tracking
node manage-accounts.js list
node manage-accounts.js add-admin <username> <password>
node manage-accounts.js add <username> <password> <telegram_chat_id>
node manage-accounts.js delete <username>
```

## API Endpoints (all require auth except /api/auth/*)
| Method | Path | Description |
|---|---|---|
| GET | `/api/summary` | Balance, income, expense totals |
| GET | `/api/transactions` | Paginated transaction list |
| GET | `/api/categories` | Category breakdown |
| GET | `/api/categories/list` | All categories |
| GET | `/api/trends` | Monthly trends (default 6 months) |
| GET | `/api/analytics/yearly` | Year-by-year summary |
| GET | `/api/contributors` | Income by contributor |
| GET | `/api/users/spending` | Spending by Telegram user |
| GET | `/api/export` | Export as CSV or XLSX |
| GET | `/api/health/budget` | Health check (monitoring) |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |

## Dashboard Features
- Overview tab: balance, income, expenses, category breakdown chart
- Monthly tab: month-by-month income/expenses/balance/savings rate (loads on demand)
- Transactions tab: paginated list with date/category filters, client-side search
- Analytics tab: yearly summary, contributor breakdown, per-user spending
- Dark/light mode toggle (persisted to `localStorage`)
- Export to CSV or XLSX

## Environment Variables (`.env` on server)
```
TELEGRAM_BOT_TOKEN=...
SESSION_SECRET=...
DATABASE_PATH=./data/budget.db   # optional, this is the default
PORT=3110                         # optional, this is the default
```

## Do Not Touch
- `monitor-bridge-batch.js` — monitoring integration
- `data/` — SQLite database files
- `.env` — production secrets

## Deploy / Restart
```bash
ssh -i H:/.ssh/id_ed25519 root@192.168.1.131
cd /root/budget-tracking
pm2 restart budget-bot
pm2 logs budget-bot --lines 50
```
No build step needed — frontend is plain HTML/JS. No `npm install` needed for routine deployments (dependencies are already installed on the server).
