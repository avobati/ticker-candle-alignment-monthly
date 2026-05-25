import test from "node:test";
import assert from "node:assert/strict";
import { getAlignmentStatus, isKnownTicker, tradingViewUrl } from "./market.ts";

test("isKnownTicker accepts real universe symbols and rejects generated placeholders", () => {
  assert.equal(isKnownTicker("AAPL"), true);
  assert.equal(isKnownTicker("AGDA"), false);
});

test("tradingViewUrl points at the real ticker symbol", () => {
  assert.equal(tradingViewUrl("AAPL"), "https://www.tradingview.com/chart/?symbol=AAPL");
});

test("getAlignmentStatus classifies weekly and monthly signals", () => {
  assert.equal(getAlignmentStatus("BUY", "BUY"), "Aligned BUY");
  assert.equal(getAlignmentStatus("BUY", "NEUTRAL"), "Weekly BUY, Monthly Neutral");
  assert.equal(getAlignmentStatus("BUY", "SELL"), "Conflict");
  assert.equal(getAlignmentStatus("SELL", "SELL"), "Avoid");
});
