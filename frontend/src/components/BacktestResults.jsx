function StatCard({ label, value, valueClass }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold ${valueClass || 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function fmt(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BacktestResults({ result, investmentAmount, onAmountChange, reinvest, onReinvestChange, onClear, isDark }) {
  if (!result) return null;

  const isPositive = result.totalReturn >= 0;
  const returnColor = isPositive ? 'text-green-500' : 'text-red-500';

  return (
    <div data-tour="backtest-results" className={[
      'mt-4 rounded-lg border p-4',
      isDark ? 'border-emerald-800/40 bg-emerald-950/20' : 'border-emerald-200 bg-emerald-50/50',
    ].join(' ')}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">
          Investment Calculator: {result.startDate} to {result.endDate}
        </h3>
        <button
          data-tour="backtest-clear"
          onClick={onClear}
          className={[
            'px-3 py-1 rounded-md text-sm font-semibold cursor-pointer transition-colors border',
            isDark
              ? 'text-red-400 border-red-400/40 hover:text-red-300 hover:bg-red-500/10'
              : 'text-red-500 border-red-300 hover:text-red-600 hover:bg-red-50',
          ].join(' ')}
        >
          Clear
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="flex items-center gap-1.5 text-sm text-foreground">
          <span className="text-muted-foreground">Invest $</span>
          <input
            type="number"
            value={investmentAmount}
            onChange={(e) => onAmountChange(Number(e.target.value))}
            min={1}
            className={[
              'w-28 px-2 py-1 rounded border text-sm font-medium',
              isDark
                ? 'bg-slate-800 border-slate-600 text-white'
                : 'bg-white border-slate-300 text-slate-900',
            ].join(' ')}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={reinvest}
            onChange={(e) => onReinvestChange(e.target.checked)}
            className="accent-emerald-500"
          />
          <span className="text-muted-foreground">Reinvest Dividends (DRIP)</span>
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Value"
          value={`$${fmt(result.totalValue)}`}
          valueClass={returnColor}
        />
        <StatCard
          label="Total Return"
          value={`${isPositive ? '+' : ''}$${fmt(result.totalReturn)} (${isPositive ? '+' : ''}${result.totalReturnPct.toFixed(1)}%)`}
          valueClass={returnColor}
        />
        <StatCard
          label="Annualized Return"
          value={result.periodYears >= 1 ? `${result.annualizedReturnPct >= 0 ? '+' : ''}${result.annualizedReturnPct.toFixed(1)}%` : '-'}
        />
        <StatCard
          label="Price Return"
          value={`${result.priceReturnPct >= 0 ? '+' : ''}${result.priceReturnPct.toFixed(1)}%`}
          valueClass={result.priceReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}
        />
        <StatCard
          label="Dividend Income"
          value={`$${fmt(result.totalDividends)}`}
        />
        <StatCard
          label="Dividend Return"
          value={`+${result.dividendReturnPct.toFixed(1)}%`}
        />
        <StatCard
          label="Shares"
          value={result.reinvested && result.finalShares !== result.initialShares
            ? `${result.initialShares.toFixed(2)} → ${result.finalShares.toFixed(2)}`
            : result.initialShares.toFixed(2)}
        />
        <StatCard
          label="Period"
          value={result.periodYears >= 1
            ? `${result.periodYears.toFixed(1)} years`
            : `${Math.round(result.periodYears * 12)} months`}
        />
      </div>
    </div>
  );
}
