import { sql } from "@/lib/db";
import { Dashboard } from "@/components/dashboard";
import type { TickerRow } from "@/data/mock-data";

export const revalidate = 3600;

export default async function Home() {
  const rows = await sql`SELECT * FROM ticker_alignments ORDER BY id`;

  const data: TickerRow[] = (rows as Record<string, unknown>[]).map((r) => ({
    symbol: r.symbol as string,
    ticker: r.ticker as string,
    symbolName: r.symbol_name as string,
    market: r.market as TickerRow["market"],
    status: r.status as TickerRow["status"],
    weekly: {
      timeframe: "weekly" as const,
      signal: r.weekly_signal as TickerRow["weekly"]["signal"],
      candlesAgo: r.weekly_candles_ago as number,
      signalPrice: r.weekly_signal_price as number,
      currentPrice: r.weekly_current_price as number,
      scannedAt: r.weekly_scanned_at as string,
    },
    monthly: {
      timeframe: "monthly" as const,
      signal: r.monthly_signal as TickerRow["monthly"]["signal"],
      candlesAgo: r.monthly_candles_ago as number,
      signalPrice: r.monthly_signal_price as number,
      currentPrice: r.monthly_current_price as number,
      scannedAt: r.monthly_scanned_at as string,
    },
  }));

  return <Dashboard initialData={data} />;
}
