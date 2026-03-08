import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { HelpCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { filterByRange } from '@/utils/dateRangeFilter';
import { calculateBacktest } from '@/utils/backtestCalculator';
import BacktestResults from './BacktestResults';

function getValuationSeries(fairPE) {
  const peLabel = fairPE ? `${fairPE}x` : '15x';
  return [
    { key: 'actualPrice', label: 'Actual Price', colorKey: 'actualPrice' },
    { key: 'eps', label: 'Annual EPS', color: '#82ca9d' },
    { key: 'fairValueOrange', label: `Fair Value (${peLabel} P/E)`, color: '#FF8C00' },
    { key: 'fairValueBlue', label: 'Fair Value (Hist. Avg P/E)', color: '#4169E1' },
    { key: 'projectedFair', label: 'Projected Fair Value', color: '#FF8C00' },
    { key: 'projectedEps', label: 'Projected EPS', color: '#82ca9d' },
    { key: 'analystTargets', label: 'Analysts', color: '#a855f7' },
  ];
}

const SMA_SERIES = [
  { key: 'actualPrice', label: 'Actual Price', colorKey: 'actualPrice' },
  { key: 'sma50', label: '50-Day SMA', color: '#FF8C00' },
  { key: 'sma200', label: '200-Day SMA', color: '#4169E1' },
];

const DATE_RANGES = ['1M', '3M', '6M', 'YTD', '1Y', '2Y', '5Y', '10Y', 'ALL'];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function niceInterval(range) {
  if (range <= 20) return 2;
  if (range <= 50) return 5;
  if (range <= 200) return 10;
  if (range <= 500) return 25;
  if (range <= 2000) return 50;
  return 100;
}

function getXAxisConfig(range, isSMA) {
  const configs = {
    '1M':  { fmt: 'month', monthInterval: 1,  weekInterval: 4  },
    '3M':  { fmt: 'month', monthInterval: 1,  weekInterval: 4  },
    '6M':  { fmt: 'month', monthInterval: 2,  weekInterval: 8  },
    'YTD': { fmt: 'month', monthInterval: 2,  weekInterval: 8  },
    '1Y':  { fmt: 'month', monthInterval: 2,  weekInterval: 12 },
    '2Y':  { fmt: 'year',  monthInterval: 6,  weekInterval: 26 },
    '5Y':  { fmt: 'year',  monthInterval: 12, weekInterval: 52 },
    '10Y': { fmt: 'year',  monthInterval: 11, weekInterval: 51 },
    'ALL': { fmt: 'year',  monthInterval: 11, weekInterval: 51 },
  };

  const cfg = configs[range] ?? configs['ALL'];
  const interval = isSMA ? cfg.weekInterval : cfg.monthInterval;

  const tickFormatter = cfg.fmt === 'month'
    ? (d) => {
        const [year, month] = d.split('-');
        return `${MONTH_NAMES[parseInt(month, 10) - 1]} '${year.slice(2)}`;
      }
    : (d) => d.slice(0, 4);

  return { interval, tickFormatter };
}

// Monthly data is too sparse for 1M/3M — hide those for non-weekly charts
const SHORT_RANGES = new Set(['1M', '3M']);

function DateRangeSelector({ selected, onChange, isDark, isSMA }) {
  return (
    <div className="flex items-center justify-center gap-0.5 my-2">
      {DATE_RANGES.filter((r) => isSMA || !SHORT_RANGES.has(r)).map((range) => {
        const isSelected = selected === range;
        return (
          <button
            key={range}
            onClick={() => onChange(range)}
            className={[
              'px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
              isSelected
                ? 'bg-violet-600 text-white shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-black/5',
            ].join(' ')}
          >
            {range}
          </button>
        );
      })}
    </div>
  );
}

export default forwardRef(function ValuationChart({ chartData, theme, selectedRange, onRangeChange, dividendEvents, onStartTour, onBacktestComplete }, ref) {
  const isSMA = chartData?.chartType === 'sma';
  const seriesConfig = isSMA ? SMA_SERIES : getValuationSeries(chartData?.fairPE_orange);

  const mergedData = useMemo(() => {
    if (!chartData?.chartData) return [];

    if (isSMA) return chartData.chartData;

    return chartData.chartData.map((point) => {
      const epsEntry = chartData.annualEPS?.find(
        (e) => point.date.startsWith(String(e.year)) && point.date.endsWith('-12')
      );
      return {
        ...point,
        eps: epsEntry?.eps ?? null,
      };
    });
  }, [chartData, isSMA]);

  const filteredData = useMemo(
    () => filterByRange(mergedData, selectedRange),
    [mergedData, selectedRange]
  );

  const xAxisConfig = getXAxisConfig(selectedRange, isSMA);

  const [visibleSeries, setVisibleSeries] = useState({
    actualPrice: true,
    eps: true,
    fairValueOrange: true,
    fairValueBlue: true,
    projectedFair: true,
    projectedEps: true,
    analystTargets: true,
    sma50: true,
    sma200: true,
  });

  // Chart mode: zoom or backtest
  const [chartMode, setChartMode] = useState('zoom');
  const [backtestSelection, setBacktestSelection] = useState({ start: null, end: null });
  const [backtestResult, setBacktestResult] = useState(null);
  const [backtestAmount, setBacktestAmount] = useState(10000);
  const [backtestDrip, setBacktestDrip] = useState(false);

  useImperativeHandle(ref, () => ({
    enterBacktestMode: () => {
      setChartMode('backtest');
      setBacktestSelection({ start: null, end: null });
      setBacktestResult(null);
    },
    exitBacktestMode: () => {
      setChartMode('zoom');
    },
  }));

  // Drag-to-zoom state
  const [zoomArea, setZoomArea] = useState({ start: null, end: null });
  const [zoomRange, setZoomRange] = useState(null);

  const displayData = useMemo(() => {
    if (!zoomRange) return filteredData;
    return filteredData.slice(zoomRange.left, zoomRange.right + 1);
  }, [filteredData, zoomRange]);

  // Run backtest calculation whenever inputs change
  const runBacktest = useCallback((startDate, endDate, amount, drip) => {
    const result = calculateBacktest({
      chartData: filteredData,
      dividendEvents: dividendEvents || [],
      startDate,
      endDate,
      investmentAmount: amount,
      reinvestDividends: drip,
    });
    setBacktestResult(result);
  }, [filteredData, dividendEvents]);

  const handleMouseDown = useCallback((e) => {
    if (e?.activeLabel) setZoomArea({ start: e.activeLabel, end: null });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (zoomArea.start && e?.activeLabel) {
      setZoomArea((prev) => ({ ...prev, end: e.activeLabel }));
    }
  }, [zoomArea.start]);

  const handleMouseUp = useCallback(() => {
    const { start, end } = zoomArea;
    if (!start || !end || start === end) {
      setZoomArea({ start: null, end: null });
      return;
    }

    if (chartMode === 'backtest') {
      // In backtest mode, select period instead of zooming
      let startDate = start;
      let endDate = end;
      // Support right-to-left drag
      if (startDate > endDate) [startDate, endDate] = [endDate, startDate];
      setBacktestSelection({ start: startDate, end: endDate });
      runBacktest(startDate, endDate, backtestAmount, backtestDrip);
      onBacktestComplete?.();
      setZoomArea({ start: null, end: null });
      return;
    }

    // Zoom mode (existing behavior)
    let leftIdx = filteredData.findIndex((d) => d.date === start);
    let rightIdx = filteredData.findIndex((d) => d.date === end);
    if (leftIdx < 0 || rightIdx < 0) {
      setZoomArea({ start: null, end: null });
      return;
    }
    // Support right-to-left drag
    if (leftIdx > rightIdx) [leftIdx, rightIdx] = [rightIdx, leftIdx];
    // Ignore tiny selections
    if (rightIdx - leftIdx < 2) {
      setZoomArea({ start: null, end: null });
      return;
    }
    setZoomRange({ left: leftIdx, right: rightIdx });
    setZoomArea({ start: null, end: null });
  }, [zoomArea, filteredData, chartMode, backtestAmount, backtestDrip, runBacktest]);

  const resetZoom = useCallback(() => setZoomRange(null), []);

  // Compute dynamic X-axis interval for zoomed view
  const zoomXInterval = useMemo(() => {
    if (!zoomRange) return xAxisConfig.interval;
    const count = zoomRange.right - zoomRange.left + 1;
    if (count <= 12) return 0;
    if (count <= 24) return 1;
    if (count <= 48) return 2;
    return Math.floor(count / 12);
  }, [zoomRange, xAxisConfig.interval]);

  const priceDomain = useMemo(() => {
    if (!displayData.length) return [0, 'auto'];
    const priceKeys = isSMA
      ? ['actualPrice', 'sma50', 'sma200']
      : ['actualPrice', 'fairValueOrange', 'fairValueBlue', 'projectedFairOrange', 'projectedFairBlue'];
    let min = Infinity;
    let max = -Infinity;
    for (const point of displayData) {
      for (const key of priceKeys) {
        const v = point[key];
        if (v != null) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    if (visibleSeries.analystTargets && chartData?.analystTargets) {
      const at = chartData.analystTargets;
      if (at.high != null && at.high > max) max = at.high;
      if (at.low != null && at.low < min) min = at.low;
    }
    if (min === Infinity) return [0, 'auto'];
    const padding = (max - min) * 0.1 || max * 0.05;
    const range = max - min + 2 * padding;
    const step = niceInterval(range);
    return [
      Math.max(0, Math.floor((min - padding) / step) * step),
      Math.ceil((max + padding) / step) * step,
    ];
  }, [displayData, isSMA, visibleSeries.analystTargets, chartData?.analystTargets]);

  const toggleSeries = (key) => {
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isDark = theme === 'dark';
  const colors = {
    grid: isDark ? '#334155' : '#e2e8f0',
    actualPrice: isDark ? '#e2e8f0' : '#1e293b',
    text: isDark ? '#cbd5e1' : '#334155',
    tooltipBg: isDark ? '#1e293b' : '#ffffff',
    tooltipBorder: isDark ? '#334155' : '#e2e8f0',
  };

  if (!mergedData.length) return null;

  const title = isSMA
    ? 'Technical Analysis (Moving Averages)'
    : 'Valuation';

  const subtitle = isSMA
    ? null
    : `Historical Avg P/E: ${chartData.historicalAvgPE}x`;

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="flex items-baseline gap-3">
          {title}
          {subtitle && (
            <span className="text-sm font-normal text-muted-foreground">
              {subtitle}
            </span>
          )}
          {onStartTour && (
            <button
              onClick={onStartTour}
              className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              aria-label="Backtest feature tour"
              title="Learn about the Backtest feature"
            >
              <HelpCircle className="size-4" />
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-3">
          {seriesConfig.map(({ key, label, color, colorKey }) => (
            <Button
              key={key}
              variant={visibleSeries[key] ? 'outline' : 'ghost'}
              size="sm"
              className={visibleSeries[key] ? '' : 'opacity-40'}
              onClick={() => toggleSeries(key)}
            >
              <span
                className="inline-block w-3 h-3 rounded-sm mr-1.5 shrink-0"
                style={{ backgroundColor: colorKey ? colors[colorKey] : color }}
              />
              {label}
            </Button>
          ))}
        </div>
        <div data-tour="chart-area">
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart
            data={displayData}
            margin={{ top: 10, right: 50, left: 10, bottom: 10 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={resetZoom}
            style={{ cursor: zoomArea.start ? 'col-resize' : 'crosshair' }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis
              dataKey="date"
              tickFormatter={xAxisConfig.tickFormatter}
              interval={zoomRange ? zoomXInterval : xAxisConfig.interval}
              tick={{ fontSize: 13, fill: colors.text }}
            />
            <YAxis
              yAxisId="price"
              orientation="left"
              domain={priceDomain}
              tickCount={8}
              allowDecimals={false}
              tick={{ fontSize: 13, fill: colors.text }}
              label={{ value: 'Price ($)', angle: -90, position: 'insideLeft', offset: -5, fill: colors.text }}
            />
            {!isSMA && (
              <YAxis
                yAxisId="eps"
                orientation="right"
                tickCount={6}
                allowDecimals={false}
                tick={{ fontSize: 13, fill: colors.text }}
                label={{ value: 'EPS ($)', angle: 90, position: 'insideRight', offset: -5, fill: colors.text }}
              />
            )}

            {!isSMA && (
              <Bar
                yAxisId="eps"
                dataKey="eps"
                fill="#82ca9d"
                opacity={0.6}
                name="Annual EPS"
                hide={!visibleSeries.eps}
              />
            )}

            <Line
              yAxisId="price"
              type="monotone"
              dataKey="actualPrice"
              stroke={colors.actualPrice}
              dot={false}
              strokeWidth={2}
              name="Actual Price"
              hide={!visibleSeries.actualPrice}
            />

            {isSMA ? (
              <>
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="sma50"
                  stroke="#FF8C00"
                  dot={false}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="50-Day SMA"
                  hide={!visibleSeries.sma50}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="sma200"
                  stroke="#4169E1"
                  dot={false}
                  strokeWidth={2}
                  name="200-Day SMA"
                  hide={!visibleSeries.sma200}
                />
              </>
            ) : (
              <>
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="fairValueOrange"
                  stroke="#FF8C00"
                  dot={false}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name={`Fair Value (${chartData?.fairPE_orange ?? 15}x P/E)`}
                  hide={!visibleSeries.fairValueOrange}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="fairValueBlue"
                  stroke="#4169E1"
                  dot={false}
                  strokeWidth={2}
                  name="Fair Value (Hist. Avg P/E)"
                  hide={!visibleSeries.fairValueBlue}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="projectedFairOrange"
                  stroke="#FF8C00"
                  dot={false}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  name={`Projected (${chartData?.fairPE_orange ?? 15}x P/E)`}
                  hide={!visibleSeries.projectedFair}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="projectedFairBlue"
                  stroke="#4169E1"
                  dot={false}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  name="Projected (Hist. Avg P/E)"
                  hide={!visibleSeries.projectedFair}
                />
                <Bar
                  yAxisId="eps"
                  dataKey="projectedEps"
                  fill="#82ca9d"
                  opacity={0.3}
                  name="Projected EPS"
                  hide={!visibleSeries.projectedEps}
                />
              </>
            )}

            {!isSMA && chartData?.analystTargets && visibleSeries.analystTargets && (
              <>
                {chartData.analystTargets.low != null && chartData.analystTargets.high != null && (
                  <ReferenceArea
                    yAxisId="price"
                    y1={chartData.analystTargets.low}
                    y2={chartData.analystTargets.high}
                    fill="#a855f7"
                    fillOpacity={0.03}
                    stroke="#a855f7"
                    strokeOpacity={0.15}
                    strokeDasharray="3 3"
                  />
                )}
                <ReferenceLine
                  yAxisId="price"
                  y={chartData.analystTargets.mean}
                  stroke="#a855f7"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={({ viewBox }) => {
                    const text = `Analyst Target: $${chartData.analystTargets.mean.toFixed(0)}${chartData.analystTargets.numberOfAnalysts ? ` (${chartData.analystTargets.numberOfAnalysts} analysts)` : ''}`;
                    const x = (viewBox?.x ?? 0) + 8;
                    const y = (viewBox?.y ?? 0) - 6;
                    return (
                      <g>
                        <rect
                          x={x - 4}
                          y={y - 12}
                          width={text.length * 6.2 + 8}
                          height={18}
                          rx={4}
                          fill={isDark ? '#1e1b2e' : '#faf5ff'}
                          stroke="#a855f7"
                          strokeWidth={0.5}
                          opacity={0.95}
                        />
                        <text
                          x={x}
                          y={y}
                          fill="#a855f7"
                          fontSize={12}
                          fontWeight={600}
                        >
                          {text}
                        </text>
                      </g>
                    );
                  }}
                />
              </>
            )}

            <Tooltip
              formatter={(value, name) => {
                if (value == null) return ['-', name];
                const isProjected = name.startsWith('Projected');
                return [`$${value.toFixed(2)}${isProjected ? ' (est.)' : ''}`, name];
              }}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{ backgroundColor: colors.tooltipBg, borderColor: colors.tooltipBorder, color: colors.text }}
              labelStyle={{ color: colors.text }}
            />

            {backtestSelection.start && backtestSelection.end && (
              <ReferenceArea
                yAxisId="price"
                x1={backtestSelection.start}
                x2={backtestSelection.end}
                strokeOpacity={0.4}
                fill={isDark ? '#10b981' : '#34d399'}
                fillOpacity={0.12}
                stroke={isDark ? '#10b981' : '#059669'}
              />
            )}

            {zoomArea.start && zoomArea.end && (
              <ReferenceArea
                yAxisId="price"
                x1={zoomArea.start}
                x2={zoomArea.end}
                strokeOpacity={0.3}
                fill={chartMode === 'backtest' ? (isDark ? '#10b981' : '#34d399') : (isDark ? '#6366f1' : '#818cf8')}
                fillOpacity={0.15}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-3">
          <div data-tour="mode-toggle" className={[
            'flex items-center gap-0.5 rounded-lg border px-1 py-0.5',
            isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-100/50',
          ].join(' ')}>
            {['zoom', 'backtest'].map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setChartMode(mode);
                  if (mode === 'zoom') {
                    setBacktestSelection({ start: null, end: null });
                    setBacktestResult(null);
                  } else {
                    setZoomRange(null);
                  }
                }}
                className={[
                  'px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                  chartMode === mode
                    ? mode === 'backtest'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-violet-600 text-white shadow-sm'
                    : isDark
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-black/5',
                ].join(' ')}
              >
                {mode === 'zoom' ? 'Zoom' : 'Backtest'}
              </button>
            ))}
          </div>
          <DateRangeSelector
            selected={selectedRange}
            onChange={(range) => { setZoomRange(null); onRangeChange(range); }}
            isDark={isDark}
            isSMA={isSMA}
          />
          {zoomRange && (
            <button
              onClick={resetZoom}
              className={[
                'px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                isDark
                  ? 'text-red-400 hover:text-red-300 hover:bg-white/5 border border-red-400/30'
                  : 'text-red-500 hover:text-red-600 hover:bg-red-50 border border-red-300',
              ].join(' ')}
            >
              Reset Zoom
            </button>
          )}
        </div>

        {chartMode === 'backtest' && !backtestResult && (
          <div data-tour="backtest-instructions" className={[
            'mt-4 rounded-lg border-2 border-dashed p-5 text-center',
            isDark ? 'border-emerald-700/60 bg-emerald-950/30' : 'border-emerald-300 bg-emerald-50/60',
          ].join(' ')}>
            <p className={[
              'text-base font-semibold mb-3',
              isDark ? 'text-emerald-400' : 'text-emerald-700',
            ].join(' ')}>
              Click and drag on the chart above to select a time period
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <label data-tour="backtest-amount" className="flex items-center gap-1.5 text-sm text-foreground">
                <span className="text-muted-foreground">Invest $</span>
                <input
                  type="number"
                  value={backtestAmount}
                  onChange={(e) => setBacktestAmount(Number(e.target.value))}
                  min={1}
                  className={[
                    'w-28 px-2 py-1 rounded border text-sm font-medium',
                    isDark
                      ? 'bg-slate-800 border-slate-600 text-white'
                      : 'bg-white border-slate-300 text-slate-900',
                  ].join(' ')}
                />
              </label>
              <label data-tour="backtest-drip" className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={backtestDrip}
                  onChange={(e) => setBacktestDrip(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span className="text-muted-foreground">Reinvest Dividends (DRIP)</span>
              </label>
            </div>
          </div>
        )}

        <BacktestResults
          result={backtestResult}
          investmentAmount={backtestAmount}
          onAmountChange={(amount) => {
            setBacktestAmount(amount);
            if (backtestSelection.start && backtestSelection.end) {
              runBacktest(backtestSelection.start, backtestSelection.end, amount, backtestDrip);
            }
          }}
          reinvest={backtestDrip}
          onReinvestChange={(drip) => {
            setBacktestDrip(drip);
            if (backtestSelection.start && backtestSelection.end) {
              runBacktest(backtestSelection.start, backtestSelection.end, backtestAmount, drip);
            }
          }}
          onClear={() => {
            setBacktestSelection({ start: null, end: null });
            setBacktestResult(null);
          }}
          isDark={isDark}
        />
      </CardContent>
    </Card>
  );
});
