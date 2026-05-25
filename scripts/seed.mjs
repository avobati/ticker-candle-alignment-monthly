import fs from "node:fs";
import { neon } from "@neondatabase/serverless";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      process.env[key] ||= value;
    }
  }
}

function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

loadEnv();

const databaseUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required to seed signals.");

const snapshot = JSON.parse(fs.readFileSync("data/latest_alignment.json", "utf8"));
const fallbackScannedAt = snapshot.generatedAt || new Date().toISOString();
const sql = neon(databaseUrl);
const values = [];

for (const row of snapshot.rows ?? []) {
  for (const timeframe of ["weekly", "monthly"]) {
    const signal = row[timeframe];
    if (!signal) continue;
    values.push([
      row.symbol,
      row.symbolName,
      row.market,
      timeframe,
      signal.signal,
      asNumber(signal.currentPrice),
      asNumber(signal.signalPrice),
      Number.isInteger(signal.candlesAgo) ? signal.candlesAgo : null,
      signal.scannedAt || fallbackScannedAt,
    ]);
  }
}

await sql.query("truncate table signal_snapshots");

const batchSize = 500;
let inserted = 0;
for (let index = 0; index < values.length; index += batchSize) {
  const batch = values.slice(index, index + batchSize);
  const params = [];
  const placeholders = batch.map((row, rowIndex) => {
    const offset = rowIndex * 9;
    params.push(...row);
    return `(${Array.from({ length: 9 }, (_, colIndex) => `$${offset + colIndex + 1}`).join(", ")})`;
  });

  await sql.query(
    `
      insert into signal_snapshots
        (symbol, symbol_name, market, timeframe, signal, price, signal_price, candles_ago, scanned_at)
      values ${placeholders.join(", ")}
      on conflict (symbol, timeframe, scanned_at) do update set
        symbol_name = excluded.symbol_name,
        market = excluded.market,
        signal = excluded.signal,
        price = excluded.price,
        signal_price = excluded.signal_price,
        candles_ago = excluded.candles_ago
    `,
    params,
  );
  inserted += batch.length;
}

console.log(`Seed complete: ${inserted} weekly/monthly signal rows inserted or updated.`);
