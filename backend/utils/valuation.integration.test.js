import { describe, it, expect } from 'vitest';
import { getHistoricalEPS, getStockData } from '../services/yahooFinance.js';
import { calculateFairValueSeries } from './valuation.js';

describe('valuation 10-year coverage (integration)', () => {
  it('fair value lines cover 7+ years via EPS extrapolation', async () => {
    const [fundamentals, data] = await Promise.all([
      getHistoricalEPS('AAPL'),
      getStockData('AAPL'),
    ]);

    const result = calculateFairValueSeries({
      historicalPrices: data.historicalPrices,
      sharesOutstanding: data.defaultKeyStatistics?.sharesOutstanding || null,
      forwardEPS: data.defaultKeyStatistics?.forwardEps ?? null,
      currentPrice: data.price?.regularMarketPrice ?? null,
      fundamentals,
    });

    // chartData should have non-null fair values going back 7+ years (via extrapolation)
    const withFairValue = result.chartData.filter((d) => d.fairValueBlue != null);
    expect(withFairValue.length).toBeGreaterThan(0);

    const fairValueYears = withFairValue.map((d) => parseInt(d.date.split('-')[0]));
    const oldestFairValueYear = Math.min(...fairValueYears);
    const newestFairValueYear = Math.max(...fairValueYears);
    const yearSpan = newestFairValueYear - oldestFairValueYear;

    console.log(`Fair value coverage: ${oldestFairValueYear}-${newestFairValueYear} (${yearSpan} years)`);
    console.log(`Known EPS years: ${result.annualEPS.map(e => e.year).join(', ')}`);
    console.log(`Chart data points with fair value: ${withFairValue.length}/${result.chartData.length}`);

    expect(yearSpan).toBeGreaterThanOrEqual(7);
  }, 30000);
});
