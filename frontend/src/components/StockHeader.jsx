import { useMemo } from 'react';
import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { filterByRange } from '@/utils/dateRangeFilter';

function formatMarketCap(n) {
  if (n == null) return 'N/A';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

const RANGE_LABELS = {
  '1M': '1M', '3M': '3M', '6M': '6M', 'YTD': 'YTD',
  '1Y': '1Y', '2Y': '2Y', '5Y': '5Y', '10Y': '10Y', 'ALL': 'Today',
};

export default function StockHeader({ data, chartData, selectedRange, isInWatchlist, onToggleWatchlist }) {
  const p = data?.price || {};
  const sp = data?.summaryProfile || {};
  const currentPrice = p.regularMarketPrice;

  const periodChange = useMemo(() => {
    if (!selectedRange || selectedRange === 'ALL' || !chartData?.chartData?.length || currentPrice == null) {
      return null;
    }
    const filtered = filterByRange(chartData.chartData, selectedRange);
    if (!filtered.length) return null;
    const startPrice = filtered[0].actualPrice;
    if (!startPrice) return null;
    const change = currentPrice - startPrice;
    const changePct = change / startPrice;
    return { change, changePct };
  }, [selectedRange, chartData, currentPrice]);

  const usePeriod = periodChange !== null;
  const change = usePeriod ? periodChange.change : (p.regularMarketChange ?? 0);
  const changePct = usePeriod ? periodChange.changePct : (p.regularMarketChangePercent ?? 0);
  const isPositive = change >= 0;
  const label = RANGE_LABELS[selectedRange] || 'Today';

  return (
    <Card className="mb-5">
      <CardContent className="flex justify-between items-start pt-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              {p.shortName || p.longName || 'Unknown'}{' '}
              <span className="font-normal text-muted-foreground">({p.symbol})</span>
            </h1>
            {onToggleWatchlist && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={onToggleWatchlist}
                aria-label={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                <Star
                  className={`size-4 transition-colors ${
                    isInWatchlist
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground hover:text-yellow-400'
                  }`}
                />
              </Button>
            )}
          </div>
          <div className="text-xs font-medium mt-0.5">
            {p.currency === 'CAD' ? (
              <span className="text-red-400">Canadian Stock</span>
            ) : (
              <span className="text-blue-400">US Stock</span>
            )}
            {p.exchangeName && <span className="text-muted-foreground"> &middot; {p.exchangeName}</span>}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {sp.sector && <span>{sp.sector}</span>}
            {sp.industry && <span> &middot; {sp.industry}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-foreground">
            ${currentPrice?.toFixed(2) ?? 'N/A'}{' '}
            <span className="text-sm font-normal text-muted-foreground">{p.currency || 'USD'}</span>
          </div>
          <div className={`text-base font-semibold mt-0.5 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}
            {change.toFixed(2)} ({isPositive ? '+' : ''}
            {(changePct * 100).toFixed(2)}%)
            {usePeriod && (
              <span className="text-xs font-normal text-muted-foreground ml-1.5">{label}</span>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Mkt Cap: {formatMarketCap(p.marketCap)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
