# Telegram Dashy Admin Bot 🤖

A lightweight, secure, and fully Dockerized Telegram bot designed to manage your self-hosted Dashy-style dashboard configuration (`conf.yml`). 

By bridging a Telegram chat interface directly to your YAML file, this bot acts as a specialized CRUD (Create, Read, Update, Delete) administrator. It utilizes interactive multi-step wizards for adding items and robust inline-keyboards for modifications, completely removing the hassle of SSH/terminal YAML editing.

## ✨ Features

- **Strict User Authorization**: Locked down via a strict internal allowlist so only you (or designated friends/family) can access the bot functionality.
- **Smart Link Auto-Add**: Simply dispatch a bare URL message to the bot. It will attempt to scrape the website's title and intelligently categorize the link inside an "Unsorted" boundary.
- **Atomic File Operations**: Uses a secure temp-file copy/rename pipeline behind the scenes (`.conf.yml.tmp`) ensuring your PHP dashboard never reads a half-written configuration.
- **Interactive Wizards**: Guides you step-by-step through adding new Items (Title, Description, Icon, Validated URL) using Telegraf's Scenes architecture.
- **Clean Inline Keyboards**: Simplifies navigation through deleting configuration elements natively via Telegram's tap interfaces.
- **Docker First**: Provides multi-stage lightweight builds (Alpine Linux) with drop-in compose files mapping directly to your existing host dashboard config.

## 🛠️ Technology Stack

- **Runtime Environment:** Node.js 20 (Alpine)
- **Language Setup:** TypeScript (ES2022)
- **API Framework:** Telegraf (Telegram Bot API wrapper)
- **Data Serialization:** `yaml`
- **Error/Logging:** `pino` & `pino-pretty`
- **Validation Constraints:** `zod`

---
---


If you like this project, consider supporting me on [Buy Me a Coffee](https://www.buymeacoffee.com/dominatos) ?☕️

---
## 🚀 Setup & Installation

### 1. Requirements
Ensure you have Docker and Docker Compose installed.

### 2. Generate Telegram Credentials
1. **Bot Token**: Message [@BotFather](https://t.me/botfather) on Telegram, use `/newbot`, name it, and copy the resulting `HTTP API Token`.
2. **User ID**: Message [@userinfobot](https://t.me/userinfobot) (or equivalent) to retrieve your personal numerical Telegram ID.

### 3. Configure the Environment
Clone or navigate to this folder and copy the environment template:
```bash
cp .env.example .env
```
Open `.env` in your text editor and populate the variables:
```env
# Telegram Bot Token from BotFather
BOT_TOKEN=123456789:YOUR_VERY_LONG_TELEGRAM_TOKEN_HERE

# Comma-separated list of allowed Telegram user IDs
ALLOWED_USER_IDS=12345678,87654321

# Optional: Path to where your conf.yml lives.
# If omitted, defaults to the parent directory (`../conf.yml`). 
# You can set this to any absolute path (e.g. /var/www/html/conf.yml) and Docker will dynamically mount it.
CONF_PATH=../conf.yml
```

---

## 🐳 Deployment (Docker Compose)

The provided `docker-compose.yml` dynamically mounts the exact file location defined by `CONF_PATH` inside your `.env` file directly into the container. 

If you leave `CONF_PATH` blank or omitted, it gracefully falls back to looking for `../conf.yml`. This allows you to store your dashboard configuration globally anywhere on your host filesystem (like `/var/www/html/conf.yml`) and gracefully wire it right into the bot without editing the compose file.

Launch the system detached:
```bash
docker compose up -d --build
```
*Note: This will perform a multi-stage background build to strip development dependencies before running the bot container.*

**Useful Docker Commands**:
- Read Live Logs: `docker compose logs -f`
- Restart Bot: `docker compose restart`
- Shut down: `docker compose down`

---

## 💻 Local Development (Without Docker)

If modifying the bot natively or running without containers, utilize `npm`:

```bash
npm install
npm run dev
```

*Be aware that `CONF_PATH` inside `.env` dictates exactly where the YAML parser intends to edit the target config when run locally.*

---

## 📱 Bot Commands Manual

Interact with your active Telegram bot using these standard commands:

* `/start` - Displays a welcome message and a persistent custom reply keyboard layout.
* `/help` - Prints administrative command guidelines.
* `/sections` - Lists all currently configured Sections inside your `conf.yml`.
* `/items` - Prints an expanded hierarchy list of every item available across every section.
* `/add` - Mounts the **Addition Wizard Scene**. The bot will conversationally prompt you for:
  1. Section Name (or creation of a new one)
  2. Item Title
  3. Item Description (Optional via `/skip`)
  4. Dashy/Premium String Icon Reference (Optional via `/skip`)
  5. URL Constraints (Must pass URL parsing evaluation)
* `[Raw HTTP/HTTPS Link]` - If you message the bot a standalone URL, it bypasses the wizard and automatically extracts the `<title>` element (or defaults to the URL path). It instantly injects the new link into a category titled **"Unsorted"**.
* `/delete` - Queries all items, binding them to an inline callback-keyboard. Selecting an item instantly wipes it from the `conf.yml`.
* `/cancel` - Kills your active wizard workflow securely (specifically required if you get trapped inside `/add` prompts and want to back out).

---

## 🗃️ Folder Structure
```text
/tg-admin-bot/
├── src/
│   ├── index.ts           # Telegraf polling entry point 
│   ├── config.ts          # Zod validation and .env processing
│   ├── bot/
│   │   ├── middleware.ts  # Authorizing traffic payload user ID validation
│   │   ├── commands.ts    # Handlers for base /slash routines
│   │   ├── scenes.ts      # Multi-step stateful workflows wizard (/add)
│   │   └── actions.ts     # Callback handlers for inline button presses 
│   ├── service/
│   │   └── yamlAdmin.ts   # FS Atomic configuration I/O logic 
│   └── utils/
│       └── logger.ts      # Pino logging formats
├── Dockerfile             # Multi-stage container definitions
├── docker-compose.yml     # Compose volume and env mapping configurations
├── .env.example           # Example runtime definitions
└── README.md
```

---


If you like this project, consider supporting me on [Buy Me a Coffee](https://www.buymeacoffee.com/dominatos) ☕️

---
