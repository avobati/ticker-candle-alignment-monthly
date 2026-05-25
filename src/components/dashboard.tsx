"use client";

import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Download, ExternalLink, Search, X } from "lucide-react";
import { countAlignmentStats, filterTickerRows } from "@/lib/alignment-data";
import type { Alignment, Signal, TickerRow } from "@/data/mock-data";

type SignalFilter = Signal | "ALL";
type StatusFilter = Alignment | "ALL";

const statusOptions: StatusFilter[] = ["ALL", "Aligned BUY", "Weekly BUY, Monthly Neutral", "Conflict", "Avoid"];
const signalOptions: SignalFilter[] = ["ALL", "BUY", "NEUTRAL", "SELL"];
const rowHeight = 66;
const overscan = 12;

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (Math.abs(value) >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  }).format(new Date(iso));
}

function tradingViewUrl(symbol: string) {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}

function statusLabel(status: Alignment) {
  return status === "Weekly BUY, Monthly Neutral" ? "Watch" : status;
}

function statusClass(status: Alignment) {
  if (status === "Aligned BUY") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  if (status === "Weekly BUY, Monthly Neutral") return "border-cyan-300/40 bg-cyan-300/10 text-cyan-100";
  if (status === "Conflict") return "border-amber-300/40 bg-amber-300/10 text-amber-100";
  return "border-slate-500/40 bg-white/[0.03] text-slate-300";
}

function signalClass(signal: Signal) {
  if (signal === "BUY") return "bg-emerald-300/10 text-emerald-200 ring-1 ring-emerald-300/30";
  if (signal === "SELL") return "bg-rose-300/10 text-rose-200 ring-1 ring-rose-300/30";
  return "bg-slate-300/10 text-slate-300 ring-1 ring-slate-300/20";
}

function countStatus(rows: readonly TickerRow[], status: Alignment) {
  return rows.filter((row) => row.status === status).length;
}

