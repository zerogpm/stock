import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Anthropic SDK
const mockResponse = {
  content: [{
    text: JSON.stringify({
      industry: {
        sectorPEOverride: 28,
        fairPERange: [22, 35],
        scenarios: {
          bear: { peMult: 0.80, peMin: 18 },
          bull: { peMult: 1.20, peMax: 40 },
        },
        promptContext: [
          'Membership-based retailers trade at premium P/E.',
          'Evaluate membership renewal rates.',
          'Same-store sales growth is a key metric.',
          'Low margins are structural, not a weakness.',
        ],
      },
      ticker: {
        additionalContext: [
          'Costco has 90%+ membership renewal rate.',
          'Kirkland brand provides pricing power.',
        ],
      },
    }),
  }],
};

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    constructor() {
      this.messages = {
        create: vi.fn().mockResolvedValue(mockResponse),
      };
    }
  }
  return { default: MockAnthropic };
});

// Mock stockProfiles functions
vi.mock('../utils/stockProfiles.js', () => ({
  getIndustryProfile: vi.fn().mockResolvedValue(null),
  putIndustryProfile: vi.fn().mockResolvedValue({}),
  putTickerProfile: vi.fn().mockResolvedValue({}),
}));

import { generateAndSaveProfile } from './profileGenerator.js';
import { getIndustryProfile, putIndustryProfile, putTickerProfile } from '../utils/stockProfiles.js';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = 'test-key';
});

describe('generateAndSaveProfile', () => {
  const stockData = {
    symbol: 'COST',
    sector: 'Consumer Defensive',
    industry: 'Discount Stores',
    shortName: 'Costco Wholesale Corporation',
    marketCap: 350e9,
    trailingPE: 50.5,
    forwardPE: 42.3,
    debtToEquity: 45.2,
    profitMargins: 0.027,
    revenueGrowth: 0.075,
    dividendYield: 0.006,
  };

  it('generates and saves both industry and ticker profiles', async () => {
    const result = await generateAndSaveProfile(stockData);

    expect(result.generated).toBe(true);
    expect(putIndustryProfile).toHaveBeenCalledWith('Discount Stores', expect.objectContaining({
      sectorPEOverride: 28,
      fairPERange: [22, 35],
    }));
    expect(putTickerProfile).toHaveBeenCalledWith('COST', expect.objectContaining({
      industry: 'Discount Stores',
      additionalContext: expect.arrayContaining([
        expect.stringContaining('membership renewal'),
      ]),
    }));
  });

  it('skips industry generation when industry profile already exists', async () => {
    getIndustryProfile.mockResolvedValueOnce({
      sectorPEOverride: 28,
      fairPERange: [22, 35],
    });

    await generateAndSaveProfile(stockData);

    expect(putIndustryProfile).not.toHaveBeenCalled();
    expect(putTickerProfile).toHaveBeenCalled();
  });

  it('returns generated: true on success', async () => {
    const result = await generateAndSaveProfile(stockData);
    expect(result).toEqual({ generated: true });
  });
});
