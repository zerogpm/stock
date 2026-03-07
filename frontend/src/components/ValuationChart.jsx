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

export default function ValuationChart({ chartData, theme }) {
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
          <ComposedChart data={mergedData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => d.slice(0, 4)}
              interval={isSMA ? 51 : 11}
              tick={{ fontSize: 12, fill: colors.text }}
            />
            <YAxis
              yAxisId="price"
              orientation="left"
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
      </CardContent>
    </Card>
  );
}
