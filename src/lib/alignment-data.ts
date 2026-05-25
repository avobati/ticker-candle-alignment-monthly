import type { Alignment, Signal, TickerRow } from "@/data/mock-data";

export type AlignmentStats = {
  total: number;
  alignedBuy: number;
  watch: number;
  conflict: number;
  avoid: number;
};

export type TickerFilters = {
  query?: string;
  market?: string;
  weekly?: Signal | "ALL";
  monthly?: Signal | "ALL";
  status?: Alignment | "ALL";
  maxCandles?: string | number | null;
};

const statusRank: Record<Alignment, number> = {
  "Aligned BUY": 0,
  "Weekly BUY, Monthly Neutral": 1,
  Conflict: 2,
  Avoid: 3,
};

const signalRank: Record<Signal, number> = {
  BUY: 0,
  NEUTRAL: 1,
  SELL: 2,
};

function scannedAtTime(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function latestRowTime(row: TickerRow) {
  return Math.max(scannedAtTime(row.weekly.scannedAt), scannedAtTime(row.monthly.scannedAt));
}

export function dedupeTickerRows(rows: readonly TickerRow[]) {
  const bySymbol = new Map<string, TickerRow>();

  for (const row of rows) {
    const symbolKey = row.symbol.trim().toUpperCase();
    const current = bySymbol.get(symbolKey);
    if (!current || latestRowTime(row) >= latestRowTime(current)) {
      bySymbol.set(symbolKey, { ...row, symbol: symbolKey, ticker: row.ticker.trim().toUpperCase() });
    }
  }

  return Array.from(bySymbol.values());
}

export function countAlignmentStats(rows: readonly TickerRow[]): AlignmentStats {
  return {
    total: rows.length,
    alignedBuy: rows.filter((row) => row.status === "Aligned BUY").length,
    watch: rows.filter((row) => row.status === "Weekly BUY, Monthly Neutral").length,
    conflict: rows.filter((row) => row.status === "Conflict").length,
    avoid: rows.filter((row) => row.status === "Avoid").length,
  };
}

export function sortTickerRows(rows: readonly TickerRow[]) {
  return [...rows].sort((a, b) => {
    const byStatus = statusRank[a.status] - statusRank[b.status];
    if (byStatus !== 0) return byStatus;

    const byWeekly = signalRank[a.weekly.signal] - signalRank[b.weekly.signal];
    if (byWeekly !== 0) return byWeekly;

    const aFresh = a.weekly.candlesAgo ?? Number.MAX_SAFE_INTEGER;
    const bFresh = b.weekly.candlesAgo ?? Number.MAX_SAFE_INTEGER;
    if (aFresh !== bFresh) return aFresh - bFresh;

    return a.ticker.localeCompare(b.ticker);
  });
}

export function filterTickerRows(rows: readonly TickerRow[], filters: TickerFilters) {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const market = filters.market ?? "ALL";
  const weekly = filters.weekly ?? "ALL";
  const monthly = filters.monthly ?? "ALL";
  const status = filters.status ?? "ALL";
  const maxCandles =
    filters.maxCandles == null || filters.maxCandles === "" ? null : Number(filters.maxCandles);

  return rows.filter((row) => {
    if (status !== "ALL" && row.status !== status) return false;
    if (market !== "ALL" && row.market !== market) return false;
    if (weekly !== "ALL" && row.weekly.signal !== weekly) return false;
    if (monthly !== "ALL" && row.monthly.signal !== monthly) return false;
    if (maxCandles != null && Number.isFinite(maxCandles) && maxCandles > 0) {
      if (row.weekly.candlesAgo > maxCandles && row.monthly.candlesAgo > maxCandles) return false;
    }
    if (!query) return true;
    return `${row.symbol} ${row.ticker} ${row.symbolName} ${row.market}`.toLowerCase().includes(query);
  });
}

export function latestGeneratedAt(rows: readonly TickerRow[]) {
  const latest = rows.reduce((max, row) => Math.max(max, latestRowTime(row)), 0);
  return latest ? new Date(latest).toISOString() : null;
}
