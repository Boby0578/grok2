import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Coin } from './types';
import { getCoinOfficialLinks, getCoinDeepReport } from './services/geminiService';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

const CONFIG = {
  AUTO_REFRESH_INTERVAL: 60000,
  MAX_COINS_PER_PAGE: 250,
  MAX_RETRIES: 3,
};

const MARKET_DATA_API = 'https://api.coingecko.com/api/v3/coins/markets';
const GLOBAL_STATS_API = 'https://api.coingecko.com/api/v3/global';

const RADIO_STATIONS = [
  { name: 'La Première', url: 'http://stream.srg-ssr.ch/m/la-1ere/mp3_128' },
  { name: 'Couleur 3', url: 'http://stream.srg-ssr.ch/m/couleur3/mp3_128' },
  { name: 'NRJ France', url: 'https://streaming.nrjaudio.fm/oumvmk8fnozc' },
  { name: 'FIP', url: 'http://icecast.radiofrance.fr/fip-midfi.mp3' },
];

const ALL_CURRENCIES = [
  { code: 'usd', symbol: '$', name: 'US Dollar' },
  { code: 'eur', symbol: '€', name: 'Euro' },
  { code: 'chf', symbol: 'Fr', name: 'Swiss Franc' },
].sort((a, b) => a.name.localeCompare(b.name));

const SORT_OPTIONS = [
  { id: 'market_cap_desc', name: 'Cap. Boursière (Haut)' },
  { id: 'market_cap_asc', name: 'Cap. Boursière (Bas)' },
  { id: 'price_desc', name: 'Prix (Haut)' },
  { id: 'price_asc', name: 'Prix (Bas)' },
];

const CATEGORIES = [
  { id: '', name: 'Toutes', icon: 'fa-layer-group' },
  { id: 'smart-contract-platform', name: 'Smart Contracts', icon: 'fa-code' },
  { id: 'decentralized-finance-defi', name: 'DeFi', icon: 'fa-building-columns' },
  { id: 'artificial-intelligence', name: 'IA', icon: 'fa-brain' },
  { id: 'meme-token', name: 'Memes', icon: 'fa-face-laugh-beam' },
  { id: 'stablecoins', name: 'Stablecoins', icon: 'fa-anchor' },
];

