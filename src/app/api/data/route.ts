import { NextRequest, NextResponse } from "next/server";
import { getAlignmentRows } from "@/lib/db";
import type { Alignment, Signal } from "@/data/mock-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const result = await getAlignmentRows({
      ticker: sp.get("ticker") || "",
      market: sp.get("market") || "ALL",
      weekly: (sp.get("weekly") || "ALL") as Signal | "ALL",
      monthly: (sp.get("monthly") || "ALL") as Signal | "ALL",
      status: (sp.get("status") || "ALL") as Alignment | "ALL",
      maxCandles: positiveInt(sp.get("maxCandles"), 0),
      limit: positiveInt(sp.get("limit"), 50),
      offset: Math.max(0, positiveInt(sp.get("offset"), 0)),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
