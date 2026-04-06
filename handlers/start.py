from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

router = Router()


@router.message(Command("start"))
async def start_command(message: Message) -> None:
    await message.answer(
        "🚀 Welcome to Degenex!\n\n"
        "Available commands:\n"
        "• /price <token> — Get real-time token price from Dexscreener\n"
        "• /trending — Show top 5 trending tokens"
    )
