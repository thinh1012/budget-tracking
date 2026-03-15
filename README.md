# Budget Tracking Bot

Personal budget tracking with Telegram input and a web dashboard.

## Access

| | URL |
|---|---|
| **Dashboard (LAN)** | http://192.168.1.131:3110/ |
| **Public / Webhook** | https://thinhle1234.ddns.net |

> The app runs on an Ubuntu server on the local network. The DDNS domain is used for Telegram webhook only.

## Login

Default credentials (from `.env`):
- **Username:** `admin`
- **Password:** `budget2026`

> Accounts are managed via `manage-accounts.js` and stored in the database (not the `.env`).

## Account Management

```bash
# Add a new admin account
node manage-accounts.js add-admin <username> <password>
```

## Running the App

```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

## Stack

- **Bot:** Telegram via `node-telegram-bot-api`
- **Server:** Express.js on port `3110`
- **Database:** SQLite via `better-sqlite3`
- **Auth:** bcrypt sessions
- **Reverse proxy:** nginx (see `nginx.conf`)
- **OCR:** tesseract.js (receipt scanning)

## Environment

Copy `.env.example` to `.env` and fill in:
- `TELEGRAM_BOT_TOKEN`
- `SESSION_SECRET`
- `WEBHOOK_BASE_URL`
