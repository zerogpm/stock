import { getRecommendedPeers, getQuoteBatch, getFinancialData } from './yahooFinance.js';

const PEER_TIMEOUT_MS = 8000;

export async function discoverPeers(symbol, profile) {
  const upper = symbol.toUpperCase();

  // Priority 1: curated peers from profile
  if (profile?.peers?.length) {
    return profile.peers.filter((p) => p.toUpperCase() !== upper).slice(0, 5);
  }

  // Priority 2: Yahoo Finance algorithmic recommendations
  const recs = await getRecommendedPeers(upper);
  return recs
    .filter((r) => r.symbol.toUpperCase() !== upper)
    .slice(0, 5)
    .map((r) => r.symbol);
}

function computeMedian(values) {
  const nums = values.filter((v) => v != null && isFinite(v));
  if (nums.length === 0) return null;
  nums.sort((a, b) => a - b);
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function buildMetricRow(quote, financials) {
  return {
    symbol: quote.symbol,
    name: quote.shortName || quote.longName || quote.symbol,
    marketCap: quote.marketCap ?? null,
    trailingPE: quote.trailingPE ?? null,
    forwardPE: quote.forwardPE ?? null,
    revenueGrowth: financials?.revenueGrowth ?? null,
    profitMargin: financials?.profitMargins ?? null,
    debtToEquity: financials?.debtToEquity ?? null,
    dividendYield: quote.trailingAnnualDividendYield ?? null,
  };
}

export async function buildPeerComparison(symbol, stockData, profile) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PEER_TIMEOUT_MS);

  try {
    const peerSymbols = await discoverPeers(symbol, profile);
    if (peerSymbols.length === 0) return null;

    // Fetch quote data (batch) and financial data (parallel) simultaneously
    const [quotes, financialsResults] = await Promise.all([
      getQuoteBatch(peerSymbols),
      Promise.allSettled(peerSymbols.map((s) => getFinancialData(s))),
    ]);

    // Build financials map from settled results
    const financialsMap = {};
    peerSymbols.forEach((s, i) => {
      if (financialsResults[i].status === 'fulfilled') {
        financialsMap[s] = financialsResults[i].value;
      }
    });

    // Build peer rows
    const quoteArray = Array.isArray(quotes) ? quotes : [quotes];
    const peers = quoteArray.map((q) => buildMetricRow(q, financialsMap[q.symbol]));

    // Build target row from existing stock data
    const fd = stockData.financialData || {};
    const sd = stockData.summaryDetail || {};
    const ks = stockData.defaultKeyStatistics || {};
    const p = stockData.price || {};

    const target = {
      symbol: symbol.toUpperCase(),
      name: p.shortName || p.longName || symbol,
      marketCap: p.marketCap ?? null,
      trailingPE: sd.trailingPE ?? null,
      forwardPE: ks.forwardPE ?? null,
      revenueGrowth: fd.revenueGrowth ?? null,
      profitMargin: fd.profitMargins ?? null,
      debtToEquity: fd.debtToEquity ?? null,
      dividendYield: sd.dividendYield ?? null,
    };

    // Compute medians across peers only (not including target)
    const metricKeys = ['trailingPE', 'forwardPE', 'revenueGrowth', 'profitMargin', 'debtToEquity', 'dividendYield'];
    const medians = {};
    for (const key of metricKeys) {
      medians[key] = computeMedian(peers.map((p) => p[key]));
    }

    const source = profile?.peers?.length ? 'profile' : 'yahoo';

    return { target, peers, medians, source };
  } finally {
    clearTimeout(timeout);
  }
}
