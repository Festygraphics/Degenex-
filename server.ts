import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { Telegraf, Markup } from "telegraf";
import { getUserByTelegramId, createUser, updateUser, getAllUsers, User } from "./src/db.js";

console.log("SERVER.TS IS EXECUTING");

// --- Types ---
interface Token {
  id: string;
  symbol: string;
  name: string;
  address: string;
  price: number;
  change24h: number;
  color: string;
  image?: string;
  marketCap?: number;
  volume?: number;
  rank?: number;
  description?: string;
  links?: {
    homepage?: string;
    twitter?: string;
    website?: string;
  };
  sentiment?: {
    upvotes: number;
    downvotes: number;
  };
}

// --- Listings Categorization ---
const getListings = () => {
  const sortedByVolume = [...tokens].sort((a, b) => (b.volume || 0) - (a.volume || 0));
  const sortedByMarketCap = [...tokens].sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
  
  return {
    new: tokens.slice(0, 3), // Mocking new listings
    hot: sortedByVolume.slice(0, 4),
    earlyGems: tokens.filter(t => (t.marketCap || 0) < 100000000).slice(0, 4)
  };
};

// --- Rewards Data ---
const rewardsData = {
  tasks: [
    { id: 'join_tg', title: 'Join Telegram Channel', reward: 100, icon: 'Globe', link: 'https://t.me/degenex_channel' },
    { id: 'follow_tw', title: 'Follow on Twitter', reward: 100, icon: 'Twitter', link: 'https://twitter.com/degenex' },
    { id: 'daily_login', title: 'Daily Login', reward: 50, icon: 'Zap', isDaily: true },
  ],
  missions: [
    { id: 'first_trade', title: 'Complete First Trade', reward: 200, goal: 1 },
    { id: 'profit_100', title: 'Reach $100 Profit', reward: 500, goal: 100 },
  ]
};

// --- Live Data Integration (CoinGecko) ---
let tokens: Token[] = [
  { 
    id: "dogecoin", symbol: "DOGE", name: "Dogecoin", address: "0xba2ae424d960c26247dd6c32edc70b295c744c43", price: 0.15, change24h: 0, color: "#F7931A",
    description: "Dogecoin is an open source peer-to-peer digital currency, favored by Shiba Inus worldwide.",
    links: { homepage: "https://dogecoin.com", twitter: "https://twitter.com/dogecoin" },
    sentiment: { upvotes: 1250, downvotes: 120 }
  },
  { 
    id: "shiba-inu", symbol: "SHIB", name: "Shiba Inu", address: "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce", price: 0.000025, change24h: 0, color: "#FFA500",
    description: "Shiba Inu is an Ethereum-based altcoin that features the Shiba Inu Japanese breed of hunting dog as its mascot.",
    links: { homepage: "https://shibatoken.com", twitter: "https://twitter.com/shibtoken" },
    sentiment: { upvotes: 980, downvotes: 85 }
  },
  { 
    id: "pepe", symbol: "PEPE", name: "Pepe", address: "0x6982508145454ce325ddbe47a25d4ec3d2311933", price: 0.000008, change24h: 0, color: "#00FF00",
    description: "Pepe is a deflationary memecoin launched on Ethereum. The project aims to capitalize on the popularity of meme coins.",
    links: { homepage: "https://www.pepe.vip", twitter: "https://twitter.com/pepecoineth" },
    sentiment: { upvotes: 2100, downvotes: 340 }
  },
  { 
    id: "floki", symbol: "FLOKI", name: "Floki", address: "0xcf0c122c6b900000000000000000000000000000", price: 0.0002, change24h: 0, color: "#7C3AED",
    description: "Floki is the people's cryptocurrency and the utility token of the Floki Ecosystem.",
    links: { homepage: "https://www.floki.com", twitter: "https://twitter.com/realflokiinu" },
    sentiment: { upvotes: 750, downvotes: 45 }
  },
  { 
    id: "bonk", symbol: "BONK", name: "Bonk", address: "DezXAZ8z7PnrnRJjz3wXBoRgixrk6UM8q6X7JHOOCXC", price: 0.00002, change24h: 0, color: "#14F195",
    description: "Bonk is the first Solana dog coin for the people, by the people.",
    links: { homepage: "https://www.bonkcoin.com", twitter: "https://twitter.com/bonk_inu" },
    sentiment: { upvotes: 1500, downvotes: 90 }
  },
  { 
    id: "dogwifhat", symbol: "WIF", name: "dogwifhat", address: "EKpQGSJtjMFqKZ9KQanAtY7YXQHCfS7LcHMahztgma6", price: 3.2, change24h: 0, color: "#E4B1F0",
    description: "Literally just a dog with a hat.",
    links: { homepage: "https://dogwifcoin.org", twitter: "https://twitter.com/dogwifcoin" },
    sentiment: { upvotes: 3200, downvotes: 150 }
  },
  { 
    id: "brett", symbol: "BRETT", name: "Brett", address: "0x532f27101965dd16442e59d406704f5e1c00b651", price: 0.07, change24h: 0, color: "#4335A7",
    description: "Brett is Pepe's best friend on Base.",
    links: { homepage: "https://www.basedbrett.com", twitter: "https://twitter.com/basedbrett" },
    sentiment: { upvotes: 890, downvotes: 60 }
  },
];

