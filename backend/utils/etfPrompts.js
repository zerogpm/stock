import { buildPeerPromptSection } from './peerPrompt.js';
import { formatMacroBlock } from './macroScore.js';

export const KNOWN_EXPENSE_RATIOS = {
  VOO: 0.03, SPY: 0.09, IVV: 0.03, VTI: 0.03, SPLG: 0.02,
  QQQ: 0.20, QQQM: 0.15, SCHD: 0.06, VYM: 0.06, SCHG: 0.04,
  VEA: 0.05, VWO: 0.08, VXUS: 0.07, VGT: 0.10, XLE: 0.09,
  ARKK: 0.75, JEPI: 0.35, JEPQ: 0.35,
};

const HISTORICAL_PE_RANGES = {
  BROAD_MARKET: {
    label: 'S&P 500 long-term average', low: 16, high: 18,
    forwardLabel: 'S&P 500 forward P/E (modern era 2010+)', forwardLow: 17, forwardHigh: 22,
  },
  GROWTH: {
    label: 'Nasdaq-100 historical average', low: 25, high: 28,
    forwardLabel: 'Nasdaq-100 forward P/E average', forwardLow: 22, forwardHigh: 28,
  },
  DIVIDEND_GROWTH: {
    label: 'Dividend-weighted index average', low: 14, high: 17,
    forwardLabel: 'Dividend index forward P/E average', forwardLow: 13, forwardHigh: 16,
  },
  INTERNATIONAL: {
    label: 'MSCI EAFE historical average', low: 13, high: 16,
    forwardLabel: 'MSCI EAFE forward P/E average', forwardLow: 12, forwardHigh: 15,
  },
};

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

function formatNewsBlock(news) {
  if (!news || news.length === 0) return 'No recent news available.';
  const headlines = news
    .slice(0, 5)
    .map((n, i) => `${i + 1}. ${n.title} (${n.publisher})`)
    .join('\n');
  return `${headlines}

**MANDATORY:** You MUST cite at least one headline above by name in your summary or analysis_sections. If a headline contradicts your verdict, address it and explain why your verdict still holds.`;
}

function formatDividendTable(dividendInfo) {
  if (!dividendInfo?.annualDividends?.length) return '';
  const rows = dividendInfo.annualDividends.map((d, i, arr) => {
    const change =
      i === 0
        ? '—'
        : `${((d.total / arr[i - 1].total - 1) * 100).toFixed(1)}%`;
    return `| ${d.year} | $${d.total.toFixed(4)} | ${change} |`;
  });
  return (
    '\n## Dividend History\n| Year | Annual Dividend | YoY Change |\n|------|----------------|------------|\n' +
    rows.join('\n') +
    '\n'
  );
}

