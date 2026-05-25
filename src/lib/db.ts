import { neon } from "@neondatabase/serverless";
import { countAlignmentStats, dedupeTickerRows, filterTickerRows, latestGeneratedAt, sortTickerRows } from "@/lib/alignment-data";
import type { Alignment, Market, Signal, TickerRow } from "@/data/mock-data";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

export const sql = neon(DATABASE_URL);

type DbAlignmentRow = {
  symbol: string;
  ticker: string;
  symbol_name: string;
  market: Market;
  status: Alignment;
  weekly_signal: Signal;
  weekly_candles_ago: number;
  weekly_signal_price: number | string;
  weekly_current_price: number | string;
  weekly_scanned_at: string | Date;
  monthly_signal: Signal;
  monthly_candles_ago: number;
  monthly_signal_price: number | string;
  monthly_current_price: number | string;
  monthly_scanned_at: string | Date;
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

function toNumber(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapAlignmentRow(row: DbAlignmentRow): TickerRow {
  return {
    symbol: row.symbol,
    ticker: row.ticker,
    symbolName: row.symbol_name,
    market: row.market,
    status: row.status,
    weekly: {
      timeframe: "weekly",
      signal: row.weekly_signal,
      candlesAgo: row.weekly_candles_ago,
      signalPrice: toNumber(row.weekly_signal_price),
      currentPrice: toNumber(row.weekly_current_price),
      scannedAt: toIso(row.weekly_scanned_at),
    },
    monthly: {
      timeframe: "monthly",
      signal: row.monthly_signal,
      candlesAgo: row.monthly_candles_ago,
      signalPrice: toNumber(row.monthly_signal_price),
      currentPrice: toNumber(row.monthly_current_price),
      scannedAt: toIso(row.monthly_scanned_at),
    },
  };
}

export async function getAlignmentRows(query: AlignmentQuery = {}) {
  const dbRows = (await sql`
    WITH ranked AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY UPPER(symbol)
          ORDER BY
            GREATEST(
              COALESCE(weekly_scanned_at, '-infinity'::timestamptz),
              COALESCE(monthly_scanned_at, '-infinity'::timestamptz),
              COALESCE(created_at, '-infinity'::timestamptz)
            ) DESC,
            id DESC
        ) AS row_rank
      FROM ticker_alignments
    )
    SELECT *
    FROM ranked
    WHERE row_rank = 1
    ORDER BY symbol
  `) as DbAlignmentRow[];

  const normalizedRows = sortTickerRows(dedupeTickerRows(dbRows.map(mapAlignmentRow)));
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
    generatedAt: latestGeneratedAt(normalizedRows),
  };
}