const fetchLivePrices = async () => {
  try {
    console.log("Fetching live prices from CoinGecko...");
    const ids = tokens.map(t => t.id).join(",");
    const response = await fetchWithRetry(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`
    );
    
    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status}`);
      return;
    }

    const data = await response.json();
    if (Array.isArray(data)) {
      tokens = tokens.map(t => {
        const liveData = data.find((d: any) => d.id === t.id);
        if (liveData) {
          return {
            ...t,
            price: liveData.current_price,
            change24h: liveData.price_change_percentage_24h || 0,
            image: liveData.image,
            marketCap: liveData.market_cap,
            volume: liveData.total_volume,
            rank: liveData.market_cap_rank,
          };
        }
        return t;
      });
      console.log("Live prices and images updated successfully");
    }
  } catch (error) {
    console.error("Failed to fetch live prices:", error);
  }
};

// Initial fetch and then every 120 seconds (respecting free tier rate limits)
fetchLivePrices();
setInterval(fetchLivePrices, 120000);

// --- Alert Generation ---
let alerts: string[] = [
  "Liquidity added to DOGE/SOL pool",
  "New token listed: PEPE",
  "Whale buy detected on SHIB: 50,000,000,000 tokens",
];

// Caching for CoinGecko API
const historyCache: { [key: string]: { data: any, timestamp: number } } = {};
const detailsCache: { [key: string]: { data: any, timestamp: number } } = {};
const CACHE_TTL_HISTORY = 5 * 60 * 1000; // 5 minutes
const CACHE_TTL_DETAILS = 60 * 60 * 1000; // 1 hour

