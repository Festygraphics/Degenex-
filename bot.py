import os
import sqlite3
import json
import logging
import asyncio
from datetime import datetime
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import Message
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
DB_PATH = "degenex.db"

# Configure logging
logging.basicConfig(level=logging.INFO)

# Initialize bot and dispatcher
bot = Bot(token=TOKEN)
dp = Dispatcher()

# Database setup
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT,
            balance REAL DEFAULT 1000,
            portfolio TEXT DEFAULT '{}',
            trades TEXT DEFAULT '[]',
            hasCompletedOnboarding INTEGER DEFAULT 0,
            isPro INTEGER DEFAULT 0,
            referralCode TEXT,
            referralsCount INTEGER DEFAULT 0,
            completedTasks TEXT DEFAULT '[]',
            lastLogin TEXT
        )
    ''')
    conn.commit()
    conn.close()

def get_user(user_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "id": row[0],
            "username": row[1],
            "balance": row[2],
            "portfolio": json.loads(row[3]),
            "trades": json.loads(row[4]),
            "hasCompletedOnboarding": bool(row[5]),
            "isPro": bool(row[6]),
            "referralCode": row[7],
            "referralsCount": row[8],
            "completedTasks": json.loads(row[9]),
            "lastLogin": row[10]
        }
    return None

def save_user(user):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO users (
            id, username, balance, portfolio, trades, 
            hasCompletedOnboarding, isPro, referralCode, 
            referralsCount, completedTasks, lastLogin
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        user["id"], 
        user.get("username"), 
        user["balance"], 
        json.dumps(user["portfolio"]), 
        json.dumps(user["trades"]),
        1 if user.get("hasCompletedOnboarding") else 0,
        1 if user.get("isPro") else 0,
        user.get("referralCode", f"DGX-{user['id']}"),
        user.get("referralsCount", 0),
        json.dumps(user.get("completedTasks", [])),
        user.get("lastLogin", "")
    ))
    conn.commit()
    conn.close()

# Mock tokens for the bot (matching server.ts)
TOKENS = {
    "DOGE": {"id": "dogecoin", "price": 0.15},
    "SHIB": {"id": "shiba-inu", "price": 0.000025},
    "PEPE": {"id": "pepe", "price": 0.000008},
    "FLOKI": {"id": "floki", "price": 0.0002},
    "BONK": {"id": "bonk", "price": 0.00002},
    "WIF": {"id": "dogwifhat", "price": 3.2},
    "BRETT": {"id": "brett", "price": 0.07}
}

@dp.message(Command("start"))
async def start_command(message: Message):
    user_id = message.from_user.id
    username = message.from_user.username or message.from_user.first_name
    
    user = get_user(user_id)
    if not user:
        user = {
            "id": user_id,
            "username": username,
            "balance": 1000.0,
            "portfolio": {},
            "trades": [],
            "hasCompletedOnboarding": False,
            "isPro": False,
            "referralCode": f"DGX-{user_id}",
            "referralsCount": 0,
            "completedTasks": [],
            "lastLogin": datetime.now().isoformat()
        }
        save_user(user)
        await message.answer(f"🚀 Welcome to DEGENEX, {username}!\n\nYour account has been created with a demo balance of $1,000.")
    else:
        await message.answer(f"🔥 Welcome back, {username}!\n\nYour current balance: ${user['balance']:,.2f}")

@dp.message(Command("buy"))
async def buy_command(message: Message):
    args = message.text.split()
    if len(args) < 3:
        return await message.answer("Usage: /buy <coin_symbol> <amount_usd>\nExample: /buy DOGE 100")
    
    symbol = args[1].upper()
    try:
        amount_usd = float(args[2])
    except ValueError:
        return await message.answer("Invalid amount. Please provide a number.")

    if symbol not in TOKENS:
        return await message.answer(f"Coin {symbol} not found. Available: {', '.join(TOKENS.keys())}")

    user = get_user(message.from_user.id)
    if not user:
        return await message.answer("Please use /start first.")

    if user["balance"] < amount_usd:
        return await message.answer(f"Insufficient balance. You have ${user['balance']:,.2f}")

    token = TOKENS[symbol]
    token_amount = amount_usd / token["price"]
    
    user["balance"] -= amount_usd
    token_id = token["id"]
    user["portfolio"][token_id] = user["portfolio"].get(token_id, 0) + token_amount
    user["trades"].append({
        "type": "buy",
        "symbol": symbol,
        "amount_usd": amount_usd,
        "token_amount": token_amount,
        "price": token["price"]
    })
    
    save_user(user)
    await message.answer(f"✅ Bought {token_amount:,.4f} {symbol} for ${amount_usd:,.2f}.\nNew balance: ${user['balance']:,.2f}")

@dp.message(Command("sell"))
async def sell_command(message: Message):
    args = message.text.split()
    if len(args) < 3:
        return await message.answer("Usage: /sell <coin_symbol> <amount_tokens>\nExample: /sell DOGE 100")
    
    symbol = args[1].upper()
    try:
        token_amount = float(args[2])
    except ValueError:
        return await message.answer("Invalid amount. Please provide a number.")

    if symbol not in TOKENS:
        return await message.answer(f"Coin {symbol} not found.")

    user = get_user(message.from_user.id)
    if not user:
        return await message.answer("Please use /start first.")

    token = TOKENS[symbol]
    token_id = token["id"]
    
    current_holdings = user["portfolio"].get(token_id, 0)
    if current_holdings < token_amount:
        return await message.answer(f"Insufficient tokens. You have {current_holdings:,.4f} {symbol}")

    usd_amount = token_amount * token["price"]
    user["balance"] += usd_amount
    user["portfolio"][token_id] -= token_amount
    user["trades"].append({
        "type": "sell",
        "symbol": symbol,
        "amount_usd": usd_amount,
        "token_amount": token_amount,
        "price": token["price"]
    })
    
    save_user(user)
    await message.answer(f"✅ Sold {token_amount:,.4f} {symbol} for ${usd_amount:,.2f}.\nNew balance: ${user['balance']:,.2f}")

@dp.message(Command("portfolio"))
async def portfolio_command(message: Message):
    user = get_user(message.from_user.id)
    if not user:
        return await message.answer("Please use /start first.")

    text = f"📊 *Your Portfolio*\n\nBalance: ${user['balance']:,.2f}\n\n*Holdings:*\n"
    total_value = user["balance"]
    
    has_holdings = False
    for symbol, token_info in TOKENS.items():
        token_id = token_info["id"]
        amount = user["portfolio"].get(token_id, 0)
        if amount > 0:
            has_holdings = True
            value = amount * token_info["price"]
            total_value += value
            text += f"• {symbol}: {amount:,.4f} (${value:,.2f})\n"
    
    if not has_holdings:
        text += "_No holdings yet._"
    
    text += f"\n*Total Portfolio Value: ${total_value:,.2f}*"
    await message.answer(text, parse_mode="Markdown")

async def main():
    init_db()
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
