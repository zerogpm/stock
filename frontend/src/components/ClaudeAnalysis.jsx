import { useState, useEffect } from "react";
import { useClaudeStream } from "../hooks/useClaudeStream";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ProfileDiscoveryLoader from "./ProfileDiscoveryLoader";
import PeerComparison from "./PeerComparison";

const ACTION_CONFIG = {
  STRONG_BUY: {
    className:
      "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40",
    label: "Strong Buy",
  },
  BUY: {
    className:
      "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/40",
    label: "Buy",
  },
  ACCUMULATE: {
    className:
      "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40",
    label: "Accumulate",
  },
  HOLD: {
    className:
      "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300 dark:hover:bg-yellow-900/40",
    label: "Hold",
  },
  AVOID: {
    className:
      "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/40",
    label: "Avoid",
  },
  SPECULATIVE_BUY: {
    className:
      "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/40",
    label: "Speculative Buy",
  },
  ROTATE_OUT: {
    className:
      "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-900/40",
    label: "Rotate Out",
  },
  REDUCE: {
    className:
      "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-900/40",
    label: "Reduce Exposure",
  },
  SELL: {
    className:
      "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/40",
    label: "Sell",
  },
  STRONG_SELL: {
    className:
      "bg-red-200 text-red-900 hover:bg-red-200 dark:bg-red-900/60 dark:text-red-200 dark:hover:bg-red-900/60",
    label: "Strong Sell",
  },
};

const VERDICT_CONFIG = {
  UNDERVALUED: {
    className:
      "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/40",
    label: "Undervalued",
  },
  OVERVALUED: {
    className:
      "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/40",
    label: "Overvalued",
  },
  FAIR_VALUE: {
    className:
      "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300 dark:hover:bg-yellow-900/40",
    label: "Fair Value",
  },
  FAVORABLE_ENTRY: {
    className:
      "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/40",
    label: "Favorable Entry",
  },
  NEUTRAL: {
    className:
      "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300 dark:hover:bg-yellow-900/40",
    label: "Neutral",
  },
  UNFAVORABLE_ENTRY: {
    className:
      "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/40",
    label: "Unfavorable Entry",
  },
  ATTRACTIVE_YIELD: {
    className:
      "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/40",
    label: "Attractive Yield",
  },
  FAIR_YIELD: {
    className:
      "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300 dark:hover:bg-yellow-900/40",
    label: "Fair Yield",
  },
  YIELD_TRAP: {
    className:
      "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/40",
    label: "Yield Trap",
  },
  EARLY_ENTRY: {
    className:
      "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/40",
    label: "Early Entry",
  },
  EXTENDED: {
    className:
      "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/40",
    label: "Extended",
  },
  EARLY_OPPORTUNITY: {
    className:
      "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/40",
    label: "Early Opportunity",
  },
  FULLY_PRICED: {
    className:
      "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300 dark:hover:bg-yellow-900/40",
    label: "Fully Priced",
  },
};

function getActionSuggestionStyle(action) {
  const styles = {
    STRONG_BUY: "border-green-300 bg-green-50/60 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300",
    BUY: "border-green-300 bg-green-50/60 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300",
    ACCUMULATE: "border-green-300 bg-green-50/60 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300",
    HOLD: "border-yellow-300 bg-yellow-50/60 text-yellow-700 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300",
    SPECULATIVE_BUY: "border-amber-300 bg-amber-50/60 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
    REDUCE: "border-orange-300 bg-orange-50/60 text-orange-700 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-300",
    ROTATE_OUT: "border-orange-300 bg-orange-50/60 text-orange-700 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-300",
    SELL: "border-red-300 bg-red-50/60 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300",
    STRONG_SELL: "border-red-300 bg-red-50/60 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300",
    AVOID: "border-red-300 bg-red-50/60 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300",
  };
  return styles[action] || "text-muted-foreground";
}

function getActionExplanation(action) {
  const explanations = {
    STRONG_BUY: "Strong opportunity \u2014 the stock looks significantly undervalued right now.",
    BUY: "Good time to buy \u2014 the stock is trading below its fair value.",
    ACCUMULATE: "Worth adding to your position gradually at these prices.",
    HOLD: "No rush to buy or sell \u2014 holding your current position makes sense here.",
    SPECULATIVE_BUY: "Could be worth a small position, but comes with higher uncertainty.",
    REDUCE: "Consider trimming your position \u2014 valuation looks stretched.",
    ROTATE_OUT: "Consider moving your money into better-valued alternatives.",
    SELL: "Good time to sell if you need the money \u2014 you\u2019re locking in gains at a premium valuation. Selling now doesn\u2019t lose you anything.",
    STRONG_SELL: "The stock looks significantly overpriced \u2014 consider selling soon to protect your gains.",
    AVOID: "Best to stay away for now \u2014 risk/reward doesn\u2019t look favorable.",
  };
  return explanations[action] || null;
}