export function formatDataBlock(stock, dividendInfo, etfType) {
  const p = stock.price || {};
  const sd = stock.summaryDetail || {};
  const sp = stock.summaryProfile || {};
  const ks = stock.defaultKeyStatistics || {};
  const fp = stock.fundProfile || {};
  const th = stock.topHoldings || {};

  const divYield =
    sd.dividendYield != null
      ? (sd.dividendYield * 100).toFixed(2) + '%'
      : sd.yield != null
        ? (sd.yield * 100).toFixed(2) + '%'
        : 'N/A';

  // Expense ratio: fundProfile > summaryDetail fallback > known ETF map
  const fpExpense = fp.feesExpensesInvestment?.annualReportExpenseRatio;
  let expenseRatio =
    fpExpense != null
      ? (fpExpense * 100).toFixed(2) + '%'
      : sd.annualReportExpenseRatio != null
        ? (sd.annualReportExpenseRatio * 100).toFixed(2) + '%'
        : 'N/A';
  if (expenseRatio === 'N/A') {
    const ticker = (p.symbol || '').toUpperCase();
    const known = KNOWN_EXPENSE_RATIOS[ticker];
    if (known != null) expenseRatio = known.toFixed(2) + '% (reference)';
  }

  // Beta and YTD: defaultKeyStatistics (not summaryDetail)
  const beta = ks.beta3Year ?? sd.beta3Year;
  const ytdReturn = ks.ytdReturn ?? sd.ytdReturn;

  // Category: fundProfile > summaryProfile
  const category = fp.categoryName || sp.category || sp.sector || 'N/A';

  let divMetrics = '';
  if (dividendInfo) {
    divMetrics = `\n- **Dividend CAGR:** ${dividendInfo.growthRate?.toFixed(2) ?? 'N/A'}%\n- **Consecutive Increase Streak:** ${dividendInfo.consecutiveIncreaseStreak ?? 0} years\n- **Dividend Grade:** ${dividendInfo.grade ?? 'N/A'}`;
  }

  const sma50 =
    p.regularMarketPrice && sd.fiftyDayAverage
      ? `$${p.regularMarketPrice.toFixed(2)} vs $${sd.fiftyDayAverage.toFixed(2)} — ` +
        (p.regularMarketPrice > sd.fiftyDayAverage ? 'Above' : 'Below') +
        ' by ' +
        Math.abs((p.regularMarketPrice / sd.fiftyDayAverage - 1) * 100).toFixed(1) + '%'
      : 'N/A';
  const sma200 =
    p.regularMarketPrice && sd.twoHundredDayAverage
      ? `$${p.regularMarketPrice.toFixed(2)} vs $${sd.twoHundredDayAverage.toFixed(2)} — ` +
        (p.regularMarketPrice > sd.twoHundredDayAverage ? 'Above' : 'Below') +
        ' by ' +
        Math.abs((p.regularMarketPrice / sd.twoHundredDayAverage - 1) * 100).toFixed(1) + '%'
      : 'N/A';

  // Top holdings
  let holdingsBlock = '';
  const holdings = th.holdings;
  if (holdings && holdings.length > 0) {
    const top = holdings.slice(0, 10);
    const totalPct = top.reduce((s, h) => s + (h.holdingPercent || 0), 0);
    const lines = top
      .map(
        (h) =>
          `  ${h.holdingName || h.symbol} (${h.symbol}): ${(h.holdingPercent * 100).toFixed(1)}%`
      )
      .join('\n');
    holdingsBlock = `\n\n## Top Holdings (${(totalPct * 100).toFixed(1)}% of fund)\n${lines}`;
  }

  // Sector weightings
  let sectorBlock = '';
  const sectors = th.sectorWeightings;
  if (sectors && sectors.length > 0) {
    const lines = sectors
      .map((s) => {
        const [name, weight] = Object.entries(s)[0];
        return { name: name.replace(/_/g, ' '), weight };
      })
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map((s) => `  ${s.name}: ${(s.weight * 100).toFixed(1)}%`)
      .join('\n');
    sectorBlock = `\n\n## Sector Weights (top 5)\n${lines}`;
  }

  return `- **Fund:** ${p.shortName || p.longName || 'Unknown'} (${p.symbol || 'N/A'})
- **Category:** ${category}
- **Fund Family:** ${fp.family || 'N/A'}
- **Current Price:** $${p.regularMarketPrice ?? 'N/A'} ${p.currency || 'USD'}
- **Net Assets:** ${sd.totalAssets ? formatLargeNumber(sd.totalAssets) : 'N/A'}
- **Expense Ratio:** ${expenseRatio}
- **Beta (3Y):** ${beta?.toFixed(2) ?? 'N/A'}
- **YTD Return:** ${ytdReturn != null ? (ytdReturn * 100).toFixed(2) + '%' : 'N/A'}
- **Trailing P/E:** ${sd.trailingPE?.toFixed(2) ?? 'N/A'}${(() => { const ref = HISTORICAL_PE_RANGES[etfType]; return ref ? `\n- **Historical Reference P/E:** ${ref.label}: ${ref.low}-${ref.high}x` : ''; })()}
- **Forward P/E:** ${(ks.forwardPE ?? sd.forwardPE)?.toFixed(2) ?? 'N/A'}${(() => { const ref = HISTORICAL_PE_RANGES[etfType]; return ref?.forwardLabel ? `\n- **Historical Forward P/E Range:** ${ref.forwardLabel}: ${ref.forwardLow}-${ref.forwardHigh}x` : ''; })()}
- **Dividend Yield:** ${divYield}
- **Dividend Rate:** $${sd.dividendRate?.toFixed(2) ?? sd.trailingAnnualDividendRate?.toFixed(2) ?? 'N/A'} per share${divMetrics}
- **52-Week High:** $${sd.fiftyTwoWeekHigh ?? 'N/A'}
- **52-Week Low:** $${sd.fiftyTwoWeekLow ?? 'N/A'}
- **50-Day Avg:** $${sd.fiftyDayAverage?.toFixed(2) ?? 'N/A'}
- **200-Day Avg:** $${sd.twoHundredDayAverage?.toFixed(2) ?? 'N/A'}
- **Price vs 50-Day SMA:** ${sma50}
- **Price vs 200-Day SMA:** ${sma200}${holdingsBlock}${sectorBlock}`;
}

