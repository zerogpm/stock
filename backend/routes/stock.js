import { Router } from 'express';
import { getStockData, searchSymbols } from '../services/yahooFinance.js';
import { calculateFairValueSeries } from '../utils/valuation.js';
import { calculateSMASeries } from '../utils/movingAverage.js';

const router = Router();

function isREIT(data) {
  const sector = data.summaryProfile?.sector || '';
  const industry = data.summaryProfile?.industry || '';
  return sector === 'Real Estate' || industry.includes('REIT');
}

async function detectETF(symbol) {
  const results = await searchSymbols(symbol);
  const match = results.find(
    (r) => r.symbol.toUpperCase() === symbol.toUpperCase()
  );
  return match?.type === 'ETF';
}

router.get('/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();

  try {
    const etf = await detectETF(symbol);

    // ETFs get weekly data upfront; stocks/REITs start with monthly
    let data = await getStockData(symbol, {
      interval: etf ? '1wk' : '1mo',
    });

    let assetType = etf ? 'etf' : 'stock';

    // Check for REIT (needs summaryProfile from the fetch)
    if (!etf && isREIT(data)) {
      assetType = 'reit';
      // Re-fetch with weekly interval for SMA
      data = await getStockData(symbol, { interval: '1wk' });
    }

    let chart;
    if (assetType === 'etf' || assetType === 'reit') {
      chart = calculateSMASeries({
        historicalPrices: data.historicalPrices,
      });
    } else {
      const incomeStatements =
        data.incomeStatementHistory?.incomeStatementHistory || [];
      const sharesOutstanding =
        data.defaultKeyStatistics?.sharesOutstanding || null;
      const forwardEPS =
        data.defaultKeyStatistics?.forwardEps ?? null;
      const currentPrice =
        data.price?.regularMarketPrice ?? null;

      chart = {
        ...calculateFairValueSeries({
          incomeStatements,
          historicalPrices: data.historicalPrices,
          sharesOutstanding,
          forwardEPS,
          currentPrice,
        }),
        chartType: 'valuation',
      };
    }

    res.json({
      stock: {
        price: data.price,
        summaryDetail: data.summaryDetail,
        financialData: data.financialData,
        defaultKeyStatistics: data.defaultKeyStatistics,
        earningsTrend: data.earningsTrend,
        summaryProfile: data.summaryProfile,
        assetType,
      },
      chart,
    });
  } catch (err) {
    console.error(`Error fetching stock ${symbol}:`, err.message);
    res.status(502).json({
      error: `Failed to fetch data for ${symbol}`,
      details: err.message,
    });
  }
});

export default router;
