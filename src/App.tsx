/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Wallet, 
  Trophy, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Bell,
  ChevronRight,
  ArrowLeftRight,
  Coins,
  User as UserIcon,
  RefreshCw,
  Globe,
  Twitter,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Rocket,
  MousePointer2,
  Zap,
  X
} from 'lucide-react';
import { useMotionValue, useTransform, useSpring } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  AreaChart, 
  Area,
  Brush,
  CartesianGrid
} from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Token {
  id: string;
  symbol: string;
  name: string;
  address: string;
  chainId?: string;
  pairAddress?: string;
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

const formatPrice = (price: number) => {
  if (price === 0) return '0.00';
  if (price >= 1) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 0.01) return price.toFixed(4);
  if (price >= 0.0001) return price.toFixed(6);
  return price.toFixed(8);
};

const highlightText = (text: string, highlight: string) => {
  if (!highlight.trim()) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${highlight.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span key={i} className="text-[#7C3AED] font-black">{part}</span>
        ) : (
          part
        )
      )}
    </span>
  );
};

interface User {
  id: number;
  username?: string;
  photoUrl?: string;
  balance: number;
  portfolio: { [tokenId: string]: number };
  hasCompletedOnboarding: boolean;
  isPro: boolean;
  referralCode: string;
  referralsCount: number;
  completedTasks: string[];
}

interface ListingsData {
  new: Token[];
  hot: Token[];
  earlyGems: Token[];
}

interface RewardsData {
  tasks: { id: string; title: string; reward: number; icon: string; link?: string; isDaily?: boolean }[];
  missions: { id: string; title: string; reward: number; goal: number }[];
}

interface PortfolioData {
  balance: number;
  totalValue: number;
  tokens: (Token & { amount: number })[];
  trades: {
    type: 'buy' | 'sell';
    tokenId: string;
    amount: number;
    tokenAmount: number;
    price: number;
    date: string;
  }[];
}

const API_BASE_URL = (((import.meta as any).env?.VITE_API_BASE_URL as string) || '').replace(/\/$/, '');
const DEXSCREENER_SEARCH_URL = 'https://api.dexscreener.com/latest/dex/search';
const DEXSCREENER_TOKEN_URL = 'https://api.dexscreener.com/latest/dex/tokens';
const TRENDING_SEARCH_TERMS = ['btc', 'sol', 'pepe', 'doge'];

