import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useStockData } from './hooks/useStockData';
import { useTheme } from './hooks/useTheme';
import { useWatchlist } from './hooks/useWatchlist';
import { useActiveSection } from './hooks/useActiveSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import SearchBar from './components/SearchBar';
import RecentStocks from './components/RecentStocks';
import StockHeader from './components/StockHeader';
import ValuationChart from './components/ValuationChart';
import MetricsGrid from './components/MetricsGrid';
import NewsSection from './components/NewsSection';
import ClaudeAnalysis from './components/ClaudeAnalysis';
import DividendHistory from './components/DividendHistory';
import Sidebar, { SidebarMobileToggle } from './components/Sidebar';
import { useBacktestTour } from './hooks/useBacktestTour';

function readRecent() {
  try { return JSON.parse(localStorage.getItem('recentStocks')) || []; }
  catch { return []; }
}

function readSidebarCollapsed() {
  try { return JSON.parse(localStorage.getItem('sidebarCollapsed')) ?? false; }
  catch { return false; }
}

function App() {
  const [symbol, setSymbol] = useState('');
  const [recentStocks, setRecentStocks] = useState(readRecent);
  const { data, loading, error, loadStock, reset } = useStockData();
  const { theme, toggleTheme } = useTheme();
  const { watchlist, addStock, removeStock, isInWatchlist } = useWatchlist();
  const [selectedRange, setSelectedRange] = useState('ALL');
  const chartRef = useRef(null);
  const { startTour, handleBacktestComplete, isCompleted: tourCompleted } = useBacktestTour(chartRef);
  const tourTriggered = useRef(false);

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', JSON.stringify(next));
      return next;
    });
  }, []);

  // Visible sections for sidebar nav
  const visibleSections = useMemo(() => {
    if (!data) return [];
    const sections = [
      { id: 'section-search', label: 'Search' },
      { id: 'section-chart', label: 'Chart' },
      { id: 'section-metrics', label: 'Metrics' },
    ];
    if (data.dividendInfo) sections.push({ id: 'section-dividends', label: 'Dividends' });
    if (data.news?.length) sections.push({ id: 'section-news', label: 'News' });
    sections.push({ id: 'section-analysis', label: 'AI Analysis' });
    return sections;
  }, [data]);

  const sectionIds = useMemo(() => visibleSections.map((s) => s.id), [visibleSections]);
  const activeSection = useActiveSection(sectionIds);

  const handleNavigate = useCallback((sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (sectionId === 'section-search') {
      setTimeout(() => document.getElementById('search-input')?.focus(), 400);
    }
  }, []);

  useEffect(() => {
    if (data && !tourCompleted && !tourTriggered.current) {
      tourTriggered.current = true;
      const timer = setTimeout(startTour, 800);
      return () => clearTimeout(timer);
    }
  }, [data, tourCompleted, startTour]);

  const handleSearch = (sym) => {
    setSymbol(sym);
    loadStock(sym);
    const updated = [sym, ...recentStocks.filter((s) => s !== sym)].slice(0, 5);
    setRecentStocks(updated);
    localStorage.setItem('recentStocks', JSON.stringify(updated));
  };

  const handleClearRecent = () => {
    setRecentStocks([]);
    localStorage.removeItem('recentStocks');
  };

  const handleToggleWatchlist = useCallback(() => {
    if (!symbol) return;
    if (isInWatchlist(symbol)) {
      removeStock(symbol);
    } else {
      addStock(symbol);
    }
  }, [symbol, isInWatchlist, addStock, removeStock]);

  const isEmptyState = !data && !loading;

  return (
    <div className={`min-h-screen flex flex-col ${isEmptyState ? 'justify-center' : ''}`}>
      {/* Theme toggle — only on empty/loading state (sidebar handles it when data loaded) */}
      {!data && (
        <div className="absolute top-4 right-4">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
        </div>
      )}

      {isEmptyState && (
        <div className="max-w-2xl mx-auto w-full px-6 py-12">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
              Stock Analysis Dashboard
            </h1>
            <p className="text-muted-foreground text-base">
              Valuation charts, key metrics, and AI-powered analysis for any ticker.
            </p>
          </div>
          <SearchBar onSearch={handleSearch} />
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <RecentStocks
            symbols={recentStocks}
            onSelect={handleSearch}
            onClear={handleClearRecent}
          />
        </div>
      )}

      {loading && (
        <div className="text-center py-10 text-muted-foreground text-lg">
          Loading stock data...
        </div>
      )}

      {data && (
        <>
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={toggleSidebar}
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
            visibleSections={visibleSections}
            activeSection={activeSection}
            onNavigate={handleNavigate}
            watchlist={watchlist}
            currentSymbol={symbol}
            onWatchlistSelect={handleSearch}
            onWatchlistRemove={removeStock}
            theme={theme}
            toggleTheme={toggleTheme}
            onStartTour={startTour}
          />
          <div
            className={`transition-all duration-300 ${
              sidebarCollapsed ? 'md:ml-14' : 'md:ml-56'
            }`}
          >
            <div className="max-w-6xl mx-auto w-full px-6 py-6">
              <header className="mb-6 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <SidebarMobileToggle onClick={() => setMobileOpen(true)} />
                  <h1
                    className="text-3xl font-bold text-foreground cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={reset}
                  >
                    Stock Analysis Dashboard
                  </h1>
                </div>
              </header>
              <div id="section-search">
                <SearchBar onSearch={handleSearch} />
              </div>
              <StockHeader
                data={data.stock}
                chartData={data.chart}
                selectedRange={selectedRange}
                isInWatchlist={isInWatchlist(symbol)}
                onToggleWatchlist={handleToggleWatchlist}
              />
              <section id="section-chart">
                <ValuationChart ref={chartRef} chartData={data.chart} theme={theme} selectedRange={selectedRange} onRangeChange={setSelectedRange} dividendEvents={data.dividendEvents || []} onStartTour={startTour} onBacktestComplete={handleBacktestComplete} />
              </section>
              <section id="section-metrics">
                <MetricsGrid data={data.stock} />
              </section>
              {data.dividendInfo && (
                <section id="section-dividends">
                  <DividendHistory dividendInfo={data.dividendInfo} />
                </section>
              )}
              {data.news?.length > 0 && (
                <section id="section-news">
                  <NewsSection news={data.news} />
                </section>
              )}
              <section id="section-analysis">
                <ClaudeAnalysis symbol={symbol} assetType={data.stock?.assetType} />
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
