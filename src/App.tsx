/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

type FilterKey = 'all' | 'trending' | 'gainers';

interface Token {
  id: string;
  name: string;
  symbol: string;
  address: string;
  price: number;
  change24h: number;
  volume: number;
  liquidity: number;
  chainId: string;
  source: 'trending' | 'gainer';
}

interface DexPair {
  chainId?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
}

const DEX_SEARCH_URL = 'https://api.dexscreener.com/latest/dex/search';
const TRENDING_QUERIES = ['pepe', 'doge', 'shib', 'inu'];
const GAINER_QUERIES = ['btc', 'sol', 'eth', 'pepe', 'doge', 'shib', 'bonk', 'wif'];

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatPrice = (price: number) => {
  if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
};

const buildChartData = (price: number, change24h: number, points = 24) => {
  if (!price) return [];
  const start = price / (1 + change24h / 100 || 1);
  const now = Date.now();
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    const drift = start + (price - start) * t;
    const noise = drift * (Math.random() * 0.01 - 0.005);
    return {
      time: new Date(now - (points - i - 1) * 60 * 60 * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      price: Math.max(0, drift + noise),
    };
  });
};

const mapPairToToken = (pair: DexPair, source: Token['source']): Token | null => {
  const address = pair.baseToken?.address;
  const symbol = pair.baseToken?.symbol;
  const name = pair.baseToken?.name;
  if (!address || !symbol || !name) return null;

  return {
    id: `${pair.chainId || 'unknown'}:${address}`,
    name,
    symbol,
    address,
    chainId: pair.chainId || 'unknown',
    price: toNumber(pair.priceUsd),
    change24h: toNumber(pair.priceChange?.h24),
    volume: toNumber(pair.volume?.h24),
    liquidity: toNumber(pair.liquidity?.usd),
    source,
  };
};

async function fetchDexQuery(query: string): Promise<DexPair[]> {
  const url = `${DEX_SEARCH_URL}?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Dexscreener ${res.status} for query=${query}`);
  }
  const data = await res.json();
  return Array.isArray(data?.pairs) ? data.pairs : [];
}

export default function App() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedChartData = useMemo(
    () => (selectedToken ? buildChartData(selectedToken.price, selectedToken.change24h) : []),
    [selectedToken]
  );

  const loadListing = async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const trendingQueries = search?.trim() ? [search.trim()] : TRENDING_QUERIES;

      const [trendingSets, gainerSets] = await Promise.all([
        Promise.all(trendingQueries.map(fetchDexQuery)),
        Promise.all(GAINER_QUERIES.map(fetchDexQuery)),
      ]);

      const trending = trendingSets
        .flat()
        .map((pair) => mapPairToToken(pair, 'trending'))
        .filter((t): t is Token => Boolean(t))
        .filter((t) => t.liquidity > 10000)
        .sort((a, b) => b.volume - a.volume);

      const gainers = gainerSets
        .flat()
        .map((pair) => mapPairToToken(pair, 'gainer'))
        .filter((t): t is Token => Boolean(t))
        .sort((a, b) => b.change24h - a.change24h);

      const merged = [...trending, ...gainers];
      const deduped = new Map<string, Token>();
      for (const token of merged) {
        const key = token.address.toLowerCase();
        const existing = deduped.get(key);
        if (!existing || token.volume > existing.volume) {
          deduped.set(key, token);
        }
      }

      const finalList = Array.from(deduped.values()).sort(
        (a, b) => (b.volume + b.change24h * 1000) - (a.volume + a.change24h * 1000)
      );

      setTokens(finalList);
      setSelectedToken((prev) => prev || finalList[0] || null);
    } catch (e) {
      console.error('Listing load failed:', e);
      setError('Failed to load tokens from Dexscreener.');
      setTokens([]);
      setSelectedToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
    loadListing();
  }, []);

  useEffect(() => {
    let list = [...tokens];
    if (activeFilter === 'trending') {
      list = list.filter((t) => t.source === 'trending').sort((a, b) => b.volume - a.volume);
    } else if (activeFilter === 'gainers') {
      list = list.sort((a, b) => b.change24h - a.change24h);
    }
    setFilteredTokens(list);
  }, [tokens, activeFilter]);

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white px-4 py-5 max-w-xl mx-auto">
      <header className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <TrendingUp size={22} className="text-[#7C3AED]" />
          <h1 className="text-2xl font-black">Listing</h1>
        </div>
        <button
          onClick={() => loadListing(searchQuery)}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="flex gap-2 mb-4">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadListing(searchQuery)}
          placeholder="Search token (e.g. bonk, wif, pepe)"
          className="flex-1 bg-[#111114] border border-white/10 rounded-xl px-4 py-3 outline-none"
        />
        <button
          onClick={() => loadListing(searchQuery)}
          className="px-4 py-3 rounded-xl bg-[#7C3AED] font-bold"
        >
          Search
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { id: 'all' as const, label: 'All' },
          { id: 'trending' as const, label: 'Trending' },
          { id: 'gainers' as const, label: 'Top Gainers' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold border ${
              activeFilter === f.id ? 'bg-[#7C3AED] border-[#7C3AED]' : 'bg-white/5 border-white/10 text-white/70'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-white/60">Loading tokens...</div>
      ) : error ? (
        <div className="p-8 text-center text-red-400">{error}</div>
      ) : filteredTokens.length === 0 ? (
        <div className="p-8 text-center text-white/50">No tokens found.</div>
      ) : (
        <div className="space-y-2 mb-6 max-h-[48vh] overflow-y-auto pr-1">
          {filteredTokens.map((token) => (
            <button
              key={token.id}
              onClick={() => setSelectedToken(token)}
              className="w-full text-left p-4 rounded-2xl bg-[#111114] border border-white/10 hover:border-[#7C3AED]/40"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black tracking-tight">{token.name}</div>
                  <div className="text-xs text-white/50 uppercase">{token.symbol} • {token.chainId}</div>
                </div>
                <div className="text-right">
                  <div className="font-black">{formatPrice(token.price)}</div>
                  <div className={`text-xs font-bold ${token.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-white/50 flex gap-4">
                <span>Vol 24h: ${token.volume.toLocaleString()}</span>
                <span>Liq: ${token.liquidity.toLocaleString()}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedToken && (
        <section className="bg-[#111114] border border-white/10 rounded-2xl p-4 space-y-4">
          <div>
            <div className="text-lg font-black">{selectedToken.name} ({selectedToken.symbol})</div>
            <div className="text-sm text-white/60">Price {formatPrice(selectedToken.price)} • 24h {selectedToken.change24h.toFixed(2)}%</div>
            <div className="text-xs text-white/50 mt-1">
              Liquidity ${selectedToken.liquidity.toLocaleString()} • Volume ${selectedToken.volume.toLocaleString()}
            </div>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={selectedChartData}>
                <defs>
                  <linearGradient id="listingChartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="time" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="price" stroke="#7C3AED" fill="url(#listingChartFill)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
