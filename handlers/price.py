from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from services.dexscreener import DexscreenerService
from utils.formatter import format_price_message

router = Router()
USAGE_MESSAGE = "Usage: /price <token_symbol_or_name>\nExample: /price PEPE"


def _extract_query(text: str) -> str:
    parts = text.split(maxsplit=1)
    return parts[1].strip() if len(parts) > 1 else ""


@router.message(Command("price"))
async def price_command(message: Message, dexscreener_service: DexscreenerService) -> None:
    query = _extract_query(message.text or "")
    if not query:
        await message.answer(USAGE_MESSAGE)
        return

    quote = await dexscreener_service.get_token_price(query)
    if quote is None:
        await message.answer(f"Could not find live token data for '{query}'. Try another symbol.")
        return

    await message.answer(format_price_message(quote))
