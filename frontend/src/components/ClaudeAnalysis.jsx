import { useState } from "react";
import { useClaudeStream } from "../hooks/useClaudeStream";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
};

export default function ClaudeAnalysis({ symbol }) {
  const { analysis, streaming, error, startAnalysis } = useClaudeStream();

  if (!symbol) return null;

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
            {streaming ? "Analyzing..." : "Analyze Stock"}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {streaming && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            <p className="text-sm text-muted-foreground font-medium">
              Analyzing {symbol}...
            </p>
          </div>
        )}

        {analysis && !streaming && (
          <div className="pt-2">
            <div className="flex items-center gap-3 mb-4">
              <VerdictBadge verdict={analysis.verdict} />
              <ConfidenceBadge confidence={analysis.confidence} />
            </div>

            <p className="text-base text-muted-foreground leading-relaxed mb-5">
              {analysis.summary}
            </p>

            <Section title="Valuation Analysis">
              <p className="text-muted-foreground leading-relaxed">
                {analysis.valuation_analysis}
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
