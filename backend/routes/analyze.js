import { Router } from 'express';
import { getStockData, getNewsForSymbol } from '../services/yahooFinance.js';
import { calculateFairValueSeries } from '../utils/valuation.js';
import { streamAnalysis } from '../services/claude.js';

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
  return 'stock';
}

function buildREITPrompt(stock, news) {
  const p = stock.price || {};
  const fd = stock.financialData || {};
  const sd = stock.summaryDetail || {};
  const ks = stock.defaultKeyStatistics || {};
  const sp = stock.summaryProfile || {};

  const newsSection = (news || [])
    .slice(0, 5)
    .map((n, i) => `${i + 1}. ${n.title} (${n.publisher})`)
    .join('\n');

  return `You are a professional REIT analyst. Analyze the following REIT data and provide a structured assessment. Note: FFO/AFFO data is not available, so focus on the metrics provided.

## REIT Data
- **Company:** ${p.shortName || p.longName || 'Unknown'} (${p.symbol || 'N/A'})
- **Sector:** ${sp.sector || 'N/A'} | **Sub-Industry:** ${sp.industry || 'N/A'}
- **Current Price:** $${p.regularMarketPrice ?? 'N/A'} ${p.currency || 'USD'}
- **Market Cap:** ${formatLargeNumber(p.marketCap)}

## Key REIT Metrics
- **Dividend Yield:** ${pct(sd.dividendYield)}
- **Dividend Rate:** $${sd.dividendRate?.toFixed(2) ?? 'N/A'} per share
- **Payout Ratio:** ${sd.payoutRatio != null ? (sd.payoutRatio * 100).toFixed(1) + '%' : 'N/A'}
- **P/B Ratio (NAV proxy):** ${ks.priceToBook?.toFixed(2) ?? 'N/A'}
- **Debt/Equity:** ${fd.debtToEquity?.toFixed(2) ?? 'N/A'}

## Valuation Context
- **Trailing P/E:** ${sd.trailingPE?.toFixed(2) ?? 'N/A'} (note: P/E is less meaningful for REITs — FFO-based metrics are preferred but unavailable)
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

Based on this data, provide your analysis as a JSON object with this exact structure:
{
  "verdict": "UNDERVALUED" | "OVERVALUED" | "FAIR_VALUE",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "summary": "2-3 sentence overall assessment of this REIT, focusing on dividend sustainability and value",
  "valuation_analysis": "Paragraph analyzing the REIT's dividend yield attractiveness, P/B ratio relative to NAV, debt levels, payout sustainability, and technical positioning. Explain why P/E is less relevant and what the available metrics suggest.",
  "risks": ["risk1", "risk2", "risk3"],
  "catalysts": ["catalyst1", "catalyst2"],
  "forecasts": {
    "3m": {
      "price_target": { "low": number, "base": number, "high": number },
      "summary": "2-3 sentence 3-month outlook"
    },
    "6m": {
      "price_target": { "low": number, "base": number, "high": number },
      "summary": "2-3 sentence 6-month outlook"
    },
    "12m": {
      "price_target": { "low": number, "base": number, "high": number },
      "summary": "2-3 sentence 12-month outlook"
    }
  }
}

Return ONLY the JSON object, no markdown code fences or other text.`;
}

function buildETFPrompt(stock, news) {
  const p = stock.price || {};
  const sd = stock.summaryDetail || {};
  const sp = stock.summaryProfile || {};

  const newsSection = (news || [])
    .slice(0, 5)
    .map((n, i) => `${i + 1}. ${n.title} (${n.publisher})`)
    .join('\n');

  return `You are a professional ETF analyst. Analyze the following ETF data and provide a structured assessment.

## ETF Data
- **Fund:** ${p.shortName || p.longName || 'Unknown'} (${p.symbol || 'N/A'})
- **Category:** ${sp.category || sp.sector || 'N/A'}
- **Current Price:** $${p.regularMarketPrice ?? 'N/A'} ${p.currency || 'USD'}
- **52-Week High:** $${sd.fiftyTwoWeekHigh ?? 'N/A'}
- **52-Week Low:** $${sd.fiftyTwoWeekLow ?? 'N/A'}
- **50-Day Avg:** $${sd.fiftyDayAverage?.toFixed(2) ?? 'N/A'}
- **200-Day Avg:** $${sd.twoHundredDayAverage?.toFixed(2) ?? 'N/A'}

## Fund Metrics
- **Expense Ratio:** ${sd.annualReportExpenseRatio != null ? (sd.annualReportExpenseRatio * 100).toFixed(2) + '%' : (sd.expenseRatio != null ? (sd.expenseRatio * 100).toFixed(2) + '%' : 'N/A')}
- **Dividend Yield:** ${sd.dividendYield != null ? (sd.dividendYield * 100).toFixed(2) + '%' : sd.yield != null ? (sd.yield * 100).toFixed(2) + '%' : 'N/A'}
- **Net Assets:** ${sd.totalAssets ? formatLargeNumber(sd.totalAssets) : 'N/A'}
- **Beta (3Y):** ${sd.beta3Year?.toFixed(2) ?? 'N/A'}
- **YTD Return:** ${sd.ytdReturn != null ? (sd.ytdReturn * 100).toFixed(2) + '%' : 'N/A'}

## Technical Levels
- **Price vs 50-Day SMA:** ${p.regularMarketPrice && sd.fiftyDayAverage ? (p.regularMarketPrice > sd.fiftyDayAverage ? 'Above' : 'Below') + ' (' + ((p.regularMarketPrice / sd.fiftyDayAverage - 1) * 100).toFixed(1) + '%)' : 'N/A'}
- **Price vs 200-Day SMA:** ${p.regularMarketPrice && sd.twoHundredDayAverage ? (p.regularMarketPrice > sd.twoHundredDayAverage ? 'Above' : 'Below') + ' (' + ((p.regularMarketPrice / sd.twoHundredDayAverage - 1) * 100).toFixed(1) + '%)' : 'N/A'}

## Recent News Headlines
${newsSection || 'No recent news available.'}

---

Based on this data, provide your analysis as a JSON object with this exact structure:
{
  "verdict": "UNDERVALUED" | "OVERVALUED" | "FAIR_VALUE",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "summary": "2-3 sentence overall assessment of this ETF",
  "valuation_analysis": "Paragraph analyzing the ETF's current technical positioning, expense efficiency, yield, and whether it's a good entry point based on moving average levels and 52-week range",
  "risks": ["risk1", "risk2", "risk3"],
  "catalysts": ["catalyst1", "catalyst2"],
  "forecasts": {
    "3m": {
      "price_target": { "low": number, "base": number, "high": number },
      "summary": "2-3 sentence 3-month outlook"
    },
    "6m": {
      "price_target": { "low": number, "base": number, "high": number },
      "summary": "2-3 sentence 6-month outlook"
    },
    "12m": {
      "price_target": { "low": number, "base": number, "high": number },
      "summary": "2-3 sentence 12-month outlook"
    }
  }
}

Return ONLY the JSON object, no markdown code fences or other text.`;
}

