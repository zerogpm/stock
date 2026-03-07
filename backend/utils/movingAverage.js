/**
 * Calculate SMA series for ETFs using weekly price data.
 * 10-week SMA ≈ 50-day SMA, 40-week SMA ≈ 200-day SMA.
 */
export function calculateSMASeries({ historicalPrices }) {
  const prices = historicalPrices.filter((p) => p.close != null);

  const chartData = prices.map((p, i) => {
    const date = new Date(p.date);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    return {
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      actualPrice: round2(p.close),
      sma50: i >= 9 ? round2(sma(prices, i, 10)) : null,
      sma200: i >= 39 ? round2(sma(prices, i, 40)) : null,
    };
  });

  return {
    chartData,
    chartType: 'sma',
  };
}

function sma(prices, endIndex, period) {
  let sum = 0;
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    sum += prices[i].close;
  }
  return sum / period;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
