import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { filterByRange } from '@/utils/dateRangeFilter';

const VALUATION_SERIES = [
  { key: 'actualPrice', label: 'Actual Price', colorKey: 'actualPrice' },
  { key: 'eps', label: 'Annual EPS', color: '#82ca9d' },
  { key: 'fairValueOrange', label: 'Fair Value (15x P/E)', color: '#FF8C00' },
  { key: 'fairValueBlue', label: 'Fair Value (Hist. Avg P/E)', color: '#4169E1' },
];

const SMA_SERIES = [
  { key: 'actualPrice', label: 'Actual Price', colorKey: 'actualPrice' },
  { key: 'sma50', label: '50-Day SMA', color: '#FF8C00' },
  { key: 'sma200', label: '200-Day SMA', color: '#4169E1' },
];

const DATE_RANGES = ['1M', '3M', '6M', 'YTD', '1Y', '2Y', '5Y', '10Y', 'ALL'];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

export default function ValuationChart({ chartData, theme, selectedRange, onRangeChange }) {
  const isSMA = chartData?.chartType === 'sma';
  const seriesConfig = isSMA ? SMA_SERIES : VALUATION_SERIES;

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

  const priceDomain = useMemo(() => {
    if (!filteredData.length) return [0, 'auto'];
    const priceKeys = isSMA
      ? ['actualPrice', 'sma50', 'sma200']
      : ['actualPrice', 'fairValueOrange', 'fairValueBlue'];
    let min = Infinity;
    let max = -Infinity;
    for (const point of filteredData) {
      for (const key of priceKeys) {
        const v = point[key];
        if (v != null) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    if (min === Infinity) return [0, 'auto'];
    const padding = (max - min) * 0.1 || max * 0.05;
    return [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)];
  }, [filteredData, isSMA]);

  const [visibleSeries, setVisibleSeries] = useState({
    actualPrice: true,
    eps: true,
    fairValueOrange: true,
    fairValueBlue: true,
    sma50: true,
    sma200: true,
  });

  const toggleSeries = (key) => {
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isDark = theme === 'dark';
  const colors = {
    grid: isDark ? '#334155' : '#e2e8f0',
    actualPrice: isDark ? '#e2e8f0' : '#1e293b',
    text: isDark ? '#94a3b8' : '#475569',
    tooltipBg: isDark ? '#1e293b' : '#ffffff',
    tooltipBorder: isDark ? '#334155' : '#e2e8f0',
  };

  if (!mergedData.length) return null;

  const title = isSMA
    ? 'Technical Analysis (Moving Averages)'
    : 'FastGraphs-Style Valuation';

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
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart data={filteredData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis
              dataKey="date"
              tickFormatter={xAxisConfig.tickFormatter}
              interval={xAxisConfig.interval}
              tick={{ fontSize: 12, fill: colors.text }}
            />
            <YAxis
              yAxisId="price"
              orientation="left"
              domain={priceDomain}
              tick={{ fontSize: 12, fill: colors.text }}
              label={{ value: 'Price ($)', angle: -90, position: 'insideLeft', offset: -5, fill: colors.text }}
            />
            {!isSMA && (
              <YAxis
                yAxisId="eps"
                orientation="right"
                tick={{ fontSize: 12, fill: colors.text }}
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
                  name="Fair Value (15x P/E)"
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
              </>
            )}

            <Tooltip
              formatter={(value, name) =>
                value != null ? [`$${value.toFixed(2)}`, name] : ['-', name]
              }
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{ backgroundColor: colors.tooltipBg, borderColor: colors.tooltipBorder, color: colors.text }}
              labelStyle={{ color: colors.text }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <DateRangeSelector
          selected={selectedRange}
          onChange={onRangeChange}
          isDark={isDark}
          isSMA={isSMA}
        />
      </CardContent>
    </Card>
  );
}
