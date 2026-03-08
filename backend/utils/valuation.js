export const SECTOR_PE_BASELINES = {
  'Technology': 25,
  'Communication Services': 20,
  'Consumer Cyclical': 20,
  'Consumer Defensive': 20,
  'Healthcare': 18,
  'Industrials': 18,
  'Basic Materials': 15,
  'Energy': 12,
  'Financial Services': 13,
  'Utilities': 17,
  'Real Estate': 35,
};

export const DEFAULT_SECTOR_PE = 15;

export function calculateFairValueSeries({
  historicalPrices,
  sharesOutstanding,
  forwardEPS,
  currentPrice,
  fundamentals,
  sector,
  sectorPEOverride,
}) {
  // Step 1: Extract annual EPS from fundamentalsTimeSeries
  const annualEPS = (fundamentals || [])
    .map((f) => {
      const year = new Date(f.date).getFullYear();
      const eps = f.dilutedEPS ?? f.basicEPS ??
        (f.netIncome && f.dilutedAverageShares ? f.netIncome / f.dilutedAverageShares : null);
      return { year, eps };
    })
    .filter((e) => e.eps != null && e.eps > 0)
    .sort((a, b) => a.year - b.year);

  // Step 2: Compute average stock price per fiscal year
  const pricesByYear = {};
  for (const p of historicalPrices) {
    if (p.close == null) continue;
    const year = new Date(p.date).getFullYear();
    if (!pricesByYear[year]) pricesByYear[year] = [];
    pricesByYear[year].push(p.close);
  }

  const avgPriceByYear = {};
  for (const [year, prices] of Object.entries(pricesByYear)) {
    avgPriceByYear[year] = prices.reduce((a, b) => a + b, 0) / prices.length;
  }

  // Step 3: Compute historical average P/E
  const yearlyPEs = annualEPS
    .map((e) => {
      const avgPrice = avgPriceByYear[e.year];
      if (!avgPrice || e.eps <= 0) return null;
      return avgPrice / e.eps;
    })
    .filter((pe) => pe != null && pe > 0 && pe < 100);

  const rawAvgPE =
    yearlyPEs.length > 0
      ? yearlyPEs.reduce((a, b) => a + b, 0) / yearlyPEs.length
      : 15;

  const historicalAvgPE = Math.max(5, Math.min(50, rawAvgPE));

  // Step 4: Compute EPS growth rate for FastGraphs formula
  const epsValues = annualEPS.map((e) => e.eps);
  let epsGrowthRate = 0;
  if (epsValues.length >= 2) {
    const oldest = epsValues[0];
    const newest = epsValues[epsValues.length - 1];
    const years = epsValues.length - 1;
    if (oldest > 0 && years > 0) {
      epsGrowthRate = (Math.pow(newest / oldest, 1 / years) - 1) * 100;
    }
  }

  // FastGraphs: use sector baseline P/E, or growth rate if it exceeds the baseline
  const sectorBasePE = sectorPEOverride ?? SECTOR_PE_BASELINES[sector] ?? DEFAULT_SECTOR_PE;
  const fairPE_orange = epsGrowthRate >= sectorBasePE
    ? Math.max(sectorBasePE, epsGrowthRate)
    : sectorBasePE;

  // Step 5: Extrapolate EPS backward for years with price data but no EPS
  const epsByYear = {};
  for (const e of annualEPS) epsByYear[e.year] = e.eps;

  if (annualEPS.length >= 2) {
    const priceYears = Object.keys(pricesByYear).map(Number).sort((a, b) => a - b);
    const oldestEPSYear = annualEPS[0].year;
    const growthFactor = 1 + epsGrowthRate / 100;

    for (let y = oldestEPSYear - 1; y >= priceYears[0]; y--) {
      if (epsByYear[y + 1] && growthFactor > 0) {
        epsByYear[y] = epsByYear[y + 1] / growthFactor;
      }
    }
  }

  // Step 6: Build monthly chart data
  const chartData = historicalPrices
    .filter((p) => p.close != null)
    .map((p) => {
      const date = new Date(p.date);
      const year = date.getFullYear();
      const month = date.getMonth();

      // Find EPS for this period (known or extrapolated)
      const eps = epsByYear[year] ?? epsByYear[year - 1] ?? null;

      return {
        date: `${year}-${String(month + 1).padStart(2, '0')}`,
        actualPrice: round2(p.close),
        fairValueOrange: eps ? round2(eps * fairPE_orange) : null,
        fairValueBlue: eps ? round2(eps * historicalAvgPE) : null,
      };
    });

  // Step 6b: Project forward fair values using forward EPS
  if (forwardEPS && forwardEPS > 0 && chartData.length > 0) {
    const lastPoint = chartData[chartData.length - 1];
    const [lastYear, lastMonth] = lastPoint.date.split('-').map(Number);

    // Bridge: add projected keys to last historical point for seamless line connection
    lastPoint.projectedFairOrange = lastPoint.fairValueOrange;
    lastPoint.projectedFairBlue = lastPoint.fairValueBlue;

    const year1EPS = forwardEPS;
    const safeGrowth = Math.max(0, epsGrowthRate);
    const year2EPS = forwardEPS * (1 + safeGrowth / 100);

    for (let i = 1; i <= 24; i++) {
      let m = lastMonth + i;
      let y = lastYear;
      while (m > 12) { m -= 12; y += 1; }

      const projEPS = i <= 12 ? year1EPS : year2EPS;
      const dateStr = `${y}-${String(m).padStart(2, '0')}`;

      const point = {
        date: dateStr,
        actualPrice: null,
        fairValueOrange: null,
        fairValueBlue: null,
        projectedFairOrange: round2(projEPS * fairPE_orange),
        projectedFairBlue: round2(projEPS * historicalAvgPE),
      };

      if (m === 12) {
        point.projectedEps = round2(projEPS);
      }

      chartData.push(point);
    }
  }

  // Step 7: Current valuation verdict
  const latestEPS = annualEPS.length > 0 ? annualEPS[annualEPS.length - 1].eps : 1;
  const currentFairValue = latestEPS * historicalAvgPE;
  const forwardFairValue = forwardEPS ? forwardEPS * historicalAvgPE : null;
  const verdictRatio = currentPrice ? currentPrice / currentFairValue : null;

  return {
    chartData,
    annualEPS: annualEPS.map((e) => ({
      year: e.year,
      eps: round2(e.eps),
      avgPrice: avgPriceByYear[e.year] ? round2(avgPriceByYear[e.year]) : null,
      impliedPE:
        avgPriceByYear[e.year] && e.eps > 0
          ? round2(avgPriceByYear[e.year] / e.eps)
          : null,
    })),
    historicalAvgPE: round2(historicalAvgPE),
    epsGrowthRate: round2(epsGrowthRate),
    fairPE_orange: round2(fairPE_orange),
    sectorBasePE,
    currentFairValue: round2(currentFairValue),
    forwardFairValue: forwardFairValue ? round2(forwardFairValue) : null,
    verdictRatio: verdictRatio ? round2(verdictRatio) : null,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
