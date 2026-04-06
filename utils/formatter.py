from services.dexscreener import TokenQuote

DEFAULT_PRICE_DECIMALS = 8


def format_usd(value: float) -> str:
    if value >= 1:
        return f"${value:,.2f}"
    if value >= 0.01:
        return f"${value:,.4f}"
    return f"${value:,.{DEFAULT_PRICE_DECIMALS}f}"


def format_compact_usd(value: float) -> str:
    return f"${value:,.0f}"


def format_price_message(quote: TokenQuote) -> str:
    return (
        f"🔥 {quote.name} ({quote.symbol})\n"
        f"💰 Price: {format_usd(quote.price_usd)}\n"
        f"💧 Liquidity: {format_compact_usd(quote.liquidity_usd)}\n"
        f"📊 24h Volume: {format_compact_usd(quote.volume_24h_usd)}"
    )


def format_trending_message(quotes: list[TokenQuote], sort_by: str = "volume") -> str:
    metric_label = "24h Volume" if sort_by == "volume" else "Liquidity"
    lines = [f"📈 Top 5 Trending Tokens by {metric_label}"]

    for idx, quote in enumerate(quotes, start=1):
        metric_value = quote.volume_24h_usd if sort_by == "volume" else quote.liquidity_usd
        line = (
            f"{idx}. {quote.name} ({quote.symbol}) | "
            f"Price {format_usd(quote.price_usd)} | "
            f"{metric_label}: {format_compact_usd(metric_value)}"
        )
        lines.append(line)

    return "\n".join(lines)
