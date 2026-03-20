import { describe, it, expect, beforeEach } from 'vitest';
import { getStockProfile, invalidateCache, forceFallback } from './stockProfiles.js';

beforeEach(() => {
  forceFallback();
});

describe('getStockProfile', () => {
  it('returns defense profile for LMT by ticker match', async () => {
    const profile = await getStockProfile('LMT', '');
    expect(profile).not.toBeNull();
    expect(profile.matched.ticker).toBe(true);
    expect(profile.matched.industry).toBe('Aerospace & Defense');
    expect(profile.sectorPEOverride).toBe(22);
    expect(profile.fairPERange).toEqual([20, 25]);
  });

  it('returns defense profile for lowercase ticker', async () => {
    const profile = await getStockProfile('lmt', '');
    expect(profile).not.toBeNull();
    expect(profile.matched.industry).toBe('Aerospace & Defense');
  });

  it('merges ticker additionalContext into promptContext', async () => {
    const profile = await getStockProfile('LMT', '');
    expect(profile.promptContext.length).toBeGreaterThan(3);
    expect(profile.promptContext.some(c => c.includes('F-35'))).toBe(true);
    expect(profile.promptContext.some(c => c.includes('20-25x P/E'))).toBe(true);
  });

  it('returns industry profile by yahoo industry string', async () => {
    const profile = await getStockProfile('UNKNOWN_TICKER', 'Semiconductors');
    expect(profile).not.toBeNull();
    expect(profile.matched.ticker).toBe(false);
    expect(profile.matched.industry).toBe('Semiconductors');
    expect(profile.sectorPEOverride).toBe(25);
  });

  it('returns null for unrecognized ticker and industry', async () => {
    const profile = await getStockProfile('NOTREAL', 'Nonexistent Industry');
    expect(profile).toBeNull();
  });

  it('returns null for completely unknown stock', async () => {
    const profile = await getStockProfile('XYZZY', '');
    expect(profile).toBeNull();
  });

  it('includes scenario overrides for defense stocks', async () => {
    const profile = await getStockProfile('LMT', '');
    expect(profile.scenarios).toBeDefined();
    expect(profile.scenarios.bear.peMin).toBe(16);
    expect(profile.scenarios.bull.peMax).toBe(30);
  });

  it('returns ticker-only profile without additionalContext', async () => {
    const profile = await getStockProfile('LHX', '');
    expect(profile).not.toBeNull();
    expect(profile.matched.ticker).toBe(true);
    expect(profile.matched.industry).toBe('Aerospace & Defense');
    expect(profile.promptContext.some(c => c.includes('20-25x P/E'))).toBe(true);
  });

  it('returns oil & gas profile for XOM', async () => {
    const profile = await getStockProfile('XOM', '');
    expect(profile.sectorPEOverride).toBe(12);
    expect(profile.promptContext.some(c => c.includes('EV/EBITDA'))).toBe(true);
    expect(profile.promptContext.some(c => c.includes('Pioneer'))).toBe(true);
  });

  it('returns pharma profile for PFE', async () => {
    const profile = await getStockProfile('PFE', '');
    expect(profile.sectorPEOverride).toBe(18);
    expect(profile.promptContext.some(c => c.includes('pipeline'))).toBe(true);
  });

  it('returns utility profile for NEE', async () => {
    const profile = await getStockProfile('NEE', '');
    expect(profile.sectorPEOverride).toBe(17);
    expect(profile.promptContext.some(c => c.includes('regulated'))).toBe(true);
  });

  it('returns telecom profile for T', async () => {
    const profile = await getStockProfile('T', '');
    expect(profile.sectorPEOverride).toBe(14);
    expect(profile.promptContext.some(c => c.includes('ARPU'))).toBe(true);
  });

  it('returns tobacco profile for MO', async () => {
    const profile = await getStockProfile('MO', '');
    expect(profile.sectorPEOverride).toBe(15);
    expect(profile.promptContext.some(c => c.includes('Declining cigarette volumes'))).toBe(true);
  });

  it('ticker industry takes precedence over yahoo industry', async () => {
    const profile = await getStockProfile('NVDA', 'Some Other Industry');
    expect(profile.matched.industry).toBe('Semiconductors');
    expect(profile.sectorPEOverride).toBe(25);
  });

  it('returns dataOverrides with forward EPS guidance for LMT', async () => {
    const profile = await getStockProfile('LMT', '');
    expect(profile.dataOverrides).not.toBeNull();
    expect(profile.dataOverrides.forwardEPS.range).toEqual([29.35, 30.25]);
    expect(profile.dataOverrides.forwardEPS.source).toContain('FY2026');
  });

  it('returns valuationNotes for LMT', async () => {
    const profile = await getStockProfile('LMT', '');
    expect(profile.valuationNotes).not.toBeNull();
    expect(profile.valuationNotes).toContain('temporarily depressed');
    expect(profile.valuationNotes).toContain('29.35');
  });

  it('returns null dataOverrides for tickers without overrides', async () => {
    const profile = await getStockProfile('NOC', '');
    expect(profile.dataOverrides).toBeNull();
    expect(profile.valuationNotes).toBeNull();
  });

  it('returns null dataOverrides for industry-only matches', async () => {
    const profile = await getStockProfile('UNKNOWN', 'Semiconductors');
    expect(profile.dataOverrides).toBeNull();
    expect(profile.valuationNotes).toBeNull();
  });

  it('returns ABBV profile with ticker-level scenario overrides', async () => {
    const profile = await getStockProfile('ABBV', '');
    expect(profile).not.toBeNull();
    expect(profile.matched.ticker).toBe(true);
    expect(profile.matched.industry).toBe('Drug Manufacturers - General');
    expect(profile.sectorPEOverride).toBe(18);
    // Ticker scenarios should override industry scenarios
    expect(profile.scenarios.bear.peMult).toBe(0.26);
    expect(profile.scenarios.base.peMult).toBe(0.34);
    expect(profile.scenarios.bull.peMult).toBe(0.44);
    expect(profile.scenarios.bull.peMax).toBe(22);
  });

  it('returns ABBV dataOverrides and valuationNotes', async () => {
    const profile = await getStockProfile('ABBV', '');
    expect(profile.dataOverrides.forwardEPS.range).toEqual([14.37, 14.57]);
    expect(profile.dataOverrides.forwardEPS.source).toContain('FY2026');
    expect(profile.valuationNotes).toContain('Trailing EPS');
    expect(profile.valuationNotes).toContain('14.37');
  });

  it('ABBV promptContext includes both industry and ticker context', async () => {
    const profile = await getStockProfile('ABBV', '');
    // Industry context (Drug Manufacturers)
    expect(profile.promptContext.some(c => c.includes('patent cliff'))).toBe(true);
    // Ticker context (ABBV-specific)
    expect(profile.promptContext.some(c => c.includes('Humira'))).toBe(true);
    expect(profile.promptContext.some(c => c.includes('Skyrizi'))).toBe(true);
  });

  it('LMT still gets industry scenarios when ticker has no scenario overrides', async () => {
    const profile = await getStockProfile('LMT', '');
    // LMT has no ticker-level scenarios, should get Aerospace & Defense industry scenarios
    expect(profile.scenarios.bear.peMult).toBe(0.85);
    expect(profile.scenarios.bull.peMax).toBe(30);
  });

  it('returns curated peers for LMT from ticker profile', async () => {
    const profile = await getStockProfile('LMT', '');
    expect(profile.peers).toEqual(['RTX', 'NOC', 'GD', 'BA']);
  });

  it('returns null peers for tickers without curated peers', async () => {
    const profile = await getStockProfile('NOC', '');
    expect(profile.peers).toBeNull();
  });

  it('returns null peers for industry-only matches', async () => {
    const profile = await getStockProfile('UNKNOWN', 'Semiconductors');
    expect(profile.peers).toBeNull();
  });
});
