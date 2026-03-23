# Budget Tracking

Personal expense tracker with a Telegram bot for input and a web dashboard for review.

## What it does

- Send expenses to a Telegram bot in natural language — it parses the amount, category, and note automatically
- Web dashboard shows spending by category, monthly totals, and transaction history
- Multi-account support with per-account balance tracking
- Runs 24/7 on a self-hosted Ubuntu server (PM2 + webhook mode)

## Stack

- **Backend:** Node.js, Express
- **Bot:** Telegram Bot API (webhook)
- **Database:** SQLite (better-sqlite3)
- **Frontend:** Vanilla HTML/CSS/JS
- **Auth:** bcrypt sessions
- **Reverse proxy:** nginx

## Architecture

```
Telegram → webhook → Express (port 3110) → SQLite
                                          ↓
                               Web dashboard (login required)
```

## Setup

```bash
npm install
cp .env.example .env   # fill in your values
npm start
```

## Environment variables

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `WEBHOOK_BASE_URL` | Public HTTPS URL for Telegram webhook |
| `SESSION_SECRET` | Express session secret |

## Account management

```bash
node manage-accounts.js add-admin <username> <password>
```

## Self-hosting notes

Deployed behind nginx with a self-signed cert on port 8443 for Telegram webhook compatibility. PM2 keeps it alive across reboots.
