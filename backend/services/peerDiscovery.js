import Anthropic from '@anthropic-ai/sdk';
import { getRecommendedPeers, getQuoteBatch, getFinancialData } from './yahooFinance.js';
import { KNOWN_TICKERS } from '../utils/etfClassifier.js';

const PEER_TIMEOUT_MS = 12000;
const MIN_SAME_SECTOR_PEERS = 3;

function findETFPeers(symbol) {
  const upper = symbol.toUpperCase();
  for (const [, tickers] of Object.entries(KNOWN_TICKERS)) {
    if (tickers.has(upper)) {
      return [...tickers].filter((t) => t !== upper).slice(0, 5);
    }
  }
  return [];
}

async function askClaudeForPeers(symbol, industry, marketCap) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const fmtCap = marketCap ? `$${(marketCap / 1e9).toFixed(0)}B` : 'unknown';
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    temperature: 0,
    messages: [{
      role: 'user',
      content: `List 5 publicly traded peer companies for ${symbol} (${industry}, market cap ~${fmtCap}). Same industry, similar size when possible. Return ONLY a JSON array of ticker symbols, e.g. ["NEE","DUK","SO","AEP","D"]. No explanation.`,
    }],
  });
  let text = response.content[0].text.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  const tickers = JSON.parse(text);
  return tickers.filter((t) => t.toUpperCase() !== symbol.toUpperCase()).slice(0, 5);
}

export async function discoverPeers(symbol, profile) {
  const upper = symbol.toUpperCase();

  // Priority 1: curated peers from profile
  if (profile?.peers?.length) {
    return { symbols: profile.peers.filter((p) => p.toUpperCase() !== upper).slice(0, 5), source: 'profile' };
  }

  // Priority 2: ETF classifier (for ETFs, Yahoo recs are unreliable)
  const etfPeers = findETFPeers(upper);
  if (etfPeers.length > 0) {
    return { symbols: etfPeers, source: 'etf-classifier' };
  }

  // Priority 3: Yahoo recs (will be sector-filtered in buildPeerComparison)
  const recs = await getRecommendedPeers(upper);
  const yahooPeers = recs
    .filter((r) => r.symbol.toUpperCase() !== upper)
    .map((r) => r.symbol);

  if (yahooPeers.length > 0) {
    return { symbols: yahooPeers, source: 'yahoo' };
  }

  return { symbols: [], source: 'none' };
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

async function fetchPeerData(peerSymbols) {
  const [quotes, financialsResults] = await Promise.all([
    getQuoteBatch(peerSymbols),
    Promise.allSettled(peerSymbols.map((s) => getFinancialData(s))),
  ]);

  const financialsMap = {};
  peerSymbols.forEach((s, i) => {
    if (financialsResults[i].status === 'fulfilled') {
      financialsMap[s] = financialsResults[i].value;
    }
  });

  const quoteArray = Array.isArray(quotes) ? quotes : [quotes];
  const peers = quoteArray.map((q) => buildMetricRow(q, financialsMap[q.symbol]));

  return { peers, financialsMap };
}

export async function buildPeerComparison(symbol, stockData, profile) {
  const timeout = setTimeout(() => {}, PEER_TIMEOUT_MS);

  try {
    const targetSector = stockData.summaryProfile?.sector || null;
    const targetIndustry = stockData.summaryProfile?.industry || '';
    const targetMarketCap = stockData.price?.marketCap ?? null;

    let { symbols: peerSymbols, source } = await discoverPeers(symbol, profile);
    if (peerSymbols.length === 0) return null;

    // Fetch data for discovered peers
    let { peers, financialsMap } = await fetchPeerData(peerSymbols);

    // Step 1: Filter Yahoo peers by sector
    if (source === 'yahoo' && targetSector) {
      const sameSectorPeers = peers.filter((p) =>
        financialsMap[p.symbol]?.sector === targetSector
      );

      if (sameSectorPeers.length >= MIN_SAME_SECTOR_PEERS) {
        // Enough same-sector peers from Yahoo
        peers = sameSectorPeers.slice(0, 5);
      } else {
        // Step 2: Not enough — ask Claude for better peers
        try {
          console.log(`Yahoo peers for ${symbol} had only ${sameSectorPeers.length} same-sector matches — asking Claude for peers`);
          const claudePeers = await askClaudeForPeers(symbol.toUpperCase(), targetIndustry, targetMarketCap);

          // Step 3: Fetch Yahoo data for Claude's suggestions
          const claudeData = await fetchPeerData(claudePeers);
          peers = claudeData.peers;
          Object.assign(financialsMap, claudeData.financialsMap);
          source = 'claude';
        } catch (err) {
          console.warn(`Claude peer suggestion failed for ${symbol}:`, err.message);
          // Fall back to whatever same-sector peers we had, or all Yahoo peers
          peers = sameSectorPeers.length > 0 ? sameSectorPeers : peers.slice(0, 5);
        }
      }
    }

    // Limit to 5 peers
    peers = peers.slice(0, 5);
    if (peers.length === 0) return null;

    // Build target row
    const fd = stockData.financialData || {};
    const sd = stockData.summaryDetail || {};
    const ks = stockData.defaultKeyStatistics || {};
    const p = stockData.price || {};

    const target = {
      symbol: symbol.toUpperCase(),
      name: p.shortName || p.longName || symbol,
      marketCap: p.marketCap ?? sd.totalAssets ?? null,
      trailingPE: sd.trailingPE ?? null,
      forwardPE: ks.forwardPE ?? null,
      revenueGrowth: fd.revenueGrowth ?? null,
      profitMargin: fd.profitMargins ?? null,
      debtToEquity: fd.debtToEquity ?? null,
      dividendYield: sd.dividendYield ?? sd.trailingAnnualDividendYield ?? sd.yield ?? null,
    };

    // Step 4: Compute medians from filtered peers
    const metricKeys = ['trailingPE', 'forwardPE', 'revenueGrowth', 'profitMargin', 'debtToEquity', 'dividendYield'];
    const medians = {};
    for (const key of metricKeys) {
      medians[key] = computeMedian(peers.map((p) => p[key]));
    }

    return { target, peers, medians, source };
  } finally {
    clearTimeout(timeout);
  }
}