export default function ClaudeAnalysis({ symbol, assetType }) {
  const { analysis, streaming, error, cached, computedTargets, fairValue, generatingProfile, peerComparison, startAnalysis, loadCachedAnalysis } = useClaudeStream();

  useEffect(() => {
    if (symbol) loadCachedAnalysis(symbol);
  }, [symbol, loadCachedAnalysis]);

  if (!symbol) return null;

  const isTypedETF = analysis?.etf_type != null;
  const isLegacyETF = !isTypedETF && analysis?.scenarios != null;
  const buttonLabel = assetType === 'etf' ? 'Analyze ETF' : assetType === 'bank' ? 'Analyze Bank' : 'Analyze Stock';

  return (
    <Card className="mb-5">
      <CardContent className="pt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-foreground">AI Analysis</h2>
          <Button
            onClick={() => startAnalysis(symbol)}
            disabled={streaming}
            size="lg"
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-200 text-white"
          >
            {streaming ? "Analyzing..." : cached ? "Re-analyze" : buttonLabel}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {streaming && (
          <ProfileDiscoveryLoader symbol={symbol} isDiscovery={generatingProfile} />
        )}

        {analysis && !streaming && (
          <div className="pt-2">
            <div className="flex items-center gap-3 mb-4">
              <VerdictBadge verdict={analysis.verdict} />
              {analysis.action && <ActionBadge action={analysis.action} />}
              <ConfidenceBadge confidence={analysis.confidence} />
            </div>

            {analysis.action && getActionExplanation(analysis.action) && (
              <p className={`text-sm italic mb-4 rounded-md border-l-4 px-3 py-2 ${getActionSuggestionStyle(analysis.action)}`}>
                {getActionExplanation(analysis.action)}
              </p>
            )}

            {fairValue && <FairValueBanner fairValue={fairValue} />}

            <p className="text-base text-muted-foreground leading-relaxed mb-5">
              {analysis.summary}
            </p>

            {analysis.news_reconciliation && (
              <p className="text-sm italic text-muted-foreground mb-5">
                {analysis.news_reconciliation}
              </p>
            )}

            {isTypedETF ? (
              <>
                {(analysis.analysis_sections || []).map((section, i) => (
                  <Section key={i} title={section.title}>
                    <p className="text-muted-foreground leading-relaxed">
                      {section.content}
                    </p>
                  </Section>
                ))}

                <div className="grid grid-cols-2 gap-5 mb-5">
                  <Section title="Risk Flags">
                    <ul className="pl-5 space-y-1">
                      {(analysis.risks || []).map((r, i) => (
                        <li key={i} className="text-red-500 dark:text-red-400">
                          {r}
                        </li>
                      ))}
                    </ul>
                  </Section>
                  <Section title="Catalysts">
                    <ul className="pl-5 space-y-1">
                      {(analysis.catalysts || []).map((c, i) => (
                        <li key={i} className="text-green-500 dark:text-green-400">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </Section>
                </div>

                {analysis.callout && (
                  <CalloutCard
                    title={analysis.callout.title}
                    content={analysis.callout.content}
                  />
                )}

                {analysis.forecasts && (
                  <ForecastTabs forecasts={analysis.forecasts} />
                )}

                <ETFTypeBadge type={analysis.etf_type} />
              </>
            ) : isLegacyETF ? (
              <>
                <Section title="Market Analysis">
                  <p className="text-muted-foreground leading-relaxed">
                    {analysis.market_analysis}
                  </p>
                </Section>

                <div className="grid grid-cols-2 gap-5 mb-5">
                  <Section title="Risk Flags">
                    <ul className="pl-5 space-y-1">
                      {(analysis.risks || []).map((r, i) => (
                        <li key={i} className="text-red-500 dark:text-red-400">
                          {r}
                        </li>
                      ))}
                    </ul>
                  </Section>
                  <Section title="Tailwinds">
                    <ul className="pl-5 space-y-1">
                      {(analysis.tailwinds || []).map((t, i) => (
                        <li key={i} className="text-green-500 dark:text-green-400">
                          {t}
                        </li>
                      ))}
                    </ul>
                  </Section>
                </div>

                <ScenarioCards scenarios={analysis.scenarios} />
              </>
            ) : (
              <>
                <Section title="Valuation Analysis">
                  <p className="text-muted-foreground leading-relaxed">
                    {analysis.valuation_analysis}
                  </p>
                </Section>

                {peerComparison && <PeerComparison data={peerComparison} />}

                <div className="grid grid-cols-2 gap-5 mb-5">
                  <Section title="Risk Flags">
                    <ul className="pl-5 space-y-1">
                      {(analysis.risks || []).map((r, i) => (
                        <li key={i} className="text-red-500 dark:text-red-400">
                          {r}
                        </li>
                      ))}
                    </ul>
                  </Section>
                  <Section title="Catalysts">
                    <ul className="pl-5 space-y-1">
                      {(analysis.catalysts || []).map((c, i) => (
                        <li key={i} className="text-green-500 dark:text-green-400">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </Section>
                </div>

                {analysis.forecasts && (
                  <ForecastTabs forecasts={analysis.forecasts} />
                )}
                {computedTargets && (
                  <TargetBreakdown computedTargets={computedTargets} />
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function VerdictBadge({ verdict }) {
  const config = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.FAIR_VALUE;
  return (
    <Badge className={`text-base px-4 py-1.5 ${config.className}`}>
      {config.label}
    </Badge>
  );
}

function ActionBadge({ action }) {
  const config = ACTION_CONFIG[action];
  if (!config) return null;
  return (
    <Badge className={`text-base px-4 py-1.5 ${config.className}`}>
      {config.label}
    </Badge>
  );
}

function ConfidenceBadge({ confidence }) {
  const colors = {
    HIGH: "bg-green-500",
    MEDIUM: "bg-yellow-500",
    LOW: "bg-red-500",
  };
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-semibold">
      <span
        className={`w-2.5 h-2.5 rounded-full ${colors[confidence] || "bg-slate-400"}`}
      />
      {confidence} Confidence
    </span>
  );
}

function FairValueBanner({ fairValue }) {
  if (!fairValue) return null;

  const { currentPrice, currentFairValue, forwardFairValue, verdictRatio,
          historicalAvgPE, fairPE_orange, orangeFairValue, sector } = fairValue;

  const discountPct = (1 - verdictRatio) * 100;
  const isUndervalued = verdictRatio < 1;
  const isFairish = verdictRatio >= 0.95 && verdictRatio <= 1.05;

  const borderColor = isUndervalued
    ? 'border-green-300 dark:border-green-700'
    : isFairish
      ? 'border-yellow-300 dark:border-yellow-700'
      : 'border-red-300 dark:border-red-700';
  const bgColor = isUndervalued
    ? 'bg-green-50 dark:bg-green-900/20'
    : isFairish
      ? 'bg-yellow-50 dark:bg-yellow-900/20'
      : 'bg-red-50 dark:bg-red-900/20';
  const accentColor = isUndervalued
    ? 'text-green-600 dark:text-green-400'
    : isFairish
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-4 mb-5`}>
      <h4 className="text-sm font-bold uppercase tracking-wide mb-3 text-foreground">
        Computed Fair Value
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-muted-foreground font-medium">Current Price</div>
          <div className="text-lg font-bold text-foreground">${currentPrice?.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground font-medium">
            Fair Value ({historicalAvgPE}x Avg P/E)
          </div>
          <div className="text-lg font-bold text-foreground">${currentFairValue?.toFixed(2)}</div>
        </div>
        {orangeFairValue && (
          <div>
            <div className="text-xs text-muted-foreground font-medium">
              Fair Value ({fairPE_orange}x {sector || 'Sector'} P/E)
            </div>
            <div className="text-lg font-bold text-foreground">${orangeFairValue?.toFixed(2)}</div>
          </div>
        )}
        <div>
          <div className="text-xs text-muted-foreground font-medium">
            {isUndervalued ? 'Discount to Avg P/E' : isFairish ? 'Near Avg P/E' : 'Premium to Avg P/E'}
          </div>
          <div className={`text-lg font-bold ${accentColor}`}>
            {Math.abs(discountPct).toFixed(1)}%
          </div>
        </div>
      </div>
      {forwardFairValue && (
        <div className="mt-2 text-xs text-muted-foreground">
          Forward Fair Value (using forward EPS): ${forwardFairValue.toFixed(2)}
        </div>
      )}
    </div>
  );
}

const FORECAST_PERIODS = [
  { key: "3m", label: "3 Month" },
  { key: "6m", label: "6 Month" },
  { key: "12m", label: "12 Month" },
];

function ForecastTabs({ forecasts }) {
  const [active, setActive] = useState("3m");
  const forecast = forecasts[active];

  return (
    <Section title="Price Forecast">
      <div className="flex gap-2 mb-4">
        {FORECAST_PERIODS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active === key
                ? "bg-violet-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {forecast && (
        <div>
          {forecast.price_target && (
            <PriceRange target={forecast.price_target} />
          )}
          <p className="text-muted-foreground text-sm leading-relaxed mt-3">
            {forecast.summary}
          </p>
        </div>
      )}
    </Section>
  );
}

function PriceRange({ target }) {
  const { low, base, high } = target;
  const range = high - low;
  const basePos = range > 0 ? ((base - low) / range) * 100 : 50;

  return (
    <div className="mt-2">
      <div className="flex justify-between text-sm text-muted-foreground mb-2">
        <span>Low: ${low}</span>
        <span>Base: ${base}</span>
        <span>High: ${high}</span>
      </div>
      <div
        className="relative h-2 rounded-full"
        style={{
          background: "linear-gradient(to right, #ef4444, #eab308, #22c55e)",
        }}
      >
        <div
          className="absolute -top-1 w-4 h-4 bg-slate-900 dark:bg-white border-2 border-white dark:border-slate-900 rounded-full shadow -translate-x-1/2"
          style={{ left: `${basePos}%` }}
        />
      </div>
    </div>
  );
}

const SCENARIO_LABELS = [
  { key: "bull", label: "Bull Case", color: "text-green-600 dark:text-green-400", border: "border-green-200 dark:border-green-800" },
  { key: "base", label: "Base Case", color: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-200 dark:border-yellow-800" },
  { key: "bear", label: "Bear Case", color: "text-red-600 dark:text-red-400", border: "border-red-200 dark:border-red-800" },
];

const ETF_TYPE_LABELS = {
  BROAD_MARKET: "Broad Market",
  DIVIDEND_GROWTH: "Dividend Growth",
  GROWTH: "Growth",
  INCOME: "Income",
  SECTOR: "Sector",
  INTERNATIONAL: "International",
  THEMATIC: "Thematic",
};

function ETFTypeBadge({ type }) {
  if (!type) return null;
  return (
    <p className="text-xs text-muted-foreground mt-4">
      Analyzed as: <span className="font-semibold">{ETF_TYPE_LABELS[type] || type}</span> ETF
    </p>
  );
}

function CalloutCard({ title, content }) {
  if (!title || !content) return null;
  return (
    <div className="mb-5 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-4">
      <h4 className="text-sm font-bold uppercase tracking-wide mb-1 text-violet-700 dark:text-violet-300">
        {title}
      </h4>
      <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>
    </div>
  );
}

const HORIZON_LABELS = { '3m': '3-Month', '6m': '6-Month', '12m': '12-Month' };

function ComputedForecastTabs({ computedTargets }) {
  const [active, setActive] = useState('3m');
  const horizon = computedTargets.scenarios[active];
  if (!horizon) return null;

  return (
    <Section title="Price Forecast (computed)">
      <div className="flex gap-2 mb-4">
        {FORECAST_PERIODS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active === key
                ? "bg-violet-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <PriceRange target={{ low: horizon.bear.targetPrice, base: horizon.base.targetPrice, high: horizon.bull.targetPrice }} />
    </Section>
  );
}

function TargetBreakdown({ computedTargets }) {
  const [active, setActive] = useState('12m');

  // Detect bank data by checking for pbMultiple field
  const sampleData = computedTargets.scenarios['12m']?.bear;
  const isBank = sampleData?.pbMultiple != null;

  if (isBank) {
    return <BankTargetBreakdown computedTargets={computedTargets} />;
  }

  return (
    <details className="mb-5">
      <summary className="text-sm font-bold text-foreground uppercase tracking-wide cursor-pointer hover:text-violet-600 transition-colors">
        Calculation Breakdown
      </summary>
      <div className="mt-3">
        <div className="flex gap-2 mb-3">
          {Object.keys(HORIZON_LABELS).map((key) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                active === key
                  ? "bg-violet-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {HORIZON_LABELS[key]}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Scenario</th>
                <th className="text-right py-2 px-4 text-muted-foreground font-medium">Projected EPS</th>
                <th className="text-right py-2 px-4 text-muted-foreground font-medium">Growth</th>
                <th className="text-right py-2 px-4 text-muted-foreground font-medium">P/E Multiple</th>
                <th className="text-right py-2 pl-4 text-muted-foreground font-medium">Target Price</th>
              </tr>
            </thead>
            <tbody>
              {['bear', 'base', 'bull'].map((scenario) => {
                const data = computedTargets.scenarios[active]?.[scenario];
                if (!data) return null;
                const colors = { bear: 'text-red-500', base: 'text-yellow-500', bull: 'text-green-500' };
                return (
                  <tr key={scenario} className="border-b border-border/50">
                    <td className={`py-2 pr-4 font-medium capitalize ${colors[scenario]}`}>{scenario}</td>
                    <td className="text-right py-2 px-4 text-foreground">${data.eps}</td>
                    <td className="text-right py-2 px-4 text-foreground">{data.growthRate}%</td>
                    <td className="text-right py-2 px-4 text-foreground">{data.peMultiple}x</td>
                    <td className="text-right py-2 pl-4 text-foreground font-semibold">${data.targetPrice}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {computedTargets.inputs && (
          <p className="text-xs text-muted-foreground mt-2">
            Base EPS: ${computedTargets.inputs.forwardEPS ?? computedTargets.inputs.currentEPS} ({computedTargets.inputs.forwardEPS ? 'forward' : 'trailing'}) | Historical Avg P/E: {computedTargets.inputs.historicalAvgPE}x | EPS CAGR: {computedTargets.inputs.epsGrowthRate}%
          </p>
        )}
      </div>
    </details>
  );
}

function BankTargetBreakdown({ computedTargets }) {
  const hasDDM = computedTargets.scenarios['12m']?.bear?.ddmFairPrice != null;
  const colors = { bear: 'text-red-500', base: 'text-yellow-500', bull: 'text-green-500' };

  return (
    <details className="mb-5">
      <summary className="text-sm font-bold text-foreground uppercase tracking-wide cursor-pointer hover:text-violet-600 transition-colors">
        Calculation Breakdown
      </summary>
      <div className="mt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Scenario</th>
                <th className="text-right py-2 px-4 text-muted-foreground font-medium">P/E Price</th>
                <th className="text-right py-2 px-4 text-muted-foreground font-medium">P/B Price</th>
                {hasDDM && <th className="text-right py-2 px-4 text-muted-foreground font-medium">DDM Price</th>}
                <th className="text-right py-2 pl-4 text-muted-foreground font-medium">Blended Target</th>
              </tr>
            </thead>
            <tbody>
              {['bear', 'base', 'bull'].map((scenario) => {
                const data = computedTargets.scenarios['12m']?.[scenario];
                if (!data) return null;
                return (
                  <tr key={scenario} className="border-b border-border/50">
                    <td className={`py-2 pr-4 font-medium capitalize ${colors[scenario]}`}>
                      {scenario}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({data.peMultiple}x P/E, {data.pbMultiple}x P/B)
                      </span>
                    </td>
                    <td className="text-right py-2 px-4 text-foreground">${data.peFairPrice}</td>
                    <td className="text-right py-2 px-4 text-foreground">${data.pbFairPrice}</td>
                    {hasDDM && <td className="text-right py-2 px-4 text-foreground">${data.ddmFairPrice}</td>}
                    <td className="text-right py-2 pl-4 text-foreground font-semibold">${data.targetPrice}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {computedTargets.inputs && (
          <p className="text-xs text-muted-foreground mt-2">
            Forward EPS: ${computedTargets.inputs.forwardEPS ?? computedTargets.inputs.currentEPS} | Book Value: ${computedTargets.inputs.bookValuePerShare}{computedTargets.inputs.dividendRate ? ` | Dividend: $${computedTargets.inputs.dividendRate}/yr` : ''} | P/E range: {computedTargets.scenarios['12m'].bear.peMultiple}–{computedTargets.scenarios['12m'].bull.peMultiple}x | P/B range: {computedTargets.scenarios['12m'].bear.pbMultiple}–{computedTargets.scenarios['12m'].bull.pbMultiple}x
          </p>
        )}
      </div>
    </details>
  );
}

function ScenarioCards({ scenarios }) {
  if (!scenarios) return null;
  return (
    <Section title="12-Month Scenarios">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SCENARIO_LABELS.map(({ key, label, color, border }) => (
          scenarios[key] && (
            <div key={key} className={`rounded-lg border ${border} p-4`}>
              <h4 className={`text-sm font-bold uppercase tracking-wide mb-2 ${color}`}>
                {label}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {scenarios[key]}
              </p>
            </div>
          )
        ))}
      </div>
    </Section>
  );
}
