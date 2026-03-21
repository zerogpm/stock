import { formatLargeNumber, pct } from '../routes/analyze.js';
import { buildPeerPromptSection } from './peerPrompt.js';

export function buildBankPrompt(stock, chart, news, bankTargets, peerComparison) {
  const p = stock.price || {};
  const fd = stock.financialData || {};
  const sd = stock.summaryDetail || {};
  const ks = stock.defaultKeyStatistics || {};
  const sp = stock.summaryProfile || {};

  const newsSection = (news || [])
    .slice(0, 5)
    .map((n, i) => `${i + 1}. ${n.title} (${n.publisher})`)
    .join('\n');

  const bookValue = ks.bookValue ?? null;
  const roe = fd.returnOnEquity;

  let fairValueSection = '';
  let targetsSection = '';

  if (bankTargets) {
    const hasDDM = bankTargets.fairValue.ddmModel != null;
    const modelLabel = hasDDM ? 'Triple Model (P/E + P/B + DDM)' : 'Dual Model (P/E + P/B)';

    fairValueSection = `
## Computed Fair Value (${modelLabel})
- **P/E Model Fair Value:** $${bankTargets.fairValue.peModel} (Forward EPS × ${bankTargets.normalRanges.pe.low}–${bankTargets.normalRanges.pe.high} normal P/E range)
- **P/B Model Fair Value:** $${bankTargets.fairValue.pbModel} (Book Value × ${bankTargets.normalRanges.pb.low}–${bankTargets.normalRanges.pb.high} normal P/B range)${hasDDM ? `
- **DDM Fair Value:** $${bankTargets.fairValue.ddmModel} (Dividend $${bankTargets.inputs.dividendRate}/share ÷ (${(bankTargets.ddmParams.requiredReturn * 100)}% required return − ${(bankTargets.ddmParams.dividendGrowth * 100)}% growth))` : ''}
- **Blended Fair Value:** $${bankTargets.fairValue.blended} (average of ${hasDDM ? 'P/E, P/B, and DDM models' : 'P/E and P/B models'})
- **Current Price vs Fair Value:** ${p.regularMarketPrice != null ? `$${p.regularMarketPrice} (${((p.regularMarketPrice / bankTargets.fairValue.blended - 1) * 100).toFixed(1)}% ${p.regularMarketPrice > bankTargets.fairValue.blended ? 'above' : 'below'} fair value)` : 'N/A'}`;

    const s = bankTargets.scenarios['12m'];
    const ddmNote = hasDDM ? `, DDM=$${s.bear.ddmFairPrice}` : '';
    targetsSection = `
## Computed Scenario Targets (server-calculated — use these exact values)
### Bear Case (Recession): P/E=${s.bear.peMultiple}, P/B=${s.bear.pbMultiple}
- PE: $${s.bear.peFairPrice} | PB: $${s.bear.pbFairPrice}${ddmNote} | **Blended: $${s.bear.targetPrice}**
### Base Case (Stable Economy): P/E=${s.base.peMultiple}, P/B=${s.base.pbMultiple}
- PE: $${s.base.peFairPrice} | PB: $${s.base.pbFairPrice}${hasDDM ? `, DDM=$${s.base.ddmFairPrice}` : ''} | **Blended: $${s.base.targetPrice}**
### Bull Case (Strong Credit Growth): P/E=${s.bull.peMultiple}, P/B=${s.bull.pbMultiple}
- PE: $${s.bull.peFairPrice} | PB: $${s.bull.pbFairPrice}${hasDDM ? `, DDM=$${s.bull.ddmFairPrice}` : ''} | **Blended: $${s.bull.targetPrice}**

PRICE TARGET RULE: You MUST use the server-calculated blended targets above for low/base/high values. Bear = low, Base = base, Bull = high. Use these same values for all three forecast horizons (3m, 6m, 12m). Do not invent different numbers. Your job is to explain the assumptions and provide qualitative commentary.`;
  }

  return `You are a professional banking sector equity research analyst. Analyze the following bank stock data and provide a structured assessment.

IMPORTANT: Do NOT compare this bank's valuation to S&P 500 levels. Banking sector multiples are structurally lower than the broad market. Use banking-specific valuation ranges only.

## Company Data
- **Company:** ${p.shortName || p.longName || 'Unknown'} (${p.symbol || 'N/A'})
- **Sector:** ${sp.sector || 'N/A'} | **Industry:** ${sp.industry || 'N/A'}
- **Current Price:** $${p.regularMarketPrice ?? 'N/A'} ${p.currency || 'USD'}
- **Market Cap:** ${formatLargeNumber(p.marketCap)}

## Bank-Specific Metrics
- **EPS (TTM):** $${ks.trailingEps?.toFixed(2) ?? 'N/A'}
- **Forward EPS:** $${ks.forwardEps?.toFixed(2) ?? 'N/A'}
- **Trailing P/E:** ${sd.trailingPE?.toFixed(2) ?? 'N/A'} (banking normal range: 9–11)
- **Forward P/E:** ${ks.forwardPE?.toFixed(2) ?? 'N/A'}
- **Book Value/Share:** $${bookValue?.toFixed(2) ?? 'N/A'}
- **P/B Ratio:** ${ks.priceToBook?.toFixed(2) ?? 'N/A'} (banking normal range: 1.2–1.8)
- **Dividend Yield:** ${pct(sd.dividendYield)} (banking typical: 3–6%)
- **Dividend Rate:** $${sd.dividendRate?.toFixed(2) ?? 'N/A'} per share
- **Dividend Payout Ratio:** ${sd.payoutRatio != null ? (sd.payoutRatio * 100).toFixed(1) + '%' : 'N/A'}
- **ROE (Return on Equity):** ${pct(roe)} (benchmark: >10% is strong for banks)
- **Debt/Equity:** ${fd.debtToEquity?.toFixed(2) ?? 'N/A'}

## Valuation Context
- **5-Year Historical Avg P/E:** ${chart.historicalAvgPE ?? 'N/A'}
- **EPS Growth Rate (CAGR):** ${chart.epsGrowthRate ?? 'N/A'}%
- **Revenue Growth (YoY):** ${pct(fd.revenueGrowth)}
- **Profit Margin:** ${pct(fd.profitMargins)}
- **Free Cash Flow:** ${formatLargeNumber(fd.freeCashflow)}

## Technical Levels
- **52-Week High:** $${sd.fiftyTwoWeekHigh ?? 'N/A'}
- **52-Week Low:** $${sd.fiftyTwoWeekLow ?? 'N/A'}
- **50-Day Avg:** $${sd.fiftyDayAverage?.toFixed(2) ?? 'N/A'}
- **200-Day Avg:** $${sd.twoHundredDayAverage?.toFixed(2) ?? 'N/A'}
${fairValueSection}
${targetsSection}

## Recent News Headlines
${newsSection || 'No recent news available.'}
${peerComparison ? buildPeerPromptSection(peerComparison) : ''}
---

## Analysis Instructions

1. **Valuation**: Use THREE valuation models — P/E, P/B, and DDM (Dividend Discount Model). Compare current P/E to the 9–11 banking range, current P/B to the 1.2–1.8 range, and assess DDM fair value. Show your calculation steps.
2. **Dividend Sustainability**: Assess using payout ratio, earnings stability, and ROE. A bank with ROE consistently above 10% typically has sustainable dividends.
3. **Macro Banking Factors**: Evaluate these banking-specific factors:
   - Interest rate environment and central bank policy impact on net interest margin
   - Net interest margin trend
   - Credit loss provisions and loan quality
   - Housing market exposure
   - Capital ratios and regulatory environment
4. **Do NOT compare** valuation multiples to S&P 500 levels — banking multiples are structurally lower.

## Action Decision Rules (MUST follow — use the Current Price vs Fair Value ratio from the Computed Fair Value section above)
- price > 1.3x blended fair value AND no strong ROE/credit growth catalyst → SELL or STRONG_SELL
- price > 1.3x blended fair value AND strong ROE improvement or credit cycle recovery → HOLD is allowed, but you MUST explain what offsets the overvaluation and state the time horizon
- price 1.1–1.3x blended fair value → HOLD (moderately stretched)
- price 0.9–1.1x blended fair value → HOLD or BUY depending on credit outlook (fair value zone)
- price < 0.9x blended fair value → BUY or STRONG_BUY (undervalued)
- price < 0.7x blended fair value → STRONG_BUY if asset quality supports it

CONFLICT RULE: If your verdict and action appear contradictory (e.g., OVERVALUED + HOLD, UNDERVALUED + HOLD), you MUST include a "conflict_rationale" field (1-2 sentences) explaining what offsets the valuation signal and stating the relevant time horizon.

Based on this data, provide your analysis as a JSON object with this exact structure:
{
  "verdict": "UNDERVALUED" | "OVERVALUED" | "FAIR_VALUE",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "action": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL",
  "conflict_rationale": "REQUIRED if verdict and action conflict (e.g. OVERVALUED+HOLD). Explain what offsets valuation and state time horizon. Omit if no conflict.",
  "summary": "2-3 sentence overall assessment focusing on banking-specific valuation (P/E + P/B + DDM models), dividend sustainability, and credit outlook",
  "valuation_analysis": "Paragraph showing fair value calculation steps using all three models (P/E, P/B, DDM), comparing to banking-specific ranges, and assessing dividend sustainability based on ROE and payout ratio",
  "risks": ["banking-specific risk1", "risk2", "risk3"],
  "catalysts": ["catalyst1", "catalyst2"],
  "forecasts": {
    "3m": {
      "price_target": { "low": ${bankTargets ? `${bankTargets.scenarios['3m'].bear.targetPrice}` : 'number'}, "base": ${bankTargets ? `${bankTargets.scenarios['3m'].base.targetPrice}` : 'number'}, "high": ${bankTargets ? `${bankTargets.scenarios['3m'].bull.targetPrice}` : 'number'} },
      "summary": "2-3 sentence 3-month outlook explaining the banking scenario assumptions (credit conditions, rate environment, NIM outlook)"
    },
    "6m": {
      "price_target": { "low": ${bankTargets ? `${bankTargets.scenarios['6m'].bear.targetPrice}` : 'number'}, "base": ${bankTargets ? `${bankTargets.scenarios['6m'].base.targetPrice}` : 'number'}, "high": ${bankTargets ? `${bankTargets.scenarios['6m'].bull.targetPrice}` : 'number'} },
      "summary": "2-3 sentence 6-month outlook"
    },
    "12m": {
      "price_target": { "low": ${bankTargets ? `${bankTargets.scenarios['12m'].bear.targetPrice}` : 'number'}, "base": ${bankTargets ? `${bankTargets.scenarios['12m'].base.targetPrice}` : 'number'}, "high": ${bankTargets ? `${bankTargets.scenarios['12m'].bull.targetPrice}` : 'number'} },
      "summary": "2-3 sentence 12-month outlook including total return perspective (price appreciation + dividend yield)"
    }
  }
}

Return ONLY the JSON object, no markdown code fences or other text.`;
}
