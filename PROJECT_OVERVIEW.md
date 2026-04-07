# Degenex Repo Observation

## What you are building

You are building **Degenex**, a Telegram-connected **paper trading platform for memecoins** with a modern web UI.

It combines:
- A React + Vite frontend dashboard for browsing tokens, trading, portfolio tracking, rewards, and leaderboard.
- An Express API backend that manages users, simulated trades, token market data, and gamified rewards.
- Telegram bot integration so users can launch and interact with the app from Telegram, with optional channel-gating behavior.

## Core product pillars

1. **Simulated trading (paper trading)**
   - Users start with demo balance (default $1,000) and can buy/sell supported tokens.
   - Portfolio value and P/L are tracked without real on-chain execution.

2. **Memecoin discovery + market context**
   - Token listings are split into categories (new/hot/early gems).
   - Live price, market cap, volume, and rank are pulled from CoinGecko (with caching/fallback behavior).

3. **Gamification and retention**
   - Task rewards and missions increase balance.
   - Pro upgrade unlocks a larger simulated balance.
   - Leaderboard ranks users by total simulated portfolio value.

4. **Telegram-first growth loop**
   - Telegram bot supports onboarding and command-based trade actions.
   - Optional channel membership gating encourages community growth before app access.

## End-to-end app flow

1. User opens Telegram bot and runs `/start`.
2. Bot creates/fetches user profile and offers launch button.
3. WebApp calls `/api/check-user` to sync Telegram identity.
4. Frontend loads `/api/tokens`, `/api/listings`, `/api/rewards`, `/api/alerts`, and user portfolio.
5. User executes buy/sell paper trades through `/api/trade`.
6. Portfolio and leaderboard update continuously.

## API surface (high-level)

- **User lifecycle:** `/api/check-user`, `/api/user/onboarded`
- **Market data:** `/api/tokens`, `/api/tokens/:id/history`, `/api/tokens/:id/details`, `/api/listings`, `/api/alerts`
- **Game mechanics:** `/api/rewards`, `/api/rewards/complete`, `/api/upgrade-pro`
- **Trading + standings:** `/api/trade`, `/api/portfolio/:userId`, `/api/leaderboard`

## Data model snapshot

The `users` table stores:
- identity (`id`, `username`, `referralCode`)
- state (`balance`, `portfolio`, `trades`)
- progression (`hasCompletedOnboarding`, `isPro`, `completedTasks`, `referralsCount`)
- recency (`lastLogin`)

## Technical shape at a glance

- **Frontend:** React 19, motion/framer-motion, Tailwind, Recharts.
- **Backend:** Express server in `server.ts`.
- **Storage:** SQLite (`better-sqlite3`) via `src/db.ts`.
- **External APIs:** CoinGecko for market data.
- **Bots:** Telegraf bot in `server.ts`, plus a separate Aiogram `bot.py` script.

## Product interpretation

In simple terms, this repo is building a **highly visual “learn + play + compete” crypto trading simulator** for Telegram users, focused on memecoin culture and social engagement rather than real-money execution.
