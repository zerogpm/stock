import { describe, it, expect } from 'vitest';
import { computeMacroScore, formatMacroBlock, MACRO_CONFIGS, SECTOR_RATE_MAP } from './macroScore.js';

// ---------------------------------------------------------------------------
// Helper to build a base input object
// ---------------------------------------------------------------------------
function base(overrides = {}) {
  return {
    etfType: 'BROAD_MARKET',
    trailingPE: 21,
    forwardPE: 19,
    dividendYield: 0.013,
    treasury10Y: 4.25,
    treasury50dma: 4.20,
    forwardGrowth: 6,
    sectorCategory: null,
    ...overrides,
  };
}

// ===========================================================================
// BROAD_MARKET
// ===========================================================================
describe('computeMacroScore — BROAD_MARKET', () => {
  it('bearish: high P/E + negative ERP + rising rates → AVOID', () => {
    const result = computeMacroScore(base({
      trailingPE: 28,       // > 24 → -2
      forwardPE: 25,        // earningsYield 4.0% - 4.5% treasury = -0.5% ERP → -2
      treasury10Y: 4.5,
      treasury50dma: 4.2,   // rising → -1
      forwardGrowth: 3,     // < 4 → -1
    }));
    expect(result.scored).toBe(true);
    expect(result.score).toBeLessThanOrEqual(-2);
    expect(result.suggestedAction).toBe('AVOID');
    expect(result.equityRiskPremium).toBeLessThan(0);
    expect(result.rateTrend).toBe('rising');
  });

  it('bullish: low P/E + positive ERP + falling rates → BUY', () => {
    const result = computeMacroScore(base({
      trailingPE: 16,       // < 18 → +2
      forwardPE: 14,        // earningsYield 7.14% - 3.5% = 3.64% ERP → +2
      treasury10Y: 3.5,
      treasury50dma: 3.7,   // falling → +1
      forwardGrowth: 10,    // > 8 → +1
    }));
    expect(result.scored).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(2);
    expect(result.suggestedAction).toBe('BUY');
    expect(result.equityRiskPremium).toBeGreaterThan(2);
    expect(result.rateTrend).toBe('falling');
  });

  it('neutral: mid-range P/E + stable rates + moderate growth → HOLD', () => {
    const result = computeMacroScore(base({
      trailingPE: 21,       // 18-24 → 0
      forwardPE: 20,        // earningsYield 5% - 4.2% = 0.8% → 0
      treasury10Y: 4.2,
      treasury50dma: 4.2,   // stable → 0
      forwardGrowth: 6,     // 4-8 → 0
    }));
    expect(result.score).toBe(0);
    expect(result.suggestedAction).toBe('HOLD');
  });

  it('missing forwardPE → skips ERP, scores other factors', () => {
    const result = computeMacroScore(base({
      trailingPE: 28,       // > 24 → -2
      forwardPE: null,
      treasury10Y: 4.5,
      treasury50dma: 4.2,   // rising → -1
      forwardGrowth: 3,     // < 4 → -1
    }));
    expect(result.earningsYield).toBeNull();
    expect(result.equityRiskPremium).toBeNull();
    expect(result.breakdown.erp).toBeUndefined();
    // Still scores P/E, rates, growth
    expect(result.score).toBeLessThanOrEqual(-2);
  });
});

// ===========================================================================
// GROWTH
// ===========================================================================
describe('computeMacroScore — GROWTH', () => {
  it('P/E of 26 does NOT penalize (threshold is 30)', () => {
    const result = computeMacroScore(base({
      etfType: 'GROWTH',
      trailingPE: 26,
    }));
    expect(result.breakdown.pe).toBe(0);
  });

  it('P/E of 32 penalizes (> 30 threshold)', () => {
    const result = computeMacroScore(base({
      etfType: 'GROWTH',
      trailingPE: 32,
    }));
    expect(result.breakdown.pe).toBe(-2);
  });

  it('P/E of 20 rewards (< 22 threshold)', () => {
    const result = computeMacroScore(base({
      etfType: 'GROWTH',
      trailingPE: 20,
    }));
    expect(result.breakdown.pe).toBe(2);
  });
});

