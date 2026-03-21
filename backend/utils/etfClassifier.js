export const KNOWN_TICKERS = {
  BROAD_MARKET: new Set([
    'VOO', 'VTI', 'SPY', 'IVV', 'SPLG', 'SPTM', 'ITOT', 'SCHB', 'SCHX',
    'VV', 'RSP', 'IWB', 'VONE', 'SPHQ', 'QUAL', 'IWV', 'DFAC', 'FNILX',
    'FXAIX', 'VTHR', 'SCHA', 'SWPPX',
  ]),
  DIVIDEND_GROWTH: new Set([
    'SCHD', 'VYM', 'DGRO', 'VIG', 'NOBL', 'SDY', 'DGRW', 'DVY', 'HDV',
    'SPHD', 'FDL', 'DLN', 'TDIV', 'RDIV', 'VIGI', 'DIVB', 'FDVV',
  ]),
  GROWTH: new Set([
    'QQQ', 'QQQM', 'VGT', 'SCHG', 'VUG', 'IWF', 'MGK', 'VONG', 'RPG',
    'SPYG', 'IVW', 'FTEC', 'IWY', 'IUSG', 'ONEQ', 'VOOG', 'IWP', 'MTUM',
    'TECB',
  ]),
  INCOME: new Set([
    'JEPI', 'JEPQ', 'XYLD', 'QYLD', 'RYLD', 'DIVO', 'NUSI', 'SVOL',
    'SPYI', 'QQQI', 'PFF', 'PFFD', 'HYG', 'JNK', 'SPYD', 'USHY', 'VCIT',
    'LQD', 'BND',
  ]),
  SECTOR: new Set([
    'XLE', 'XLF', 'XLV', 'XLK', 'XLI', 'XLC', 'XLU', 'XLP', 'XLY',
    'XLB', 'XLRE', 'VNQ', 'IYR', 'KRE', 'KBE', 'OIH', 'GDX', 'GDXJ',
    'IBB', 'IHI', 'ITA', 'VDE', 'VFH', 'VHT', 'VIS', 'VAW', 'VCR', 'VPU',
    'SMH', 'SOXX', 'XBI', 'MJ',
  ]),
  INTERNATIONAL: new Set([
    'VEA', 'EEM', 'VXUS', 'EFA', 'IEMG', 'VWO', 'IXUS', 'IEFA', 'SCZ',
    'SPDW', 'ACWI', 'ACWX', 'EWJ', 'EWZ', 'FXI', 'MCHI', 'INDA', 'EWG',
    'EWT', 'EWY', 'HEFA', 'DGS', 'EMXC', 'VEU',
  ]),
  THEMATIC: new Set([
    'ARKK', 'ARKW', 'ARKG', 'ARKF', 'ARKQ', 'BOTZ', 'ICLN', 'TAN', 'LIT',
    'HACK', 'ROBO', 'BETZ', 'MSOS', 'YOLO', 'MOON', 'DRIV', 'BLOK',
    'CLOU', 'AIQ', 'IRBO', 'KWEB', 'QCLN', 'ESGU', 'IDRV', 'SNSR',
  ]),
};

const NAME_PATTERNS = [
  { type: 'BROAD_MARKET', pattern: /s&p\s*500|total\s*(?:stock\s*)?market|russell\s*(?:1000|3000)|(?:large|mega)[\s-]?cap\s*(?:index|blend)/i },
  { type: 'INTERNATIONAL', pattern: /emerging|international|ex[\s-]?us|world|developed|foreign|eafe|ftse\s*(?:dev|emerg)|non[\s-]?u\.?s/i },
  { type: 'INCOME', pattern: /covered\s*call|option|premium\s*income|buy[\s-]?write|high\s*yield|income\s*(?:strategy|fund)|equity\s*premium/i },
  { type: 'DIVIDEND_GROWTH', pattern: /dividend\s*(?:growth|appreciat|grower|achiev|aristocrat)/i },
  { type: 'SECTOR', pattern: /(?:select\s*sector|energy|financ|health\s*care|utilit|consumer|industrial|material|real\s*estate|technolog)\s*(?:sector|select|spdr|etf|fund|index)/i },
  { type: 'THEMATIC', pattern: /innovation|disrupt|genomic|robot|cyber|cloud|solar|clean\s*energy|cannabis|blockchain|metaverse|\bai\b|artificial|autonomous|space|fintech/i },
  { type: 'GROWTH', pattern: /growth|nasdaq(?!.*income)|large[\s-]?cap\s*growth/i },
];

export function classifyETF({ ticker, name, dividendYield, peRatio, streak }) {
  const upperTicker = (ticker || '').toUpperCase();

  for (const [type, tickers] of Object.entries(KNOWN_TICKERS)) {
    if (tickers.has(upperTicker)) return type;
  }

  const etfName = name || '';
  for (const { type, pattern } of NAME_PATTERNS) {
    if (pattern.test(etfName)) return type;
  }

  if (dividendYield != null && dividendYield > 0.06) return 'INCOME';
  if (dividendYield != null && dividendYield >= 0.02 && streak >= 5) return 'DIVIDEND_GROWTH';
  if (dividendYield != null && dividendYield < 0.01 && peRatio != null && peRatio > 28) return 'GROWTH';

  return 'BROAD_MARKET';
}