const UNIVERSAL_RULES = `## Universal Rules (always apply)
- If any news headline is directly relevant to this ETF, you MUST reference it in the analysis. Do not ignore news that contradicts your conclusion.
- Never use the word "Undervalued" for a broad market or growth ETF unless the P/E is meaningfully below its own 5-year historical average.
- Never give false precision in price targets. Round to the nearest $5 for ETFs under $100, nearest $10 for ETFs over $100.
- If dividend data shows currency conversion artifacts (wild swings in USD dividends for an international fund), note this explicitly rather than treating the swings as real dividend policy changes.
- The summary must end with: "This analysis is for informational purposes only and is not financial advice."`;

function buildJSONInstruction({
  type,
  verdictValues,
  actionValues,
  sections,
  callout,
  summaryNote,
}) {
  const verdictStr = verdictValues.map((v) => `"${v}"`).join(' | ');
  const actionStr = actionValues.map((a) => `"${a}"`).join(' | ');
  const sectionsStr = sections
    .map((s) => `    { "title": "${s.title}", "content": "${s.desc}" }`)
    .join(',\n');
  const calloutStr = callout
    ? `,\n  "callout": { "title": "${callout.title}", "content": "${callout.desc}" }`
    : '';
  const summaryDesc = summaryNote
    ? `3 sentence summary. ${summaryNote}`
    : '3 sentence summary';

  return `## Confidence Calibration (MUST follow):
- **HIGH**: ONLY when data clearly supports the verdict with no conflicting signals AND macro conditions are calm. HIGH is NEVER appropriate for broad market ETFs during periods of elevated macro uncertainty (tariffs, rate uncertainty, geopolitical tensions, recession fears).
- **MEDIUM**: The default for most analyses. Use when data supports the verdict but macro conditions or valuation signals are mixed.
- **LOW**: Use when key data is missing, signals conflict, or macro conditions make any directional call unreliable.

Based on this data, provide your analysis as a JSON object with this exact structure:
{
  "etf_type": "${type}",
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "verdict": ${verdictStr},
  "action": ${actionStr},
  "summary": "${summaryDesc}",
  "news_reconciliation": "1-2 sentences citing the most relevant news headline by name and explaining its impact on your verdict",
  "analysis_sections": [
${sectionsStr}
  ],
  "risks": ["risk1", "risk2", "risk3"],
  "catalysts": ["MUST name specific events with dates — if none exist, use 'No near-term catalysts identified'"],
  "forecasts": {
    "3m": { "price_target": { "low": number, "base": number, "high": number }, "summary": "State the macro assumption behind this target" },
    "6m": { "price_target": { "low": number, "base": number, "high": number }, "summary": "State the macro assumption behind this target" },
    "12m": { "price_target": { "low": number, "base": number, "high": number }, "summary": "State the macro assumption behind this target" }
  }${calloutStr}
}

## PRE-OUTPUT VALIDATION (check before returning):
1. Is confidence HIGH? → Re-read the news headlines. If ANY headline mentions selloffs, uncertainty, tariffs, rate fears, or volatility, change confidence to MEDIUM or LOW.
2. Does any catalyst say "Fed pivot", "earnings growth", "AI tailwinds", or similar? → Replace it with a specific event or "No near-term catalysts identified".
3. Does any forecast summary lack a macro assumption? → Add one.
4. Is expense ratio mentioned in the analysis_sections? → If the data shows an expense ratio, it must appear.

Return ONLY the JSON object, no markdown code fences or other text.`;
}

