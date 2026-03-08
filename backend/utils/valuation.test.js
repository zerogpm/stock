import { describe, it, expect } from 'vitest';
import { calculateFairValueSeries, SECTOR_PE_BASELINES, DEFAULT_SECTOR_PE } from './valuation.js';

function makeFundamental(year, dilutedEPS, netIncome, dilutedAverageShares) {
  return { date: new Date(year, 11, 31), dilutedEPS, netIncome, dilutedAverageShares };
}

function makePrices(yearStart, yearEnd, basePrice) {
  const prices = [];
  for (let y = yearStart; y <= yearEnd; y++) {
    for (let m = 0; m < 12; m++) {
      prices.push({ date: new Date(y, m, 15).toISOString(), close: basePrice + y - yearStart });
    }
  }
  return prices;
}

describe('calculateFairValueSeries', () => {
  it('computes correct annualEPS, growth rate, and chart data for 3 years', () => {
    const result = calculateFairValueSeries({
      fundamentals: [
        makeFundamental(2021, 2.0),
        makeFundamental(2022, 2.5),
        makeFundamental(2023, 3.0),
      ],
      historicalPrices: makePrices(2021, 2023, 40),
      sharesOutstanding: 1000000,
      forwardEPS: 3.5,
      currentPrice: 50,
    });

    expect(result.annualEPS).toHaveLength(3);
    expect(result.annualEPS[0].year).toBe(2021);
    expect(result.annualEPS[2].year).toBe(2023);
    expect(result.epsGrowthRate).toBeGreaterThan(0);
    expect(result.chartData.length).toBeGreaterThan(0);
    expect(result.historicalAvgPE).toBeGreaterThan(0);
    expect(result.currentFairValue).toBeGreaterThan(0);
    expect(result.forwardFairValue).toBeGreaterThan(0);
    expect(result.verdictRatio).toBeGreaterThan(0);
  });

  it('derives EPS from netIncome / dilutedAverageShares when dilutedEPS is missing', () => {
    const result = calculateFairValueSeries({
      fundamentals: [makeFundamental(2022, undefined, 5000000, 1000000)],
      historicalPrices: makePrices(2022, 2022, 50),
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 50,
    });

    expect(result.annualEPS).toHaveLength(1);
    expect(result.annualEPS[0].eps).toBe(5);
  });

  it('filters out negative EPS years', () => {
    const result = calculateFairValueSeries({
      fundamentals: [
        makeFundamental(2021, -1.0),
        makeFundamental(2022, 0),
        makeFundamental(2023, 3.0),
      ],
      historicalPrices: makePrices(2021, 2023, 40),
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 50,
    });

    expect(result.annualEPS).toHaveLength(1);
    expect(result.annualEPS[0].year).toBe(2023);
  });

  it('clamps historicalAvgPE to minimum of 5', () => {
    const result = calculateFairValueSeries({
      fundamentals: [makeFundamental(2023, 100.0)],
      historicalPrices: [{ date: new Date(2023, 6, 1).toISOString(), close: 10 }],
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 10,
    });

    expect(result.historicalAvgPE).toBe(5);
  });

  it('clamps historicalAvgPE to maximum of 50', () => {
    const result = calculateFairValueSeries({
      fundamentals: [makeFundamental(2023, 0.1)],
      historicalPrices: [{ date: new Date(2023, 6, 1).toISOString(), close: 8 }],
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 8,
    });

    expect(result.historicalAvgPE).toBe(50);
  });

  it('excludes P/E ratios above 100 from average', () => {
    const result = calculateFairValueSeries({
      fundamentals: [
        makeFundamental(2021, 1.0),
        makeFundamental(2022, 2.0),
      ],
      historicalPrices: [
        { date: new Date(2021, 6, 1).toISOString(), close: 1000 },
        { date: new Date(2022, 6, 1).toISOString(), close: 30 },
      ],
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 30,
    });

    expect(result.historicalAvgPE).toBe(15);
  });

  it('uses growth rate as fairPE_orange when CAGR >= 15%', () => {
    const result = calculateFairValueSeries({
      fundamentals: [
        makeFundamental(2022, 1.0),
        makeFundamental(2023, 2.0),
      ],
      historicalPrices: makePrices(2022, 2023, 20),
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 40,
    });

    expect(result.epsGrowthRate).toBe(100);
    expect(result.fairPE_orange).toBe(100);
  });

  it('defaults fairPE_orange to 15 when CAGR < 15%', () => {
    const result = calculateFairValueSeries({
      fundamentals: [
        makeFundamental(2022, 2.0),
        makeFundamental(2023, 2.1),
      ],
      historicalPrices: makePrices(2022, 2023, 30),
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 30,
    });

    expect(result.epsGrowthRate).toBe(5);
    expect(result.fairPE_orange).toBe(15);
  });

  it('returns epsGrowthRate 0 with only 1 year of data', () => {
    const result = calculateFairValueSeries({
      fundamentals: [makeFundamental(2023, 3.0)],
      historicalPrices: makePrices(2023, 2023, 45),
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 45,
    });

    expect(result.epsGrowthRate).toBe(0);
    expect(result.fairPE_orange).toBe(15);
  });

  it('handles empty fundamentals gracefully', () => {
    const result = calculateFairValueSeries({
      fundamentals: [],
      historicalPrices: makePrices(2023, 2023, 50),
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 50,
    });

    expect(result.annualEPS).toHaveLength(0);
    expect(result.historicalAvgPE).toBe(15); // default
    expect(result.epsGrowthRate).toBe(0);
  });

  it('uses fundamentals data for EPS extraction', () => {
    const fundamentals = Array.from({ length: 8 }, (_, i) => ({
      date: new Date(2016 + i, 11, 31),
      dilutedEPS: 2 + i * 0.2,
    }));
    const result = calculateFairValueSeries({
      historicalPrices: makePrices(2016, 2023, 30),
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 50,
      fundamentals,
    });

    expect(result.annualEPS).toHaveLength(8);
    expect(result.annualEPS[0].year).toBe(2016);
    // All chart data points should have non-null fair values
    const nullFairValues = result.chartData.filter((d) => d.fairValueBlue === null);
    expect(nullFairValues).toHaveLength(0);
  });

  it('handles null fundamentals gracefully', () => {
    const result = calculateFairValueSeries({
      historicalPrices: makePrices(2022, 2023, 40),
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 50,
      fundamentals: null,
    });

    expect(result.annualEPS).toHaveLength(0);
  });

  it('filters out prices with null close values', () => {
    const result = calculateFairValueSeries({
      fundamentals: [makeFundamental(2023, 3.0)],
      historicalPrices: [
        { date: new Date(2023, 0, 15).toISOString(), close: 45 },
        { date: new Date(2023, 1, 15).toISOString(), close: null },
        { date: new Date(2023, 2, 15).toISOString(), close: 50 },
      ],
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 50,
    });

    expect(result.chartData).toHaveLength(2);
  });

  it('uses Financial Services baseline (13x) for bank stocks', () => {
    const result = calculateFairValueSeries({
      fundamentals: [
        makeFundamental(2022, 2.0),
        makeFundamental(2023, 2.1),
      ],
      historicalPrices: makePrices(2022, 2023, 30),
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 30,
      sector: 'Financial Services',
    });

    expect(result.fairPE_orange).toBe(13);
    expect(result.sectorBasePE).toBe(13);
  });

  it('uses Technology baseline (25x) when CAGR < baseline', () => {
    const result = calculateFairValueSeries({
      fundamentals: [
        makeFundamental(2022, 2.0),
        makeFundamental(2023, 2.4),
      ],
      historicalPrices: makePrices(2022, 2023, 50),
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 60,
      sector: 'Technology',
    });

    expect(result.fairPE_orange).toBe(25);
    expect(result.sectorBasePE).toBe(25);
  });

  it('uses growth rate when CAGR exceeds sector baseline', () => {
    const result = calculateFairValueSeries({
      fundamentals: [
        makeFundamental(2022, 2.0),
        makeFundamental(2023, 2.7),
      ],
      historicalPrices: makePrices(2022, 2023, 50),
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 70,
      sector: 'Technology',
    });

    expect(result.fairPE_orange).toBe(35);
    expect(result.sectorBasePE).toBe(25);
  });

  it('uses Energy baseline (12x) for energy stocks', () => {
    const result = calculateFairValueSeries({
      fundamentals: [
        makeFundamental(2022, 5.0),
        makeFundamental(2023, 5.25),
      ],
      historicalPrices: makePrices(2022, 2023, 60),
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 65,
      sector: 'Energy',
    });

    expect(result.fairPE_orange).toBe(12);
    expect(result.sectorBasePE).toBe(12);
  });

  it('falls back to 15x for unknown sector', () => {
    const result = calculateFairValueSeries({
      fundamentals: [
        makeFundamental(2022, 2.0),
        makeFundamental(2023, 2.1),
      ],
      historicalPrices: makePrices(2022, 2023, 30),
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 30,
      sector: 'Some Unknown Sector',
    });

    expect(result.fairPE_orange).toBe(15);
    expect(result.sectorBasePE).toBe(DEFAULT_SECTOR_PE);
  });

  it('appends 24 projected data points when forwardEPS is provided', () => {
    const result = calculateFairValueSeries({
      fundamentals: [
        makeFundamental(2022, 2.0),
        makeFundamental(2023, 2.5),
      ],
      historicalPrices: makePrices(2022, 2023, 40),
      sharesOutstanding: 1000000,
      forwardEPS: 3.0,
      currentPrice: 50,
    });

    const projected = result.chartData.filter((d) => d.projectedFairOrange != null);
    // 24 future points + 1 bridge point (last historical)
    expect(projected.length).toBe(25);
    // Future points should have null actualPrice
    const futureOnly = projected.filter((d) => d.actualPrice === null);
    expect(futureOnly.length).toBe(24);
  });

  it('does not append projections when forwardEPS is null', () => {
    const result = calculateFairValueSeries({
      fundamentals: [makeFundamental(2023, 3.0)],
      historicalPrices: makePrices(2023, 2023, 45),
      sharesOutstanding: 1000000,
      forwardEPS: null,
      currentPrice: 50,
    });

    const projected = result.chartData.filter((d) => d.projectedFairOrange != null);
    expect(projected.length).toBe(0);
  });

  it('bridges last historical point with projected keys', () => {
    const result = calculateFairValueSeries({
      fundamentals: [makeFundamental(2023, 3.0)],
      historicalPrices: makePrices(2023, 2023, 45),
      sharesOutstanding: 1000000,
      forwardEPS: 3.5,
      currentPrice: 50,
    });

    // Find last point that has both historical and projected values
    const bridge = result.chartData.find(
      (d) => d.fairValueOrange != null && d.projectedFairOrange != null && d.actualPrice != null
    );
    expect(bridge).toBeDefined();
    expect(bridge.projectedFairOrange).toBe(bridge.fairValueOrange);
    expect(bridge.projectedFairBlue).toBe(bridge.fairValueBlue);
  });

  it('adds projectedEps only at December months', () => {
    const result = calculateFairValueSeries({
      fundamentals: [makeFundamental(2023, 3.0)],
      historicalPrices: makePrices(2023, 2023, 45),
      sharesOutstanding: 1000000,
      forwardEPS: 3.5,
      currentPrice: 50,
    });

    const withProjectedEps = result.chartData.filter((d) => d.projectedEps != null);
    expect(withProjectedEps.length).toBeGreaterThan(0);
    for (const point of withProjectedEps) {
      expect(point.date.endsWith('-12')).toBe(true);
    }
  });
});
