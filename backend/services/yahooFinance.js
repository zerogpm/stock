import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export async function getStockData(symbol, { interval = '1mo' } = {}) {
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

  const [quoteSummary, chartResult] = await Promise.all([
    yahooFinance.quoteSummary(symbol, {
      modules: [
        'price',
        'summaryDetail',
        'financialData',
        'defaultKeyStatistics',
        'earningsTrend',
        'summaryProfile',
      ],
    }),
    yahooFinance.chart(symbol, {
      period1: tenYearsAgo,
      period2: new Date(),
      interval,
      events: 'div|split|earn',
    }),
  ]);

  const historicalPrices = (chartResult.quotes || []).map((q) => ({
    date: q.date,
    close: q.close,
    high: q.high,
    low: q.low,
    open: q.open,
    volume: q.volume,
  }));

  const dividendEvents = Object.values(chartResult.events?.dividends || {}).map((d) => ({
    date: d.date,
    amount: d.amount,
  }));

  return {
    ...quoteSummary,
    historicalPrices,
    dividendEvents,
  };
}

export async function getHistoricalEPS(symbol) {
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

  const result = await yahooFinance.fundamentalsTimeSeries(symbol, {
    period1: tenYearsAgo,
    type: 'annual',
    module: 'all',
  });

  return result;
}

export async function getREITFundamentals(symbol) {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const result = await yahooFinance.fundamentalsTimeSeries(symbol, {
    period1: twoYearsAgo,
    type: 'annual',
    module: 'all',
  });

  return result;
}

export async function getETFFundData(symbol) {
  const result = await yahooFinance.quoteSummary(symbol, {
    modules: ['fundProfile', 'topHoldings'],
  });
  return {
    fundProfile: result.fundProfile || null,
    topHoldings: result.topHoldings || null,
  };
}

export async function searchSymbols(query) {
  const result = await yahooFinance.search(query);
  return (result.quotes || []).slice(0, 5).map((q) => ({
    symbol: q.symbol,
    name: q.shortname || q.longname || '',
    exchange: q.exchange || '',
    type: q.quoteType || '',
  }));
}

export async function getNewsForSymbol(symbol) {
  const result = await yahooFinance.search(symbol, { newsCount: 10 });
  return (result.news || []).map((item) => ({
    title: item.title,
    link: item.link,
    publisher: item.publisher,
    publishedAt: item.providerPublishTime,
  }));
}