// Helper for fetching with retry and exponential backoff
const fetchWithRetry = async (url: string, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      
      if (response.status === 429) {
        // Rate limited, wait and retry if possible
        // Exponential backoff: 5s, 10s, 20s
        const waitTime = Math.pow(2, i) * 5000;
        console.warn(`Rate limited by CoinGecko (429), waiting ${waitTime}ms before retry ${i + 1}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (e) {
      if (i === retries - 1) throw e;
      const waitTime = (i + 1) * 2000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  return fetch(url); // Final attempt
};

let users: { [id: number]: User } = {
  123: {
    id: 123,
    username: "DegenMaster",
    balance: 1000,
    portfolio: {},
    trades: [],
    hasCompletedOnboarding: true,
    isPro: false,
    referralCode: "DEGEN123",
    referralsCount: 0,
    completedTasks: [],
    lastLogin: new Date().toISOString(),
  }
};

setInterval(() => {
  // Randomly add alerts based on live data
  if (Math.random() > 0.8) {
    const randomToken = tokens[Math.floor(Math.random() * tokens.length)];
    const alertTypes = [
      `Whale buy detected on ${randomToken.symbol}`,
      `Volume spike on ${randomToken.symbol}`,
      `Social sentiment surging for ${randomToken.symbol}`,
      `Large exchange inflow for ${randomToken.symbol}`,
    ];
    alerts.unshift(alertTypes[Math.floor(Math.random() * alertTypes.length)]);
    if (alerts.length > 10) alerts.pop();
  }
}, 10000);

// --- Telegram Bot ---
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const channelUsername = process.env.TELEGRAM_CHANNEL_USERNAME || "@degenex_channel";
const appUrl = process.env.APP_URL;

if (botToken) {
  const bot = new Telegraf(botToken);

  bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;
    
    try {
      let user = getUserByTelegramId(userId);
      if (!user) {
        user = createUser(userId, username);
      } else {
        user.lastLogin = new Date().toISOString();
        updateUser(user);
      }

      // Check channel membership
      const member = await ctx.telegram.getChatMember(channelUsername, userId).catch(() => null);
      const isJoined = member ? ["member", "administrator", "creator"].includes(member.status) : true; // Default to true if check fails

      if (!isJoined) {
        return ctx.reply(
          `🚀 Welcome to Degenex, ${username}!\n\nYour current balance: $${user.balance.toLocaleString()}\n\nJoin our channel to unlock the premium paper trading experience.`,
          Markup.inlineKeyboard([
            [Markup.button.url("Join Channel", `https://t.me/${channelUsername.replace("@", "")}`)],
            [Markup.button.callback("I have joined", "check_joined")]
          ])
        );
      }

      return ctx.reply(
        `🔥 Welcome back, Degen ${username}!\n\nYour current balance: $${user.balance.toLocaleString()}\n\nReady to master the pump?`,
        Markup.inlineKeyboard([
          [Markup.button.webApp("Launch Degenex", `${appUrl}`)]
        ])
      );
    } catch (e) {
      console.error("Bot error:", e);
      ctx.reply("Something went wrong. Please try again later.");
    }
  });

  // /buy <coin> <amount>
  bot.command('buy', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply("Usage: /buy <coin_symbol> <amount_usd>\nExample: /buy DOGE 100");

    const symbol = args[1].toUpperCase();
    const amountUsd = parseFloat(args[2]);

    if (isNaN(amountUsd) || amountUsd <= 0) return ctx.reply("Invalid amount. Please provide a positive number.");

    const user = getUserByTelegramId(userId);
    if (!user) return ctx.reply("Please start the bot first with /start");

    const token = tokens.find(t => t.symbol.toUpperCase() === symbol);
    if (!token) return ctx.reply(`Coin ${symbol} not found. Try one of: ${tokens.map(t => t.symbol).join(', ')}`);

    if (user.balance < amountUsd) return ctx.reply(`Insufficient balance. You have $${user.balance.toLocaleString()}`);

    const tokenAmount = amountUsd / token.price;
    user.balance -= amountUsd;
    user.portfolio[token.id] = (user.portfolio[token.id] || 0) + tokenAmount;
    user.trades.push({ type: 'buy', tokenId: token.id, amount: amountUsd, tokenAmount, price: token.price, date: new Date() });
    
    updateUser(user);

    ctx.reply(`✅ Successfully bought ${tokenAmount.toFixed(4)} ${token.symbol} for $${amountUsd.toLocaleString()}.\nNew balance: $${user.balance.toLocaleString()}`);
  });

  // /sell <coin> <amount>
  bot.command('sell', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply("Usage: /sell <coin_symbol> <amount_tokens>\nExample: /sell DOGE 100");

    const symbol = args[1].toUpperCase();
    const tokenAmount = parseFloat(args[2]);

    if (isNaN(tokenAmount) || tokenAmount <= 0) return ctx.reply("Invalid amount. Please provide a positive number of tokens.");

    const user = getUserByTelegramId(userId);
    if (!user) return ctx.reply("Please start the bot first with /start");

    const token = tokens.find(t => t.symbol.toUpperCase() === symbol);
    if (!token) return ctx.reply(`Coin ${symbol} not found.`);

    const currentAmount = user.portfolio[token.id] || 0;
    if (currentAmount < tokenAmount) return ctx.reply(`Insufficient tokens. You have ${currentAmount.toFixed(4)} ${token.symbol}`);

    const usdAmount = tokenAmount * token.price;
    user.balance += usdAmount;
    user.portfolio[token.id] -= tokenAmount;
    user.trades.push({ type: 'sell', tokenId: token.id, amount: usdAmount, tokenAmount, price: token.price, date: new Date() });
    
    updateUser(user);

    ctx.reply(`✅ Successfully sold ${tokenAmount.toFixed(4)} ${token.symbol} for $${usdAmount.toLocaleString()}.\nNew balance: $${user.balance.toLocaleString()}`);
  });

  // /portfolio
  bot.command('portfolio', async (ctx) => {
    const userId = ctx.from.id;
    const user = getUserByTelegramId(userId);
    if (!user) return ctx.reply("Please start the bot first with /start");

    let portfolioText = `📊 *Your Portfolio*\n\nBalance: $${user.balance.toLocaleString()}\n\n*Holdings:*\n`;
    let totalValue = user.balance;

    const holdings = Object.entries(user.portfolio).filter(([_, amount]) => amount > 0);
    
    if (holdings.length === 0) {
      portfolioText += "_No holdings yet._";
    } else {
      for (const [tokenId, amount] of holdings) {
        const token = tokens.find(t => t.id === tokenId);
        if (token) {
          const value = amount * token.price;
          totalValue += value;
          portfolioText += `• ${token.symbol}: ${amount.toFixed(4)} ($${value.toLocaleString()})\n`;
        }
      }
    }

    portfolioText += `\n*Total Value: $${totalValue.toLocaleString()}*`;
    ctx.replyWithMarkdown(portfolioText);
  });

  bot.action("check_joined", async (ctx) => {
    const userId = ctx.from.id;
    try {
      const member = await ctx.telegram.getChatMember(channelUsername, userId);
      const isJoined = ["member", "administrator", "creator"].includes(member.status);

      if (isJoined) {
        await ctx.answerCbQuery("Success! You are in.");
        return ctx.reply(
          "🔥 Access Unlocked!\n\nLaunch the app to start trading.",
          Markup.inlineKeyboard([
            [Markup.button.webApp("Launch Degenex", `${appUrl}`)]
          ])
        );
      } else {
        return ctx.answerCbQuery("You haven't joined yet!", { show_alert: true });
      }
    } catch (e) {
      ctx.answerCbQuery("Error checking membership.");
    }
  });

  try {
    bot.launch().catch(err => {
      if (err.response && err.response.error_code === 409) {
        console.error("Bot conflict detected (409). Another instance is likely running. Please ensure only one instance of the bot is active with this token.");
      } else {
        console.error("Bot launch failed:", err);
      }
    });
    console.log("Telegram Bot started");

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (e) {
    console.error("Bot setup failed:", e);
  }
}

