import { useEffect, useRef, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useStockData } from './hooks/useStockData';
import { useTheme } from './hooks/useTheme';
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
import { useBacktestTour } from './hooks/useBacktestTour';

function readRecent() {
  try { return JSON.parse(localStorage.getItem('recentStocks')) || []; }
  catch { return []; }
}

function App() {
  const [symbol, setSymbol] = useState('');
  const [recentStocks, setRecentStocks] = useState(readRecent);
  const { data, loading, error, loadStock, reset } = useStockData();
  const { theme, toggleTheme } = useTheme();
  const [selectedRange, setSelectedRange] = useState('ALL');
  const chartRef = useRef(null);
  const { startTour, handleBacktestComplete, isCompleted: tourCompleted } = useBacktestTour(chartRef);
  const tourTriggered = useRef(false);

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

  const isEmptyState = !data && !loading;

  return (
    <div className={`min-h-screen flex flex-col ${isEmptyState ? 'justify-center' : ''}`}>
      <div className="absolute top-4 right-4">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>
      </div>

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
        <div className="max-w-6xl mx-auto w-full px-6 py-6">
          <header className="mb-6 flex justify-between items-center">
            <h1
              className="text-3xl font-bold text-foreground cursor-pointer hover:opacity-80 transition-opacity"
              onClick={reset}
            >
              Stock Analysis Dashboard
            </h1>
          </header>
          <SearchBar onSearch={handleSearch} />
          <StockHeader data={data.stock} chartData={data.chart} selectedRange={selectedRange} />
          <ValuationChart ref={chartRef} chartData={data.chart} theme={theme} selectedRange={selectedRange} onRangeChange={setSelectedRange} dividendEvents={data.dividendEvents || []} onStartTour={startTour} onBacktestComplete={handleBacktestComplete} />
          <MetricsGrid data={data.stock} />
          <DividendHistory dividendInfo={data.dividendInfo} />
          <NewsSection news={data.news} />
          <ClaudeAnalysis symbol={symbol} assetType={data.stock?.assetType} />
        </div>
      )}
    </div>
  );
}

export default App;
