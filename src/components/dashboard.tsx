"use client";

import { useState, useMemo } from "react";
import { Search, Download, ExternalLink } from "lucide-react";
import type { TickerRow, Alignment, Market } from "@/data/mock-data";

const ALL_MARKETS: Market[] = [
  "Basic Materials", "Communication Services", "Consumer Cyclical",
  "Consumer Defensive", "Energy", "Financial", "Healthcare",
  "Industrials", "Real Estate", "Technology", "Utilities",
];

const ALIGNMENT_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "Aligned BUY", label: "Aligned BUY" },
  { key: "Weekly BUY, Monthly Neutral", label: "Watch" },
  { key: "Conflict", label: "Conflict" },
  { key: "Avoid", label: "Avoid" },
] as const;

type WeeklyFilter = "ALL" | "BUY" | "NEUTRAL" | "SELL";
type MonthlyFilter = "ALL" | "BUY" | "NEUTRAL" | "SELL";

function formatPrice(p: number): string {
  return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "America/New_York",
  });
}

function SignalBadge({ signal }: { signal: string }) {
  const colorMap: Record<string, string> = {
    BUY: "bg-emerald-300/10 text-emerald-200 ring-1 ring-emerald-300/30",
    NEUTRAL: "bg-slate-300/10 text-slate-300 ring-1 ring-slate-300/30",
    SELL: "bg-red-300/10 text-red-200 ring-1 ring-red-300/30",
  };
  return (
    <span className={`inline-flex h-6 w-full items-center justify-center rounded px-2 font-mono text-[11px] ${colorMap[signal] ?? "bg-white/5 text-white/70 ring-1 ring-white/20"}`}>
      {signal}
    </span>
  );
}

function AlignmentBadge({ status }: { status: Alignment }) {
  const map: Record<Alignment, string> = {
    "Aligned BUY": "border-emerald-300/40 bg-emerald-300/10 text-emerald-100",
    "Weekly BUY, Monthly Neutral": "border-cyan-300/40 bg-cyan-300/10 text-cyan-100",
    Conflict: "border-amber-300/40 bg-amber-300/10 text-amber-100",
    Avoid: "border-red-300/40 bg-red-300/10 text-red-100",
  };
  const label = status === "Weekly BUY, Monthly Neutral" ? "Watch" : status;
  return (
    <span className={`inline-flex h-7 items-center rounded border px-2 text-[11px] ${map[status]}`}>
      {label}
    </span>
  );
}

