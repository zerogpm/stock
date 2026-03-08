import { Router } from 'express';
import { getStockData, searchSymbols, getHistoricalEPS, getETFFundData } from '../services/yahooFinance.js';
import { calculateFairValueSeries } from '../utils/valuation.js';
import { calculateSMASeries } from '../utils/movingAverage.js';
import { calculateDividendGrade } from '../utils/dividendGrade.js';
import { KNOWN_EXPENSE_RATIOS } from '../utils/etfPrompts.js';
import { isBank } from '../utils/bankClassifier.js';
import { getStockProfile } from '../utils/stockProfiles.js';

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
      const firstDividendEvents = data.dividendEvents;
      // Re-fetch with weekly interval for SMA
      data = await getStockData(symbol, { interval: '1wk' });
      // Preserve dividend events from the first fetch if the weekly fetch lost them
      if (!data.dividendEvents?.length && firstDividendEvents?.length) {
        data.dividendEvents = firstDividendEvents;
      }
    }

    // Check for bank (keeps monthly interval and valuation chart)
    if (!etf && assetType !== 'reit' && isBank({
      sector: data.summaryProfile?.sector,
      industry: data.summaryProfile?.industry,
      ticker: symbol,
    })) {
      assetType = 'bank';
    }

    if (etf) {
      try {
        const fundData = await getETFFundData(symbol);
        data.fundProfile = fundData.fundProfile;
        data.topHoldings = fundData.topHoldings;
      } catch (err) {
        console.warn(`Could not fetch fund data for ${symbol}:`, err.message);
      }

      // Fallback expense ratio for known ETFs when yahoo doesn't provide it
      const fpExpense = data.fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio;
      if (fpExpense == null && data.summaryDetail?.annualReportExpenseRatio == null) {
        const known = KNOWN_EXPENSE_RATIOS[symbol];
        if (known != null) {
          data.summaryDetail = data.summaryDetail || {};
          data.summaryDetail.annualReportExpenseRatio = known / 100;
        }
      }
    }

    const dividendInfo = data.dividendEvents?.length
      ? calculateDividendGrade(data.dividendEvents)
      : null;

    let chart;
    if (assetType === 'etf' || assetType === 'reit') {
      chart = calculateSMASeries({
        historicalPrices: data.historicalPrices,
      });
    } else {
      const sharesOutstanding =
        data.defaultKeyStatistics?.sharesOutstanding || null;
      const forwardEPS =
        data.defaultKeyStatistics?.forwardEps ?? null;
      const currentPrice =
        data.price?.regularMarketPrice ?? null;

      let fundamentals = null;
      try {
        fundamentals = await getHistoricalEPS(symbol);
      } catch (err) {
        console.warn(`Could not fetch fundamentals for ${symbol}:`, err.message);
      }

      const sector = data.summaryProfile?.sector || '';
      const industry = data.summaryProfile?.industry || '';
      const stockProfile = getStockProfile(symbol, industry);

      const guidanceEPS = stockProfile?.dataOverrides?.forwardEPS?.range;
      const effectiveForwardEPS = guidanceEPS
        ? (guidanceEPS[0] + guidanceEPS[1]) / 2
        : forwardEPS;

      chart = {
        ...calculateFairValueSeries({
          historicalPrices: data.historicalPrices,
          sharesOutstanding,
          forwardEPS: effectiveForwardEPS,
          currentPrice,
          fundamentals,
          sector,
          sectorPEOverride: stockProfile?.sectorPEOverride ?? undefined,
        }),
        chartType: 'valuation',
      };

      // Analyst consensus price targets
      const fd = data.financialData || {};
      if (fd.targetMeanPrice != null) {
        chart.analystTargets = {
          mean: fd.targetMeanPrice,
          high: fd.targetHighPrice ?? null,
          low: fd.targetLowPrice ?? null,
          numberOfAnalysts: fd.numberOfAnalystOpinions ?? null,
        };
      }
    }

    if (data.financialData?.debtToEquity == null) {
      const totalDebt = data.financialData?.totalDebt;
      const bv = data.defaultKeyStatistics?.bookValue;
      const shares = data.defaultKeyStatistics?.sharesOutstanding;
      if (totalDebt != null && bv && shares) {
        data.financialData = data.financialData || {};
        data.financialData.debtToEquity = (totalDebt / (bv * shares)) * 100;
      }
    }

    res.json({
      stock: {
        price: data.price,
        summaryDetail: data.summaryDetail,
        financialData: data.financialData,
        defaultKeyStatistics: data.defaultKeyStatistics,
        earningsTrend: data.earningsTrend,
        summaryProfile: data.summaryProfile,
        fundProfile: data.fundProfile,
        topHoldings: data.topHoldings,
        assetType,
      },
      chart,
      dividendInfo,
      dividendEvents: data.dividendEvents || [],
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
