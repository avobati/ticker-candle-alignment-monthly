import { NextRequest, NextResponse } from "next/server";
import { generateTickerData } from "@/data/mock-data";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const data = generateTickerData(11054);
  const format = req.nextUrl.searchParams.get("format") ?? "csv";

  const rows = data.map((r) => ({
    Symbol: r.symbol,
    Ticker: r.ticker,
    Name: r.symbolName,
    Market: r.market,
    Alignment: r.status,
    "Weekly Signal": r.weekly.signal,
    "Weekly Candles Ago": r.weekly.candlesAgo,
    "Weekly Signal Price": r.weekly.signalPrice,
    "Weekly Current Price": r.weekly.currentPrice,
    "Weekly Scanned At": r.weekly.scannedAt,
    "Monthly Signal": r.monthly.signal,
    "Monthly Candles Ago": r.monthly.candlesAgo,
    "Monthly Signal Price": r.monthly.signalPrice,
    "Monthly Current Price": r.monthly.currentPrice,
    "Monthly Scanned At": r.monthly.scannedAt,
  }));

  if (format === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alignment");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ut-bot-alignment-weekly-monthly-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  }

  // CSV
  const headers = Object.keys(rows[0] ?? {});
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
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
}
