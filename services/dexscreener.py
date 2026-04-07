import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any

import aiohttp

logger = logging.getLogger(__name__)

DEXSCREENER_SEARCH_URL = "https://api.dexscreener.com/latest/dex/search"


@dataclass(slots=True)
class TokenQuote:
    name: str
    symbol: str
    price_usd: float
    liquidity_usd: float
    volume_24h_usd: float
    dex_id: str | None = None
    chain_id: str | None = None
    pair_url: str | None = None


class DexscreenerService:
    def __init__(
        self,
        ttl_seconds: int = 20,
        timeout_seconds: int = 10,
        max_cache_entries: int = 128,
    ) -> None:
        self.ttl_seconds = ttl_seconds
        self.timeout_seconds = timeout_seconds
        self.max_cache_entries = max_cache_entries
        self._cache: dict[str, tuple[float, list[TokenQuote]]] = {}
        self._lock = asyncio.Lock()
        self._session: aiohttp.ClientSession | None = None

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    async def search_tokens(self, query: str) -> list[TokenQuote]:
        normalized = query.strip().lower()
        if not normalized:
            return []

        cached = await self._get_cached(normalized)
        if cached is not None:
            return cached

        payload = await self._fetch_search_payload(query)
        if payload is None:
            return []

        pairs = payload.get("pairs") or []
        quotes: list[TokenQuote] = []
        for pair in pairs:
            quote = self._pair_to_quote(pair)
            if quote is not None:
                quotes.append(quote)

        await self._set_cached(normalized, quotes)
        return quotes

    async def get_token_price(self, token_query: str) -> TokenQuote | None:
        quotes = await self.search_tokens(token_query)
        if not quotes:
            return None

        # Prefer exact symbol match, then exact name, then highest-liquidity result.
        normalized = token_query.strip().lower()
        symbol_match = [q for q in quotes if q.symbol.lower() == normalized]
        if symbol_match:
            return max(symbol_match, key=lambda q: q.liquidity_usd)

        name_match = [q for q in quotes if q.name.lower() == normalized]
        if name_match:
            return max(name_match, key=lambda q: q.liquidity_usd)

        return max(quotes, key=lambda q: q.liquidity_usd)

    async def get_trending_tokens(
        self,
        query: str = "trending",
        limit: int = 5,
        sort_by: str = "volume",
    ) -> list[TokenQuote]:
        quotes = await self.search_tokens(query)
        if not quotes:
            return []

        key_fn = (
            (lambda q: q.volume_24h_usd)
            if sort_by == "volume"
            else (lambda q: q.liquidity_usd)
        )
        return sorted(quotes, key=key_fn, reverse=True)[:limit]

    async def _fetch_search_payload(self, query: str) -> dict[str, Any] | None:
        params = {"q": query}

        try:
            session = await self._get_or_create_session()
            async with session.get(DEXSCREENER_SEARCH_URL, params=params) as response:
                if response.status != 200:
                    body = await response.text()
                    logger.error(
                        "Dexscreener API error %s for query=%s: %s",
                        response.status,
                        query,
                        body[:200],
                    )
                    return None

                return await response.json()
        except aiohttp.ClientError:
            logger.exception("Network error while calling Dexscreener for query=%s", query)
            return None
        except asyncio.TimeoutError:
            logger.error("Dexscreener request timed out for query=%s", query)
            return None
        except Exception:
            logger.exception("Unexpected Dexscreener error for query=%s", query)
            return None

    async def _get_or_create_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=self.timeout_seconds)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    def _pair_to_quote(self, pair: dict[str, Any]) -> TokenQuote | None:
        base_token = pair.get("baseToken") or {}
        name = base_token.get("name")
        symbol = base_token.get("symbol")
        price_raw = pair.get("priceUsd")

        if not name or not symbol or price_raw in (None, ""):
            return None

        price_usd = self._to_float(price_raw)
        liquidity_usd = self._to_float((pair.get("liquidity") or {}).get("usd"))
        volume_24h_usd = self._to_float((pair.get("volume") or {}).get("h24"))

        return TokenQuote(
            name=name,
            symbol=symbol,
            price_usd=price_usd,
            liquidity_usd=liquidity_usd,
            volume_24h_usd=volume_24h_usd,
            dex_id=pair.get("dexId"),
            chain_id=pair.get("chainId"),
            pair_url=pair.get("url"),
        )

    @staticmethod
    def _to_float(value: Any) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    async def _get_cached(self, key: str) -> list[TokenQuote] | None:
        async with self._lock:
            cached = self._cache.get(key)
            if not cached:
                return None

            cached_at, result = cached
            if (time.time() - cached_at) > self.ttl_seconds:
                self._cache.pop(key, None)
                return None

            return result

    async def _set_cached(self, key: str, result: list[TokenQuote]) -> None:
        async with self._lock:
            if len(self._cache) >= self.max_cache_entries:
                oldest_key = min(self._cache.items(), key=lambda item: item[1][0])[0]
                self._cache.pop(oldest_key, None)

            self._cache[key] = (time.time(), result)