export function Dashboard({ generatedAt, initialData }: { generatedAt: string | null; initialData: TickerRow[] }) {
  const [tickerInput, setTickerInput] = useState("");
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState("ALL");
  const [weeklySignal, setWeeklySignal] = useState<SignalFilter>("ALL");
  const [monthlySignal, setMonthlySignal] = useState<SignalFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [maxCandles, setMaxCandles] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(640);
  const scrollRef = useRef<HTMLDivElement>(null);

  const marketOptions = useMemo(
    () => ["ALL", ...Array.from(new Set(initialData.map((row) => row.market))).sort((a, b) => a.localeCompare(b))],
    [initialData],
  );
  const summary = useMemo(() => countAlignmentStats(initialData), [initialData]);

  const filtered = useMemo(
    () =>
      filterTickerRows(initialData, {
        query,
        market,
        weekly: weeklySignal,
        monthly: monthlySignal,
        status,
        maxCandles,
      }),
    [initialData, market, maxCandles, monthlySignal, query, status, weeklySignal],
  );

  const visibleWindow = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
    const end = Math.min(filtered.length, start + visibleCount);
    return {
      rows: filtered.slice(start, end),
      topPad: start * rowHeight,
      bottomPad: Math.max(0, (filtered.length - end) * rowHeight),
    };
  }, [filtered, scrollTop, viewportHeight]);

  function submitTicker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(tickerInput.trim());
    setStatus("ALL");
  }

  function setStatusFilter(nextStatus: StatusFilter) {
    setStatus((current) => (current === nextStatus ? "ALL" : nextStatus));
    scrollRef.current?.scrollTo({ top: 0 });
  }

  return (
    <main className="min-h-screen bg-[#0b0d10] text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">Weekly and monthly candle alignment</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
              UT Bot Alignment - Weekly &amp; Monthly
            </h1>
          </div>
          <div className="rounded border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
            <p className="text-slate-400">Updated</p>
            <p className="mt-1 font-mono text-xs leading-5 text-white">{formatDate(generatedAt)}</p>
          </div>
        </header>

        <section className="rounded border border-white/10 bg-white/[0.03]">
          <div className="grid gap-3 border-b border-white/10 p-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Tickers", value: summary.total, target: "ALL" as const, className: "border-cyan-300/40 bg-cyan-300/10 text-slate-400" },
              { label: "Aligned BUY", value: summary.alignedBuy, target: "Aligned BUY" as const, className: "border-emerald-300/20 bg-emerald-300/[0.04] text-emerald-100 hover:border-emerald-300/35" },
              { label: "Weekly BUY, Monthly Neutral", value: summary.watch, target: "Weekly BUY, Monthly Neutral" as const, className: "border-cyan-300/20 bg-cyan-300/[0.04] text-cyan-100 hover:border-cyan-300/35" },
              { label: "Conflicts", value: summary.conflict, target: "Conflict" as const, className: "border-amber-300/20 bg-amber-300/[0.04] text-amber-100 hover:border-amber-300/35" },
              { label: "Avoid", value: summary.avoid, target: "Avoid" as const, className: "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/25" },
            ].map((card) => {
              const active = status === card.target;
              return (
                <button
                  className={`rounded border px-4 py-3 text-left transition ${active ? "border-cyan-300/50 bg-cyan-300/10" : card.className}`}
                  key={card.label}
                  onClick={() => setStatusFilter(card.target)}
                  type="button"
                >
                  <p className={`text-sm ${card.className.split(" ").find((part) => part.startsWith("text-")) ?? "text-slate-400"}`}>{card.label}</p>
                  <p className="mt-1 font-mono text-2xl text-white">{card.value.toLocaleString("en-US")}</p>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 border-b border-white/10 px-4 py-4 lg:grid-cols-[1fr_minmax(24rem,32rem)] lg:items-end">
            <div>
              <h2 className="text-xl font-semibold text-white">Alignment Board</h2>
              <p className="mt-1 text-sm text-slate-400">
                {filtered.length.toLocaleString("en-US")} matching names · rendering {visibleWindow.rows.length.toLocaleString("en-US")} visible rows
              </p>
            </div>
            <form className="flex flex-col gap-2" onSubmit={submitTicker}>
              <div className="flex gap-2">
                <label className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    className="h-10 w-full rounded border border-white/10 bg-black/20 pl-9 pr-3 text-sm font-mono text-white outline-none transition placeholder:font-sans placeholder:text-slate-600 focus:border-cyan-300/60"
                    onChange={(event) => setTickerInput(event.target.value)}
                    placeholder="Check ticker, e.g. AAPL"
                    value={tickerInput}
                  />
                </label>
                <button className="inline-flex h-10 min-w-24 items-center justify-center rounded border border-cyan-300/30 bg-cyan-300/10 px-3 text-sm font-medium text-cyan-100 transition hover:border-cyan-200" type="submit">
                  Check
                </button>
              </div>
            </form>
          </div>

          <div className="flex flex-col gap-4 border-b border-white/10 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span>{summary.total.toLocaleString("en-US")} total names</span>
              <a className="inline-flex h-9 items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-100" href="/api/export?format=csv">
                <Download className="h-3.5 w-3.5" />
                CSV
              </a>
              <a className="inline-flex h-9 items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-100" href="/api/export?format=xlsx">
                <Download className="h-3.5 w-3.5" />
                Excel
              </a>
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(13rem,1fr)_9rem_9rem_9rem_8rem]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  className="h-10 w-full rounded border border-white/10 bg-black/20 pl-9 pr-9 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ticker or market"
                  value={query}
                />
                {query ? (
                  <button aria-label="Clear search" className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded border border-white/10 text-slate-400 transition hover:text-white" onClick={() => setQuery("")} type="button">
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </label>
              <select className="h-10 rounded border border-white/10 bg-[#101318] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60" onChange={(event) => setMarket(event.target.value)} value={market}>
                {marketOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "ALL" ? "All markets" : option}
                  </option>
                ))}
              </select>
              <select className="h-10 rounded border border-white/10 bg-[#101318] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60" onChange={(event) => setWeeklySignal(event.target.value as SignalFilter)} value={weeklySignal}>
                {signalOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "ALL" ? "Weekly any" : `Weekly ${option}`}
                  </option>
                ))}
              </select>
              <select className="h-10 rounded border border-white/10 bg-[#101318] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60" onChange={(event) => setMonthlySignal(event.target.value as SignalFilter)} value={monthlySignal}>
                {signalOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "ALL" ? "Monthly any" : `Monthly ${option}`}
                  </option>
                ))}
              </select>
              <input className="h-10 rounded border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60" inputMode="numeric" min="0" onChange={(event) => setMaxCandles(event.target.value)} placeholder="Max candles" type="number" value={maxCandles} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-3">
            {statusOptions.map((option) => {
              const active = option === status;
              const count = option === "ALL" ? summary.total : countStatus(initialData, option);
              const label = option === "ALL" ? "All" : statusLabel(option);
              return (
                <button
                  className={`rounded border px-3 py-2 text-sm transition ${active ? (option === "ALL" ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : statusClass(option)) : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/25"}`}
                  key={option}
                  onClick={() => setStatusFilter(option)}
                  type="button"
                >
                  {label} <span className="ml-1 font-mono text-xs opacity-75">{count.toLocaleString("en-US")}</span>
                </button>
              );
            })}
          </div>

          <div
            className="max-h-[72vh] overflow-auto"
            onScroll={(event) => {
              setScrollTop(event.currentTarget.scrollTop);
              setViewportHeight(event.currentTarget.clientHeight);
            }}
            ref={scrollRef}
            style={{ overflowAnchor: "none" }}
          >
            <table className="w-full min-w-[1180px] table-fixed border-collapse text-left text-xs">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[13%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                <col className="w-[7%]" />
                <col className="w-[5%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[7%]" />
                <col className="w-[5%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[5%]" />
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
                {visibleWindow.topPad ? (
                  <tr aria-hidden="true">
                    <td className="p-0" colSpan={13} style={{ height: visibleWindow.topPad }} />
                  </tr>
                ) : null}
                {visibleWindow.rows.map((row) => (
                  <tr className="border-t border-white/10 transition hover:bg-white/[0.025]" key={row.symbol}>
                    <td className="truncate px-2 py-3 font-mono font-semibold text-cyan-200" title={row.ticker}>{row.ticker}</td>
                    <td className="truncate px-2 py-3 text-slate-200" title={row.symbolName}>{row.symbolName}</td>
                    <td className="truncate px-2 py-3 text-slate-400">{row.market}</td>
                    <td className="px-2 py-3">
                      <span className={`inline-flex h-7 items-center rounded border px-2 text-[11px] ${statusClass(row.status)}`}>
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="border-l border-white/10 px-2 py-3">
                      <span className={`inline-flex h-6 w-full items-center justify-center rounded px-2 font-mono text-[11px] ${signalClass(row.weekly.signal)}`}>{row.weekly.signal}</span>
                      <p className="mt-1 truncate font-mono text-[10px] text-slate-600">{formatDate(row.weekly.scannedAt)}</p>
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-slate-200">{row.weekly.candlesAgo}</td>
                    <td className="px-2 py-3 text-right font-mono text-slate-200">{formatPrice(row.weekly.signalPrice)}</td>
                    <td className="px-2 py-3 text-right font-mono text-white">{formatPrice(row.weekly.currentPrice)}</td>
                    <td className="border-l border-white/10 px-2 py-3">
                      <span className={`inline-flex h-6 w-full items-center justify-center rounded px-2 font-mono text-[11px] ${signalClass(row.monthly.signal)}`}>{row.monthly.signal}</span>
                      <p className="mt-1 truncate font-mono text-[10px] text-slate-600">{formatDate(row.monthly.scannedAt)}</p>
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-slate-200">{row.monthly.candlesAgo}</td>
                    <td className="px-2 py-3 text-right font-mono text-slate-200">{formatPrice(row.monthly.signalPrice)}</td>
                    <td className="px-2 py-3 text-right font-mono text-white">{formatPrice(row.monthly.currentPrice)}</td>
                    <td className="border-l border-white/10 px-2 py-3 text-right">
                      <a aria-label={`Open ${row.ticker} on TradingView`} className="inline-flex h-8 w-8 items-center justify-center rounded border border-cyan-300/30 text-cyan-200 transition hover:border-cyan-200 hover:bg-cyan-300/10" href={tradingViewUrl(row.symbol)} rel="noreferrer" target="_blank">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </td>
                  </tr>
                ))}
                {visibleWindow.bottomPad ? (
                  <tr aria-hidden="true">
                    <td className="p-0" colSpan={13} style={{ height: visibleWindow.bottomPad }} />
                  </tr>
                ) : null}
                {!filtered.length ? (
                  <tr>
                    <td className="px-4 py-16 text-center text-sm text-slate-400" colSpan={13}>No tickers match the current filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