const apiUrl = (path: string) => {
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const safeFetchJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const fullUrl = apiUrl(path);
  const res = await fetch(fullUrl, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} on ${fullUrl}: ${text.slice(0, 300)}`);
  }
  return res.json();
};

const fallbackRewardsData: RewardsData = {
  tasks: [],
  missions: [],
};

const fallbackListingsData: ListingsData = {
  new: [],
  hot: [],
  earlyGems: [],
};

const normalizeUser = (raw: Partial<User> & { id: number }): User => ({
  id: raw.id,
  username: raw.username,
  photoUrl: raw.photoUrl,
  balance: toNumber(raw.balance ?? 1000),
  portfolio: raw.portfolio || {},
  hasCompletedOnboarding: Boolean(raw.hasCompletedOnboarding),
  isPro: Boolean(raw.isPro),
  referralCode: raw.referralCode || `DGX-${raw.id}`,
  referralsCount: toNumber(raw.referralsCount ?? 0),
  completedTasks: raw.completedTasks || [],
});

const buildFallbackPortfolio = (user: User): PortfolioData => ({
  balance: user.balance,
  totalValue: user.balance,
  tokens: [],
  trades: [],
});

const colorFromSymbol = (symbol: string) => {
  const palette = ['#7C3AED', '#22C55E', '#F97316', '#0EA5E9', '#EF4444', '#EAB308', '#8B5CF6'];
  const hash = symbol.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return palette[hash % palette.length];
};

const mapDexPairToToken = (pair: any): Token | null => {
  const baseToken = pair?.baseToken;
  if (!baseToken?.symbol || !baseToken?.name) return null;
  const pairAddress = pair?.pairAddress || `${pair?.chainId || 'dex'}-${baseToken.symbol}`;

  return {
    id: String(baseToken?.address || pairAddress),
    symbol: String(baseToken.symbol).toUpperCase(),
    name: String(baseToken.name),
    address: String(baseToken?.address || pairAddress),
    chainId: String(pair?.chainId || ''),
    pairAddress: String(pair?.pairAddress || ''),
    price: toNumber(pair?.priceUsd),
    change24h: toNumber(pair?.priceChange?.h24),
    color: colorFromSymbol(String(baseToken.symbol).toUpperCase()),
    image: pair?.info?.imageUrl,
    marketCap: toNumber(pair?.marketCap),
    volume: toNumber(pair?.volume?.h24),
    rank: undefined,
    links: {
      homepage: pair?.url,
      twitter: pair?.info?.socials?.find((s: any) => s?.type === 'twitter')?.url,
      website: pair?.info?.websites?.[0]?.url,
    },
    sentiment: {
      upvotes: 0,
      downvotes: 0,
    },
  };
};

const bestDexPair = (pairs: any[] = []) => {
  if (!Array.isArray(pairs) || pairs.length === 0) return null;
  return [...pairs].sort((a, b) => toNumber(b?.liquidity?.usd) - toNumber(a?.liquidity?.usd))[0];
};

const buildSyntheticChartData = (currentPrice: number, change24h: number, points = 24) => {
  if (!currentPrice || points < 2) return [];
  const changeFactor = 1 + (change24h / 100);
  const startPrice = currentPrice / (changeFactor || 1);
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    const trend = startPrice + (currentPrice - startPrice) * t;
    const noise = trend * (Math.random() * 0.01 - 0.005);
    return {
      time: new Date(now - (points - 1 - i) * hourMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      price: Math.max(0, trend + noise),
    };
  });
};

const fetchDexPairForToken = async (tokenAddress: string) => {
  try {
    const data = await safeFetchJson<{ pairs?: any[] }>(`${DEXSCREENER_TOKEN_URL}/${encodeURIComponent(tokenAddress)}`);
    return bestDexPair(data?.pairs || []);
  } catch (error) {
    console.error('Dexscreener token endpoint failed:', error);
    return null;
  }
};

const mapDexPairToDetails = (pair: any) => ({
  description: `${pair?.baseToken?.name || 'Token'} on ${pair?.dexId || 'DEX'}.`,
  sentiment_votes_up_percentage: 50,
  sentiment_votes_down_percentage: 50,
  links: {
    homepage: [pair?.url].filter(Boolean),
    twitter_screen_name: null,
    subreddit_url: null,
  },
  isMock: false,
});

const fetchDexscreenerTokens = async (query = 'trending', limit = 30): Promise<Token[]> => {
  try {
    const url = `${DEXSCREENER_SEARCH_URL}?q=${encodeURIComponent(query)}`;
    const data = await safeFetchJson<{ pairs?: any[] }>(url);
    const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
    const mapped = pairs
      .map(mapDexPairToToken)
      .filter((token): token is Token => Boolean(token))
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, limit);
    return mapped;
  } catch (error) {
    console.error('Dexscreener fallback fetch failed:', error);
    return [];
  }
};

const fetchTrendingDexTokens = async (): Promise<Token[]> => {
  const batches = await Promise.all(TRENDING_SEARCH_TERMS.map(term => fetchDexscreenerTokens(term, 25)));
  const merged = batches.flat();
  const unique = new Map<string, Token>();

  for (const token of merged) {
    const key = token.pairAddress || token.address || token.id;
    const existing = unique.get(key);
    if (!existing || (token.volume || 0) > (existing.volume || 0)) {
      unique.set(key, token);
    }
  }

  const sorted = Array.from(unique.values()).sort((a, b) => (b.volume || 0) - (a.volume || 0));
  const perChain: Record<string, Token[]> = {};
  for (const token of sorted) {
    const chain = token.chainId || 'unknown';
    if (!perChain[chain]) perChain[chain] = [];
    perChain[chain].push(token);
  }

  const chainKeys = Object.keys(perChain).sort((a, b) => (perChain[b].length - perChain[a].length));
  const diversified: Token[] = [];
  let added = true;
  let idx = 0;
  while (added && diversified.length < 60) {
    added = false;
    for (const chain of chainKeys) {
      const item = perChain[chain][idx];
      if (item) {
        diversified.push(item);
        added = true;
      }
      if (diversified.length >= 60) break;
    }
    idx += 1;
  }

  return diversified;
};

// --- Components ---

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div className={cn("bg-white/[0.03] border border-white/[0.05] rounded-[24px] p-5 backdrop-blur-md", className)} {...props}>
    {children}
  </div>
);

const NavItem = ({ active, icon: Icon, label, onClick, isCenter = false }: { active: boolean; icon: any; label: string; onClick: () => void; isCenter?: boolean }) => {
  if (isCenter) {
    return (
      <div className="relative -top-8 flex flex-col items-center">
        <button 
          onClick={onClick}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-[0_20px_50px_rgba(124,58,237,0.3)] active:scale-90 group",
            active 
              ? "bg-[#7C3AED] text-white scale-110" 
              : "bg-[#7C3AED] text-white/90 hover:scale-105"
          )}
        >
          <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
          <Icon size={32} strokeWidth={2.5} className="relative z-10" />
        </button>
        <span className={cn(
          "text-[10px] font-black uppercase tracking-[0.2em] mt-3 transition-all duration-500",
          active ? "text-[#7C3AED] opacity-100 translate-y-0" : "text-white/20 opacity-0 translate-y-2"
        )}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <button 
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1.5 transition-all duration-300 py-2 flex-1 active:scale-90",
        active ? "text-[#7C3AED]" : "text-white/30 hover:text-white/50"
      )}
    >
      <div className={cn(
        "p-2 rounded-xl transition-all duration-300",
        active ? "bg-[#7C3AED]/10" : "bg-transparent"
      )}>
        <Icon size={22} strokeWidth={active ? 2.5 : 2} />
      </div>
      <span className={cn(
        "text-[9px] font-black uppercase tracking-[0.1em] transition-all duration-300",
        active ? "opacity-100" : "opacity-40"
      )}>
        {label}
      </span>
    </button>
  );
};

const StatItem = ({ label, value, subValue, trend }: { label: string; value: string; subValue?: string; trend?: number }) => (
  <div className="space-y-1">
    <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{label}</div>
    <div className="text-lg font-black tracking-tight">{value}</div>
    {subValue && (
      <div className={cn(
        "text-[10px] font-bold flex items-center gap-0.5",
        trend && trend > 0 ? "text-green-400" : trend && trend < 0 ? "text-red-400" : "text-white/40"
      )}>
        {trend && trend !== 0 && (trend > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />)}
        {subValue}
      </div>
    )}
  </div>
);

const ActionButton = ({ icon: Icon, label, onClick, variant = 'secondary' }: { icon: any; label: string; onClick: () => void; variant?: 'primary' | 'secondary' }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex flex-col items-center gap-2 transition-all active:scale-95 group",
      "flex-1"
    )}
  >
    <div className={cn(
      "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300",
      variant === 'primary' 
        ? "bg-[#7C3AED] text-white shadow-lg shadow-[#7C3AED]/20 group-hover:bg-[#8B5CF6]" 
        : "bg-white/5 text-white/60 border border-white/5 group-hover:bg-white/10 group-hover:text-white"
    )}>
      <Icon size={20} />
    </div>
    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest group-hover:text-white/60 transition-colors">{label}</span>
  </button>
);

export default function App() {
  const tabs = useMemo(() => ['trade', 'listings', 'home', 'portfolio', 'rewards'] as const, []);
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('home');
  const [prevTab, setPrevTab] = useState<typeof tabs[number]>('home');
  const [user, setUser] = useState<User | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [listings, setListings] = useState<ListingsData | null>(null);
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [tokensError, setTokensError] = useState<string | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);

  // Track scroll position to only enable pull-to-refresh at the top
  useEffect(() => {
    const handleScroll = () => {
      setIsAtTop(window.scrollY < 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Pull to refresh logic
  const pullDistance = useMotionValue(0);
  const springPullDistance = useSpring(pullDistance, { stiffness: 300, damping: 30 });
  const pullThreshold = 80;
  
  const refreshOpacity = useTransform(springPullDistance, [0, pullThreshold], [0, 1]);
  const refreshScale = useTransform(springPullDistance, [0, pullThreshold], [0.5, 1]);
  const refreshRotate = useTransform(springPullDistance, [0, pullThreshold], [0, 180]);
  const contentY = useTransform(springPullDistance, [0, pullThreshold], [0, 20]);

  const fetchData = async () => {
    setTokensLoading(true);
    setTokensError(null);
    const [tokensResult, alertsResult, listingsResult, rewardsResult] = await Promise.allSettled([
      fetchTrendingDexTokens(),
      safeFetchJson<string[]>('/api/alerts'),
      safeFetchJson<ListingsData>('/api/listings'),
      safeFetchJson<RewardsData>('/api/rewards')
    ]);

    if (tokensResult.status === 'fulfilled' && Array.isArray(tokensResult.value)) {
      setTokens(tokensResult.value);
    } else {
      console.error('Dexscreener trending fetch failed, falling back to backend /api/tokens.', tokensResult);
      try {
        const fallbackTokens = await safeFetchJson<Token[]>('/api/tokens');
        setTokens(fallbackTokens);
      } catch (fallbackError) {
        console.error('Fallback /api/tokens fetch failed:', fallbackError);
        setTokens([]);
        setTokensError('No token data available from Dexscreener or backend.');
      }
    }
    setTokensLoading(false);

    if (alertsResult.status === 'fulfilled' && Array.isArray(alertsResult.value)) {
      setAlerts(alertsResult.value);
    } else {
      console.error('Alerts API failed:', alertsResult);
      setAlerts([]);
    }

    if (listingsResult.status === 'fulfilled') {
      setListings(listingsResult.value);
    } else {
      console.error('Listings API failed:', listingsResult);
      setListings(fallbackListingsData);
    }

    if (rewardsResult.status === 'fulfilled') {
      setRewards(rewardsResult.value);
    } else {
      console.error('Rewards API failed:', rewardsResult);
      setRewards(fallbackRewardsData);
    }

    if (!user) return;

    const [portfolioResult, leaderboardResult] = await Promise.allSettled([
      safeFetchJson<PortfolioData>(`/api/portfolio/${user.id}`),
      safeFetchJson<any[]>('/api/leaderboard'),
    ]);

    if (portfolioResult.status === 'fulfilled') {
      setPortfolio(portfolioResult.value);
    } else {
      console.error('Portfolio API failed:', portfolioResult);
      setPortfolio(buildFallbackPortfolio(user));
    }

    if (leaderboardResult.status === 'fulfilled' && Array.isArray(leaderboardResult.value)) {
      setLeaderboard(leaderboardResult.value);
    } else {
      console.error('Leaderboard API failed:', leaderboardResult);
      setLeaderboard([]);
    }
  };

  const handlePullEnd = () => {
    if (pullDistance.get() >= pullThreshold) {
      triggerRefresh();
    }
    pullDistance.set(0);
  };

  const triggerRefresh = async () => {
    setIsRefreshing(true);
    // Simulate a slight delay for the "great" animation feel
    await Promise.all([
      fetchData(),
      new Promise(resolve => setTimeout(resolve, 1000))
    ]);
    setIsRefreshing(false);
  };

  const direction = useMemo(() => {
    const currIndex = tabs.indexOf(activeTab);
    const prevIndex = tabs.indexOf(prevTab);
    return currIndex >= prevIndex ? 1 : -1;
  }, [activeTab, prevTab, tabs]);

  const handleTabChange = (tab: typeof tabs[number]) => {
    setPrevTab(activeTab);
    setActiveTab(tab);
    setInteractionCount(prev => prev + 1);
    
    // Smart gating: prompt to join after 5 interactions
    if (interactionCount === 5 && !user?.completedTasks?.includes('join_tg')) {
      setShowJoinModal(true);
    }
  };

  const tabVariants = {
    initial: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 20 : -20,
      scale: 0.98
    }),
    animate: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: [0.23, 1, 0.32, 1],
        staggerChildren: 0.05
      }
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -20 : 20,
      scale: 0.98,
      transition: {
        duration: 0.3
      }
    })
  };

  const itemVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
  };
  const [tokens, setTokens] = useState<Token[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [tokenDetails, setTokenDetails] = useState<any>(null);
  const [chartTimeframe, setChartTimeframe] = useState<'1' | '7' | '30'>('1');
  const [tokenHistory, setTokenHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [tradeAmount, setTradeAmount] = useState<string>('');
  const [isTrading, setIsTrading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [sortBy, setSortBy] = useState<'marketCap' | 'volume' | 'change24h' | 'price'>('marketCap');
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [seenTooltips, setSeenTooltips] = useState<string[]>(() => {
    const saved = localStorage.getItem('degenex_seen_tooltips');
    return saved ? JSON.parse(saved) : [];
  });

  const dismissTooltip = (id: string) => {
    if (seenTooltips.includes(id)) return;
    const updated = [...seenTooltips, id];
    setSeenTooltips(updated);
    localStorage.setItem('degenex_seen_tooltips', JSON.stringify(updated));
  };

  const GuideTooltip = ({ id, title, description, position = 'top', children }: { id: string, title: string, description: string, position?: 'top' | 'bottom' | 'left' | 'right', children: React.ReactNode, key?: React.Key }) => {
    if (seenTooltips.includes(id) || showOnboarding) return <>{children}</>;

    return (
      <div className="relative group/tooltip">
        {children}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: position === 'top' ? 10 : -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={cn(
            "absolute z-[60] w-48 p-4 bg-[#7C3AED] rounded-2xl shadow-2xl shadow-[#7C3AED]/30 text-left pointer-events-auto",
            position === 'top' && "bottom-full mb-4 left-1/2 -translate-x-1/2",
            position === 'bottom' && "top-full mt-4 left-1/2 -translate-x-1/2",
            position === 'left' && "right-full mr-4 top-1/2 -translate-y-1/2",
            position === 'right' && "left-full ml-4 top-1/2 -translate-y-1/2"
          )}
        >
          {/* Arrow */}
          <div className={cn(
            "absolute w-3 h-3 bg-[#7C3AED] rotate-45",
            position === 'top' && "bottom-[-6px] left-1/2 -translate-x-1/2",
            position === 'bottom' && "top-[-6px] left-1/2 -translate-x-1/2",
            position === 'left' && "right-[-6px] top-1/2 -translate-y-1/2",
            position === 'right' && "left-[-6px] top-1/2 -translate-y-1/2"
          )} />
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={12} className="text-white" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Pro Tip</span>
              </div>
              <button onClick={() => dismissTooltip(id)} className="text-white/50 hover:text-white transition-colors">
                <RefreshCw size={10} className="rotate-45" />
              </button>
            </div>
            <div className="text-xs font-black text-white leading-tight">{title}</div>
            <p className="text-[10px] text-white/70 leading-relaxed font-medium">{description}</p>
            <button 
              onClick={() => dismissTooltip(id)}
              className="w-full mt-2 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors"
            >
              Got it
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  useEffect(() => {
    if (user && !user.hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  }, [user]);

  const completeOnboarding = async () => {
    if (!user) return;
    try {
      const data = await safeFetchJson<User>('/api/user/onboarded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id })
      });
      setUser(normalizeUser(data));
      setShowOnboarding(false);
    } catch (e) {
      console.error("Onboarding completion error:", e);
      setShowOnboarding(false);
    }
  };

  const filteredTokens = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return tokens
      .filter(t => 
        t.name.toLowerCase().includes(query) || 
        t.symbol.toLowerCase().includes(query) ||
        t.address.toLowerCase().includes(query)
      )
      .sort((a, b) => {
        const valA = (a as any)[sortBy] || 0;
        const valB = (b as any)[sortBy] || 0;
        return valB - valA;
      });
  }, [tokens, searchQuery, sortBy]);

  const handleSearchSubmit = async () => {
    const query = searchQuery.trim();
    setIsSearchLoading(true);
    setTokensError(null);
    try {
      const discovered = query
        ? await fetchDexscreenerTokens(query, 60)
        : await fetchTrendingDexTokens();

      setTokens(discovered);
      if (!discovered.length) {
        setTokensError(query ? `No tokens found for "${query}".` : 'No trending tokens found right now.');
      }
    } catch (error) {
      console.error('Token search failed:', error);
      setTokensError('Token search failed. Please try again.');
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleShowTopGainers = () => {
    setSortBy('change24h');
    setTokens(prev => [...prev].sort((a, b) => b.change24h - a.change24h));
  };

  const handleShowTopLosers = () => {
    setSortBy('change24h');
    setTokens(prev => [...prev].sort((a, b) => a.change24h - b.change24h));
  };

  // Telegram WebApp Integration
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.initDataUnsafe?.user) {
      tg.expand();
      tg.ready();
      
      const tgUser = tg.initDataUnsafe.user;
      safeFetchJson<User>('/api/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tgUser.id, username: tgUser.username })
      })
      .then(data => setUser(normalizeUser({ ...data, photoUrl: tgUser.photo_url })))
      .catch(err => console.error("Check user error:", err));
    } else {
      // Mock user for local dev or when not in Telegram
      setUser(normalizeUser({ id: 123, username: 'DegenMaster', balance: 1000, portfolio: {} }));
    }
  }, []);

  // Initial load (manual refresh only after this)
  useEffect(() => {
    fetchData();
  }, [user?.id]);

  // Fetch token history when selectedToken or timeframe changes
  useEffect(() => {
    if (selectedToken) {
      setIsHistoryLoading(true);
      safeFetchJson<{ data?: any[] } | any[]>(`/api/tokens/${selectedToken.id}/history?days=${chartTimeframe}`)
        .then(resData => {
          // Handle new structure { data, isMock, isStale }
          const historyData = Array.isArray(resData)
            ? resData
            : (resData?.data || []);
          if (historyData.length) {
            setTokenHistory(historyData);
            setIsHistoryLoading(false);
            return;
          }
          throw new Error('Empty history data from primary API');
        })
        .catch(async err => {
          console.error("History fetch error:", err);
          const dexPair = await fetchDexPairForToken(selectedToken.address);
          if (dexPair) {
            const fallbackHistory = buildSyntheticChartData(
              toNumber(dexPair?.priceUsd),
              toNumber(dexPair?.priceChange?.h24),
              chartTimeframe === '1' ? 24 : chartTimeframe === '7' ? 28 : 30
            );
            setTokenHistory(fallbackHistory);
            setTokenDetails(prev => prev || mapDexPairToDetails(dexPair));
          } else {
            setTokenHistory([]);
          }
          setIsHistoryLoading(false);
        });

      if (isDetailOpen) {
        safeFetchJson<any>(`/api/tokens/${selectedToken.id}/details`)
          .then(data => setTokenDetails(data))
          .catch(async err => {
            console.error("Details fetch error:", err);
            const dexPair = await fetchDexPairForToken(selectedToken.address);
            setTokenDetails(dexPair ? mapDexPairToDetails(dexPair) : null);
          });
      }
    } else {
      setTokenHistory([]);
      setTokenDetails(null);
    }
  }, [selectedToken, chartTimeframe, isDetailOpen]);

  const handleTrade = async (type: 'buy' | 'sell') => {
    if (!user || !selectedToken || !tradeAmount) return;
    setIsTrading(true);
    try {
      const data = await safeFetchJson<any>('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          tokenId: selectedToken.id,
          amount: parseFloat(tradeAmount),
          type
        })
      });      
      if (data.error) {
        alert(data.error);
      } else {
        setUser(normalizeUser(data));
        setTradeAmount('');
        setSelectedToken(null);
      }
    } catch (e) {
      console.error("Trade error:", e);
      alert("Failed to execute trade. Please try again.");
    } finally {
      setIsTrading(false);
    }
  };

  const pnl = useMemo(() => {
    if (!portfolio) return 0;
    return ((portfolio.totalValue - 1000) / 1000) * 100;
  }, [portfolio]);

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white font-sans selection:bg-[#7C3AED]/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0B0B0F]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#7C3AED] rounded-xl flex items-center justify-center shadow-lg shadow-[#7C3AED]/20">
            <TrendingUp size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tighter uppercase italic">Degenex</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={fetchData}
            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors border border-white/5"
          >
            <RefreshCw size={18} className={cn(tokensLoading && "animate-spin")} />
          </button>
          <div className="w-10 h-10 rounded-xl border border-[#7C3AED]/30 p-0.5 overflow-hidden bg-[#121821] flex items-center justify-center shadow-lg shadow-[#7C3AED]/10">
            {user?.photoUrl ? (
              <img 
                src={user.photoUrl} 
                alt="Profile" 
                className="w-full h-full rounded-[8px] object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <UserIcon size={20} className="text-white/20" />
            )}
          </div>
        </div>
      </header>

      <main className="pb-24 px-6 pt-6 max-w-md mx-auto relative">
        {/* Pull to Refresh Indicator */}
        <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-50">
          <motion.div 
            style={{ 
              opacity: isRefreshing ? 1 : refreshOpacity,
              scale: isRefreshing ? 1 : refreshScale,
              rotate: isRefreshing ? 0 : refreshRotate,
              y: isRefreshing ? 20 : 0
            }}
            className="bg-[#7C3AED] p-2 rounded-full shadow-lg shadow-[#7C3AED]/40"
          >
            <motion.div
              animate={isRefreshing ? { rotate: 360 } : {}}
              transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
            >
              <RefreshCw size={20} className="text-white" />
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          onPan={(e, info) => {
            // Only allow pulling down when at the top
            if (info.offset.y > 0 && isAtTop) {
              pullDistance.set(info.offset.y);
            } else {
              pullDistance.set(0);
            }
          }}
          onPanEnd={handlePullEnd}
          style={{ y: isRefreshing ? 60 : contentY }}
          className="relative z-10"
        >
          <AnimatePresence mode="wait" custom={direction}>
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              custom={direction}
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-8"
            >
              {/* Main Balance Section */}
              <div className="space-y-6 pt-4">
                <div className="text-center space-y-3">
                  <div className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.25em]">Total Balance</div>
                  <div className="text-6xl font-black tracking-tighter text-white">
                    ${portfolio?.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </div>
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider",
                    pnl >= 0 ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EF4444]/10 text-[#EF4444]"
                  )}>
                    {pnl >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {Math.abs(pnl).toFixed(2)}% (24H)
                  </div>
                </div>

                <button 
                  onClick={() => handleTabChange('trade')}
                  className="w-full py-5 bg-[#7C3AED] hover:bg-[#8B5CF6] text-white rounded-[20px] font-black uppercase tracking-[0.15em] text-sm shadow-xl shadow-[#7C3AED]/20 active:scale-[0.98] transition-all"
                >
                  Start Trading
                </button>
              </div>

              {/* Trending Coins */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#9CA3AF]">Trending Coins</h3>
                  <button onClick={() => handleTabChange('trade')} className="text-[10px] font-black text-[#7C3AED] uppercase tracking-widest flex items-center gap-1">
                    View All <ChevronRight size={12} />
                  </button>
                </div>
                
                <div className="space-y-2">
                  {tokensLoading ? (
                    <div className="p-4 text-xs text-white/40">Loading live token data...</div>
                  ) : tokens.slice(0, 3).length === 0 ? (
                    <div className="p-4 text-xs text-white/40">{tokensError || 'No tokens available right now.'}</div>
                  ) : tokens.slice(0, 3).map((token) => (
                    <div 
                      key={token.id} 
                      className="flex items-center justify-between p-4 bg-[#111114] border border-white/[0.03] rounded-[20px] hover:border-[#7C3AED]/30 transition-all cursor-pointer group"
                      onClick={() => { setSelectedToken(token); setIsDetailOpen(true); }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-white/5 p-0.5 border border-white/5 group-hover:border-[#7C3AED]/30 transition-all">
                          <img src={token.image} alt={token.name} className="w-full h-full object-cover rounded-[10px]" />
                        </div>
                        <div>
                          <div className="text-sm font-black tracking-tight">{token.name}</div>
                          <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{token.symbol}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black tracking-tight">${formatPrice(token.price)}</div>
                        <div className={cn(
                          "text-[10px] font-black",
                          token.change24h >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                        )}>
                          {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Traders Leaderboard Preview */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#9CA3AF]">Top Traders</h3>
                <div className="bg-[#111114] border border-white/[0.03] rounded-[24px] overflow-hidden">
                  {leaderboard.slice(0, 3).map((trader, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border-b border-white/[0.03] last:border-0">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-[#9CA3AF]">
                          #{i + 1}
                        </div>
                        <div className="text-sm font-black tracking-tight">{trader.username}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black tracking-tight text-[#22C55E]">
                          +${trader.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total Profit</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'listings' && (
            <motion.div 
              key="listings"
              custom={direction}
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-8"
            >
              {/* New Listings */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#9CA3AF]">New Listings</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                  {listings?.new.map((token) => (
                    <div 
                      key={token.id} 
                      className="min-w-[140px] p-4 bg-[#111114] border border-white/[0.03] rounded-[24px] space-y-3 hover:border-[#7C3AED]/30 transition-all cursor-pointer"
                      onClick={() => { setSelectedToken(token); setIsDetailOpen(true); }}
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 p-0.5">
                        <img src={token.image} alt={token.name} className="w-full h-full object-cover rounded-[10px]" />
                      </div>
                      <div>
                        <div className="text-xs font-black tracking-tight">{token.symbol}</div>
                        <div className="text-[10px] font-black text-[#22C55E]">Just Added</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hot Listings */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#9CA3AF]">Hot Listings</h3>
                <div className="space-y-2">
                  {listings?.hot.map((token) => (
                    <div 
                      key={token.id} 
                      className="flex items-center justify-between p-4 bg-[#111114] border border-white/[0.03] rounded-[20px] hover:border-[#7C3AED]/30 transition-all cursor-pointer group"
                      onClick={() => { setSelectedToken(token); setIsDetailOpen(true); }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-white/5 p-0.5 border border-white/5 group-hover:border-[#7C3AED]/30 transition-all">
                          <img src={token.image} alt={token.name} className="w-full h-full object-cover rounded-[10px]" />
                        </div>
                        <div>
                          <div className="text-sm font-black tracking-tight">{token.name}</div>
                          <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{token.symbol}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black tracking-tight">${formatPrice(token.price)}</div>
                        <div className="text-[10px] font-black text-[#22C55E]">
                          Vol: ${(token.volume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Early Gems */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#9CA3AF]">Early Gems</h3>
                <div className="grid grid-cols-2 gap-4">
                  {listings?.earlyGems.map((token) => (
                    <div 
                      key={token.id} 
                      className="p-4 bg-[#111114] border border-white/[0.03] rounded-[24px] space-y-3 hover:border-[#7C3AED]/30 transition-all cursor-pointer"
                      onClick={() => { setSelectedToken(token); setIsDetailOpen(true); }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5">
                          <img src={token.image} alt={token.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="text-[9px] font-black text-[#7C3AED] bg-[#7C3AED]/10 px-2 py-0.5 rounded-full uppercase">Low Cap</div>
                      </div>
                      <div>
                        <div className="text-xs font-black tracking-tight">{token.name}</div>
                        <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{token.symbol}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'portfolio' && (
            <motion.div 
              key="portfolio"
              custom={direction}
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-8"
            >
              {/* Portfolio Summary */}
              <div className="p-6 bg-[#111114] border border-white/[0.03] rounded-[32px] space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Total Assets</div>
                    <div className="text-3xl font-black tracking-tight">${portfolio?.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">24h PnL</div>
                    <div className={cn(
                      "text-sm font-black tracking-tight",
                      pnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                    )}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                    </div>
                  </div>
                </div>

                <div className="h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[
                      { val: 1000 }, { val: 1200 }, { val: 1100 }, { val: 1400 }, { val: 1300 }, { val: 1600 }, { val: portfolio?.totalValue }
                    ]}>
                      <defs>
                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="val" stroke="#7C3AED" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/[0.03]">
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Available</div>
                    <div className="text-base font-black tracking-tight text-white">${user?.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Invested</div>
                    <div className="text-base font-black tracking-tight text-white">${((portfolio?.totalValue || 0) - (user?.balance || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
              </div>

              {/* Holdings */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#9CA3AF]">Your Holdings</h3>
                {portfolio?.tokens.length ? (
                  <div className="space-y-2">
                    {portfolio.tokens.map((token) => (
                      <div 
                        key={token.id} 
                        className="flex items-center justify-between p-4 bg-[#111114] border border-white/[0.03] rounded-[20px] hover:border-[#7C3AED]/30 transition-all cursor-pointer group"
                        onClick={() => { setSelectedToken(token); setIsDetailOpen(true); }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-white/5 p-0.5 border border-white/5 group-hover:border-[#7C3AED]/30 transition-all">
                            <img src={token.image} alt={token.name} className="w-full h-full object-cover rounded-[10px]" />
                          </div>
                          <div>
                            <div className="text-sm font-black tracking-tight">{token.name}</div>
                            <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                              {token.amount.toFixed(4)} {token.symbol}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black tracking-tight">${(token.amount * token.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className={cn(
                            "text-[10px] font-black",
                            token.change24h >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                          )}>
                            {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center space-y-4 bg-[#111114] rounded-[32px] border border-dashed border-white/5">
                    <Wallet size={48} className="mx-auto text-white/10" />
                    <div className="text-sm font-black text-white/20 uppercase tracking-widest">No assets found</div>
                    <button onClick={() => handleTabChange('trade')} className="text-xs font-black text-[#7C3AED] uppercase tracking-widest">Start Trading</button>
                  </div>
                )}
              </div>

              {/* Trade History */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#9CA3AF]">Trade History</h3>
                <div className="space-y-2">
                  {portfolio?.trades.slice(0, 5).map((trade, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-[#111114] border border-white/[0.03] rounded-[20px]">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          trade.type === 'buy' ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EF4444]/10 text-[#EF4444]"
                        )}>
                          {trade.type === 'buy' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                        </div>
                        <div>
                          <div className="text-sm font-black tracking-tight uppercase">{trade.type} {trade.tokenId}</div>
                          <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{new Date(trade.date).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black tracking-tight">${trade.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{trade.tokenAmount.toFixed(4)} tokens</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'rewards' && (
            <motion.div 
              key="rewards"
              custom={direction}
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-8"
            >
              {/* Referral Section */}
              <div className="p-6 bg-[#7C3AED] rounded-[32px] space-y-6 shadow-2xl shadow-[#7C3AED]/20">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black tracking-tight text-white">Invite Friends</h2>
                  <p className="text-white/70 text-xs font-medium leading-relaxed">Share your referral code and earn $100 for every friend who joins Degenex.</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white/10 border border-white/10 rounded-2xl py-4 px-6 font-black tracking-widest text-white text-center">
                    {user?.referralCode}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(user?.referralCode || '');
                      alert('Referral code copied!');
                    }}
                    className="w-14 h-14 bg-white text-[#7C3AED] rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all"
                  >
                    <ExternalLink size={24} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-[10px] font-black text-white/60 uppercase tracking-widest">Total Referrals</div>
                  <div className="text-sm font-black text-white">{user?.referralsCount} Friends</div>
                </div>
              </div>

              {/* Tasks */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#9CA3AF]">Daily Tasks</h3>
                <div className="space-y-3">
                  {rewards?.tasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-4 bg-[#111114] border border-white/[0.03] rounded-[24px]">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-[#7C3AED]">
                          {task.icon === 'Globe' && <Globe size={24} />}
                          {task.icon === 'Twitter' && <Twitter size={24} />}
                          {task.icon === 'Zap' && <Zap size={24} />}
                        </div>
                        <div>
                          <div className="text-sm font-black tracking-tight">{task.title}</div>
                          <div className="text-[10px] font-black text-[#22C55E] uppercase tracking-widest">+${task.reward} Reward</div>
                        </div>
                      </div>
                      {user?.completedTasks.includes(task.id) ? (
                        <div className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black text-white/20 uppercase tracking-widest">Completed</div>
                      ) : (
                        <button 
                          onClick={async () => {
                            if (task.link) window.open(task.link, '_blank');
                            const data = await safeFetchJson<any>('/api/rewards/complete', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId: user?.id, taskId: task.id })
                            });
                            if (!data.error) setUser(normalizeUser(data));
                          }}
                          className="px-6 py-2 bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-xl text-[10px] font-black text-white uppercase tracking-widest transition-all"
                        >
                          Go
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Missions */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#9CA3AF]">Missions</h3>
                <div className="space-y-3">
                  {rewards?.missions.map((mission) => (
                    <div key={mission.id} className="p-5 bg-[#111114] border border-white/[0.03] rounded-[28px] space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-black tracking-tight">{mission.title}</div>
                          <div className="text-[10px] font-black text-[#7C3AED] uppercase tracking-widest">+${mission.reward} Reward</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Progress</div>
                          <div className="text-xs font-black text-white">0 / {mission.goal}</div>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[#7C3AED] rounded-full" style={{ width: '0%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social Links */}
              <div className="flex justify-center gap-6 pt-4 pb-8">
                <button
                  onClick={() => window.open('https://x.com/dexscreener', '_blank')}
                  className="w-12 h-12 rounded-2xl bg-[#111114] border border-white/5 flex items-center justify-center text-[#9CA3AF] hover:text-white transition-all"
                >
                  <Twitter size={20} />
                </button>
                <button
                  onClick={() => window.open('https://dexscreener.com', '_blank')}
                  className="w-12 h-12 rounded-2xl bg-[#111114] border border-white/5 flex items-center justify-center text-[#9CA3AF] hover:text-white transition-all"
                >
                  <Globe size={20} />
                </button>
                <button
                  onClick={fetchData}
                  className="w-12 h-12 rounded-2xl bg-[#111114] border border-white/5 flex items-center justify-center text-[#9CA3AF] hover:text-white transition-all"
                >
                  <RefreshCw size={20} className={cn(tokensLoading && "animate-spin")} />
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'trade' && (
            <motion.div 
              key="trade"
              custom={direction}
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-8"
            >
              <div className="space-y-6">
                <div className="relative group z-50">
                  <div className="absolute inset-0 bg-[#7C3AED]/5 rounded-[24px] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#7C3AED] transition-colors" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search name, symbol or address..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchSubmit();
                      }
                    }}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                    className="w-full bg-[#111114] border border-white/[0.05] rounded-[24px] py-5 pl-14 pr-14 text-sm font-medium focus:outline-none focus:border-[#7C3AED]/50 focus:bg-[#111114] transition-all placeholder:text-white/20 shadow-lg shadow-black/20"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <X size={16} />
                      </button>
                    )}
                    <button
                      onClick={handleSearchSubmit}
                      className="w-8 h-8 rounded-full bg-[#7C3AED]/20 flex items-center justify-center text-[#C4B5FD] hover:bg-[#7C3AED]/30 transition-all"
                    >
                      {isSearchLoading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                    </button>
                  </div>

                  {/* Auto-suggestions */}
                  <AnimatePresence>
                    {isSearchFocused && searchQuery.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full left-0 right-0 mt-3 bg-[#111114] border border-white/10 rounded-[32px] shadow-[0_30px_60px_rgba(0,0,0,0.5)] overflow-hidden max-h-[400px] overflow-y-auto no-scrollbar z-50 backdrop-blur-xl"
                      >
                        {filteredTokens.length > 0 ? (
                          filteredTokens.map((token) => (
                            <button
                              key={token.id}
                              onClick={() => {
                                setSelectedToken(token);
                                setIsDetailOpen(true);
                                setSearchQuery('');
                              }}
                              className="w-full flex items-center justify-between p-5 hover:bg-white/[0.03] transition-all border-b border-white/5 last:border-0 text-left group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white/5 p-1 border border-white/5 group-hover:border-[#7C3AED]/30 transition-all">
                                  <img src={token.image} alt={token.name} className="w-full h-full object-cover rounded-[10px]" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black tracking-tight text-base">
                                      {highlightText(token.symbol, searchQuery)}
                                    </span>
                                    <span className="text-[10px] font-black text-[#7C3AED] px-2 py-0.5 bg-[#7C3AED]/10 rounded-full uppercase tracking-widest">
                                      {highlightText(token.name, searchQuery)}
                                    </span>
                                  </div>
                                  <div className="text-[10px] font-mono text-white/20 truncate max-w-[180px] mt-1">
                                    {highlightText(token.address, searchQuery)}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-black tracking-tight text-sm">${formatPrice(token.price)}</div>
                                <div className={cn(
                                  "text-[10px] font-black mt-1",
                                  token.change24h >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                                )}>
                                  {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                                </div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-white/10">
                              <Search size={32} />
                            </div>
                            <div className="text-sm font-black text-white/20 uppercase tracking-widest">
                              No coins found matching "{searchQuery}"
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Filter Controls */}
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                  <button
                    onClick={fetchData}
                    className="whitespace-nowrap px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border bg-[#111114] border-white/[0.05] text-[#9CA3AF] hover:text-white hover:border-white/10"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={handleShowTopGainers}
                    className="whitespace-nowrap px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border bg-[#111114] border-white/[0.05] text-[#9CA3AF] hover:text-white hover:border-white/10"
                  >
                    Top Gainers
                  </button>
                  <button
                    onClick={handleShowTopLosers}
                    className="whitespace-nowrap px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border bg-[#111114] border-white/[0.05] text-[#9CA3AF] hover:text-white hover:border-white/10"
                  >
                    Top Losers
                  </button>
                  {[
                    { id: 'marketCap', label: 'Market Cap' },
                    { id: 'volume', label: '24h Volume' },
                    { id: 'change24h', label: '24h Change' },
                    { id: 'price', label: 'Price' }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setSortBy(filter.id as any)}
                      className={cn(
                        "whitespace-nowrap px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border",
                        sortBy === filter.id 
                          ? "bg-[#7C3AED] border-[#7C3AED] text-white shadow-xl shadow-[#7C3AED]/20 scale-105" 
                          : "bg-[#111114] border-white/[0.05] text-[#9CA3AF] hover:text-white hover:border-white/10"
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {(tokensLoading || filteredTokens.length === 0) ? (
                  <div className="p-6 text-center text-xs text-white/40">
                    {tokensLoading ? 'Loading Dexscreener tokens...' : (tokensError || 'No matching tokens found.')}
                  </div>
                ) : filteredTokens.map((token, index) => {
                  const tokenContent = (
                    <div 
                      key={token.id}
                      onClick={() => { setSelectedToken(token); setIsDetailOpen(true); }}
                      className="flex items-center justify-between p-5 bg-[#111114] border border-white/[0.03] rounded-[28px] hover:border-[#7C3AED]/30 active:scale-[0.98] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/5 p-1 border border-white/5 group-hover:border-[#7C3AED]/30 transition-all">
                          <img src={token.image} alt={token.name} className="w-full h-full object-cover rounded-[12px]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black tracking-tight text-base">{token.symbol}</span>
                            <span className="text-[10px] font-black text-white/20 px-2 py-0.5 bg-white/5 rounded-full uppercase tracking-widest">#{token.rank}</span>
                          </div>
                          <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.2em] mt-0.5">{token.name}</div>
                        </div>
                      </div>
                      
                      <div className="text-right space-y-1">
                        <div className="font-black tracking-tight text-base">${formatPrice(token.price)}</div>
                        <div className={cn(
                          "text-[10px] font-black px-3 py-1 rounded-full inline-block uppercase tracking-widest",
                          token.change24h >= 0 ? "text-[#22C55E] bg-[#22C55E]/10" : "text-[#EF4444] bg-[#EF4444]/10"
                        )}>
                          {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  );

                  if (index === 0) {
                    return (
                      <GuideTooltip 
                        key={token.id}
                        id="dashboard-tooltip" 
                        title="Start Trading" 
                        description="Click on any token to view its performance charts and place your first trade."
                        position="bottom"
                      >
                        {tokenContent}
                      </GuideTooltip>
                    );
                  }

                  return tokenContent;
                })}
              </div>
            </motion.div>
          )}

          {activeTab === 'leaderboard' && (
            <motion.div 
              key="leaderboard"
              custom={direction}
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Global Rankings</div>
                <h2 className="text-4xl font-black tracking-tighter text-gradient italic uppercase">Hall of Degens</h2>
              </div>

              <div className="space-y-1">
                {leaderboard.map((entry, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "flex items-center justify-between p-4 rounded-[20px] transition-all",
                      entry.username === user?.username ? "bg-[#7C3AED]/10 border border-[#7C3AED]/20" : "hover:bg-white/[0.03]"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black italic",
                        i === 0 ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20" : 
                        i === 1 ? "bg-gray-300 text-black shadow-lg shadow-gray-300/20" : 
                        i === 2 ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" : 
                        "bg-white/5 text-white/40"
                      )}>
                        {i + 1}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/20">
                          <UserIcon size={20} />
                        </div>
                        <div>
                          <div className="font-black tracking-tight">{entry.username}</div>
                          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Rank {i + 1}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <div className="font-black tracking-tight text-sm text-[#7C3AED]">${entry.totalValue?.toLocaleString()}</div>
                      <div className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-md inline-block",
                        entry.profit >= 0 ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"
                      )}>
                        {entry.profit >= 0 ? '+' : ''}{entry.profit.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </motion.div>
      </main>

      {/* Token Detail Modal */}
      <AnimatePresence>
        {isDetailOpen && selectedToken && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-lg bg-[#0B0B0F] border-t sm:border border-white/10 rounded-t-[40px] sm:rounded-[40px] overflow-hidden flex flex-col max-h-[95vh] shadow-2xl shadow-black"
            >
              {/* Modal Header */}
              <div className="p-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/5 p-1 border border-white/5">
                    <img src={selectedToken.image} alt={selectedToken.name} className="w-full h-full object-cover rounded-[12px]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">{selectedToken.name}</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 font-bold uppercase tracking-widest text-[10px]">{selectedToken.symbol}</span>
                      <span className="bg-[#7C3AED]/10 px-2 py-0.5 rounded text-[10px] font-black text-[#7C3AED] uppercase tracking-widest">RANK #{selectedToken.rank}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDetailOpen(false)}
                  className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors border border-white/5"
                >
                  <RefreshCw className="rotate-45" size={24} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-10 no-scrollbar">
                {/* Price Section */}
                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    <div className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">Market Price</div>
                    <div className="text-5xl font-black tracking-tighter text-gradient">${formatPrice(selectedToken.price)}</div>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider",
                    selectedToken.change24h >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                  )}>
                    {selectedToken.change24h >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    {Math.abs(selectedToken.change24h).toFixed(2)}%
                  </div>
                </div>

                {/* Chart Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">Performance</div>
                      {tokenDetails?.isMock ? (
                        <span className="bg-amber-500/10 text-amber-400 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border border-amber-500/20">Simulated</span>
                      ) : tokenDetails?.isStale ? (
                        <span className="bg-blue-500/10 text-blue-400 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border border-blue-500/20">Cached</span>
                      ) : (
                        <span className="bg-green-500/10 text-green-400 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border border-green-500/20">Live</span>
                      )}
                    </div>
                    <div className="flex bg-white/5 p-1 rounded-xl gap-1 border border-white/5">
                      {(['1', '7', '30'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setChartTimeframe(t)}
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                            chartTimeframe === t ? "bg-[#7C3AED] text-white shadow-lg shadow-[#7C3AED]/20" : "text-white/30 hover:text-white/60"
                          )}
                        >
                          {t === '1' ? '24H' : t === '7' ? '7D' : '30D'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-64 w-full bg-white/[0.02] rounded-[32px] p-6 relative border border-white/[0.03] overflow-hidden">
                    {isHistoryLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <RefreshCw className="animate-spin text-[#7C3AED]" size={32} />
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={tokenHistory}>
                          <defs>
                            <linearGradient id="modalColorPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={selectedToken.color} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={selectedToken.color} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                          <XAxis 
                            dataKey="time" 
                            hide 
                          />
                          <YAxis 
                            domain={['auto', 'auto']} 
                            hide 
                          />
                          <Tooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-[#0B0B0F] border border-white/10 p-4 rounded-2xl shadow-2xl space-y-1">
                                    <div className="text-[10px] font-black text-white/30 uppercase tracking-widest">{label}</div>
                                    <div className="text-sm font-black tracking-tight" style={{ color: selectedToken.color }}>
                                      ${formatPrice(payload[0].value as number)}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="price" 
                            stroke={selectedToken.color} 
                            fillOpacity={1} 
                            fill="url(#modalColorPrice)" 
                            strokeWidth={4}
                            animationDuration={1500}
                            activeDot={{ r: 6, strokeWidth: 0, fill: selectedToken.color }}
                          />
                          <Brush 
                            dataKey="time" 
                            height={30} 
                            stroke={selectedToken.color}
                            fill="rgba(255,255,255,0.02)"
                            travellerWidth={10}
                            gap={1}
                          >
                            <AreaChart>
                              <Area dataKey="price" stroke={selectedToken.color} fill={selectedToken.color} fillOpacity={0.1} />
                            </AreaChart>
                          </Brush>
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-5 space-y-1">
                    <div className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">Market Cap</div>
                    <div className="text-lg font-black tracking-tight">${selectedToken.marketCap?.toLocaleString() || 'N/A'}</div>
                  </Card>
                  <Card className="p-5 space-y-1">
                    <div className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">24H Volume</div>
                    <div className="text-lg font-black tracking-tight">${selectedToken.volume?.toLocaleString() || 'N/A'}</div>
                  </Card>
                </div>

                {/* Sentiment & Description */}
                {tokenDetails && (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">Social Sentiment</div>
                      <div className="flex items-center gap-6">
                        <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden flex border border-white/5">
                          <div 
                            className="bg-green-500 h-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" 
                            style={{ width: `${tokenDetails.sentiment_votes_up_percentage}%` }} 
                          />
                          <div 
                            className="bg-red-500 h-full shadow-[0_0_10px_rgba(239,68,68,0.5)]" 
                            style={{ width: `${tokenDetails.sentiment_votes_down_percentage}%` }} 
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <ThumbsUp size={12} className="text-green-400" />
                            <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">{tokenDetails.sentiment_votes_up_percentage}%</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <ThumbsDown size={12} className="text-red-400" />
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">{tokenDetails.sentiment_votes_down_percentage}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">Community Links</div>
                      <div className="flex flex-wrap gap-3">
                        {tokenDetails.links?.homepage?.[0] && (
                          <a 
                            href={tokenDetails.links.homepage[0]} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors border border-white/5"
                          >
                            <Globe size={14} /> Website
                          </a>
                        )}
                        {tokenDetails.links?.twitter_screen_name && (
                          <a 
                            href={`https://twitter.com/${tokenDetails.links.twitter_screen_name}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors border border-white/5"
                          >
                            <Twitter size={14} /> Twitter
                          </a>
                        )}
                        {tokenDetails.links?.subreddit_url && (
                          <a 
                            href={tokenDetails.links.subreddit_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors border border-white/5"
                          >
                            <ExternalLink size={14} /> Reddit
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">Project Info</div>
                      <div 
                        className="text-sm text-white/50 leading-relaxed max-h-60 overflow-y-auto pr-4 no-scrollbar font-medium"
                        dangerouslySetInnerHTML={{ __html: tokenDetails.description }}
                      />
                    </div>
                  </div>
                )}

                {/* Trade Section */}
                <div className="space-y-6 pt-4">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                    <span>Order Amount</span>
                    <span>Bal: ${user?.balance.toFixed(2)}</span>
                  </div>
                  <div className="relative group">
                    <input 
                      type="number" 
                      value={tradeAmount}
                      onChange={(e) => setTradeAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white/[0.03] border border-white/[0.05] rounded-[24px] py-6 px-8 text-4xl font-black focus:outline-none focus:border-[#7C3AED]/50 focus:bg-white/[0.05] transition-all placeholder:text-white/10"
                    />
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 text-sm font-black text-white/20 uppercase tracking-widest">USD</div>
                  </div>
                  <GuideTooltip 
                    id="trade-tooltip" 
                    title="Place Your Trade" 
                    description="Enter an amount and click Buy or Sell to execute your paper trade."
                    position="top"
                  >
                    <div className="grid grid-cols-2 gap-4 pb-12">
                      <button 
                        disabled={isTrading}
                        onClick={() => handleTrade('buy')}
                        className="bg-green-500 hover:bg-green-600 disabled:opacity-50 py-5 rounded-[24px] font-black text-sm tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-green-500/20 uppercase"
                      >
                        <ArrowUpRight size={20} strokeWidth={3} /> Buy
                      </button>
                      <button 
                        disabled={isTrading}
                        onClick={() => handleTrade('sell')}
                        className="bg-red-500 hover:bg-red-600 disabled:opacity-50 py-5 rounded-[24px] font-black text-sm tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-red-500/20 uppercase"
                      >
                        <ArrowDownRight size={20} strokeWidth={3} /> Sell
                      </button>
                    </div>
                  </GuideTooltip>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOnboarding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#0B0B0F] flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div 
              key={onboardingStep}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="max-w-xs w-full space-y-8"
            >
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-[32px] bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl">
                  {[
                    <Rocket className="text-[#7C3AED]" size={48} />,
                    <TrendingUp className="text-green-400" size={48} />,
                    <MousePointer2 className="text-blue-400" size={48} />,
                    <Trophy className="text-amber-400" size={48} />
                  ][onboardingStep]}
                </div>
              </div>
              
              <div className="space-y-3">
                <h2 className="text-3xl font-black tracking-tight">
                  {[
                    "Welcome to Degenex",
                    "Real-Time Data",
                    "Master the Trade",
                    "Track Performance"
                  ][onboardingStep]}
                </h2>
                <p className="text-white/50 text-sm leading-relaxed font-medium">
                  {[
                    "The ultimate paper trading platform for degens. Master the markets without risking a single SOL.",
                    "Track live prices, market caps, and 24h volume for your favorite memecoins directly from CoinGecko.",
                    "Click on any token to see detailed charts and execute your first paper trade. Buy low, sell high!",
                    "Monitor your portfolio value, check your trade history, and climb the global leaderboard."
                  ][onboardingStep]}
                </p>
              </div>

              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div 
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-500",
                      i === onboardingStep ? "w-8 bg-[#7C3AED]" : "w-1.5 bg-white/10"
                    )}
                  />
                ))}
              </div>

              <div className="pt-4 space-y-4">
                {onboardingStep < 3 ? (
                  <button 
                    onClick={() => setOnboardingStep(prev => prev + 1)}
                    className="w-full bg-white/5 hover:bg-white/10 py-5 rounded-[24px] font-black text-sm tracking-widest transition-all active:scale-95 border border-white/10 uppercase"
                  >
                    Next Step
                  </button>
                ) : (
                  <button 
                    onClick={completeOnboarding}
                    className="w-full bg-[#7C3AED] hover:bg-[#8B5CF6] py-5 rounded-[24px] font-black text-sm tracking-widest transition-all active:scale-95 shadow-xl shadow-[#7C3AED]/20 uppercase"
                  >
                    Get Started
                  </button>
                )}
                
                <button 
                  onClick={completeOnboarding}
                  className="text-[10px] font-black text-white/20 uppercase tracking-widest hover:text-white/40 transition-colors"
                >
                  Skip Tutorial
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0B0B0F]/80 backdrop-blur-2xl border-t border-white/5 px-6 pt-3 pb-8 flex items-center justify-between z-50">
        <NavItem active={activeTab === 'trade'} icon={ArrowLeftRight} label="Trade" onClick={() => handleTabChange('trade')} />
        <NavItem active={activeTab === 'listings'} icon={TrendingUp} label="Listings" onClick={() => handleTabChange('listings')} />
        <NavItem active={activeTab === 'home'} icon={LayoutDashboard} label="Home" onClick={() => handleTabChange('home')} isCenter />
        <NavItem active={activeTab === 'portfolio'} icon={Wallet} label="Portfolio" onClick={() => handleTabChange('portfolio')} />
        <NavItem active={activeTab === 'rewards'} icon={Trophy} label="Rewards" onClick={() => handleTabChange('rewards')} />
      </nav>

      {/* Pro Upgrade Modal */}
      <AnimatePresence>
        {showProModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProModal(false)}
              className="absolute inset-0 bg-[#0B0B0F]/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-[#111114] border border-white/5 rounded-[32px] p-8 space-y-8 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#7C3AED]" />
              
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-[#7C3AED]/10 rounded-3xl flex items-center justify-center mx-auto text-[#7C3AED]">
                  <Zap size={40} strokeWidth={2.5} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black tracking-tight">Upgrade to Pro</h2>
                  <p className="text-[#9CA3AF] text-sm font-medium">Unlock the full potential of Degenex and trade like a whale.</p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  "Starting balance of $100,000",
                  "Advanced portfolio analytics",
                  "Priority trade execution",
                  "Exclusive early gem alerts",
                  "Zero platform fees"
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E]">
                      <ChevronRight size={12} strokeWidth={3} />
                    </div>
                    <span className="text-xs font-bold text-white/80">{feature}</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={async () => {
                  const data = await safeFetchJson<any>('/api/upgrade-pro', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user?.id })
                  });
                  if (!data.error) {
                    setUser(normalizeUser(data));
                    setShowProModal(false);
                    alert('Welcome to Pro! Your balance has been upgraded to $100,000.');
                  }
                }}
                className="w-full py-5 bg-[#7C3AED] hover:bg-[#8B5CF6] text-white rounded-[20px] font-black uppercase tracking-widest text-sm shadow-xl shadow-[#7C3AED]/20 transition-all active:scale-95"
              >
                Upgrade Now
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Join Telegram Modal */}
      <AnimatePresence>
        {showJoinModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowJoinModal(false)}
              className="absolute inset-0 bg-[#0B0B0F]/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-[#111114] border border-white/5 rounded-[32px] p-8 space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-[#7C3AED]/10 rounded-3xl flex items-center justify-center mx-auto text-[#7C3AED]">
                  <Globe size={40} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black tracking-tight">Join the Community</h2>
                  <p className="text-[#9CA3AF] text-sm font-medium">Join our Telegram channel to unlock more features and earn a $100 bonus!</p>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => window.open('https://t.me/degenpapertrading', '_blank')}
                  className="w-full py-5 bg-[#7C3AED] hover:bg-[#8B5CF6] text-white rounded-[20px] font-black uppercase tracking-widest text-sm transition-all active:scale-95"
                >
                  Join Channel
                </button>
                <button 
                  onClick={() => setShowJoinModal(false)}
                  className="w-full py-4 text-[#9CA3AF] font-black uppercase tracking-widest text-[10px] hover:text-white transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
