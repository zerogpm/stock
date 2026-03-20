import Anthropic from '@anthropic-ai/sdk';
import { putIndustryProfile, putTickerProfile, getIndustryProfile } from '../utils/stockProfiles.js';

export async function generateAndSaveProfile(stockData) {
  const {
    symbol, sector, industry, shortName, marketCap,
    trailingPE, forwardPE, debtToEquity,
    profitMargins, revenueGrowth, dividendYield,
  } = stockData;

  // Check if industry profile already exists — if so, only generate ticker
  const existingIndustry = industry ? await getIndustryProfile(industry) : null;
  const needsIndustry = !existingIndustry && !!industry;

  const prompt = buildGenerationPrompt({
    symbol, sector, industry, shortName, marketCap,
    trailingPE, forwardPE, debtToEquity,
    profitMargins, revenueGrowth, dividendYield,
    needsIndustry,
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    temperature: 0.1,
    messages: [{ role: 'user', content: prompt }],
  });

  let text = response.content[0].text.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const result = JSON.parse(text);

  // Save industry profile (don't overwrite existing)
  if (needsIndustry && result.industry) {
    await putIndustryProfile(industry, result.industry);
    console.log(`Auto-generated industry profile: ${industry}`);
  }

  // Save ticker profile
  if (result.ticker) {
    await putTickerProfile(symbol, {
      industry: industry || undefined,
      ...result.ticker,
    });
    console.log(`Auto-generated ticker profile: ${symbol}`);
  }

  return { generated: true };
}

function buildGenerationPrompt(data) {
  const {
    symbol, sector, industry, shortName, marketCap,
    trailingPE, forwardPE, debtToEquity,
    profitMargins, revenueGrowth, dividendYield,
    needsIndustry,
  } = data;

  const fmtMcap = marketCap ? `$${(marketCap / 1e9).toFixed(1)}B` : 'N/A';
  const fmtPE = (v) => v != null ? v.toFixed(2) : 'N/A';
  const fmtPct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : 'N/A';

  const industrySection = needsIndustry ? `
## 1. Industry Profile for "${industry}"
Generate an industry-level analysis profile:
- "sectorPEOverride": What P/E multiple does this industry typically trade at? Use the actual market multiple, not a theoretical value.
- "fairPERange": [low, high] — realistic P/E range for companies in this industry.
- "scenarios": Bear and bull multipliers for price target modeling:
  - "bear": { "peMult": 0.70-0.85, "peMin": floor P/E in a downturn }
  - "bull": { "peMult": 1.15-1.30, "peMax": ceiling P/E in a rally }
- "promptContext": Array of 3-4 strings. Each string is an actionable analysis rule explaining:
  - How P/E should be interpreted for this industry (if different from generic)
  - How debt/equity should be interpreted (if industry has structural debt)
  - What key metrics matter more than standard EPS/P/E
  - What makes this industry unique for valuation purposes

Rules for promptContext:
- Each entry must be specific and actionable, not generic ("tech is growing" is banned)
- Explain WHY standard metrics might be misleading
- Reference industry-specific benchmarks and ranges
` : '';

  const tickerSection = `
## ${needsIndustry ? '2' : '1'}. Ticker Profile for ${symbol}
Generate a company-specific profile:
- "additionalContext": Array of 1-3 strings with company-specific analysis rules:
  - Current business situation (major transitions, acquisitions, product cycles)
  - What makes this company different from industry peers
  - Key company-specific metrics or risks to watch
- "peers": Array of 3-5 ticker symbols of the closest publicly-traded competitors or comparables. Choose companies in the same industry with similar market cap when possible. Use standard US ticker symbols (e.g., "MSFT", "GOOGL").
`;

  const responseFormat = needsIndustry ? `{
  "industry": {
    "sectorPEOverride": <number>,
    "fairPERange": [<low>, <high>],
    "scenarios": {
      "bear": { "peMult": <number>, "peMin": <number> },
      "bull": { "peMult": <number>, "peMax": <number> }
    },
    "promptContext": ["<rule1>", "<rule2>", "<rule3>", "<rule4>"]
  },
  "ticker": {
    "additionalContext": ["<context1>", "<context2>"],
    "peers": ["<TICKER1>", "<TICKER2>", "<TICKER3>"]
  }
}` : `{
  "ticker": {
    "additionalContext": ["<context1>", "<context2>"],
    "peers": ["<TICKER1>", "<TICKER2>", "<TICKER3>"]
  }
}`;

  return `You are a financial analyst creating a stock analysis profile. Generate a profile for use in automated stock analysis.

## Stock Data
- **Company:** ${shortName || 'Unknown'} (${symbol})
- **Sector:** ${sector || 'Unknown'}
- **Industry:** ${industry || 'Unknown'}
- **Market Cap:** ${fmtMcap}
- **Trailing P/E:** ${fmtPE(trailingPE)}
- **Forward P/E:** ${fmtPE(forwardPE)}
- **Debt/Equity:** ${debtToEquity != null ? `${debtToEquity.toFixed(2)}%` : 'N/A'}
- **Profit Margin:** ${fmtPct(profitMargins)}
- **Revenue Growth:** ${fmtPct(revenueGrowth)}
- **Dividend Yield:** ${fmtPct(dividendYield)}
${industrySection}${tickerSection}
Return ONLY a JSON object in this exact format (no markdown fences):
${responseFormat}`;
}
