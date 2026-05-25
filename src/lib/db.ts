import { neon } from "@neondatabase/serverless";
import fallbackSnapshot from "../../data/latest_alignment.json" with { type: "json" };
import symbolMeta from "../../data/symbol_meta.json" with { type: "json" };
import universe from "../../data/universe.json" with { type: "json" };
import { countAlignmentStats, dedupeTickerRows, filterTickerRows, latestGeneratedAt, sortTickerRows } from "@/lib/alignment-data";
import { getAlignmentStatus, normalizeTicker, shortSymbol } from "@/lib/market";
import type { Alignment, Signal, TickerRow } from "@/data/mock-data";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

export const sql = neon(DATABASE_URL);

type Timeframe = "weekly" | "monthly";
type UniverseFile = { symbols?: string[] };
type MetaEntry = { name?: string; market?: string; sector?: string };
type SnapshotFile = { generatedAt?: string | null; rows?: TickerRow[] };

type DbSignalRow = {
  symbol: string;
  symbol_name: string | null;
  market: string | null;
  timeframe: Timeframe;
  signal: Signal;
  price: number | string | null;
  signal_price: number | string | null;
  candles_ago: number | null;
  scanned_at: string | Date | null;
};

export type AlignmentQuery = {
  ticker?: string;
  market?: string;
  weekly?: Signal | "ALL";
  monthly?: Signal | "ALL";
  status?: Alignment | "ALL";
  maxCandles?: number | string | null;
  limit?: number;
  offset?: number;
};

const universeSymbols = ((universe as UniverseFile).symbols ?? [])
  .map((symbol) => normalizeTicker(symbol))
  .filter(Boolean);
const metaBySymbol = symbolMeta as Record<string, MetaEntry>;

function toNumber(value: number | string | null) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(value: string | Date | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function metaFor(symbol: string) {
  const bare = shortSymbol(symbol);
  const meta = metaBySymbol[symbol] || metaBySymbol[bare] || {};
  return {
    symbolName: meta.name || bare,
    market: meta.market || meta.sector || "UNKNOWN",
  };
}

function emptySignal(timeframe: Timeframe) {
  return {
    timeframe,
    signal: "NEUTRAL" as const,
    candlesAgo: null,
    signalPrice: null,
    currentPrice: null,
    scannedAt: null,
  };
}

function emptyRow(symbol: string): TickerRow {
  const normalized = normalizeTicker(symbol);
  const meta = metaFor(normalized);
  const weekly = emptySignal("weekly");
  const monthly = emptySignal("monthly");

  return {
    symbol: normalized,
    ticker: shortSymbol(normalized),
    symbolName: meta.symbolName,
    market: meta.market,
    status: getAlignmentStatus(weekly.signal, monthly.signal),
    weekly,
    monthly,
  };
}

function normalizeDbRows(rows: DbSignalRow[]) {
  const grouped = new Map<string, TickerRow>();

  for (const row of rows) {
    const symbol = normalizeTicker(row.symbol);
    const meta = metaFor(symbol);
    const current = grouped.get(symbol) ?? {
      symbol,
      ticker: shortSymbol(symbol),
      symbolName: row.symbol_name || meta.symbolName,
      market: row.market || meta.market,
      status: "Avoid" as Alignment,
      weekly: emptySignal("weekly"),
      monthly: emptySignal("monthly"),
    };

    const snapshot = {
      timeframe: row.timeframe,
      signal: row.signal,
      candlesAgo: row.candles_ago,
      signalPrice: toNumber(row.signal_price),
      currentPrice: toNumber(row.price),
      scannedAt: toIso(row.scanned_at),
    };

    if (row.timeframe === "weekly") current.weekly = snapshot;
    if (row.timeframe === "monthly") current.monthly = snapshot;
    current.symbolName = row.symbol_name || current.symbolName;
    current.market = row.market || current.market;
    current.status = getAlignmentStatus(current.weekly.signal, current.monthly.signal);
    grouped.set(symbol, current);
  }

  for (const symbol of universeSymbols) {
    if (!grouped.has(symbol)) grouped.set(symbol, emptyRow(symbol));
  }

  return sortTickerRows(dedupeTickerRows(Array.from(grouped.values())));
}

function fallbackRows() {
  const snapshot = fallbackSnapshot as SnapshotFile;
  const rows = (snapshot.rows ?? []).filter((row) => row.weekly && row.monthly);
  return {
    rows: normalizeDbRows(
      rows.flatMap((row) => [
        {
          symbol: row.symbol,
          symbol_name: row.symbolName,
          market: row.market,
          timeframe: "weekly" as const,
          signal: row.weekly.signal,
          price: row.weekly.currentPrice,
          signal_price: row.weekly.signalPrice,
          candles_ago: row.weekly.candlesAgo,
          scanned_at: row.weekly.scannedAt,
        },
        {
          symbol: row.symbol,
          symbol_name: row.symbolName,
          market: row.market,
          timeframe: "monthly" as const,
          signal: row.monthly.signal,
          price: row.monthly.currentPrice,
          signal_price: row.monthly.signalPrice,
          candles_ago: row.monthly.candlesAgo,
          scanned_at: row.monthly.scannedAt,
        },
      ]),
    ),
    generatedAt: snapshot.generatedAt ?? null,
  };
}

export async function getAlignmentRows(query: AlignmentQuery = {}) {
  let normalizedRows: TickerRow[];
  let generatedAt: string | null;

  try {
    const dbRows = (await sql`
      SELECT DISTINCT ON (symbol, timeframe)
        symbol,
        symbol_name,
        market,
        timeframe,
        signal,
        price,
        signal_price,
        candles_ago,
        scanned_at
      FROM signal_snapshots
      WHERE timeframe IN ('weekly', 'monthly')
      ORDER BY symbol, timeframe, scanned_at DESC, id DESC
    `) as DbSignalRow[];

    normalizedRows = normalizeDbRows(dbRows);
    generatedAt = latestGeneratedAt(normalizedRows);
  } catch {
    const fallback = fallbackRows();
    normalizedRows = fallback.rows;
    generatedAt = fallback.generatedAt;
  }

  const filteredRows = filterTickerRows(normalizedRows, {
    query: query.ticker,
    market: query.market,
    weekly: query.weekly,
    monthly: query.monthly,
    status: query.status,
    maxCandles: query.maxCandles,
  });
  const offset = Math.max(0, query.offset ?? 0);
  const limit = query.limit && query.limit > 0 ? query.limit : filteredRows.length;
  const rows = filteredRows.slice(offset, offset + limit);

  return {
    rows,
    total: filteredRows.length,
    stats: countAlignmentStats(filteredRows),
    generatedAt,
  };
}
