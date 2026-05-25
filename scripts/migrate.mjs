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

loadEnv();

const databaseUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required to run migrations.");

const sql = neon(databaseUrl);

await sql.query(`
  create table if not exists signal_snapshots (
    id bigserial primary key,
    symbol text not null,
    symbol_name text,
    market text,
    timeframe text not null check (timeframe in ('weekly', 'monthly')),
    signal text not null check (signal in ('BUY', 'SELL', 'NEUTRAL')),
    price numeric,
    signal_price numeric,
    candles_ago integer,
    scanned_at timestamptz not null,
    created_at timestamptz not null default now(),
    unique(symbol, timeframe, scanned_at)
  )
`);

await sql.query(`
  create index if not exists idx_signal_snapshots_symbol_tf_time
    on signal_snapshots(symbol, timeframe, scanned_at desc)
`);

await sql.query(`
  create index if not exists idx_signal_snapshots_signal_tf
    on signal_snapshots(signal, timeframe)
`);

console.log("Migration complete: signal_snapshots is ready for weekly/monthly signals.");
