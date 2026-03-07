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
        'incomeStatementHistory',
        'earningsTrend',
        'summaryProfile',
      ],
    }),
    yahooFinance.chart(symbol, {
      period1: tenYearsAgo,
      period2: new Date(),
      interval,
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

  return {
    ...quoteSummary,
    historicalPrices,
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