// ---------------------------------------------------------------------------
// Type-specific prompt builders
// ---------------------------------------------------------------------------

function buildBroadMarketPrompt(stock, news, dividendInfo) {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a senior ETF analyst. Analyze this broad market ETF for a long-term retail investor.

## ETF Data
${formatDataBlock(stock, dividendInfo, 'BROAD_MARKET')}

## Recent News Headlines
${formatNewsBlock(news)}

Today's Date: ${today}

---

## Analysis Instructions
1. PRICE CONTEXT: Begin by stating the current price/NAV explicitly (e.g. "VOO is currently trading at $618.43"). This anchors the entire analysis for the reader.
2. VALUATION CONTEXT: Compare BOTH the trailing P/E AND forward P/E to their respective historical reference ranges provided in the data above. State all numbers explicitly (e.g. "Trailing P/E of 27x vs the long-term average of 16-18x; forward P/E of 21x vs the modern-era forward average of 17-22x"). The forward P/E is a more actionable measure because it reflects expected earnings growth. If forward P/E is within or near its historical range even while trailing P/E looks elevated, this suggests the market is expensive on a trailing basis but may be more reasonably valued on a forward basis. If forward P/E is N/A, note this and rely on trailing P/E with appropriate caveats. Also reference Shiller CAPE if it strengthens the argument.
3. MACRO CONTEXT: Identify 1-2 current macro factors (rates, tariffs, growth fears, etc.) that are directly relevant to broad market performance RIGHT NOW. You MUST reference the news headlines — explain what is happening and why it matters for this ETF.
4. FUND QUALITY: Note the expense ratio and how it compares to competitors (SPY charges 0.09%, IVV charges 0.03%). If the expense ratio data is available, this is a key selling point for index ETFs. Mention tax efficiency of the ETF structure if relevant.
5. CONCENTRATION: Reference the top holdings and sector weights from the data. Note whether the index is top-heavy (e.g. tech concentration) and what that means for risk.
6. TECHNICAL POSITION: State where price sits relative to 50-day and 200-day moving averages. Keep this to one sentence — it is secondary for a long-term product.
7. RISKS: List only risks specific to current macro conditions, not generic boilerplate. "Recession risk" is only valid if there are concrete signals.
8. CATALYSTS: Must be specific and current — cite concrete events, data releases, or policy decisions. BANNED generic catalysts: "Fed pivot", "earnings growth", "AI tailwinds", "long-term market returns". If you cannot name a specific upcoming catalyst, say there are no near-term catalysts and that is fine for a long-term holding.
9. VERDICT: Give a Buy / Hold / Avoid with a time horizon. A broad market ETF is almost never a Sell — distinguish between "good long-term entry" vs "better entry likely if you are patient."
10. PRICE FORECASTS: Each forecast MUST state the macro assumption behind it (e.g. "Base case assumes no recession and 2 rate cuts"). Do not give targets without stating what scenario produces them.

HARD CONSTRAINTS:
- Do NOT spend more than one subordinate clause on dividend yield. This is a broad market ETF, not an income product.
- If both trailing P/E and forward P/E data are available, you MUST discuss both. Do not present trailing P/E alone as the complete valuation picture.
- Broad market ETFs reflect the ENTIRE economy. During ANY period of macro uncertainty (rate changes, tariff disputes, geopolitical risk, recession fears, market selloffs referenced in news), confidence MUST be MEDIUM or LOW, never HIGH. The bar for HIGH confidence on a broad market ETF is: P/E at or below the historical average AND macro conditions clearly supportive with no active disruptions.

${UNIVERSAL_RULES}

${buildJSONInstruction({
  type: 'BROAD_MARKET',
  verdictValues: ['UNDERVALUED', 'FAIR_VALUE', 'OVERVALUED'],
  actionValues: ['BUY', 'HOLD', 'AVOID'],
  sections: [
    {
      title: 'Valuation Analysis',
      desc: '2-3 sentences comparing BOTH trailing and forward P/E to their historical reference ranges (cite all numbers). Note whether forward P/E tells a different story than trailing. Include fund quality (expense ratio). Do NOT discuss dividend yield here.',
    },
  ],
  callout: null,
  summaryNote: 'Do NOT mention dividend yield except as a minor subordinate clause — this is NOT an income product.',
})}`;
}

function buildDividendGrowthPrompt(stock, news, dividendInfo) {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a dividend-focused ETF analyst writing for income and dividend growth investors.

## ETF Data
${formatDataBlock(stock, dividendInfo, 'DIVIDEND_GROWTH')}
${formatDividendTable(dividendInfo)}
## Recent News Headlines
${formatNewsBlock(news)}

Today's Date: ${today}

---

## Analysis Instructions
1. DIVIDEND TRACK RECORD IS THE HEADLINE: Lead with the increase streak, CAGR, and whether dividend growth is accelerating or decelerating. This is what dividend growth investors care about most.
2. DECELERATION CHECK: Compare the last 2-3 years of dividend growth to the overall CAGR. If recent growth is slowing, flag it explicitly — this is a warning sign for this ETF type.
3. YIELD CONTEXT: State the current yield. Is it attractive relative to alternatives (savings accounts, bonds, other dividend ETFs)?
4. VALUATION: For a dividend ETF, valuation matters less than dividend sustainability. Focus on whether current price represents a reasonable entry for someone planning to hold 10+ years.
5. COMPETITION: If any news headlines reference a competing ETF outperforming, acknowledge it and explain what it means.
6. DO NOT lead with technical analysis — dividend growth investors are not traders.

${UNIVERSAL_RULES}

${buildJSONInstruction({
  type: 'DIVIDEND_GROWTH',
  verdictValues: ['UNDERVALUED', 'FAIR_VALUE', 'OVERVALUED'],
  actionValues: ['BUY', 'HOLD', 'AVOID'],
  sections: [
    {
      title: 'Dividend Analysis',
      desc: '3-4 sentences — the most important section for dividend growth investors',
    },
    { title: 'Valuation Analysis', desc: '2 sentences max' },
  ],
  callout: null,
})}`;
}