export function Dashboard({ initialData }: { initialData: TickerRow[] }) {
  const [searchInput, setSearchInput] = useState("");
  const [tableFilterTicker, setTableFilterTicker] = useState("");
  const [marketFilter, setMarketFilter] = useState<string>("ALL");
  const [tableFilterMarket, setTableFilterMarket] = useState<string>("ALL");
  const [weeklyFilter, setWeeklyFilter] = useState<WeeklyFilter>("ALL");
  const [tableFilterWeekly, setTableFilterWeekly] = useState<WeeklyFilter>("ALL");
  const [monthlyFilter, setMonthlyFilter] = useState<MonthlyFilter>("ALL");
  const [tableFilterMonthly, setTableFilterMonthly] = useState<MonthlyFilter>("ALL");
  const [maxCandles, setMaxCandles] = useState("");
  const [tableFilterMaxCandles, setTableFilterMaxCandles] = useState("");
  const [alignmentFilter, setAlignmentFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    let rows = initialData;

    if (tableFilterTicker.trim()) {
      const q = tableFilterTicker.trim().toUpperCase();
      rows = rows.filter(
        (r) => r.ticker.toUpperCase().includes(q) || r.symbolName.toUpperCase().includes(q)
      );
    }
    if (tableFilterMarket !== "ALL") {
      rows = rows.filter((r) => r.market === tableFilterMarket);
    }
    if (tableFilterWeekly !== "ALL") {
      rows = rows.filter((r) => r.weekly.signal === tableFilterWeekly);
    }
    if (tableFilterMonthly !== "ALL") {
      rows = rows.filter((r) => r.monthly.signal === tableFilterMonthly);
    }
    const mc = parseInt(tableFilterMaxCandles, 10);
    if (!isNaN(mc) && mc > 0) {
      rows = rows.filter((r) => r.weekly.candlesAgo <= mc && r.monthly.candlesAgo <= mc);
    }
    if (alignmentFilter !== "ALL") {
      rows = rows.filter((r) => r.status === alignmentFilter);
    }
    return rows;
  }, [initialData, tableFilterTicker, tableFilterMarket, tableFilterWeekly, tableFilterMonthly, tableFilterMaxCandles, alignmentFilter]);

  const stats = useMemo(() => ({
    total: filtered.length,
    alignedBuy: filtered.filter((r) => r.status === "Aligned BUY").length,
    watch: filtered.filter((r) => r.status === "Weekly BUY, Monthly Neutral").length,
    conflict: filtered.filter((r) => r.status === "Conflict").length,
    avoid: filtered.filter((r) => r.status === "Avoid").length,
  }), [filtered]);

  return (
    <main className="min-h-screen bg-[#0b0d10] text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">Weekly and monthly candle alignment</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-4xl">UT Bot Alignment - Weekly &amp; Monthly</h1>
          </div>
          <div className="rounded border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
            <p className="text-slate-400">Updated</p>
            <p className="mt-1 font-mono text-xs leading-5 text-white">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
            </p>
          </div>
        </header>

        <section className="rounded border border-white/10 bg-white/[0.03]">
          <div className="grid gap-3 border-b border-white/10 p-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Tickers", value: stats.total, border: "border-cyan-300/40 bg-cyan-300/10", isActive: true },
              { label: "Aligned BUY", value: stats.alignedBuy, border: alignmentFilter === "Aligned BUY" ? "border-emerald-300/40 bg-emerald-300/10" : "border-emerald-300/20 bg-emerald-300/[0.04] hover:border-emerald-300/35", textColor: "text-emerald-100" },
              { label: "Weekly BUY, Monthly Neutral", value: stats.watch, border: alignmentFilter === "Weekly BUY, Monthly Neutral" ? "border-cyan-300/40 bg-cyan-300/10" : "border-cyan-300/20 bg-cyan-300/[0.04] hover:border-cyan-300/35", textColor: "text-cyan-100" },
              { label: "Conflicts", value: stats.conflict, border: alignmentFilter === "Conflict" ? "border-amber-300/40 bg-amber-300/10" : "border-amber-300/20 bg-amber-300/[0.04] hover:border-amber-300/35", textColor: "text-amber-100" },
              { label: "Avoid", value: stats.avoid, border: alignmentFilter === "Avoid" ? "border-red-300/40 bg-red-300/10" : "border-white/10 bg-white/[0.02] hover:border-white/25", textColor: "text-slate-400" },
            ].map((card, i) => (
              <button
                key={card.label}
                className={`rounded border px-4 py-3 text-left transition ${card.border}`}
                type="button"
                onClick={() => {
                  if (i === 0) setAlignmentFilter("ALL");
                  else {
                    const keys = ["Aligned BUY", "Weekly BUY, Monthly Neutral", "Conflict", "Avoid"];
                    const k = keys[i - 1];
                    setAlignmentFilter(alignmentFilter === k ? "ALL" : k);
                  }
                }}
              >
                <p className={`text-sm ${card.textColor ?? "text-slate-400"}`}>{card.label}</p>
                <p className="mt-1 font-mono text-2xl text-white">{card.value.toLocaleString()}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-3 border-b border-white/10 px-4 py-4 lg:grid-cols-[1fr_minmax(24rem,32rem)] lg:items-end">
            <div>
              <h2 className="text-xl font-semibold text-white">Alignment Board</h2>
              <p className="mt-1 text-sm text-slate-400">{initialData.length.toLocaleString()} matching names · rendering {filtered.length} visible rows</p>
            </div>
            <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); setTableFilterTicker(searchInput); }}>
              <div className="flex gap-2">
                <label className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input className="h-10 w-full rounded border border-white/10 bg-black/20 pl-9 pr-3 text-sm font-mono text-white outline-none transition placeholder:font-sans placeholder:text-slate-600 focus:border-cyan-300/60" placeholder="Check ticker, e.g. AAPL" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
                </label>
                <button className="inline-flex h-10 min-w-24 items-center justify-center rounded border border-cyan-300/30 bg-cyan-300/10 px-3 text-sm font-medium text-cyan-100 transition hover:border-cyan-200" type="submit">Check</button>
              </div>
            </form>
          </div>

          <div className="flex flex-col gap-4 border-b border-white/10 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span>{initialData.length.toLocaleString()} total names</span>
              <a className="inline-flex h-9 items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-100" href="/api/export?format=csv"><Download className="h-3.5 w-3.5" />CSV</a>
              <a className="inline-flex h-9 items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-100" href="/api/export?format=xlsx"><Download className="h-3.5 w-3.5" />Excel</a>
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(13rem,1fr)_9rem_9rem_9rem_8rem]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input className="h-10 w-full rounded border border-white/10 bg-black/20 pl-9 pr-9 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60" placeholder="Ticker or market" value={tableFilterTicker} onChange={(e) => setTableFilterTicker(e.target.value)} />
              </label>
              <select className="h-10 rounded border border-white/10 bg-[#101318] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60" value={marketFilter} onChange={(e) => { setMarketFilter(e.target.value); setTableFilterMarket(e.target.value); }}>
                <option value="ALL">All markets</option>
                {ALL_MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className="h-10 rounded border border-white/10 bg-[#101318] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60" value={weeklyFilter} onChange={(e) => { setWeeklyFilter(e.target.value as WeeklyFilter); setTableFilterWeekly(e.target.value as WeeklyFilter); }}>
                <option value="ALL">Weekly any</option>
                <option value="BUY">Weekly BUY</option>
                <option value="NEUTRAL">Weekly NEUTRAL</option>
                <option value="SELL">Weekly SELL</option>
              </select>
              <select className="h-10 rounded border border-white/10 bg-[#101318] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60" value={monthlyFilter} onChange={(e) => { setMonthlyFilter(e.target.value as MonthlyFilter); setTableFilterMonthly(e.target.value as MonthlyFilter); }}>
                <option value="ALL">Monthly any</option>
                <option value="BUY">Monthly BUY</option>
                <option value="NEUTRAL">Monthly NEUTRAL</option>
                <option value="SELL">Monthly SELL</option>
              </select>
              <input className="h-10 rounded border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60" inputMode="numeric" min="0" placeholder="Max candles" type="number" value={maxCandles} onChange={(e) => { setMaxCandles(e.target.value); setTableFilterMaxCandles(e.target.value); }} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-3">
            {ALIGNMENT_FILTERS.map((f) => {
              const active = alignmentFilter === f.key;
              const activeClass = f.key === "Avoid" ? "border-red-300/40 bg-red-300/10 text-red-100" : "border-cyan-300/40 bg-cyan-300/10 text-cyan-100";
              return (
                <button key={f.key} className={`rounded border px-3 py-2 text-sm transition ${active ? activeClass : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/25"}`} type="button" onClick={() => setAlignmentFilter(alignmentFilter === f.key ? "ALL" : f.key)}>
                  {f.label} <span className="ml-1 font-mono text-xs opacity-75">
                    {f.key === "ALL" ? filtered.length.toLocaleString() : filtered.filter((r) => r.status === f.key).length.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="max-h-[72vh] overflow-auto" style={{ overflowAnchor: "none" }}>
            <table className="w-full min-w-[1180px] table-fixed border-collapse text-left text-xs">
              <colgroup>
                <col className="w-[9%]" /><col className="w-[13%]" /><col className="w-[8%]" /><col className="w-[9%]" />
                <col className="w-[7%]" /><col className="w-[5%]" /><col className="w-[8%]" /><col className="w-[8%]" />
                <col className="w-[7%]" /><col className="w-[5%]" /><col className="w-[8%]" /><col className="w-[8%]" /><col className="w-[5%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[#14171c] text-[11px] uppercase tracking-normal text-slate-400 shadow-[0_1px_0_rgba(255,255,255,0.1)]">
                <tr>
                  <th className="px-2 py-2" rowSpan={2}>Ticker</th>
                  <th className="px-2 py-2" rowSpan={2}>Name</th>
                  <th className="px-2 py-2" rowSpan={2}>Market</th>
                  <th className="px-2 py-2" rowSpan={2}>Alignment</th>
                  <th className="border-l border-white/10 px-2 py-2 text-center text-cyan-200" colSpan={4}>Weekly</th>
                  <th className="border-l border-white/10 px-2 py-2 text-center text-violet-200" colSpan={4}>Monthly</th>
                  <th className="border-l border-white/10 px-2 py-2 text-right" rowSpan={2}>Chart</th>
                </tr>
                <tr>
                  <th className="border-l border-white/10 px-2 py-2">Signal</th>
                  <th className="px-2 py-2 text-right">Ago</th>
                  <th className="px-2 py-2 text-right">Signal Px</th>
                  <th className="px-2 py-2 text-right">Current</th>
                  <th className="border-l border-white/10 px-2 py-2">Signal</th>
                  <th className="px-2 py-2 text-right">Ago</th>
                  <th className="px-2 py-2 text-right">Signal Px</th>
                  <th className="px-2 py-2 text-right">Current</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={`${row.symbol}-${row.weekly.scannedAt}-${row.monthly.scannedAt}`} className="border-t border-white/10 transition hover:bg-white/[0.025]">
                    <td className="truncate px-2 py-3 font-mono font-semibold text-cyan-200" title={row.ticker}>{row.ticker}</td>
                    <td className="truncate px-2 py-3 text-slate-200" title={row.symbolName}>{row.symbolName}</td>
                    <td className="truncate px-2 py-3 text-slate-400">{row.market}</td>
                    <td className="px-2 py-3"><AlignmentBadge status={row.status} /></td>
                    <td className="border-l border-white/10 px-2 py-3"><SignalBadge signal={row.weekly.signal} /><p className="mt-1 truncate font-mono text-[10px] text-slate-600">{formatDate(row.weekly.scannedAt)}</p></td>
                    <td className="px-2 py-3 text-right font-mono text-slate-200">{row.weekly.candlesAgo}</td>
                    <td className="px-2 py-3 text-right font-mono text-slate-200">{formatPrice(row.weekly.signalPrice)}</td>
                    <td className="px-2 py-3 text-right font-mono text-white">{formatPrice(row.weekly.currentPrice)}</td>
                    <td className="border-l border-white/10 px-2 py-3"><SignalBadge signal={row.monthly.signal} /><p className="mt-1 truncate font-mono text-[10px] text-slate-600">{formatDate(row.monthly.scannedAt)}</p></td>
                    <td className="px-2 py-3 text-right font-mono text-slate-200">{row.monthly.candlesAgo}</td>
                    <td className="px-2 py-3 text-right font-mono text-slate-200">{formatPrice(row.monthly.signalPrice)}</td>
                    <td className="px-2 py-3 text-right font-mono text-white">{formatPrice(row.monthly.currentPrice)}</td>
                    <td className="border-l border-white/10 px-2 py-3 text-right">
                      <a aria-label={`Open ${row.ticker} on TradingView`} className="inline-flex h-8 w-8 items-center justify-center rounded border border-cyan-300/30 text-cyan-200 transition hover:border-cyan-200 hover:bg-cyan-300/10" href={`https://www.tradingview.com/chart/?symbol=${row.ticker}`} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" /></a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
