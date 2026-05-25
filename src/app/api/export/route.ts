import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAlignmentRows } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const columns = [
  "Symbol",
  "Ticker",
  "Name",
  "Market",
  "Alignment",
  "Weekly Signal",
  "Weekly Candles Ago",
  "Weekly Signal Price",
  "Weekly Current Price",
  "Weekly Scanned At",
  "Monthly Signal",
  "Monthly Candles Ago",
  "Monthly Signal Price",
  "Monthly Current Price",
  "Monthly Scanned At",
] as const;

function fileStamp() {
  return new Date().toISOString().slice(0, 10);
}

function flattenRows(rows: Awaited<ReturnType<typeof getAlignmentRows>>["rows"]) {
  return rows.map((row) => ({
    Symbol: row.symbol,
    Ticker: row.ticker,
    Name: row.symbolName,
    Market: row.market,
    Alignment: row.status,
    "Weekly Signal": row.weekly.signal,
    "Weekly Candles Ago": row.weekly.candlesAgo,
    "Weekly Signal Price": row.weekly.signalPrice,
    "Weekly Current Price": row.weekly.currentPrice,
    "Weekly Scanned At": row.weekly.scannedAt,
    "Monthly Signal": row.monthly.signal,
    "Monthly Candles Ago": row.monthly.candlesAgo,
    "Monthly Signal Price": row.monthly.signalPrice,
    "Monthly Current Price": row.monthly.currentPrice,
    "Monthly Scanned At": row.monthly.scannedAt,
  }));
}

function csvValue(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(req: NextRequest) {
  try {
    const format = (req.nextUrl.searchParams.get("format") ?? "csv").toLowerCase();
    const { rows } = await getAlignmentRows();
    const mapped = flattenRows(rows);
    const filename = `ut-bot-alignment-weekly-monthly-${fileStamp()}`;

    if (format === "xlsx" || format === "excel") {
      const ws = XLSX.utils.json_to_sheet(mapped, { header: [...columns] });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Alignment");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const csv = [
      columns.map(csvValue).join(","),
      ...mapped.map((row) => columns.map((column) => csvValue(row[column])).join(",")),
    ].join("\r\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