function buildGrowthPrompt(stock, news, dividendInfo) {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a growth equity analyst evaluating a growth-oriented ETF for an investor with a 5-10 year horizon.

## ETF Data
${formatDataBlock(stock, dividendInfo, 'GROWTH')}

## Recent News Headlines
${formatNewsBlock(news)}

Today's Date: ${today}

---

## Analysis Instructions
1. PRICE CONTEXT: Begin by stating the current price/NAV explicitly (e.g. "QQQ is currently trading at $485.20"). This anchors the entire analysis for the reader.
2. CONCENTRATION IS THE STORY: Identify the top sector or holding concentration (e.g. Magnificent 7 in QQQ). What % of the ETF is in its top 10 holdings? This is the single most important structural fact.
3. VALUATION — DUAL P/E ANALYSIS: Compare BOTH the trailing P/E AND forward P/E to their respective historical reference ranges provided in the data above. State all numbers explicitly (e.g. "Trailing P/E of 32x vs the Nasdaq-100 historical average of 25-28x; forward P/E of 26x vs the forward average of 22-28x"). The forward P/E is critical because growth ETFs often look expensive on trailing earnings while being more reasonable on forward earnings due to high earnings growth. If forward P/E is N/A, note this and rely on trailing P/E with appropriate caveats.
4. GROWTH DRIVERS: What are the 1-2 actual themes driving performance right now (AI, semiconductors, cloud, etc.)? Be specific — do not say "technology innovation" generically.
5. MACRO CONTEXT: Identify 1-2 current macro factors directly relevant to growth/tech performance RIGHT NOW (rates, tariffs, antitrust, AI capex cycle, etc.). You MUST reference the news headlines — explain what is happening and why it matters for this ETF.
6. FUND QUALITY: Note the expense ratio and how it compares to alternatives (QQQM charges 0.15%, SCHG charges 0.04%). If the expense ratio data is available, mention it.
7. TECHNICAL POSITION: State where price sits relative to 50-day and 200-day moving averages. Keep this to one sentence — it is secondary.
8. NEWS RECONCILIATION: If any headline suggests a competing ETF is a better option, or mentions tech/growth headwinds, address it directly. Do not ignore it.
9. RISKS: List only risks specific to current conditions — not generic boilerplate. "Valuation compression" is only valid if P/E is above historical range.
10. CATALYSTS: Must be specific and current — cite concrete events, data releases, or policy decisions. BANNED generic catalysts: "AI tailwinds", "earnings growth", "tech innovation". If you cannot name a specific upcoming catalyst, say there are no near-term catalysts.
11. PRICE FORECASTS: Each forecast MUST state BOTH the macro assumption AND the valuation logic behind it (e.g. "Base case assumes forward P/E normalizes to 26x on estimated index earnings, with 2 rate cuts and stable AI capex"). Do not give targets without stating what P/E multiple and earnings assumption produces them.
12. DO NOT discuss dividend yield for a growth ETF — it is irrelevant and distracts from the core analysis.

HARD CONSTRAINTS:
- If both trailing P/E and forward P/E data are available, you MUST discuss both. Do not present trailing P/E alone as the complete valuation picture.
- During ANY period of macro uncertainty (rate changes, tariff disputes, tech regulation, antitrust actions, recession fears), confidence MUST be MEDIUM or LOW, never HIGH. The bar for HIGH confidence is: forward P/E at or below the historical average range AND macro conditions clearly supportive.
- Forecasts without valuation logic (P/E multiple x earnings assumption) are NOT allowed. Every target must show its math.

${UNIVERSAL_RULES}

${buildJSONInstruction({
  type: 'GROWTH',
  verdictValues: ['UNDERVALUED', 'FAIR_VALUE', 'OVERVALUED'],
  actionValues: ['BUY', 'HOLD', 'AVOID'],
  sections: [
    {
      title: 'Concentration Analysis',
      desc: '2-3 sentences — lead section on top holdings and sector weight',
    },
    {
      title: 'Valuation Analysis',
      desc: '2-3 sentences comparing BOTH trailing and forward P/E to their historical reference ranges (cite all numbers). Note whether forward P/E tells a different story than trailing.',
    },
  ],
  callout: null,
  summaryNote: 'Do NOT mention dividend yield at all — it is irrelevant for growth ETFs.',
})}`;
}

function buildIncomePrompt(stock, news, dividendInfo) {
  const today = new Date().toISOString().slice(0, 10);
  return `You are an income ETF specialist analyzing an options-based or high-yield ETF for an investor prioritizing monthly income.

## ETF Data
${formatDataBlock(stock, dividendInfo, 'INCOME')}
${formatDividendTable(dividendInfo)}
## Recent News Headlines
${formatNewsBlock(news)}

Today's Date: ${today}

---

## Analysis Instructions
1. DISTRIBUTION MECHANICS FIRST: Explain where the yield comes from. If it is a covered call ETF (ELN, options premium), say so explicitly. Do NOT treat options premium distributions the same as qualified dividends — they are different in tax treatment and sustainability.
2. DISTRIBUTION SUSTAINABILITY: Has the monthly/annual distribution been stable, growing, or declining? Volatile distributions are a major red flag for income investors.
3. YIELD vs TOTAL RETURN TRADEOFF: Options-based ETFs cap upside. Clearly state what the investor gives up in exchange for the high yield (e.g. "In strong bull markets, JEPI will significantly underperform QQQ").
4. TAX WARNING: Flag that options premium income is typically taxed as ordinary income, not at the lower qualified dividend rate. This matters for taxable accounts.
5. WHO THIS IS FOR: End with a clear statement of which investor profile this suits (e.g. retirees needing income, not growth investors).

${UNIVERSAL_RULES}

${buildJSONInstruction({
  type: 'INCOME',
  verdictValues: ['ATTRACTIVE_YIELD', 'FAIR_YIELD', 'YIELD_TRAP'],
  actionValues: ['BUY', 'HOLD', 'AVOID'],
  sections: [
    {
      title: 'Distribution Analysis',
      desc: '3-4 sentences on yield source, sustainability, and stability — lead section',
    },
    {
      title: 'Total Return Tradeoff',
      desc: '2 sentences on upside cap vs yield',
    },
    {
      title: 'Tax Considerations',
      desc: '1-2 sentences on tax treatment of distributions',
    },
  ],
  callout: {
    title: 'Ideal Investor Profile',
    desc: '1 sentence describing who this ETF is best suited for',
  },
})}`;
}

function buildSectorPrompt(stock, news, dividendInfo) {
  const today = new Date().toISOString().slice(0, 10);
  const sp = stock.summaryProfile || {};
  const sectorName = sp.category || sp.sector || 'Unknown Sector';

  return `You are a sector rotation analyst evaluating a sector ETF for a tactical investor.

## ETF Data
${formatDataBlock(stock, dividendInfo, 'SECTOR')}

Sector: ${sectorName}

## Recent News Headlines
${formatNewsBlock(news)}

Today's Date: ${today}

---

## Analysis Instructions
1. CYCLE POSITIONING: Where is this sector in the economic cycle right now? (Early cycle, mid cycle, late cycle, recession — pick one and justify briefly.)
2. PRIMARY DRIVER: What is the #1 external factor driving this sector right now? (e.g. for XLE it is oil prices, for XLF it is interest rates, for XLV it is policy/drug pricing.)
3. RELATIVE PERFORMANCE: Is this sector outperforming or underperforming the S&P 500 YTD? This tells you if a rotation is already priced in.
4. CONCENTRATION: Who are the top 2-3 holdings and what % of the ETF do they represent? Sector ETFs can be very top-heavy.
5. TACTICAL vs CORE: State clearly — this is a tactical position, not a core long-term holding. Give guidance on when an investor should consider rotating out.

${UNIVERSAL_RULES}

${buildJSONInstruction({
  type: 'SECTOR',
  verdictValues: ['EARLY_ENTRY', 'FAIR_VALUE', 'EXTENDED'],
  actionValues: ['BUY', 'HOLD', 'ROTATE_OUT'],
  sections: [
    {
      title: 'Cycle & Driver Analysis',
      desc: '3 sentences on cycle position and primary sector driver — lead section',
    },
    {
      title: 'Concentration Analysis',
      desc: '2 sentences on top holdings and weight',
    },
  ],
  callout: {
    title: 'Exit Signal',
    desc: 'Conditions that would trigger a rotate-out recommendation',
  },
})}`;
}

function buildInternationalPrompt(stock, news, dividendInfo) {
  const today = new Date().toISOString().slice(0, 10);
  return `You are an international equity analyst evaluating a non-US ETF for a diversification-focused investor.

## ETF Data
${formatDataBlock(stock, dividendInfo, 'INTERNATIONAL')}

## Recent News Headlines
${formatNewsBlock(news)}

Today's Date: ${today}

---

## Analysis Instructions
1. CURRENCY RISK FIRST: State explicitly that this ETF carries USD/foreign currency exchange rate risk. Is the USD currently strong or weak, and how does that affect returns for a US-based investor?
2. GEOGRAPHIC CONCENTRATION: What regions or countries dominate this ETF? Political or economic risk in those regions is the primary risk.
3. VALUATION vs US: International equities have traded at a persistent discount to US equities. Is this ETF cheap vs its own history, or just cheap vs the US (which may be justified)?
4. GEOPOLITICAL FLAGS: Are there any active geopolitical risks in the major country exposures? Reference news if relevant.
5. DIVERSIFICATION VALUE: Does adding this ETF to a US-heavy portfolio actually reduce risk or add value? Be honest — if the correlation to US equities is high, the diversification benefit is limited.

${UNIVERSAL_RULES}

${buildJSONInstruction({
  type: 'INTERNATIONAL',
  verdictValues: ['UNDERVALUED', 'FAIR_VALUE', 'OVERVALUED'],
  actionValues: ['BUY', 'HOLD', 'AVOID'],
  sections: [
    {
      title: 'Currency & Geographic Analysis',
      desc: '3 sentences on currency risk and country/region concentration — lead section',
    },
    {
      title: 'Valuation vs History',
      desc: '2 sentences comparing valuation to its own history, not just vs US',
    },
  ],
  callout: {
    title: 'Diversification Verdict',
    desc: '1 sentence — is it actually worth adding to a US portfolio right now?',
  },
})}`;
}

function buildThematicPrompt(stock, news, dividendInfo) {
  const today = new Date().toISOString().slice(0, 10);
  const sp = stock.summaryProfile || {};
  const p = stock.price || {};
  const themeName =
    sp.category || p.shortName?.replace(/ETF|Fund|Trust/gi, '').trim() || 'Unknown Theme';

  return `You are a thematic ETF analyst evaluating a niche or high-conviction ETF for a risk-tolerant investor.

## ETF Data
${formatDataBlock(stock, dividendInfo, 'THEMATIC')}

Theme: ${themeName}

## Recent News Headlines
${formatNewsBlock(news)}

Today's Date: ${today}

---

## Analysis Instructions
1. THEME VIABILITY: Is the underlying theme gaining or losing momentum RIGHT NOW based on news and market signals? Be direct — some themes have peaked, others are early innings.
2. VOLATILITY WARNING: Thematic ETFs are high-risk, high-volatility instruments. State the drawdown history or volatility profile clearly. Do not present this as equivalent to a broad market ETF.
3. CONCENTRATION & LIQUIDITY: These ETFs are often small and illiquid with high expense ratios. Flag if AUM is under $1B or if expense ratio is above 0.5%.
4. HYPE vs REALITY: Is the current price driven by fundamentals or sentiment/narrative? Be honest about which is dominant.
5. POSITION SIZING GUIDANCE: This is not a core holding. Suggest it as a satellite position (5-10% of portfolio max) unless the investor has very high risk tolerance.

${UNIVERSAL_RULES}

${buildJSONInstruction({
  type: 'THEMATIC',
  verdictValues: ['EARLY_OPPORTUNITY', 'FULLY_PRICED', 'AVOID'],
  actionValues: ['SPECULATIVE_BUY', 'HOLD', 'AVOID'],
  sections: [
    {
      title: 'Theme Momentum Analysis',
      desc: '3 sentences on whether the theme is gaining or losing momentum — lead section',
    },
    {
      title: 'Volatility & Risk Profile',
      desc: '2 sentences on drawdown risk and volatility vs broad market',
    },
  ],
  callout: {
    title: 'Position Sizing',
    desc: 'Satellite position recommendation (5-10% max) unless high risk tolerance',
  },
})}`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

const PROMPT_BUILDERS = {
  BROAD_MARKET: buildBroadMarketPrompt,
  DIVIDEND_GROWTH: buildDividendGrowthPrompt,
  GROWTH: buildGrowthPrompt,
  INCOME: buildIncomePrompt,
  SECTOR: buildSectorPrompt,
  INTERNATIONAL: buildInternationalPrompt,
  THEMATIC: buildThematicPrompt,
};

export function buildETFAnalysisPrompt(etfType, stock, news, dividendInfo, peerComparison, macroData) {
  const builder = PROMPT_BUILDERS[etfType] || buildBroadMarketPrompt;
  let prompt = builder(stock, news, dividendInfo);
  if (peerComparison) {
    prompt = prompt.replace(/\n---\n/, `\n${buildPeerPromptSection(peerComparison)}\n---\n`);
  }
  if (macroData) {
    const macroBlock = formatMacroBlock(macroData, etfType);
    prompt = prompt.replace(/\n---\n/, `\n${macroBlock}\n---\n`);
  }
  return prompt;
}
