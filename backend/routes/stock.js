import { Router } from 'express';
import { getStockData, searchSymbols } from '../services/yahooFinance.js';
import { calculateFairValueSeries } from '../utils/valuation.js';

const router = Router();

router.get('/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();

  try {
    const data = await getStockData(symbol);

    const incomeStatements =
      data.incomeStatementHistory?.incomeStatementHistory || [];
    const sharesOutstanding =
      data.defaultKeyStatistics?.sharesOutstanding || null;
    const forwardEPS =
      data.defaultKeyStatistics?.forwardEps ?? null;
    const currentPrice =
      data.price?.regularMarketPrice ?? null;

    const chart = calculateFairValueSeries({
      incomeStatements,
      historicalPrices: data.historicalPrices,
      sharesOutstanding,
      forwardEPS,
      currentPrice,
    });

    res.json({
      stock: {
        price: data.price,
        summaryDetail: data.summaryDetail,
        financialData: data.financialData,
        defaultKeyStatistics: data.defaultKeyStatistics,
        earningsTrend: data.earningsTrend,
        summaryProfile: data.summaryProfile,
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
