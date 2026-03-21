const METRICS = [
  { key: 'marketCap', label: 'Market Cap', format: 'cap', lowerBetter: false },
  { key: 'trailingPE', label: 'P/E (TTM)', format: 'num', lowerBetter: true },
  { key: 'forwardPE', label: 'P/E (Fwd)', format: 'num', lowerBetter: true },
  { key: 'revenueGrowth', label: 'Rev Growth', format: 'pct', lowerBetter: false },
  { key: 'profitMargin', label: 'Profit Margin', format: 'pct', lowerBetter: false },
  { key: 'debtToEquity', label: 'D/E', format: 'num', lowerBetter: true },
  { key: 'dividendYield', label: 'Div Yield', format: 'pct', lowerBetter: false },
];

function formatValue(value, format) {
  if (value == null) return 'N/A';
  if (format === 'cap') {
    if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
    return `$${value.toLocaleString()}`;
  }
  if (format === 'pct') return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(2);
}

function getColor(value, median, lowerBetter, format) {
  // No color for market cap or missing values
  if (format === 'cap' || value == null || median == null) return '';
  const diff = ((value - median) / Math.abs(median)) * 100;
  if (Math.abs(diff) < 5) return '';
  const isBetter = lowerBetter ? diff < 0 : diff > 0;
  return isBetter ? 'text-green-500' : 'text-red-500';
}

// --- Takeaway generation ---

const TAKEAWAY_DEFS = [
  {
    id: 'valuation',
    // Prefer forwardPE, fall back to trailingPE
    getValues: (target, medians) => {
      const fwd = target.forwardPE != null && medians.forwardPE != null
        ? { val: target.forwardPE, med: medians.forwardPE }
        : null;
      const ttm = target.trailingPE != null && medians.trailingPE != null
        ? { val: target.trailingPE, med: medians.trailingPE }
        : null;
      return fwd || ttm;
    },
    lowerBetter: true,
    higherWord: 'more expensive',
    lowerWord: 'cheaper',
    neutralWord: 'priced similarly to',
    context: 'similar companies',
    skipFor: ['reit'],
  },
  {
    id: 'growth',
    getValues: (target, medians) =>
      target.revenueGrowth != null && medians.revenueGrowth != null
        ? { val: target.revenueGrowth, med: medians.revenueGrowth }
        : null,
    lowerBetter: false,
    higherWord: 'growing faster',
    lowerWord: 'growing slower',
    neutralWord: 'growing at a similar pace to',
    context: 'peers',
    skipFor: [],
  },
  {
    id: 'dividend',
    getValues: (target, medians) =>
      target.dividendYield != null && medians.dividendYield != null
        ? { val: target.dividendYield, med: medians.dividendYield }
        : null,
    lowerBetter: false,
    higherWord: 'pays more dividends',
    lowerWord: 'pays less in dividends',
    neutralWord: 'pays about the same dividends as',
    context: 'peers',
    skipFor: [],
  },
  {
    id: 'debt',
    getValues: (target, medians) =>
      target.debtToEquity != null && medians.debtToEquity != null
        ? { val: target.debtToEquity, med: medians.debtToEquity }
        : null,
    lowerBetter: true,
    higherWord: 'carries more debt',
    lowerWord: 'carries less debt',
    neutralWord: 'has similar debt levels to',
    context: 'peers',
    skipFor: [],
  },
];

function getMagnitude(pctDiff) {
  const abs = Math.abs(pctDiff);
  if (abs < 5) return 'neutral';
  if (abs < 20) return 'somewhat';
  return 'significantly';
}

function generateTakeaways(target, medians, assetType) {
  const takeaways = [];

  for (const def of TAKEAWAY_DEFS) {
    if (def.skipFor.includes(assetType)) continue;

    const values = def.getValues(target, medians);
    if (!values) continue;

    const { val, med } = values;
    if (med === 0) continue;

    const pctDiff = ((val - med) / Math.abs(med)) * 100;
    const magnitude = getMagnitude(pctDiff);

    if (magnitude === 'neutral') {
      takeaways.push({
        text: def.neutralWord,
        context: def.context,
        color: 'text-muted-foreground',
        magnitude: '',
      });
    } else {
      const isBetter = def.lowerBetter ? pctDiff < 0 : pctDiff > 0;
      const word = pctDiff > 0 ? def.higherWord : def.lowerWord;
      // For "carries less debt", lower is good. For "more expensive", higher is bad.
      const color = isBetter ? 'text-green-500' : 'text-red-500';
      // Special: "carries more debt" gets a caution suffix, "less debt" gets a positive suffix
      let suffix = '';
      if (def.id === 'debt') {
        suffix = isBetter ? ' — financially conservative' : ' — higher financial risk';
      } else if (def.id === 'valuation' && !isBetter) {
        suffix = ' — you\'re paying a premium';
      }

      takeaways.push({
        text: word,
        context: def.context,
        color,
        magnitude: magnitude === 'significantly' ? 'Significantly ' : '',
        suffix,
      });
    }
  }

  return takeaways;
}

export default function PeerComparison({ data, assetType }) {
  if (!data || !data.peers?.length) return null;

  const { target, peers, medians, source } = data;
  const allRows = [target, ...peers];
  const takeaways = generateTakeaways(target, medians, assetType || 'stock');

  return (
    <div className="mb-5">
      <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
        Peer Comparison
      </h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                Company
              </th>
              {METRICS.map((m) => (
                <th
                  key={m.key}
                  className="text-right px-3 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap"
                >
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allRows.map((row, i) => {
              const isTarget = i === 0;
              return (
                <tr
                  key={row.symbol}
                  className={`border-b border-border last:border-b-0 ${
                    isTarget
                      ? 'bg-violet-50/50 dark:bg-violet-900/10 border-l-2 border-l-violet-500'
                      : 'hover:bg-muted/30'
                  }`}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`font-semibold ${isTarget ? 'text-violet-600 dark:text-violet-400' : 'text-foreground'}`}>
                      {row.symbol}
                    </span>
                    <span className="text-muted-foreground ml-1.5 text-xs hidden sm:inline">
                      {row.name}
                    </span>
                  </td>
                  {METRICS.map((m) => (
                    <td
                      key={m.key}
                      className={`text-right px-3 py-2 font-medium whitespace-nowrap ${getColor(row[m.key], medians[m.key], m.lowerBetter, m.format)}`}
                    >
                      {formatValue(row[m.key], m.format)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {/* Median row */}
            <tr className="bg-muted/30 border-t border-border">
              <td className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                Peer Median
              </td>
              {METRICS.map((m) => (
                <td
                  key={m.key}
                  className="text-right px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap"
                >
                  {m.key === 'marketCap' ? '—' : formatValue(medians[m.key], m.format)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {takeaways.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {takeaways.map((t, i) => (
            <li key={i} className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              <span>
                {t.magnitude}
                <span className={`font-semibold ${t.color}`}>{t.text}</span>
                {' '}than {t.context}
                {t.suffix}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground/60 mt-2">
        {source === 'profile' ? 'Peers from curated profile' : source === 'etf-classifier' ? 'Peers from same ETF category' : source === 'claude' ? 'Peers suggested by AI (same industry)' : 'Peers discovered via Yahoo Finance'}
      </p>
    </div>
  );
}
