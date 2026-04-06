from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from services.dexscreener import DexscreenerService
from utils.formatter import format_trending_message

router = Router()
DEFAULT_TRENDING_QUERY = "trending"
DEFAULT_LIMIT = 5
DEFAULT_SORT = "volume"


@router.message(Command("trending"))
async def trending_command(message: Message, dexscreener_service: DexscreenerService) -> None:
    quotes = await dexscreener_service.get_trending_tokens(
        query=DEFAULT_TRENDING_QUERY,
        limit=DEFAULT_LIMIT,
        sort_by=DEFAULT_SORT,
    )
    if not quotes:
        await message.answer("Unable to fetch trending tokens right now. Please try again shortly.")
        return

    await message.answer(format_trending_message(quotes, sort_by=DEFAULT_SORT))
