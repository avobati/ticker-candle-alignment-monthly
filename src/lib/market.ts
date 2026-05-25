import universe from "../../data/universe.json" with { type: "json" };
import type { Alignment, Signal } from "@/data/mock-data";

type UniverseFile = {
  symbols?: string[];
};

const universeSymbols = new Set(
  ((universe as UniverseFile).symbols ?? []).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean),
);

export function shortSymbol(symbol: string) {
  const index = symbol.indexOf(":");
  return index > -1 ? symbol.slice(index + 1) : symbol;
}

export function normalizeTicker(symbol: string) {
  return shortSymbol(symbol).trim().toUpperCase().replace(/^\$/, "");
}

export function isKnownTicker(symbol: string) {
  return universeSymbols.has(normalizeTicker(symbol));
}

export function tradingViewUrl(symbol: string) {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(normalizeTicker(symbol))}`;
}

export function getAlignmentStatus(weekly: Signal, monthly: Signal): Alignment {
  if (weekly === "BUY" && monthly === "BUY") return "Aligned BUY";
  if (weekly === "BUY" && monthly === "NEUTRAL") return "Weekly BUY, Monthly Neutral";
  if (weekly !== monthly && weekly !== "NEUTRAL" && monthly !== "NEUTRAL") return "Conflict";
  return "Avoid";
}
