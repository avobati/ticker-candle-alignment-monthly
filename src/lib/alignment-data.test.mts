import test from "node:test";
import assert from "node:assert/strict";
import { countAlignmentStats, dedupeTickerRows, filterTickerRows } from "./alignment-data.ts";

const baseRow = {
  symbol: "AAPL",
  ticker: "AAPL",
  symbolName: "Apple Inc",
  market: "Technology",
  status: "Aligned BUY",
  weekly: {
    timeframe: "weekly",
    signal: "BUY",
    candlesAgo: 1,
    signalPrice: 100,
    currentPrice: 110,
    scannedAt: "2026-05-25T00:00:00.000Z",
  },
  monthly: {
    timeframe: "monthly",
    signal: "BUY",
    candlesAgo: 2,
    signalPrice: 90,
    currentPrice: 110,
    scannedAt: "2026-05-25T00:00:00.000Z",
  },
} as const;

test("dedupeTickerRows keeps one row per symbol using the newest scan", () => {
  const rows = dedupeTickerRows([
    baseRow,
    {
      ...baseRow,
      status: "Conflict",
      weekly: { ...baseRow.weekly, scannedAt: "2026-05-26T00:00:00.000Z" },
      monthly: { ...baseRow.monthly, signal: "SELL", scannedAt: "2026-05-26T00:00:00.000Z" },
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "Conflict");
});

test("countAlignmentStats counts normalized ticker rows once", () => {
  const rows = dedupeTickerRows([
    baseRow,
    { ...baseRow, weekly: { ...baseRow.weekly, scannedAt: "2026-05-24T00:00:00.000Z" } },
    { ...baseRow, symbol: "MSFT", ticker: "MSFT", status: "Avoid", monthly: { ...baseRow.monthly, signal: "SELL" } },
  ]);

  assert.deepEqual(countAlignmentStats(rows), {
    total: 2,
    alignedBuy: 1,
    watch: 0,
    conflict: 0,
    avoid: 1,
  });
});

test("filterTickerRows ignores maxCandles when it is zero", () => {
  assert.equal(filterTickerRows([baseRow], { maxCandles: 0 }).length, 1);
});