// --- Express Server ---
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Routes
  app.post("/api/check-user", (req, res) => {
    const { id, username } = req.body;
    if (!id) return res.status(400).json({ error: "No ID provided" });

    let user = getUserByTelegramId(id);
    if (!user) {
      user = createUser(id, username);
    } else {
      user.lastLogin = new Date().toISOString();
      updateUser(user);
    }
    res.json(user);
  });

  app.get("/api/listings", (req, res) => {
    res.json(getListings());
  });

  app.get("/api/rewards", (req, res) => {
    res.json(rewardsData);
  });

  app.post("/api/rewards/complete", (req, res) => {
    const { userId, taskId } = req.body;
    const user = getUserByTelegramId(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    if (user.completedTasks.includes(taskId)) {
      return res.status(400).json({ error: "Task already completed" });
    }

    const task = rewardsData.tasks.find(t => t.id === taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    user.completedTasks.push(taskId);
    user.balance += task.reward;
    updateUser(user);
    res.json(user);
  });

  app.post("/api/upgrade-pro", (req, res) => {
    const { userId } = req.body;
    const user = getUserByTelegramId(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    user.isPro = true;
    user.balance += 99000; // Upgrade to $100k balance
    updateUser(user);
    res.json(user);
  });

  app.post("/api/user/onboarded", (req, res) => {
    const { id } = req.body;
    const user = getUserByTelegramId(id);
    if (user) {
      user.hasCompletedOnboarding = true;
      updateUser(user);
      return res.json(user);
    }
    res.status(404).json({ error: "User not found" });
  });

  app.get("/api/tokens", (req, res) => {
    res.json(tokens);
  });

  app.get("/api/tokens/:id/history", async (req, res) => {
    const { id } = req.params;
    const { days = '1' } = req.query;
    const cacheKey = `${id}-${days}`;
    const now = Date.now();

    // Check cache
    if (historyCache[cacheKey] && (now - historyCache[cacheKey].timestamp < CACHE_TTL_HISTORY)) {
      return res.json({ data: historyCache[cacheKey].data, isMock: false, isStale: false });
    }

    try {
      const response = await fetchWithRetry(
        `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`
      );
      
      if (!response.ok) {
        // If we have stale cache, use it instead of mock
        if (historyCache[cacheKey]) {
          return res.json({ data: historyCache[cacheKey].data, isMock: false, isStale: true });
        }

        // Fallback mock data if CoinGecko fails (e.g. rate limited)
        const mockHistory = [];
        const points = days === '1' ? 24 : days === '7' ? 7 : 30;
        const interval = days === '1' ? 3600000 : 86400000;
        
        const token = tokens.find(t => t.id === id);
        let basePrice = token ? token.price : 100;

        for (let i = points; i >= 0; i--) {
          mockHistory.push({
            time: days === '1' 
              ? new Date(now - i * interval).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : new Date(now - i * interval).toLocaleDateString([], { month: 'short', day: 'numeric' }),
            price: basePrice * (1 + (Math.random() * 0.1 - 0.05))
          });
        }
        return res.json({ data: mockHistory, isMock: true });
      }

      const data = await response.json();
      if (!data.prices) throw new Error("Invalid data from CoinGecko");

      const history = data.prices.map(([timestamp, price]: [number, number]) => ({
        time: days === '1' 
          ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        price: price
      }));

      // Update cache
      historyCache[cacheKey] = { data: history, timestamp: now };
      res.json({ data: history, isMock: false });
    } catch (error) {
      console.error("History fetch error:", error);
      res.status(500).json({ error: "Failed to fetch history", fallback: [] });
    }
  });

  app.get("/api/tokens/:id/details", async (req, res) => {
    const { id } = req.params;
    const now = Date.now();

    // Check cache
    if (detailsCache[id] && (now - detailsCache[id].timestamp < CACHE_TTL_DETAILS)) {
      return res.json({ ...detailsCache[id].data, isMock: false, isStale: false });
    }

    try {
      const response = await fetchWithRetry(
        `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false&sparkline=false`
      );
      
      if (!response.ok) {
        // Use stale cache if available
        if (detailsCache[id]) {
          return res.json({ ...detailsCache[id].data, isMock: false, isStale: true });
        }

        const token = tokens.find(t => t.id === id);
        return res.json({
          description: `${token?.name || id} is a popular memecoin in the crypto ecosystem. (Mock description due to API limit)`,
          sentiment_votes_up_percentage: 65,
          sentiment_votes_down_percentage: 35,
          links: { homepage: ["#"] },
          isMock: true
        });
      }

      const data = await response.json();
      const details = {
        description: data.description?.en || "No description available.",
        sentiment_votes_up_percentage: data.sentiment_votes_up_percentage || 50,
        sentiment_votes_down_percentage: data.sentiment_votes_down_percentage || 50,
        links: data.links,
        isMock: false
      };

      // Update cache
      detailsCache[id] = { data: details, timestamp: now };
      res.json(details);
    } catch (error) {
      console.error("Details fetch error:", error);
      res.status(500).json({ error: "Failed to fetch details" });
    }
  });

  app.get("/api/alerts", (req, res) => {
    res.json(alerts);
  });

  app.post("/api/trade", (req, res) => {
    const { userId, tokenId, amount, type } = req.body; // type: 'buy' | 'sell', amount is in USD for buy, in tokens for sell
    let user = getUserByTelegramId(userId);
    if (!user) {
      user = createUser(userId, `User_${userId}`);
    }
    const token = tokens.find(t => t.id === tokenId);

    if (!token) return res.status(404).json({ error: "Token not found" });

    if (type === "buy") {
      if (user.balance < amount) return res.status(400).json({ error: "Insufficient balance" });
      const tokenAmount = amount / token.price;
      user.balance -= amount;
      user.portfolio[tokenId] = (user.portfolio[tokenId] || 0) + tokenAmount;
      user.trades.push({ type, tokenId, amount, tokenAmount, price: token.price, date: new Date() });
    } else {
      const tokenAmount = amount;
      if ((user.portfolio[tokenId] || 0) < tokenAmount) return res.status(400).json({ error: "Insufficient tokens" });
      const usdAmount = tokenAmount * token.price;
      user.balance += usdAmount;
      user.portfolio[tokenId] -= tokenAmount;
      user.trades.push({ type, tokenId, amount: usdAmount, tokenAmount, price: token.price, date: new Date() });
    }

    updateUser(user);
    res.json(user);
  });

  app.get("/api/portfolio/:userId", (req, res) => {
    const userId = parseInt(req.params.userId);
    let user = getUserByTelegramId(userId);
    if (!user) {
      user = createUser(userId, `User_${userId}`);
    }

    const portfolioValue = Object.entries(user.portfolio).reduce((acc, [tokenId, amount]) => {
      const token = tokens.find(t => t.id === tokenId);
      return acc + (amount * (token?.price || 0));
    }, 0);

    res.json({
      balance: user.balance,
      portfolio: user.portfolio,
      trades: user.trades || [],
      totalValue: user.balance + portfolioValue,
      tokens: Object.entries(user.portfolio).map(([tokenId, amount]) => {
        const token = tokens.find(t => t.id === tokenId);
        return { ...token, amount };
      }).filter(t => t.amount > 0)
    });
  });

  app.get("/api/leaderboard", (req, res) => {
    const allUsers = getAllUsers();
    const leaderboard = allUsers.map(u => {
      const portfolioValue = Object.entries(u.portfolio).reduce((acc, [tokenId, amount]) => {
        const token = tokens.find(t => t.id === tokenId);
        return acc + (amount * (token?.price || 0));
      }, 0);
      return {
        username: u.username || `User_${u.id}`,
        totalValue: u.balance + portfolioValue,
        profit: (u.balance + portfolioValue) - 1000
      };
    }).sort((a, b) => b.totalValue - a.totalValue).slice(0, 10);
    
    res.json(leaderboard);
  });

  // Catch-all for API routes that don't match
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
