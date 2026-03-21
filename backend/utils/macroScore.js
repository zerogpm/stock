const MACRO_CONFIGS = {
  BROAD_MARKET: {
    scored: true,
    peThresholds: { expensive: 24, cheap: 18 },
    erpWeight: 2,
    rateWeight: 1,
    growthWeight: 1,
    yieldSpreadWeight: 0,
  },
  GROWTH: {
    scored: true,
    peThresholds: { expensive: 30, cheap: 22 },
    erpWeight: 2,
    rateWeight: 1,
    growthWeight: 1,
    yieldSpreadWeight: 0,
  },
  DIVIDEND_GROWTH: {
    scored: true,
    peThresholds: { expensive: 20, cheap: 14 },
    erpWeight: 0,
    rateWeight: 1,
    growthWeight: 0,
    yieldSpreadWeight: 2,
  },
  INCOME: {
    scored: true,
    peThresholds: null,
    erpWeight: 0,
    rateWeight: 1,
    growthWeight: 0,
    yieldSpreadWeight: 2,
  },
  SECTOR: {
    scored: true,
    peThresholds: null,
    erpWeight: 0,
    rateWeight: 2,
    growthWeight: 0,
    yieldSpreadWeight: 0,
    sectorSensitivity: true,
  },
  INTERNATIONAL: {
    scored: false,
    promptNote: 'The 10-Year US Treasury yield affects USD strength. Higher yields strengthen USD, which creates headwinds for international equity returns when measured in USD.',
  },
  THEMATIC: {
    scored: false,
    promptNote: 'Macro rates are secondary for thematic ETFs — theme momentum and adoption curve matter more than ERP. Provide this data as background context only.',
  },
};

const SECTOR_RATE_MAP = {
  financial_services: 1, financial: 1, bank: 1,
  utilities: -1, real_estate: -1, 'real estate': -1, consumer_defensive: -1, 'consumer staples': -1,
  technology: 0, healthcare: 0, energy: 0, industrials: 0,
  communication_services: 0, consumer_cyclical: 0, basic_materials: 0,
};

function getRateTrend(treasury10Y, treasury50dma) {
  if (treasury10Y == null || treasury50dma == null || treasury50dma === 0) return 'stable';
  const ratio = treasury10Y / treasury50dma;
  if (ratio > 1.02) return 'rising';
  if (ratio < 0.98) return 'falling';
  return 'stable';
}

function lookupSectorSensitivity(sectorCategory) {
  if (!sectorCategory) return 0;
  const key = sectorCategory.toLowerCase().replace(/\s+/g, '_');
  for (const [pattern, sensitivity] of Object.entries(SECTOR_RATE_MAP)) {
    if (key.includes(pattern)) return sensitivity;
  }
  return 0;
}

export function computeMacroScore({
  etfType,
  trailingPE,
  forwardPE,
  dividendYield,
  treasury10Y,
  treasury50dma,
  forwardGrowth,
  sectorCategory,
}) {
  const config = MACRO_CONFIGS[etfType] || MACRO_CONFIGS.BROAD_MARKET;
  const rateTrend = getRateTrend(treasury10Y, treasury50dma);

  // Unscored types — return context only
  if (!config.scored) {
    return {
      scored: false,
      treasury10Y: treasury10Y ?? null,
      rateTrend,
      promptNote: config.promptNote || '',
    };
  }

  const earningsYield = forwardPE && forwardPE > 0 ? (1 / forwardPE) * 100 : null;
  const erp = earningsYield != null && treasury10Y != null ? earningsYield - treasury10Y : null;
  const yieldSpread = dividendYield != null && treasury10Y != null
    ? (dividendYield * 100) - treasury10Y
    : null;

  let score = 0;
  const breakdown = {};

  // P/E score
  if (config.peThresholds && trailingPE != null) {
    if (trailingPE > config.peThresholds.expensive) {
      breakdown.pe = -2;
    } else if (trailingPE < config.peThresholds.cheap) {
      breakdown.pe = 2;
    } else {
      breakdown.pe = 0;
    }
    score += breakdown.pe;
  }

  // Rate trend score
  if (config.rateWeight) {
    if (config.sectorSensitivity) {
      const sensitivity = lookupSectorSensitivity(sectorCategory);
      // For sectors that benefit from rising rates, flip the sign
      if (rateTrend === 'rising') {
        breakdown.rates = sensitivity * config.rateWeight;
      } else if (rateTrend === 'falling') {
        breakdown.rates = -sensitivity * config.rateWeight;
      } else {
        breakdown.rates = 0;
      }
    } else {
      if (rateTrend === 'rising') {
        breakdown.rates = -config.rateWeight;
      } else if (rateTrend === 'falling') {
        breakdown.rates = config.rateWeight;
      } else {
        breakdown.rates = 0;
      }
    }
    score += breakdown.rates;
  }

  // Growth score
  if (config.growthWeight && forwardGrowth != null) {
    if (forwardGrowth > 8) {
      breakdown.growth = config.growthWeight;
    } else if (forwardGrowth < 4) {
      breakdown.growth = -config.growthWeight;
    } else {
      breakdown.growth = 0;
    }
    score += breakdown.growth;
  }

  // ERP score
  if (config.erpWeight && erp != null) {
    if (erp < 0) {
      breakdown.erp = -config.erpWeight;
    } else if (erp > 2) {
      breakdown.erp = config.erpWeight;
    } else {
      breakdown.erp = 0;
    }
    score += breakdown.erp;
  }

  // Yield spread score
  if (config.yieldSpreadWeight && yieldSpread != null) {
    if (yieldSpread < -1) {
      breakdown.yieldSpread = -config.yieldSpreadWeight;
    } else if (yieldSpread > 1) {
      breakdown.yieldSpread = config.yieldSpreadWeight;
    } else {
      breakdown.yieldSpread = 0;
    }
    score += breakdown.yieldSpread;
  }

  const suggestedAction = score <= -2 ? 'AVOID' : score >= 2 ? 'BUY' : 'HOLD';

  return {
    scored: true,
    score,
    suggestedAction,
    rateTrend,
    earningsYield: earningsYield != null ? +earningsYield.toFixed(2) : null,
    equityRiskPremium: erp != null ? +erp.toFixed(2) : null,
    yieldSpread: yieldSpread != null ? +yieldSpread.toFixed(2) : null,
    treasury10Y: treasury10Y ?? null,
    breakdown,
  };
}

