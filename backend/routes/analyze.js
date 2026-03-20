import { Router } from 'express';
import { getStockData, getNewsForSymbol, getREITFundamentals, getHistoricalEPS, getETFFundData } from '../services/yahooFinance.js';
import { calculateFairValueSeries } from '../utils/valuation.js';
import { streamAnalysis } from '../services/claude.js';
import { calculateREITMetrics } from '../utils/reitMetrics.js';
import { classifyETF } from '../utils/etfClassifier.js';
import { buildETFAnalysisPrompt } from '../utils/etfPrompts.js';
import { calculateDividendGrade } from '../utils/dividendGrade.js';
import { computePriceTargets } from '../utils/priceTargets.js';
import { isBank } from '../utils/bankClassifier.js';
import { buildBankPrompt } from '../utils/bankPrompts.js';
import { computeBankPriceTargets } from '../utils/bankPriceTargets.js';
import { getStockProfile } from '../utils/stockProfiles.js';
import { generateAndSaveProfile } from '../services/profileGenerator.js';
import { buildPeerComparison } from '../services/peerDiscovery.js';

const router = Router();

function formatLargeNumber(n) {
  if (n == null) return 'N/A';
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function pct(n) {
  if (n == null) return 'N/A';
  return `${(n * 100).toFixed(2)}%`;
}

function isREIT(data) {
  const sector = data.summaryProfile?.sector || '';
  const industry = data.summaryProfile?.industry || '';
  return sector === 'Real Estate' || industry.includes('REIT');
}

function getAssetType(data) {
  if (data.price?.quoteType === 'ETF') return 'etf';
  if (isREIT(data)) return 'reit';
  if (isBank({
    sector: data.summaryProfile?.sector,
    industry: data.summaryProfile?.industry,
    ticker: data.price?.symbol,
  })) return 'bank';
  return 'stock';
}

function buildREITPrompt(stock, news, reitMetrics) {
  const p = stock.price || {};
  const fd = stock.financialData || {};
  const sd = stock.summaryDetail || {};
  const ks = stock.defaultKeyStatistics || {};
  const sp = stock.summaryProfile || {};

  const newsSection = (news || [])
    .slice(0, 5)
    .map((n, i) => `${i + 1}. ${n.title} (${n.publisher})`)
    .join('\n');

  const hasFFO = reitMetrics?.ffo != null;
  const preamble = hasFFO
    ? 'Use the FFO-based metrics (FFO payout ratio, P/FFO) for valuation and dividend sustainability — these are the correct metrics for REITs. The GAAP P/E ratio is distorted by non-cash depreciation on real estate assets and should not drive your analysis.'
    : 'CRITICAL: FFO/AFFO data is unavailable. The GAAP payout ratio and P/E are NOT valid measures for REITs due to non-cash depreciation distortions. Do NOT cite the GAAP payout ratio as evidence of dividend risk. Instead, assess dividend sustainability using dividend yield trends, debt levels, revenue growth, and free cash flow.';

  let ffoSection = '';
  if (hasFFO) {
    const pFFO = reitMetrics.ffoPerShare && p.regularMarketPrice
      ? (p.regularMarketPrice / reitMetrics.ffoPerShare).toFixed(2)
      : 'N/A';
    ffoSection = `
- **FFO (Annual):** ${formatLargeNumber(reitMetrics.ffo)}
- **FFO/Share:** $${reitMetrics.ffoPerShare?.toFixed(2) ?? 'N/A'}
- **P/FFO:** ${pFFO}
- **FFO Payout Ratio:** ${reitMetrics.ffoPayoutRatio != null ? (reitMetrics.ffoPayoutRatio * 100).toFixed(1) + '%' : 'N/A'}`;
  } else {
    ffoSection = `
- **Payout Ratio (GAAP — unreliable for REITs):** ${sd.payoutRatio != null ? (sd.payoutRatio * 100).toFixed(1) + '%' : 'N/A'}`;
  }

  const valuationInstruction = hasFFO
    ? 'Paragraph analyzing the REIT using FFO-based metrics: P/FFO relative to sector averages, FFO payout ratio for dividend sustainability, dividend yield attractiveness, P/B ratio relative to NAV, debt levels, and technical positioning.'
    : 'Paragraph analyzing the REIT\'s dividend yield attractiveness, P/B ratio relative to NAV, debt levels, free cash flow coverage, and technical positioning. Note that GAAP P/E and payout ratio are unreliable for REITs due to non-cash depreciation distortions.';

  return `You are a professional REIT analyst. Analyze the following REIT data and provide a structured assessment.

${preamble}

## REIT Data
- **Company:** ${p.shortName || p.longName || 'Unknown'} (${p.symbol || 'N/A'})
- **Sector:** ${sp.sector || 'N/A'} | **Sub-Industry:** ${sp.industry || 'N/A'}
- **Current Price:** $${p.regularMarketPrice ?? 'N/A'} ${p.currency || 'USD'}
- **Market Cap:** ${formatLargeNumber(p.marketCap)}

## Key REIT Metrics
- **Dividend Yield:** ${pct(sd.dividendYield)}
- **Dividend Rate:** $${sd.dividendRate?.toFixed(2) ?? 'N/A'} per share${ffoSection}
- **P/B Ratio (NAV proxy):** ${ks.priceToBook?.toFixed(2) ?? 'N/A'}
- **Debt/Equity:** ${fd.debtToEquity != null ? `${fd.debtToEquity.toFixed(2)}% (${(fd.debtToEquity / 100).toFixed(2)}x ratio)` : 'N/A'} (REIT sector typical range: 80-150%; below 100% is conservative)

## Valuation Context
- **Trailing P/E:** ${sd.trailingPE?.toFixed(2) ?? 'N/A'} (note: P/E is less meaningful for REITs — FFO-based metrics are preferred)
- **Forward P/E:** ${ks.forwardPE?.toFixed(2) ?? 'N/A'}
- **Revenue Growth (YoY):** ${pct(fd.revenueGrowth)}
- **Profit Margin:** ${pct(fd.profitMargins)}
- **Free Cash Flow:** ${formatLargeNumber(fd.freeCashflow)}

## Technical Levels
- **52-Week High:** $${sd.fiftyTwoWeekHigh ?? 'N/A'}
- **52-Week Low:** $${sd.fiftyTwoWeekLow ?? 'N/A'}
- **50-Day Avg:** $${sd.fiftyDayAverage?.toFixed(2) ?? 'N/A'}
- **200-Day Avg:** $${sd.twoHundredDayAverage?.toFixed(2) ?? 'N/A'}
- **Price vs 50-Day SMA:** ${p.regularMarketPrice && sd.fiftyDayAverage ? (p.regularMarketPrice > sd.fiftyDayAverage ? 'Above' : 'Below') + ' (' + ((p.regularMarketPrice / sd.fiftyDayAverage - 1) * 100).toFixed(1) + '%)' : 'N/A'}
- **Price vs 200-Day SMA:** ${p.regularMarketPrice && sd.twoHundredDayAverage ? (p.regularMarketPrice > sd.twoHundredDayAverage ? 'Above' : 'Below') + ' (' + ((p.regularMarketPrice / sd.twoHundredDayAverage - 1) * 100).toFixed(1) + '%)' : 'N/A'}

## Recent News Headlines
${newsSection || 'No recent news available.'}

---

Determine an action recommendation based on: STRONG_BUY = significantly undervalued with high conviction and strong dividend sustainability; BUY = moderately undervalued or good entry point; HOLD = fair value or mixed signals; SELL = overvalued with headwinds; STRONG_SELL = significantly overvalued with high downside risk or dividend at risk.

Based on this data, provide your analysis as a JSON object with this exact structure:
{
  "verdict": "UNDERVALUED" | "OVERVALUED" | "FAIR_VALUE",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "action": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL",
  "summary": "2-3 sentence overall assessment of this REIT, focusing on dividend sustainability and value",
  "valuation_analysis": "${valuationInstruction}",
  "risks": ["risk1", "risk2", "risk3"],
  "catalysts": ["catalyst1", "catalyst2"],
  "forecasts": {
    "3m": {
      "price_target": { "low": number, "base": number, "high": number },
      "summary": "2-3 sentence 3-month outlook. Derive targets from: technical support/resistance (52-week range, moving averages), P/FFO multiple expansion/compression scenarios, and dividend yield target ranges."
    },
    "6m": {
      "price_target": { "low": number, "base": number, "high": number },
      "summary": "2-3 sentence 6-month outlook. Base target on P/FFO reversion to sector mean. Low target on yield compression scenario. High target on multiple expansion."
    },
    "12m": {
      "price_target": { "low": number, "base": number, "high": number },
      "summary": "2-3 sentence 12-month outlook. Include total return perspective (price appreciation + yield). Ensure the low-to-high range spans at least 15-20% to reflect realistic 12-month uncertainty."
    }
  }
}

Return ONLY the JSON object, no markdown code fences or other text.`;
}

// buildETFPrompt replaced by etfClassifier + etfPrompts modules

function buildPeerPromptSection(pc) {
  const { target, peers, medians } = pc;
  const fmtVal = (v, isPct) => {
    if (v == null) return 'N/A';
    return isPct ? `${(v * 100).toFixed(1)}%` : v.toFixed(2);
  };
  const relative = (val, med, lowerIsBetter) => {
    if (val == null || med == null) return 'N/A';
    const diff = ((val - med) / med) * 100;
    if (Math.abs(diff) < 5) return 'In-line';
    if (lowerIsBetter) return diff < 0 ? 'Favorable' : 'Elevated';
    return diff > 0 ? 'Favorable' : 'Below peers';
  };

  const metrics = [
    { label: 'Trailing P/E', key: 'trailingPE', pct: false, lowerBetter: true },
    { label: 'Forward P/E', key: 'forwardPE', pct: false, lowerBetter: true },
    { label: 'Revenue Growth', key: 'revenueGrowth', pct: true, lowerBetter: false },
    { label: 'Profit Margin', key: 'profitMargin', pct: true, lowerBetter: false },
    { label: 'Debt/Equity', key: 'debtToEquity', pct: false, lowerBetter: true },
    { label: 'Dividend Yield', key: 'dividendYield', pct: true, lowerBetter: false },
  ];

  const rows = metrics.map((m) =>
    `| ${m.label} | ${fmtVal(target[m.key], m.pct)} | ${fmtVal(medians[m.key], m.pct)} | ${relative(target[m.key], medians[m.key], m.lowerBetter)} |`
  ).join('\n');

  const peerNames = peers.map((p) => `${p.symbol} (${p.name})`).join(', ');

  return `
## Peer Comparison Context
| Metric | ${target.symbol} | Peer Median | Relative |
|--------|------|-------------|----------|
${rows}

Peers: ${peerNames}

When assessing valuation, comment on how this stock's P/E and growth metrics compare to its peer group median. If trading at a premium or discount to peers, explain whether this is justified by fundamentals.
`;
}

function buildPrompt(stock, chart, news, priceTargets, profile, peerComparison) {
  const profileContext = profile?.promptContext || [];
  const dataOverrides = profile?.dataOverrides || null;
  const valuationNotes = profile?.valuationNotes || null;
  const p = stock.price || {};
  const fd = stock.financialData || {};
  const sd = stock.summaryDetail || {};
  const ks = stock.defaultKeyStatistics || {};
  const sp = stock.summaryProfile || {};
  const et = stock.earningsTrend?.trend || [];

  const newsSection = (news || [])
    .slice(0, 5)
    .map((n, i) => `${i + 1}. ${n.title} (${n.publisher})`)
    .join('\n');

  return `You are a professional stock analyst. Analyze the following stock data and provide a structured assessment.

## Company Data
- **Company:** ${p.shortName || p.longName || 'Unknown'} (${p.symbol || 'N/A'})
- **Sector:** ${sp.sector || 'N/A'} | **Industry:** ${sp.industry || 'N/A'}
- **Current Price:** $${p.regularMarketPrice ?? 'N/A'} ${p.currency || 'USD'}
- **Market Cap:** ${formatLargeNumber(p.marketCap)}

## Valuation Metrics
- **Trailing P/E:** ${sd.trailingPE?.toFixed(2) ?? 'N/A'}
- **Forward P/E:** ${ks.forwardPE?.toFixed(2) ?? 'N/A'}
- **5-Year Historical Avg P/E:** ${chart.historicalAvgPE ?? 'N/A'}
- **P/B Ratio:** ${ks.priceToBook?.toFixed(2) ?? 'N/A'}
- **PEG Ratio:** ${ks.pegRatio?.toFixed(2) ?? 'N/A'}

## Earnings
- **EPS (TTM):** $${ks.trailingEps?.toFixed(2) ?? 'N/A'}
- **Forward EPS Estimate:** $${ks.forwardEps?.toFixed(2) ?? 'N/A'}${dataOverrides?.forwardEPS ? ` (Yahoo estimate) | **Company Guidance:** $${dataOverrides.forwardEPS.range[0]}–$${dataOverrides.forwardEPS.range[1]} (${dataOverrides.forwardEPS.source})
  ⚠ Use company guidance range as primary reference when it differs from Yahoo estimate.` : ''}
- **EPS Growth Rate (CAGR):** ${chart.epsGrowthRate ?? 'N/A'}%

## Financial Health
- **Revenue Growth (YoY):** ${pct(fd.revenueGrowth)}
- **Debt/Equity:** ${fd.debtToEquity != null ? `${fd.debtToEquity.toFixed(2)}% (${(fd.debtToEquity / 100).toFixed(2)}x ratio)` : 'N/A'}
- **Free Cash Flow:** ${formatLargeNumber(fd.freeCashflow)}
- **Profit Margin:** ${pct(fd.profitMargins)}
- **Dividend Yield:** ${pct(sd.dividendYield)}
${profileContext?.length ? `
## Industry-Specific Analysis Rules
${profileContext.map(c => `- ${c}`).join('\n')}

IMPORTANT: Apply these industry-specific rules when interpreting ALL data above. These rules override generic valuation assumptions.
` : ''}
## Fair Value Assessment
- **Fair Value (${chart.fairPE_orange}x P/E — ${sp.sector || 'default'} baseline):** $${chart.currentFairValue ? (chart.annualEPS[chart.annualEPS.length - 1]?.eps * chart.fairPE_orange)?.toFixed(2) : 'N/A'}
- **Fair Value (Historical Avg P/E):** $${chart.currentFairValue?.toFixed(2) ?? 'N/A'}
- **Current Price vs Fair Value Ratio:** ${chart.verdictRatio ?? 'N/A'}x (>1 = overvalued)
${valuationNotes ? `
⚠ VALUATION NOTE: ${valuationNotes}

## Confidence Calibration
When the VALUATION NOTE above explains that trailing metrics (P/E, EPS, GAAP margins) are distorted or temporarily depressed, base your confidence assessment on ADJUSTED/FORWARD metrics (forward P/E using company guidance, adjusted operating margins) rather than the distorted GAAP figures. A stock can warrant HIGH confidence even with an extreme trailing P/E if:
1. The distortion cause is well-understood and temporary (e.g., patent cliff, one-time charges)
2. Forward-looking fundamentals (guided EPS, pipeline, revenue trajectory) are clear
3. No macro or company-specific headline risk is present in recent news
` : ''}
## Recent News Headlines
${newsSection || 'No recent news available.'}
${peerComparison ? buildPeerPromptSection(peerComparison) : ''}
${priceTargets ? `
## Computed Price Targets (server-calculated — use these exact values)
### 3-Month Targets
- Bear: $${priceTargets.scenarios['3m'].bear.targetPrice} (EPS: $${priceTargets.scenarios['3m'].bear.eps}, Growth: ${priceTargets.scenarios['3m'].bear.growthRate}%, P/E: ${priceTargets.scenarios['3m'].bear.peMultiple}x)
- Base: $${priceTargets.scenarios['3m'].base.targetPrice} (EPS: $${priceTargets.scenarios['3m'].base.eps}, Growth: ${priceTargets.scenarios['3m'].base.growthRate}%, P/E: ${priceTargets.scenarios['3m'].base.peMultiple}x)
- Bull: $${priceTargets.scenarios['3m'].bull.targetPrice} (EPS: $${priceTargets.scenarios['3m'].bull.eps}, Growth: ${priceTargets.scenarios['3m'].bull.growthRate}%, P/E: ${priceTargets.scenarios['3m'].bull.peMultiple}x)
### 6-Month Targets
- Bear: $${priceTargets.scenarios['6m'].bear.targetPrice} (EPS: $${priceTargets.scenarios['6m'].bear.eps}, Growth: ${priceTargets.scenarios['6m'].bear.growthRate}%, P/E: ${priceTargets.scenarios['6m'].bear.peMultiple}x)
- Base: $${priceTargets.scenarios['6m'].base.targetPrice} (EPS: $${priceTargets.scenarios['6m'].base.eps}, Growth: ${priceTargets.scenarios['6m'].base.growthRate}%, P/E: ${priceTargets.scenarios['6m'].base.peMultiple}x)
- Bull: $${priceTargets.scenarios['6m'].bull.targetPrice} (EPS: $${priceTargets.scenarios['6m'].bull.eps}, Growth: ${priceTargets.scenarios['6m'].bull.growthRate}%, P/E: ${priceTargets.scenarios['6m'].bull.peMultiple}x)
### 12-Month Targets
- Bear: $${priceTargets.scenarios['12m'].bear.targetPrice} (EPS: $${priceTargets.scenarios['12m'].bear.eps}, Growth: ${priceTargets.scenarios['12m'].bear.growthRate}%, P/E: ${priceTargets.scenarios['12m'].bear.peMultiple}x)
- Base: $${priceTargets.scenarios['12m'].base.targetPrice} (EPS: $${priceTargets.scenarios['12m'].base.eps}, Growth: ${priceTargets.scenarios['12m'].base.growthRate}%, P/E: ${priceTargets.scenarios['12m'].base.peMultiple}x)
- Bull: $${priceTargets.scenarios['12m'].bull.targetPrice} (EPS: $${priceTargets.scenarios['12m'].bull.eps}, Growth: ${priceTargets.scenarios['12m'].bull.growthRate}%, P/E: ${priceTargets.scenarios['12m'].bull.peMultiple}x)

PRICE TARGET RULE: You MUST use the server-calculated price targets above for low/base/high values. Bear = low, Base = base, Bull = high. Do not invent different numbers. Your job is to explain the assumptions and provide qualitative commentary.
` : ''}
---

Determine an action recommendation based on: STRONG_BUY = trading significantly below fair value with strong earnings growth; BUY = below fair value with positive catalysts; HOLD = near fair value, balanced outlook; SELL = above fair value with headwinds; STRONG_SELL = significantly overvalued with deteriorating fundamentals.

Based on this data, provide your analysis as a JSON object with this exact structure:
{
  "verdict": "UNDERVALUED" | "OVERVALUED" | "FAIR_VALUE",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "action": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL",
  "summary": "2-3 sentence overall assessment",
  "valuation_analysis": "Paragraph comparing current price to historical P/E and fair value estimates",
  "risks": ["risk1", "risk2", "risk3"],
  "catalysts": ["catalyst1", "catalyst2"],
  "forecasts": {
    "3m": {
      "price_target": { "low": ${priceTargets ? 'bear target from above' : 'number'}, "base": ${priceTargets ? 'base target from above' : 'number'}, "high": ${priceTargets ? 'bull target from above' : 'number'} },
      "summary": "2-3 sentence 3-month outlook explaining the scenario assumptions"
    },
    "6m": {
      "price_target": { "low": ${priceTargets ? 'bear target from above' : 'number'}, "base": ${priceTargets ? 'base target from above' : 'number'}, "high": ${priceTargets ? 'bull target from above' : 'number'} },
      "summary": "2-3 sentence 6-month outlook explaining the scenario assumptions"
    },
    "12m": {
      "price_target": { "low": ${priceTargets ? 'bear target from above' : 'number'}, "base": ${priceTargets ? 'base target from above' : 'number'}, "high": ${priceTargets ? 'bull target from above' : 'number'} },
      "summary": "2-3 sentence 12-month outlook explaining the scenario assumptions"
    }
  }
}

Return ONLY the JSON object, no markdown code fences or other text.`;
}

router.post('/', async (req, res) => {
  const { symbol } = req.body;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  try {
    const upperSymbol = symbol.toUpperCase();

    const [data, news] = await Promise.all([
      getStockData(upperSymbol),
      getNewsForSymbol(upperSymbol),
    ]);

    const sharesOutstanding =
      data.defaultKeyStatistics?.sharesOutstanding || null;
    const forwardEPS = data.defaultKeyStatistics?.forwardEps ?? null;
    const currentPrice = data.price?.regularMarketPrice ?? null;

    let fundamentals = null;
    try {
      fundamentals = await getHistoricalEPS(upperSymbol);
    } catch (err) {
      console.warn(`Could not fetch fundamentals for ${upperSymbol}:`, err.message);
    }

    const sector = data.summaryProfile?.sector || '';
    const industry = data.summaryProfile?.industry || '';

    const assetType = getAssetType({ price: data.price, summaryProfile: data.summaryProfile });

    let stockProfile = await getStockProfile(upperSymbol, industry);

    // Auto-generate profile for stocks that don't have one
    if (!stockProfile && assetType === 'stock') {
      // Set SSE headers early so we can send the generating event
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ generatingProfile: true, symbol: upperSymbol })}\n\n`);

      try {
        await generateAndSaveProfile({
          symbol: upperSymbol,
          sector,
          industry,
          shortName: data.price?.shortName || data.price?.longName || '',
          marketCap: data.price?.marketCap ?? null,
          trailingPE: data.summaryDetail?.trailingPE ?? null,
          forwardPE: data.defaultKeyStatistics?.forwardPE ?? null,
          debtToEquity: data.financialData?.debtToEquity ?? null,
          profitMargins: data.financialData?.profitMargins ?? null,
          revenueGrowth: data.financialData?.revenueGrowth ?? null,
          dividendYield: data.summaryDetail?.dividendYield ?? null,
        });
        stockProfile = await getStockProfile(upperSymbol, industry);
        res.write(`data: ${JSON.stringify({ profileGenerated: true })}\n\n`);
      } catch (err) {
        console.warn(`Auto-profile generation failed for ${upperSymbol}:`, err.message);
        res.write(`data: ${JSON.stringify({ profileGenerated: true })}\n\n`);
        // Continue without profile — analysis will use generic defaults
      }
    }

    // Start peer comparison fetch in parallel (stocks only)
    let peerComparisonPromise = null;
    if (assetType === 'stock') {
      peerComparisonPromise = buildPeerComparison(upperSymbol, data, stockProfile)
        .catch((err) => { console.warn(`Peer comparison failed for ${upperSymbol}:`, err.message); return null; });
    }

    const guidanceEPS = stockProfile?.dataOverrides?.forwardEPS?.range;
    const effectiveForwardEPS = guidanceEPS
      ? (guidanceEPS[0] + guidanceEPS[1]) / 2
      : forwardEPS;

    const chart = calculateFairValueSeries({
      historicalPrices: data.historicalPrices,
      sharesOutstanding,
      forwardEPS: effectiveForwardEPS,
      currentPrice,
      fundamentals,
      sector,
      sectorPEOverride: stockProfile?.sectorPEOverride ?? undefined,
    });

    const stock = {
      price: data.price,
      summaryDetail: data.summaryDetail,
      financialData: data.financialData,
      defaultKeyStatistics: data.defaultKeyStatistics,
      earningsTrend: data.earningsTrend,
      summaryProfile: data.summaryProfile,
      fundProfile: data.fundProfile,
      topHoldings: data.topHoldings,
    };

    let reitMetrics = null;
    if (assetType === 'reit') {
      try {
        const fundamentals = await getREITFundamentals(upperSymbol);
        reitMetrics = calculateREITMetrics(fundamentals);
      } catch (err) {
        console.warn(`Could not fetch REIT fundamentals for ${upperSymbol}:`, err.message);
      }
    }

    let fairValueData = null;
    if (assetType !== 'etf' && assetType !== 'reit' && chart.currentFairValue) {
      const latestEPS = chart.annualEPS?.length > 0
        ? chart.annualEPS[chart.annualEPS.length - 1].eps : null;
      fairValueData = {
        currentPrice,
        currentFairValue: chart.currentFairValue,
        forwardFairValue: chart.forwardFairValue ?? null,
        verdictRatio: chart.verdictRatio,
        historicalAvgPE: chart.historicalAvgPE,
        fairPE_orange: chart.fairPE_orange,
        orangeFairValue: latestEPS ? Math.round(latestEPS * chart.fairPE_orange * 100) / 100 : null,
        sector: sector,
      };
    }

    let priceTargets = null;
    if (assetType === 'stock') {
      priceTargets = computePriceTargets({
        currentEPS: data.defaultKeyStatistics?.trailingEps ?? null,
        forwardEPS: effectiveForwardEPS,
        epsGrowthRate: chart.epsGrowthRate,
        historicalAvgPE: chart.historicalAvgPE,
        currentPrice,
        scenarioOverrides: stockProfile?.scenarios ?? undefined,
      });
    } else if (assetType === 'bank') {
      priceTargets = computeBankPriceTargets({
        currentEPS: data.defaultKeyStatistics?.trailingEps ?? null,
        forwardEPS: data.defaultKeyStatistics?.forwardEps ?? null,
        bookValuePerShare: data.defaultKeyStatistics?.bookValue ?? null,
        currentPrice,
        historicalAvgPE: chart.historicalAvgPE,
        dividendRate: data.summaryDetail?.dividendRate ?? null,
      });
    }

    // Await peer comparison before building prompt (needed for prompt injection)
    let peerComparison = null;
    if (peerComparisonPromise) {
      peerComparison = await peerComparisonPromise;
    }

    let prompt;
    let etfType = null;
    if (assetType === 'etf') {
      try {
        const fundData = await getETFFundData(upperSymbol);
        stock.fundProfile = fundData.fundProfile;
        stock.topHoldings = fundData.topHoldings;
      } catch (err) {
        console.warn(`Could not fetch fund data for ${upperSymbol}:`, err.message);
      }

      const dividendInfo = data.dividendEvents?.length
        ? calculateDividendGrade(data.dividendEvents)
        : null;
      const sd = data.summaryDetail || {};
      etfType = classifyETF({
        ticker: upperSymbol,
        name: data.price?.shortName || data.price?.longName || '',
        dividendYield: sd.dividendYield ?? sd.yield ?? null,
        peRatio: sd.trailingPE ?? null,
        streak: dividendInfo?.consecutiveIncreaseStreak ?? 0,
      });
      prompt = buildETFAnalysisPrompt(etfType, stock, news, dividendInfo);
    } else if (assetType === 'reit') {
      prompt = buildREITPrompt(stock, news, reitMetrics);
    } else if (assetType === 'bank') {
      prompt = buildBankPrompt(stock, chart, news, priceTargets);
    } else {
      prompt = buildPrompt(stock, chart, news, priceTargets, stockProfile, peerComparison);
    }

    // Set SSE headers (may already be set if profile was auto-generated)
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
    }

    if (priceTargets) {
      res.write(`data: ${JSON.stringify({ priceTargets })}\n\n`);
    }

    if (fairValueData) {
      res.write(`data: ${JSON.stringify({ fairValue: fairValueData })}\n\n`);
    }

    if (peerComparison) {
      res.write(`data: ${JSON.stringify({ peerComparison })}\n\n`);
    }

    req.on('close', () => {
      // Client disconnected — stream will end naturally
    });

    const SYSTEM_PROMPTS = {
      BROAD_MARKET: `You are a financial analyst producing structured JSON.
NON-NEGOTIABLE RULES — violations will make the analysis useless:
1. CONFIDENCE GATE: If ANY news headline mentions uncertainty, selloffs, tariffs, rate fears, or geopolitical risk → confidence MUST be MEDIUM or LOW. HIGH is only allowed when P/E is at or below the historical reference range AND no headline suggests macro disruption.
2. CATALYST GATE: Every catalyst must name a specific event with an approximate date. If a catalyst could appear in any analysis for any stock (e.g. "Fed pivot", "earnings growth"), it is BANNED. Replace with "No near-term catalysts identified" if none are specific.
3. EXPENSE RATIO: If the data includes an expense ratio, you MUST mention it and compare to SPY (0.09%) and IVV (0.03%).
4. FORECAST GATE: Every price target must state its macro assumption (e.g. "assumes 2 rate cuts and no recession"). Targets without assumptions are not allowed.
Follow every other instruction in the user prompt exactly.`,
      GROWTH: `You are a financial analyst producing structured JSON.
NON-NEGOTIABLE RULES — violations will make the analysis useless:
1. CONFIDENCE GATE: If ANY news headline mentions tech selloffs, AI bubble concerns, rate fears, antitrust action, or macro disruption → confidence MUST be MEDIUM or LOW. HIGH is only allowed when forward P/E is at or below the historical reference range AND no headline suggests disruption.
2. VALUATION GATE: You MUST compare BOTH trailing P/E AND forward P/E to the historical reference ranges provided in the data. Do not present trailing P/E alone as the complete valuation picture.
3. FORECAST GATE: Every price target must state BOTH its macro assumption AND the valuation multiple logic (e.g. "assumes forward P/E of 25x on estimated index earnings of $X"). Targets without valuation math are not allowed.
4. CONCENTRATION GATE: You MUST quantify top-10 holding concentration percentage and name the dominant holdings by name.
Follow every other instruction in the user prompt exactly.`,
    };
    const DEFAULT_SYSTEM = 'You are a financial analyst producing structured JSON analysis. Follow every instruction in the user prompt exactly. Do not add fields or skip constraints. Be data-driven and conservative in confidence ratings.';
    const system = (assetType === 'etf' && SYSTEM_PROMPTS[etfType]) || DEFAULT_SYSTEM;
    await streamAnalysis(prompt, res, { temperature: 0.2, system });
  } catch (err) {
    console.error(`Error analyzing ${symbol}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Analysis failed', details: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

export default router;
export { formatLargeNumber, pct, isREIT, getAssetType };
