import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

interface AlignmentRow {
  symbol: string;
  ticker: string;
  symbol_name: string;
  market: string;
  status: string;
  weekly_signal: string;
  weekly_candles_ago: number;
  weekly_signal_price: number;
  weekly_current_price: number;
  weekly_scanned_at: string;
  monthly_signal: string;
  monthly_candles_ago: number;
  monthly_signal_price: number;
  monthly_current_price: number;
  monthly_scanned_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const ticker = sp.get("ticker") || "";
    const market = sp.get("market") || "ALL";
    const weekly = sp.get("weekly") || "ALL";
    const monthly = sp.get("monthly") || "ALL";
    const status = sp.get("status") || "ALL";
    const maxCandles = parseInt(sp.get("maxCandles") || "0", 10);
    const limit = parseInt(sp.get("limit") || "50", 10);
    const offset = parseInt(sp.get("offset") || "0", 10);

    // Fetch all and filter in JS for simplicity (11K rows is manageable)
    const rows = (await sql`SELECT * FROM ticker_alignments ORDER BY id`) as AlignmentRow[];

    let filtered = rows;

    if (ticker) {
      const q = ticker.toUpperCase();
      filtered = filtered.filter(
        (r) => r.ticker.toUpperCase().includes(q) || r.symbol_name.toUpperCase().includes(q)
      );
    }
    if (market !== "ALL") filtered = filtered.filter((r) => r.market === market);
    if (weekly !== "ALL") filtered = filtered.filter((r) => r.weekly_signal === weekly);
    if (monthly !== "ALL") filtered = filtered.filter((r) => r.monthly_signal === monthly);
    if (status !== "ALL") filtered = filtered.filter((r) => r.status === status);
    if (maxCandles > 0)
      filtered = filtered.filter(
        (r) => r.weekly_candles_ago <= maxCandles && r.monthly_candles_ago <= maxCandles
      );

    const total = filtered.length;

    // Stats on filtered set
    const statsMap: Record<string, number> = {};
    for (const r of filtered) {
      statsMap[r.status] = (statsMap[r.status] || 0) + 1;
    }

    const paged = filtered.slice(offset, offset + limit);

    const mapped = paged.map((r) => ({
      symbol: r.symbol,
      ticker: r.ticker,
      symbolName: r.symbol_name,
      market: r.market,
      status: r.status,
      weekly: {
        timeframe: "weekly",
        signal: r.weekly_signal,
        candlesAgo: r.weekly_candles_ago,
        signalPrice: r.weekly_signal_price,
        currentPrice: r.weekly_current_price,
        scannedAt: r.weekly_scanned_at,
      },
      monthly: {
        timeframe: "monthly",
        signal: r.monthly_signal,
        candlesAgo: r.monthly_candles_ago,
        signalPrice: r.monthly_signal_price,
        currentPrice: r.monthly_current_price,
        scannedAt: r.monthly_scanned_at,
      },
    }));

    return NextResponse.json({ rows: mapped, total, stats: statsMap });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