// ===========================================================================
// DIVIDEND_GROWTH
// ===========================================================================
describe('computeMacroScore — DIVIDEND_GROWTH', () => {
  it('negative yield spread (div yield < 10Y) → penalized', () => {
    const result = computeMacroScore(base({
      etfType: 'DIVIDEND_GROWTH',
      dividendYield: 0.032,  // 3.2% vs 4.5% → spread -1.3% → -2
      treasury10Y: 4.5,
      treasury50dma: 4.5,
    }));
    expect(result.yieldSpread).toBeLessThan(-1);
    expect(result.breakdown.yieldSpread).toBe(-2);
  });

  it('positive yield spread (div yield > 10Y) → boosted', () => {
    const result = computeMacroScore(base({
      etfType: 'DIVIDEND_GROWTH',
      dividendYield: 0.055,  // 5.5% vs 3.5% → spread +2% → +2
      treasury10Y: 3.5,
      treasury50dma: 3.5,
    }));
    expect(result.yieldSpread).toBeGreaterThan(1);
    expect(result.breakdown.yieldSpread).toBe(2);
  });

  it('ERP weight is 0 — ERP does not affect score', () => {
    const withHighERP = computeMacroScore(base({
      etfType: 'DIVIDEND_GROWTH',
      forwardPE: 10,  // high earnings yield → high ERP
      treasury10Y: 3.0,
      treasury50dma: 3.0,
      dividendYield: 0.04,
    }));
    expect(withHighERP.breakdown.erp).toBeUndefined();
  });
});

// ===========================================================================
// INCOME
// ===========================================================================
describe('computeMacroScore — INCOME', () => {
  it('P/E thresholds null → P/E does not affect score', () => {
    const result = computeMacroScore(base({
      etfType: 'INCOME',
      trailingPE: 50,  // extremely high, but should not matter
    }));
    expect(result.breakdown.pe).toBeUndefined();
  });

  it('yield spread is dominant signal', () => {
    const low = computeMacroScore(base({
      etfType: 'INCOME',
      dividendYield: 0.02,  // 2% vs 5% → -3% spread → -2
      treasury10Y: 5.0,
      treasury50dma: 5.0,
    }));
    const high = computeMacroScore(base({
      etfType: 'INCOME',
      dividendYield: 0.08,  // 8% vs 3% → +5% spread → +2
      treasury10Y: 3.0,
      treasury50dma: 3.0,
    }));
    expect(low.breakdown.yieldSpread).toBe(-2);
    expect(high.breakdown.yieldSpread).toBe(2);
    expect(high.score).toBeGreaterThan(low.score);
  });
});

// ===========================================================================
// SECTOR
// ===========================================================================
describe('computeMacroScore — SECTOR', () => {
  it('financials + rising rates → positive score', () => {
    const result = computeMacroScore(base({
      etfType: 'SECTOR',
      sectorCategory: 'Financial Services',
      treasury10Y: 4.5,
      treasury50dma: 4.2,  // rising
    }));
    expect(result.rateTrend).toBe('rising');
    expect(result.breakdown.rates).toBeGreaterThan(0);
  });

  it('utilities + rising rates → negative score', () => {
    const result = computeMacroScore(base({
      etfType: 'SECTOR',
      sectorCategory: 'Utilities',
      treasury10Y: 4.5,
      treasury50dma: 4.2,  // rising
    }));
    expect(result.breakdown.rates).toBeLessThan(0);
  });

  it('unknown sector → neutral rate sensitivity', () => {
    const result = computeMacroScore(base({
      etfType: 'SECTOR',
      sectorCategory: 'Alien Technology',
      treasury10Y: 4.5,
      treasury50dma: 4.2,  // rising
    }));
    expect(result.breakdown.rates).toBe(0);
  });

  it('financials + falling rates → negative (inverted)', () => {
    const result = computeMacroScore(base({
      etfType: 'SECTOR',
      sectorCategory: 'Financial Services',
      treasury10Y: 3.5,
      treasury50dma: 3.7,  // falling
    }));
    expect(result.breakdown.rates).toBeLessThan(0);
  });
});

