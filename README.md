<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/44ce2bbe-d568-4bbe-b92c-4942ac54488a

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Telegram Bot (Python / aiogram)

The Telegram bot is organized as:

- `main.py` (entry point)
- `services/dexscreener.py` (Dexscreener API client + caching)
- `handlers/start.py`, `handlers/price.py`, `handlers/trending.py` (command handlers)
- `utils/formatter.py` (response formatting helpers)

### Bot commands

- `/start` — show available commands
- `/price <token>` — fetch live token data from Dexscreener
- `/trending` — show top trending tokens by 24h volume

### Run bot

1. Set `TELEGRAM_BOT_TOKEN` in your environment
2. Start the bot:
   `python main.py`

`python bot.py` also works as a backward-compatible entrypoint.