export function formatMacroBlock(macroData, etfType) {
  if (!macroData) return '';

  if (!macroData.scored) {
    return `\n## Macro Context
- **10Y US Treasury Yield:** ${macroData.treasury10Y != null ? macroData.treasury10Y + '%' : 'N/A'} (trend: ${macroData.rateTrend})
- **Note:** ${macroData.promptNote}

This is background context. Do not let it override your primary analysis.\n`;
  }

  const { score, suggestedAction, rateTrend, earningsYield, equityRiskPremium, yieldSpread, treasury10Y, breakdown } = macroData;

  let lines = `\n## Macro Environment (server-calculated)
- **10Y Treasury Yield:** ${treasury10Y != null ? treasury10Y + '%' : 'N/A'} (trend: ${rateTrend})`;

  const config = MACRO_CONFIGS[etfType] || MACRO_CONFIGS.BROAD_MARKET;

  if (config.erpWeight && earningsYield != null) {
    lines += `\n- **Earnings Yield:** ${earningsYield}% (1 / forward P/E)`;
    if (equityRiskPremium != null) {
      const erpLabel = equityRiskPremium < 0
        ? `NEGATIVE — bonds more attractive than stocks at current valuations`
        : `positive — stocks offer premium over bonds`;
      lines += `\n- **Equity Risk Premium:** ${equityRiskPremium}% (${erpLabel})`;
    }
  }

  if (config.yieldSpreadWeight && yieldSpread != null) {
    const spreadLabel = yieldSpread < 0
      ? `NEGATIVE — risk-free bonds yield MORE than this ETF`
      : `positive — ETF yields more than risk-free bonds`;
    lines += `\n- **Yield Spread vs Bonds:** ${yieldSpread}% (${spreadLabel})`;
  }

  if (config.sectorSensitivity && breakdown.rates != null) {
    const dir = breakdown.rates > 0 ? 'Positive (this sector benefits from current rate trend)'
      : breakdown.rates < 0 ? 'Negative (this sector is hurt by current rate trend)'
      : 'Neutral for this sector';
    lines += `\n- **Sector Rate Sensitivity:** ${dir}`;
  }

  const maxScore = Object.values(breakdown).reduce((s, v) => s + Math.abs(v), 0) || 6;
  lines += `\n- **Macro Score:** ${score} (range: -${maxScore} to +${maxScore}, negative = headwinds)`;
  lines += `\n- **Suggested Action:** ${suggestedAction}`;

  // Type-specific prompt instruction
  if (config.erpWeight) {
    lines += `\n\nYou MUST explain how interest rates and equity risk premium affect your verdict. If ERP is negative, explain why stocks are or aren't still attractive vs bonds.`;
  } else if (config.yieldSpreadWeight) {
    lines += `\n\nYou MUST explain how the yield spread vs risk-free bonds affects your verdict. If bonds yield more, explain why this ETF still makes sense (or doesn't) — consider growth, tax treatment, and total return.`;
  } else if (config.sectorSensitivity) {
    lines += `\n\nYou MUST explain how the current interest rate environment specifically affects this sector.`;
  }

  return lines + '\n';
}

export { MACRO_CONFIGS, SECTOR_RATE_MAP };
