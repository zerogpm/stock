function getCutoffDate(range) {
  const now = new Date();

  switch (range) {
    case '1M': { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); }
    case '3M': { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); }
    case '6M': { const d = new Date(now); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10); }
    case 'YTD': return `${now.getFullYear()}-01-01`;
    case '1Y': { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); }
    case '2Y': { const d = new Date(now); d.setFullYear(d.getFullYear() - 2); return d.toISOString().slice(0, 10); }
    case '5Y': { const d = new Date(now); d.setFullYear(d.getFullYear() - 5); return d.toISOString().slice(0, 10); }
    case '10Y': { const d = new Date(now); d.setFullYear(d.getFullYear() - 10); return d.toISOString().slice(0, 10); }
    case 'ALL':
    default: return null;
  }
}

export function filterByRange(data, range) {
  if (!data?.length || range === 'ALL') return data;

  const cutoff = getCutoffDate(range);
  if (!cutoff) return data;

  return data.filter((point) => {
    if (!point.date) return false;
    // Normalize comparison: match granularity of the data point's date
    const pointKey = point.date.length === 7 ? point.date : point.date.slice(0, 10);
    const cutoffKey = point.date.length === 7 ? cutoff.slice(0, 7) : cutoff;
    return pointKey >= cutoffKey;
  });
}