// ===========================================================================
// INTERNATIONAL / THEMATIC (unscored)
// ===========================================================================
describe('computeMacroScore — unscored types', () => {
  it('INTERNATIONAL: scored=false, returns context', () => {
    const result = computeMacroScore(base({ etfType: 'INTERNATIONAL' }));
    expect(result.scored).toBe(false);
    expect(result.score).toBeUndefined();
    expect(result.suggestedAction).toBeUndefined();
    expect(result.treasury10Y).toBe(4.25);
    expect(result.rateTrend).toBeDefined();
    expect(result.promptNote).toContain('USD strength');
  });

  it('THEMATIC: scored=false, returns context', () => {
    const result = computeMacroScore(base({ etfType: 'THEMATIC' }));
    expect(result.scored).toBe(false);
    expect(result.promptNote).toContain('theme momentum');
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================
describe('computeMacroScore — edge cases', () => {
  it('all inputs null → returns safe defaults', () => {
    const result = computeMacroScore({
      etfType: 'BROAD_MARKET',
      trailingPE: null,
      forwardPE: null,
      dividendYield: null,
      treasury10Y: null,
      treasury50dma: null,
      forwardGrowth: null,
      sectorCategory: null,
    });
    expect(result.scored).toBe(true);
    expect(result.score).toBe(0);
    expect(result.suggestedAction).toBe('HOLD');
    expect(result.earningsYield).toBeNull();
    expect(result.equityRiskPremium).toBeNull();
    expect(result.rateTrend).toBe('stable');
  });

  it('treasury10Y is 0 → stable trend, no crash', () => {
    const result = computeMacroScore(base({ treasury10Y: 0, treasury50dma: 0 }));
    expect(result.rateTrend).toBe('stable');
  });

  it('forwardPE is 0 → no divide-by-zero crash', () => {
    const result = computeMacroScore(base({ forwardPE: 0 }));
    expect(result.earningsYield).toBeNull();
    expect(result.equityRiskPremium).toBeNull();
  });

  it('unknown etfType → defaults to BROAD_MARKET config', () => {
    const result = computeMacroScore(base({ etfType: 'UNKNOWN_TYPE' }));
    expect(result.scored).toBe(true);
    // Should use BROAD_MARKET thresholds (24/18)
  });
});

// ===========================================================================
// formatMacroBlock
// ===========================================================================
describe('formatMacroBlock', () => {
  it('returns empty string for null macroData', () => {
    expect(formatMacroBlock(null, 'BROAD_MARKET')).toBe('');
  });

  it('scored type → includes Macro Score and Suggested Action', () => {
    const data = computeMacroScore(base());
    const block = formatMacroBlock(data, 'BROAD_MARKET');
    expect(block).toContain('Macro Score');
    expect(block).toContain('Suggested Action');
    expect(block).toContain('10Y Treasury Yield');
  });

  it('BROAD_MARKET → includes ERP explanation instruction', () => {
    const data = computeMacroScore(base());
    const block = formatMacroBlock(data, 'BROAD_MARKET');
    expect(block).toContain('equity risk premium');
  });

  it('DIVIDEND_GROWTH → includes yield spread instruction', () => {
    const data = computeMacroScore(base({ etfType: 'DIVIDEND_GROWTH' }));
    const block = formatMacroBlock(data, 'DIVIDEND_GROWTH');
    expect(block).toContain('yield spread');
    expect(block).toContain('Yield Spread vs Bonds');
  });

  it('SECTOR → includes sector rate sensitivity instruction', () => {
    const data = computeMacroScore(base({ etfType: 'SECTOR', sectorCategory: 'Financial Services' }));
    const block = formatMacroBlock(data, 'SECTOR');
    expect(block).toContain('Sector Rate Sensitivity');
    expect(block).toContain('interest rate environment');
  });

  it('INTERNATIONAL (unscored) → shows context note, not score', () => {
    const data = computeMacroScore(base({ etfType: 'INTERNATIONAL' }));
    const block = formatMacroBlock(data, 'INTERNATIONAL');
    expect(block).toContain('background context');
    expect(block).toContain('USD strength');
    expect(block).not.toContain('Macro Score');
  });

  it('THEMATIC (unscored) → shows context note', () => {
    const data = computeMacroScore(base({ etfType: 'THEMATIC' }));
    const block = formatMacroBlock(data, 'THEMATIC');
    expect(block).toContain('background context');
    expect(block).not.toContain('Macro Score');
  });

  it('negative ERP → block says bonds more attractive', () => {
    const data = computeMacroScore(base({
      forwardPE: 25,    // earningsYield = 4%
      treasury10Y: 4.5, // ERP = -0.5%
    }));
    const block = formatMacroBlock(data, 'BROAD_MARKET');
    expect(block).toContain('NEGATIVE');
    expect(block).toContain('bonds more attractive');
  });

  it('positive ERP → block says stocks offer premium', () => {
    const data = computeMacroScore(base({
      forwardPE: 14,    // earningsYield = 7.14%
      treasury10Y: 3.5, // ERP = 3.64%
    }));
    const block = formatMacroBlock(data, 'BROAD_MARKET');
    expect(block).toContain('positive');
    expect(block).toContain('stocks offer premium');
  });
});

// ===========================================================================
// Config integrity
// ===========================================================================
describe('MACRO_CONFIGS integrity', () => {
  it('all 7 ETF types have configs', () => {
    const types = ['BROAD_MARKET', 'GROWTH', 'DIVIDEND_GROWTH', 'INCOME', 'SECTOR', 'INTERNATIONAL', 'THEMATIC'];
    for (const type of types) {
      expect(MACRO_CONFIGS[type]).toBeDefined();
    }
  });

  it('scored types have required weight keys', () => {
    const scoredTypes = Object.entries(MACRO_CONFIGS).filter(([, c]) => c.scored);
    for (const [type, config] of scoredTypes) {
      expect(config).toHaveProperty('rateWeight');
    }
  });

  it('unscored types have promptNote', () => {
    const unscored = Object.entries(MACRO_CONFIGS).filter(([, c]) => !c.scored);
    for (const [type, config] of unscored) {
      expect(config.promptNote).toBeTruthy();
    }
  });
});
