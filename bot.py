"""Backward-compatible entrypoint.

This file is intentionally kept so existing workflows that run `python bot.py`
continue to work after the modular refactor.
"""

from main import run

if __name__ == "__main__":
    import asyncio

    asyncio.run(run())