const App: React.FC = () => {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [searchedCoins, setSearchedCoins] = useState<Coin[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [category, setCategory] = useState('');
  const [sortOrder, setSortOrder] = useState('market_cap_desc');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [totalCoinsInWorld, setTotalCoinsInWorld] = useState(14000);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartDays, setChartDays] = useState('1');
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isFullReportMode, setIsFullReportMode] = useState(false);
  const [deepReport, setDeepReport] = useState('');
  const [isGeneratingDeepReport, setIsGeneratingDeepReport] = useState(false);
  const [officialLink, setOfficialLink] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [isRadioOpen, setIsRadioOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentCurrency = useMemo(() => 
    ALL_CURRENCIES.find(c => c.code === currency) || ALL_CURRENCIES[0]
  , [currency]);

  const fetchWithRetry = useCallback(async (url: string, maxRetries = CONFIG.MAX_RETRIES): Promise<any> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);
        if (response.status === 429) { 
          await new Promise(r => setTimeout(r, 2000 * (i + 1)));
          continue;
        }
        if (!response.ok) throw new Error('HTTP Error: ' + response.status);
        return await response.json();
      } catch (e) {
        if (i === maxRetries - 1) throw e;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }, []);

  const fetchCoins = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const catParam = category ? '&category=' + category : '';
      const params = '?vs_currency=' + currency + '&order=' + sortOrder + '&per_page=' + CONFIG.MAX_COINS_PER_PAGE + '&page=' + p + '&sparkline=true&price_change_percentage=24h' + catParam;
      const data = await fetchWithRetry(MARKET_DATA_API + params);
      if (Array.isArray(data)) {
        setCoins(data);
      }
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [currency, sortOrder, category, fetchWithRetry]);

  useEffect(() => {
    fetchWithRetry(GLOBAL_STATS_API).then(data => {
      if (data?.data?.active_cryptocurrencies) {
        setTotalCoinsInWorld(data.data.active_cryptocurrencies);
      }
    }).catch(() => {});
  }, [fetchWithRetry]);

  useEffect(() => {
    fetchCoins(page);
  }, [currency, sortOrder, category, page, fetchCoins]);

  const handleGlobalSearch = async () => {
    if (!search.trim()) { setSearchedCoins([]); return; }
    setLoading(true);
    try {
      const searchRes = await fetchWithRetry('https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(search));
      if (searchRes?.coins && searchRes.coins.length > 0) {
        const ids = searchRes.coins.slice(0, 10).map((c: any) => c.id).join(',');
        const url = MARKET_DATA_API + '?vs_currency=' + currency + '&ids=' + ids + '&sparkline=true&price_change_percentage=24h';
        const marketData = await fetchWithRetry(url);
        if (Array.isArray(marketData)) setSearchedCoins(marketData);
      }
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
  };

  const processedCoins = useMemo(() => {
    const list = searchedCoins.length > 0 ? searchedCoins : coins;
    return [...list].sort((a, b) => {
      const aFav = favorites.has(a.id);
      const bFav = favorites.has(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [coins, searchedCoins, favorites]);

  const handleOpenAnalysis = async (coin: Coin) => {
    setSelectedCoin(coin);
    setChartDays('1');
    setDeepReport('');
    setOfficialLink(null);
    setIsFullReportMode(false);
    setIsChartLoading(true);
    try {
      const url = 'https://api.coingecko.com/api/v3/coins/' + coin.id + '/market_chart?vs_currency=' + currency + '&days=1';
      const res = await fetchWithRetry(url);
      if (res?.prices) {
        setChartData(res.prices.map((p: any) => ({ time: p[0], price: p[1] })));
      }
      const links = await getCoinOfficialLinks(coin);
      if (links?.length > 0) setOfficialLink(links[0].uri);
    } catch(e) {
      console.error('Analysis error:', e);
    } finally {
      setIsChartLoading(false);
    }
  };

  const toggleDeepReport = async () => {
    if (!selectedCoin) return;
    setIsFullReportMode(!isFullReportMode);
    if (!isFullReportMode && !deepReport) {
      setIsGeneratingDeepReport(true);
      try {
        const report = await getCoinDeepReport(selectedCoin);
        setDeepReport(report);
      } finally {
        setIsGeneratingDeepReport(false);
      }
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const maxPages = Math.ceil(totalCoinsInWorld / CONFIG.MAX_COINS_PER_PAGE);

  return (
    <div className={'min-h-screen p-4 sm:p-8 flex flex-col gap-10 max-w-[1920px] mx-auto overflow-x-hidden ' + (theme === 'light' ? 'light-mode' : '')}>
      <audio ref={audioRef} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
      
      <div className="flex justify-between items-center border-b border-[var(--border)] pb-8">
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="px-6 py-3 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--border)] font-orbitron font-bold text-xs transition-all active:scale-95 shadow-lg">
          <i className={'fa-solid ' + (theme === 'dark' ? 'fa-sun text-yellow-400' : 'fa-moon text-blue-600') + ' mr-2'}></i>
          {theme === 'dark' ? 'MODE CLAIR' : 'MODE SOMBRE'}
        </button>
        <button onClick={() => setIsRadioOpen(true)} className="px-6 py-3 rounded-xl border-2 border-[var(--electric-blue)] text-[var(--electric-blue)] font-orbitron font-bold text-xs transition-all active:scale-95 shadow-[0_0_15px_rgba(0,255,255,0.2)]">
          <i className="fa-solid fa-radio mr-2"></i>RADIO PULSE
        </button>
      </div>

      <header className="text-center flex flex-col items-center gap-12 py-10">
        <h1 className="text-5xl md:text-8xl font-orbitron font-black electric-green tracking-tighter select-none animate-pulse">
          CRYPTO PULSE <span className={theme === 'dark' ? 'text-white' : 'text-black'}>2026</span>
        </h1>
        
        <div className="w-full max-w-6xl flex flex-col gap-6">
          <div className="flex flex-col md:flex-row gap-4">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-xl px-6 py-4 font-orbitron font-bold text-xs uppercase cursor-pointer outline-none focus:border-[var(--electric-blue)] shadow-md">
              {ALL_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
            <div className="flex-1 relative">
              <i className="fa-solid fa-search absolute left-6 top-1/2 -translate-y-1/2 opacity-30"></i>
              <input 
                type="text" 
                placeholder="RECHERCHER (BTC, ETH, PEPE...)" 
                className="w-full bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-xl pl-14 pr-24 py-4 font-mono font-bold outline-none focus:border-[var(--electric-green)] shadow-md" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGlobalSearch()}
              />
              <button onClick={handleGlobalSearch} className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-2 bg-[var(--electric-green)] text-black rounded-lg font-orbitron font-black text-[10px] hover:scale-105 transition-transform active:scale-95 shadow-md">GO</button>
            </div>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-xl px-6 py-4 font-orbitron font-bold text-xs uppercase cursor-pointer outline-none focus:border-[var(--electric-blue)] shadow-md">
              {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => { setCategory(cat.id); setPage(1); }} className={'py-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all active:scale-95 ' + (category === cat.id ? 'bg-[var(--electric-green)] border-[var(--electric-green)] text-black shadow-[0_0_15px_rgba(57,255,20,0.3)]' : 'bg-transparent border-[var(--border)] text-slate-500 hover:border-slate-400')}>
                <i className={'fa-solid ' + cat.icon}></i>
                <span className="font-orbitron font-bold text-[9px] uppercase">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="bg-[var(--card-bg)] border-2 border-[var(--border)] rounded-[2.5rem] overflow-hidden shadow-2xl relative min-h-[600px]">
        {loading && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-40 flex flex-col items-center justify-center gap-4">
            <i className="fa-solid fa-circle-notch fa-spin text-5xl text-[var(--electric-green)]"></i>
            <span className="font-orbitron font-black text-[var(--electric-green)] uppercase tracking-[0.5em] animate-pulse">Syncing Database...</span>
          </div>
        )}
        
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="font-orbitron uppercase text-[10px] bg-black/40 text-slate-500 sticky top-0 z-10 border-b border-[var(--border)] backdrop-blur-md">
              <tr>
                <th className="p-8 text-center w-20">FAV</th>
                <th className="p-8">RANG / ASSET</th>
                <th className="p-8">PRIX ACTUEL</th>
                <th className="p-8 text-right">VAR. 24H</th>
                <th className="p-8 text-right">CAP. BOURSIÈRE</th>
                <th className="p-8 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {processedCoins.length > 0 ? processedCoins.map((coin) => (
                <tr key={coin.id} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="p-8 text-center">
                    <button onClick={() => toggleFavorite(coin.id)} className={'text-3xl transition-transform hover:scale-125 ' + (favorites.has(coin.id) ? 'text-red-500' : 'text-slate-800')}>
                      <i className={(favorites.has(coin.id) ? 'fa-solid' : 'fa-regular') + ' fa-heart'}></i>
                    </button>
                  </td>
                  <td className="p-8">
                    <div className="flex items-center gap-6">
                      <span className="text-xs opacity-20 font-orbitron font-black w-8">#{ coin.market_cap_rank || '??' }</span>
                      <img src={coin.image} alt="" className="w-12 h-12 rounded-full shadow-lg bg-black/20" />
                      <div>
                        <div className="font-black text-xl uppercase leading-none mb-1">{coin.name}</div>
                        <div className="text-[10px] opacity-40 font-mono tracking-widest">{coin.symbol.toUpperCase()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-8 font-mono font-black text-2xl text-[var(--electric-green)] whitespace-nowrap">
                    <span className="opacity-40 mr-1 text-sm">{currentCurrency.symbol}</span>
                    {coin.current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 10 })}
                  </td>
                  <td className={'p-8 text-right font-mono font-bold text-xl ' + (coin.price_change_percentage_24h >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                    {(coin.price_change_percentage_24h >= 0 ? '+' : '') + (coin.price_change_percentage_24h?.toFixed(2)) + '%'}
                  </td>
                  <td className="p-8 text-right font-mono text-slate-400 font-bold">
                    <span className="text-xs mr-1">{currentCurrency.symbol}</span>
                    {coin.market_cap?.toLocaleString()}
                  </td>
                  <td className="p-8 text-center">
                    <button onClick={() => handleOpenAnalysis(coin)} className="px-8 py-3 rounded-xl border-2 border-[var(--electric-blue)] text-[var(--electric-blue)] font-orbitron font-black text-[10px] hover:bg-[var(--electric-blue)] hover:text-black transition-all shadow-[0_0_10px_rgba(0,255,255,0.2)] active:scale-95">ANALYSER</button>
                  </td>
                </tr>
              )) : !loading && (
                <tr>
                  <td colSpan={6} className="p-20 text-center font-orbitron text-slate-500 uppercase tracking-widest opacity-40">
                    Aucun résultat trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-10 border-t border-[var(--border)] bg-black/30 flex flex-col items-center gap-6">
          <div className="text-[11px] font-orbitron opacity-40 uppercase tracking-[0.8em] select-none">
            TOTAL ASSETS: <span className="electric-green font-black">{totalCoinsInWorld.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-8">
            <button 
              disabled={page <= 1 || loading} 
              onClick={() => setPage(page - 1)} 
              className="px-10 py-4 rounded-2xl border-2 border-[var(--border)] text-slate-600 font-orbitron font-black text-xs hover:border-slate-400 disabled:opacity-10 transition-all active:scale-95"
            >
              <i className="fa-solid fa-chevron-left mr-3"></i> RETOUR
            </button>
            <div className="flex flex-col items-center">
              <span className="font-orbitron font-black text-[var(--electric-green)] text-lg">PULSE PAGE {page} / {maxPages}</span>
              <span className="text-[9px] opacity-30 font-mono uppercase tracking-widest">250 ASSETS PAR BLOC</span>
            </div>
            <button 
              disabled={loading || page >= maxPages} 
              onClick={() => setPage(page + 1)} 
              className="px-10 py-4 rounded-2xl border-2 border-[var(--electric-green)] text-[var(--electric-green)] font-orbitron font-black text-xs hover:bg-[var(--electric-green)]/10 transition-all active:scale-95 shadow-[0_0_10px_rgba(57,255,20,0.2)]"
            >
              SUIVANT <i className="fa-solid fa-chevron-right ml-3"></i>
            </button>
          </div>
        </div>
      </div>

      {selectedCoin && (
        <div className={'fixed inset-0 z-[50000] bg-black/95 backdrop-blur-3xl flex items-center justify-center animate-fadeIn ' + (isFullScreen ? 'p-0' : 'p-4 md:p-12')}>
          <div className={'bg-[var(--card-bg)] border-2 border-[var(--electric-blue)] flex flex-col shadow-[0_0_50px_rgba(0,255,255,0.2)] transition-all overflow-hidden ' + (isFullScreen ? 'w-full h-full rounded-none' : 'w-full max-w-7xl h-[90vh] rounded-[3rem]')}>
            
            <div className="p-8 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-6 bg-black/50 backdrop-blur-md">
              <div className="flex items-center gap-5">
                <img src={selectedCoin.image} className="w-12 h-12 rounded-full shadow-2xl" alt="" />
                <div>
                  <h3 className="font-orbitron font-black text-2xl text-white uppercase tracking-tighter leading-none mb-1">{selectedCoin.name}</h3>
                  <div className="text-[11px] font-mono text-[var(--electric-blue)] opacity-60 tracking-[0.4em]">{selectedCoin.symbol.toUpperCase()} / QUANTUM DATA</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {officialLink && <a href={officialLink} target="_blank" rel="noopener noreferrer" className="px-8 py-3 rounded-xl border-2 border-emerald-500 text-emerald-400 font-orbitron font-black text-[11px] uppercase hover:bg-emerald-500 hover:text-black transition-all">S'Y RENDRE</a>}
                <button onClick={toggleDeepReport} className={'px-8 py-3 rounded-xl border-2 font-orbitron font-black text-[11px] uppercase transition-all active:scale-95 ' + (isFullReportMode ? 'bg-purple-600 border-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]' : 'border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-black')}>IA REPORT</button>
                <button onClick={() => setIsFullScreen(!isFullScreen)} className="w-12 h-12 flex items-center justify-center rounded-xl border-2 border-slate-700 text-slate-500 hover:text-white hover:border-white transition-all active:scale-95"><i className={'fa-solid ' + (isFullScreen ? 'fa-compress' : 'fa-expand')}></i></button>
                <button onClick={() => setSelectedCoin(null)} className="w-12 h-12 flex items-center justify-center rounded-xl border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95"><i className="fa-solid fa-times text-xl"></i></button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
              {isChartLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md">
                   <div className="w-16 h-16 border-4 border-[var(--electric-blue)] border-t-transparent rounded-full animate-spin mb-4"></div>
                   <div className="font-orbitron font-black text-[var(--electric-blue)] tracking-[0.3em] uppercase">Syncing Flux...</div>
                </div>
              )}

              {isFullReportMode ? (
                <div className="h-full overflow-y-auto p-12 custom-scrollbar bg-black/20 animate-fadeIn">
                   {isGeneratingDeepReport ? (
                      <div className="h-full flex flex-col items-center justify-center gap-6 text-purple-500">
                        <i className="fa-solid fa-brain fa-spin text-5xl"></i>
                        <span className="font-orbitron font-black text-sm uppercase tracking-widest">Processus Neural...</span>
                      </div>
                   ) : (
                      <div className="max-w-4xl mx-auto bg-purple-500/5 border-l-8 border-purple-500 p-10 rounded-r-3xl font-mono text-base leading-relaxed text-slate-300 whitespace-pre-wrap shadow-2xl">
                        { deepReport || 'Génération du rapport en cours...' }
                      </div>
                   )}
                </div>
              ) : (
                <div className="h-full flex flex-col p-8">
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--electric-blue)" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="var(--electric-blue)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="time" hide />
                        <YAxis domain={['auto', 'auto']} orientation="right" stroke="rgba(255,255,255,0.2)" tick={{fontSize: 11, fontFamily: 'Orbitron'}} axisLine={false} tickFormatter={(val) => val.toLocaleString()} />
                        <Tooltip 
                          contentStyle={{backgroundColor: '#000', border: '1px solid #00FFFF', borderRadius: '16px', padding: '15px'}}
                          itemStyle={{color: '#00FFFF', fontWeight: 'bold'}}
                          labelStyle={{color: '#64748b', marginBottom: '8px', fontSize: '11px'}}
                          labelFormatter={(label) => new Date(label).toLocaleString()}
                          formatter={(val: any) => [currentCurrency.symbol + val.toLocaleString(undefined, {minimumFractionDigits: 2}), 'VALEUR']}
                        />
                        <Area type="monotone" dataKey="price" stroke="var(--electric-blue)" strokeWidth={4} fill="url(#colorPrice)" animationDuration={1200} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 pt-10 border-t border-[var(--border)] mt-8">
                    {['1','7','30','365'].map(d => (
                      <button key={d} onClick={() => { setChartDays(d); handleOpenAnalysis(selectedCoin!); }} className={'px-10 py-3 rounded-xl font-orbitron font-black text-xs border-2 transition-all active:scale-95 ' + (chartDays === d ? 'bg-[var(--electric-blue)] border-[var(--electric-blue)] text-black shadow-[0_0_15px_rgba(0,255,255,0.3)]' : 'border-slate-800 text-slate-600 hover:border-slate-500')}>{d === '1' ? '24H' : d === '7' ? '7D' : d === '30' ? '30D' : '1Y'}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isRadioOpen && (
        <div className="fixed inset-0 z-[60000] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-6 animate-fadeIn">
           <div className="bg-[var(--card-bg)] border-2 border-[var(--electric-blue)] rounded-[2.5rem] w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
              <div className="p-8 border-b border-[var(--border)] flex justify-between items-center bg-black/40">
                <h3 className="font-orbitron font-black text-xl text-[var(--electric-blue)] tracking-tighter uppercase">QUANTUM RADIO</h3>
                <button onClick={() => setIsRadioOpen(false)} className="text-white opacity-40 hover:opacity-100 transition-opacity p-2"><i className="fa-solid fa-times text-2xl"></i></button>
              </div>
              <div className="p-8 space-y-4">
                {RADIO_STATIONS.map(s => (
                  <button key={s.url} onClick={() => { if(audioRef.current){ audioRef.current.src = s.url; audioRef.current.play(); setIsPlaying(true); } }} className="w-full flex items-center gap-6 p-5 rounded-2xl border-2 border-white/5 hover:border-[var(--electric-blue)] transition-all bg-white/5 group active:scale-95">
                    <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-[var(--electric-blue)] group-hover:scale-110 transition-transform"><i className="fa-solid fa-play"></i></div>
                    <span className="font-orbitron font-black text-xs uppercase tracking-widest">{s.name}</span>
                  </button>
                ))}
                {isPlaying && (
                  <button onClick={() => { audioRef.current?.pause(); setIsPlaying(false); }} className="w-full py-4 rounded-xl bg-red-600 text-white font-orbitron font-black text-xs uppercase mt-4 hover:bg-red-500 transition-colors active:scale-95">STOP RADIO</button>
                )}
              </div>
           </div>
        </div>
      )}

      <footer className="py-24 text-center select-none">
        <div className="opacity-10 font-orbitron text-[11px] tracking-[2em] uppercase mb-4">PROTECTED BY NEURAL CORE</div>
        <div className="opacity-40 font-mono text-[10px] uppercase tracking-widest">© 2026 CRYPTO PULSE SYSTEM . V4.6.0</div>
      </footer>
    </div>
  );
};

export default App;