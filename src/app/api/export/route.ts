import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  try {
    const format = req.nextUrl.searchParams.get("format") ?? "csv";

    const rows = await sql`SELECT * FROM ticker_alignments ORDER BY id`;

    const mapped = (rows as Record<string, unknown>[]).map((r) => ({
      Symbol: r.symbol,
      Ticker: r.ticker,
      Name: r.symbol_name,
      Market: r.market,
      Alignment: r.status,
      "Weekly Signal": r.weekly_signal,
      "Weekly Candles Ago": r.weekly_candles_ago,
      "Weekly Signal Price": r.weekly_signal_price,
      "Weekly Current Price": r.weekly_current_price,
      "Weekly Scanned At": r.weekly_scanned_at,
      "Monthly Signal": r.monthly_signal,
      "Monthly Candles Ago": r.monthly_candles_ago,
      "Monthly Signal Price": r.monthly_signal_price,
      "Monthly Current Price": r.monthly_current_price,
      "Monthly Scanned At": r.monthly_scanned_at,
    }));

    if (format === "xlsx") {
      const ws = XLSX.utils.json_to_sheet(mapped);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Alignment");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="ut-bot-alignment-weekly-monthly-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        },
      });
    }

    const headers = Object.keys(mapped[0] ?? {});
    const csvLines = [
      headers.join(","),
      ...mapped.map((row) =>
        headers
          .map((h) => {
            const val = (row as Record<string, unknown>)[h];
            if (typeof val === "string" && val.includes(",")) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return String(val ?? "");
          })
          .join(",")
      ),
    ];
    const csv = csvLines.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ut-bot-alignment-weekly-monthly-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
