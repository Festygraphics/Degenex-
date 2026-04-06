import asyncio
import logging
import os

from aiogram import Bot, Dispatcher
from dotenv import load_dotenv

from handlers.price import router as price_router
from handlers.start import router as start_router
from handlers.trending import router as trending_router
from services.dexscreener import DexscreenerService


async def run() -> None:
    load_dotenv()
    logging.basicConfig(level=logging.INFO)

    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not set")

    bot = Bot(token=token)
    dp = Dispatcher()
    service = DexscreenerService(ttl_seconds=20, timeout_seconds=10)

    dp["dexscreener_service"] = service
    dp.include_router(start_router)
    dp.include_router(price_router)
    dp.include_router(trending_router)

    try:
        await dp.start_polling(bot)
    finally:
        await service.close()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(run())
