export type Signal = "BUY" | "NEUTRAL" | "SELL";
export type Alignment = "Aligned BUY" | "Weekly BUY, Monthly Neutral" | "Conflict" | "Avoid";
export type Market = string;

export interface TimeframeData {
  timeframe: "weekly" | "monthly";
  signal: Signal;
  candlesAgo: number | null;
  signalPrice: number | null;
  currentPrice: number | null;
  scannedAt: string | null;
}

export interface TickerRow {
  symbol: string;
  ticker: string;
  symbolName: string;
  market: Market;
  status: Alignment;
  weekly: TimeframeData;
  monthly: TimeframeData;
}

const MARKETS: Market[] = [
  "Technology",
  "Healthcare",
  "Financial",
  "Consumer Cyclical",
  "Industrials",
  "Real Estate",
  "Communication Services",
  "Consumer Defensive",
  "Energy",
  "Utilities",
  "Basic Materials",
];

// Seeded PRNG for deterministic output
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

function rngInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function rngPick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Base-26 encoding for unique 4-letter tickers (up to 456,976 unique)
function makeTicker(i: number): string {
  const a = LETTERS[i % 26];
  const b = LETTERS[Math.floor(i / 26) % 26];
  const c = LETTERS[Math.floor(i / 676) % 26];
  const d = LETTERS[Math.floor(i / 17576) % 26];
  return a + b + c + d;
}

const COMPANY_PREFIXES = [
  "Global", "American", "International", "United", "National", "First",
  "Premier", "Advanced", "Dynamic", "Strategic", "Innovative", "Integrated",
  "Atlas", "Apex", "Core", "Prime", "Elite", "Summit", "Crest", "Pinnacle",
  "Horizon", "Vertex", "Nexus", "Zenith", "Titan", "Quantum", "Meridian",
  "Pacific", "Atlantic", "Continental", "Metro", "Urban", "Heritage",
];

const COMPANY_SUFFIXES = [
  "Technologies", "Holdings", "Group", "Corp", "Inc", "Enterprises",
  "Solutions", "Systems", "Industries", "Partners", "Capital", "Equity",
  "Healthcare", "Therapeutics", "Biotech", "Pharma", "Energy", "Logistics",
  "Media", "Networks", "Digital", "Financial", "Resources", "Properties",
  "Infrastructure", "Ventures", "Innovations", "Analytics", "Security",
  "Communications", "Materials", "Utilities", "Development", "Management",
];

const COMPANY_NOUNS = [
  "Breeze", "Cobalt", "Delta", "Echo", "Falcon", "Guardian", "Harbor",
  "Iron", "Jade", "Keystone", "Legacy", "Monarch", "North", "Orion",
  "Phoenix", "Quartz", "Ridge", "Sterling", "Terra", "Union", "Valor",
  "West", "Axis", "Bridge", "Crown", "Diamond", "Emerald", "Frontier",
  "Granite", "Helix", "Insight", "Journey", "Kinetic", "Launch", "Matrix",
  "Nova", "Onyx", "Prism", "Quest", "Raven", "Sapphire", "Trail",
  "Unity", "Vista", "Wave", "Xenith", "Yield", "Zenith", "Arc",
  "Beacon", "Catalyst", "Dawn", "Element", "Flare", "Gravity", "Haven",
  "Impact", "Javelin", "Katalyst", "Lantern", "Mosaic", "Nebula", "Oasis",
  "Paragon", "Quasar", "Radiant", "Synergy", "Trident", "Umbra", "Vector",
  "Warden", "Xenon", "Zephyr",
];

function makeCompanyName(i: number): string {
  const bucket = i % 5;
  const p = rngPick(COMPANY_PREFIXES);
  const n = rngPick(COMPANY_NOUNS);
  const s = rngPick(COMPANY_SUFFIXES);

  switch (bucket) {
    case 0: return `${p} ${n} ${s}`;
    case 1: return `${n} ${s}`;
    case 2: return `${p} ${s}`;
    case 3: return `${n} ${p} ${s}`;
    case 4: return `${p} ${n} ${s}`;
    default: return `${p} ${n} ${s}`;
  }
}

function generateTimeframeData(
  tf: "weekly" | "monthly",
  status: Alignment
): TimeframeData {
  let signal: Signal;

  switch (status) {
    case "Aligned BUY":
      signal = "BUY";
      break;
    case "Avoid":
      signal = "SELL";
      break;
    case "Weekly BUY, Monthly Neutral":
      signal = tf === "weekly" ? "BUY" : "NEUTRAL";
      break;
    case "Conflict":
      signal = tf === "weekly" ? "BUY" : "SELL";
      break;
  }

  const basePrice = rng() * 500 + 2;
  const currentPrice = +(basePrice + (rng() - 0.5) * 20).toFixed(2);
  const signalPrice = +(basePrice + (rng() - 0.5) * 30).toFixed(2);

  return {
    timeframe: tf,
    signal,
    candlesAgo: rngInt(0, tf === "monthly" ? 12 : 60),
    signalPrice,
    currentPrice,
    scannedAt: new Date(Date.now() - rngInt(0, 3600000)).toISOString(),
  };
}

function generateTickerRow(i: number): TickerRow {
  const ticker = makeTicker(i);
  const name = makeCompanyName(i);
  const market = rngPick(MARKETS);

  const statusRoll = rng();
  let status: Alignment;
  if (statusRoll < 0.30) status = "Aligned BUY";
  else if (statusRoll < 0.35) status = "Weekly BUY, Monthly Neutral";
  else if (statusRoll < 0.65) status = "Conflict";
  else status = "Avoid";

  return {
    symbol: ticker,
    ticker,
    symbolName: name,
    market,
    status,
    weekly: generateTimeframeData("weekly", status),
    monthly: generateTimeframeData("monthly", status),
  };
}

export function generateTickerData(count: number = 200): TickerRow[] {
  return Array.from({ length: count }, (_, i) => generateTickerRow(i));
}