function buildPrompt(stock, chart, news) {
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
- **Forward EPS Estimate:** $${ks.forwardEps?.toFixed(2) ?? 'N/A'}
- **EPS Growth Rate (CAGR):** ${chart.epsGrowthRate ?? 'N/A'}%

## Financial Health
- **Revenue Growth (YoY):** ${pct(fd.revenueGrowth)}
- **Debt/Equity:** ${fd.debtToEquity?.toFixed(2) ?? 'N/A'}
- **Free Cash Flow:** ${formatLargeNumber(fd.freeCashflow)}
- **Profit Margin:** ${pct(fd.profitMargins)}
- **Dividend Yield:** ${pct(sd.dividendYield)}

## Fair Value Assessment
- **Fair Value (15x P/E):** $${chart.currentFairValue ? (chart.annualEPS[chart.annualEPS.length - 1]?.eps * chart.fairPE_orange)?.toFixed(2) : 'N/A'}
- **Fair Value (Historical Avg P/E):** $${chart.currentFairValue?.toFixed(2) ?? 'N/A'}
- **Current Price vs Fair Value Ratio:** ${chart.verdictRatio ?? 'N/A'}x (>1 = overvalued)

## Recent News Headlines
${newsSection || 'No recent news available.'}

---

Based on this data, provide your analysis as a JSON object with this exact structure:
{
  "verdict": "UNDERVALUED" | "OVERVALUED" | "FAIR_VALUE",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "summary": "2-3 sentence overall assessment",
  "valuation_analysis": "Paragraph comparing current price to historical P/E and fair value estimates",
  "risks": ["risk1", "risk2", "risk3"],
  "catalysts": ["catalyst1", "catalyst2"],
  "forecasts": {
    "3m": {
      "price_target": { "low": number, "base": number, "high": number },
      "summary": "2-3 sentence 3-month outlook"
    },
    "6m": {
      "price_target": { "low": number, "base": number, "high": number },
      "summary": "2-3 sentence 6-month outlook"
    },
    "12m": {
      "price_target": { "low": number, "base": number, "high": number },
      "summary": "2-3 sentence 12-month outlook"
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

    const incomeStatements =
      data.incomeStatementHistory?.incomeStatementHistory || [];
    const sharesOutstanding =
      data.defaultKeyStatistics?.sharesOutstanding || null;
    const forwardEPS = data.defaultKeyStatistics?.forwardEps ?? null;
    const currentPrice = data.price?.regularMarketPrice ?? null;

    const chart = calculateFairValueSeries({
      incomeStatements,
      historicalPrices: data.historicalPrices,
      sharesOutstanding,
      forwardEPS,
      currentPrice,
    });

    const stock = {
      price: data.price,
      summaryDetail: data.summaryDetail,
      financialData: data.financialData,
      defaultKeyStatistics: data.defaultKeyStatistics,
      earningsTrend: data.earningsTrend,
      summaryProfile: data.summaryProfile,
    };

    const assetType = getAssetType({ price: data.price, summaryProfile: data.summaryProfile });
    let prompt;
    if (assetType === 'etf') {
      prompt = buildETFPrompt(stock, news);
    } else if (assetType === 'reit') {
      prompt = buildREITPrompt(stock, news);
    } else {
      prompt = buildPrompt(stock, chart, news);
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    req.on('close', () => {
      // Client disconnected — stream will end naturally
    });

    await streamAnalysis(prompt, res);
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
