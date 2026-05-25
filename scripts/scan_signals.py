from __future__ import annotations

import argparse
import json
import os
import random
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"


@dataclass
class Candle:
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float


def load_dotenv_file() -> None:
    for filename in [".env.local", ".env"]:
        path = ROOT / filename
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            text = line.strip()
            if not text or text.startswith("#") or "=" not in text:
                continue
            key, value = text.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8-sig"))


def dt_from_unix(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


def fetch_yahoo_daily(provider_symbol: str, range_name: str = "10y", retries: int = 2) -> list[Candle]:
    encoded = urllib.parse.quote(provider_symbol, safe="")
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?interval=1d&range={range_name}"
    last_error: Exception | None = None

    for attempt in range(retries):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
            )
            with urllib.request.urlopen(request, timeout=10) as response:
                payload = json.loads(response.read().decode("utf-8"))
            break
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt < retries - 1:
                time.sleep(0.25 + random.uniform(0.05, 0.2))
    else:
        if last_error:
            raise last_error
        return []

    result = payload.get("chart", {}).get("result")
    if not result:
        return []

    data = result[0]
    timestamps = data.get("timestamp", [])
    quote = data.get("indicators", {}).get("quote", [{}])[0]
    opens = quote.get("open", [])
    highs = quote.get("high", [])
    lows = quote.get("low", [])
    closes = quote.get("close", [])
    volumes = quote.get("volume", [])

    candles: list[Candle] = []
    for index, ts in enumerate(timestamps):
        try:
            open_price = opens[index]
            high_price = highs[index]
            low_price = lows[index]
            close_price = closes[index]
            volume = volumes[index] if index < len(volumes) and volumes[index] is not None else 0
            if None in {open_price, high_price, low_price, close_price}:
                continue
            candles.append(
                Candle(
                    timestamp=dt_from_unix(int(ts)),
                    open=float(open_price),
                    high=float(high_price),
                    low=float(low_price),
                    close=float(close_price),
                    volume=float(volume),
                )
            )
        except (IndexError, TypeError, ValueError):
            continue

    candles.sort(key=lambda candle: candle.timestamp)
    return candles


def fetch_binance_klines(symbol: str, timeframe: str, market: str = "spot", limit: int = 1000, retries: int = 2) -> list[Candle]:
    intervals = {"daily": "1d", "weekly": "1w", "monthly": "1M"}
    interval = intervals[timeframe]
    clean_symbol = symbol.strip().upper().removesuffix(".P")
    encoded_symbol = urllib.parse.quote(clean_symbol, safe="")
    host = "fapi.binance.com" if market == "futures" else "api.binance.com"
    path = "/fapi/v1/klines" if market == "futures" else "/api/v3/klines"
    url = f"https://{host}{path}?symbol={encoded_symbol}&interval={interval}&limit={limit}"
    last_error: Exception | None = None

    for attempt in range(retries):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
            )
            with urllib.request.urlopen(request, timeout=12) as response:
                payload = json.loads(response.read().decode("utf-8"))
            break
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt < retries - 1:
                time.sleep(0.25 + random.uniform(0.05, 0.2))
    else:
        if last_error:
            raise last_error
        return []

    if not isinstance(payload, list):
        raise ValueError(f"Unexpected Binance response for {clean_symbol}: {payload}")

    candles: list[Candle] = []
    for row in payload:
        try:
            candles.append(
                Candle(
                    timestamp=dt_from_unix(int(row[0]) // 1000),
                    open=float(row[1]),
                    high=float(row[2]),
                    low=float(row[3]),
                    close=float(row[4]),
                    volume=float(row[5]),
                )
            )
        except (IndexError, TypeError, ValueError):
            continue

    candles.sort(key=lambda candle: candle.timestamp)
    return candles


def aggregate_weekly(candles: list[Candle]) -> list[Candle]:
    bucketed: dict[str, list[Candle]] = {}
    for candle in candles:
        dt = datetime.strptime(candle.timestamp, "%Y-%m-%d")
        year, week, _ = dt.isocalendar()
        bucketed.setdefault(f"{year}-W{week:02d}", []).append(candle)

    aggregated: list[Candle] = []
    for _, values in sorted(bucketed.items(), key=lambda item: item[0]):
        first = values[0]
        last = values[-1]
        aggregated.append(
            Candle(
                timestamp=last.timestamp,
                open=first.open,
                high=max(value.high for value in values),
                low=min(value.low for value in values),
                close=last.close,
                volume=sum(value.volume for value in values),
            )
        )
    return aggregated


def aggregate_monthly(candles: list[Candle]) -> list[Candle]:
    bucketed: dict[str, list[Candle]] = {}
    for candle in candles:
        dt = datetime.strptime(candle.timestamp, "%Y-%m-%d")
        bucketed.setdefault(f"{dt.year}-{dt.month:02d}", []).append(candle)

    aggregated: list[Candle] = []
    for _, values in sorted(bucketed.items(), key=lambda item: item[0]):
        first = values[0]
        last = values[-1]
        aggregated.append(
            Candle(
                timestamp=last.timestamp,
                open=first.open,
                high=max(value.high for value in values),
                low=min(value.low for value in values),
                close=last.close,
                volume=sum(value.volume for value in values),
            )
        )
    return aggregated


def true_range(current: Candle, previous_close: float) -> float:
    return max(
        current.high - current.low,
        abs(current.high - previous_close),
        abs(current.low - previous_close),
    )


def atr(candles: list[Candle], period: int) -> list[float]:
    if len(candles) < 2:
        return [0.0 for _ in candles]

    tr_values = [0.0]
    for index in range(1, len(candles)):
        tr_values.append(true_range(candles[index], candles[index - 1].close))

    atr_values = [0.0 for _ in candles]
    if len(candles) <= period:
        return atr_values

    seed = sum(tr_values[1 : period + 1]) / period
    atr_values[period] = seed

    for index in range(period + 1, len(candles)):
        atr_values[index] = ((atr_values[index - 1] * (period - 1)) + tr_values[index]) / period

    return atr_values


def last_true_index(values: list[bool]) -> int | None:
    for index in range(len(values) - 1, -1, -1):
        if values[index]:
            return index
    return None


def ut_bot_alerts(candles: list[Candle], key_value: float, atr_period: int, lookback: int) -> dict[str, Any]:
    if len(candles) < atr_period + 3:
        return {
            "buy_recent": False,
            "sell_recent": False,
            "bars_since_buy": None,
            "bars_since_sell": None,
            "last_buy_price": None,
            "last_sell_price": None,
            "close": candles[-1].close if candles else None,
        }

    closes = [candle.close for candle in candles]
    atr_values = atr(candles, atr_period)
    trails = [closes[0]]

    for index in range(1, len(candles)):
        n_loss = key_value * atr_values[index]
        previous_trail = trails[-1]
        previous_close = closes[index - 1]
        close = closes[index]

        if close > previous_trail and previous_close > previous_trail:
            next_trail = max(previous_trail, close - n_loss)
        elif close < previous_trail and previous_close < previous_trail:
            next_trail = min(previous_trail, close + n_loss)
        elif close > previous_trail:
            next_trail = close - n_loss
        else:
            next_trail = close + n_loss

        trails.append(next_trail)

    buy_flags = [False for _ in closes]
    sell_flags = [False for _ in closes]

    for index in range(1, len(closes)):
        buy_flags[index] = closes[index] > trails[index] and closes[index - 1] <= trails[index - 1]
        sell_flags[index] = closes[index] < trails[index] and closes[index - 1] >= trails[index - 1]

    last_buy = last_true_index(buy_flags)
    last_sell = last_true_index(sell_flags)
    bars_since_buy = None if last_buy is None else len(closes) - 1 - last_buy
    bars_since_sell = None if last_sell is None else len(closes) - 1 - last_sell

    return {
        "buy_recent": bars_since_buy is not None and bars_since_buy < lookback,
        "sell_recent": bars_since_sell is not None and bars_since_sell < lookback,
        "bars_since_buy": bars_since_buy,
        "bars_since_sell": bars_since_sell,
        "last_buy_price": None if last_buy is None else closes[last_buy],
        "last_sell_price": None if last_sell is None else closes[last_sell],
        "close": closes[-1],
    }


def state_from_tf(tf_data: dict[str, Any]) -> str:
    buy_recent = bool(tf_data.get("buy_recent", False))
    sell_recent = bool(tf_data.get("sell_recent", False))

    if not buy_recent and not sell_recent:
        return "NEUTRAL"
    if buy_recent and not sell_recent:
        return "BUY"
    if sell_recent and not buy_recent:
        return "SELL"

    buy_bars = tf_data.get("bars_since_buy")
    sell_bars = tf_data.get("bars_since_sell")
    if buy_bars is None and sell_bars is None:
        return "NEUTRAL"
    if buy_bars is None:
        return "SELL"
    if sell_bars is None:
        return "BUY"
    if buy_bars < sell_bars:
        return "BUY"
    if sell_bars < buy_bars:
        return "SELL"
    return "NEUTRAL"


def signal_metrics(signal: str, tf_data: dict[str, Any]) -> tuple[int | None, float | None]:
    if signal == "BUY":
        price = tf_data.get("last_buy_price")
        return tf_data.get("bars_since_buy"), float(price) if price is not None else None
    if signal == "SELL":
        price = tf_data.get("last_sell_price")
        return tf_data.get("bars_since_sell"), float(price) if price is not None else None

    buy_bars = tf_data.get("bars_since_buy")
    sell_bars = tf_data.get("bars_since_sell")
    if buy_bars is None and sell_bars is None:
        return None, None
    if buy_bars is None:
        price = tf_data.get("last_sell_price")
        return sell_bars, float(price) if price is not None else None
    if sell_bars is None:
        price = tf_data.get("last_buy_price")
        return buy_bars, float(price) if price is not None else None
    if buy_bars <= sell_bars:
        price = tf_data.get("last_buy_price")
        return buy_bars, float(price) if price is not None else None
    price = tf_data.get("last_sell_price")
    return sell_bars, float(price) if price is not None else None


def fetch_candles(provider_symbol: str, timeframe: str) -> list[Candle]:
    if provider_symbol.startswith("BINANCE_SPOT:"):
        return fetch_binance_klines(provider_symbol.split(":", 1)[1], timeframe, market="spot")
    if provider_symbol.startswith("BINANCE_FUTURES:"):
        return fetch_binance_klines(provider_symbol.split(":", 1)[1], timeframe, market="futures")

    daily = fetch_yahoo_daily(provider_symbol)
    if timeframe == "daily":
        return daily
    if timeframe == "monthly":
        return aggregate_monthly(daily)
    return aggregate_weekly(daily)


def fetch_timeframe_candles(provider_symbol: str) -> dict[str, list[Candle]]:
    if provider_symbol.startswith("BINANCE_SPOT:") or provider_symbol.startswith("BINANCE_FUTURES:"):
        return {
            "weekly": fetch_candles(provider_symbol, "weekly"),
            "monthly": fetch_candles(provider_symbol, "monthly"),
        }

    daily = fetch_yahoo_daily(provider_symbol)
    return {
        "weekly": aggregate_weekly(daily),
        "monthly": aggregate_monthly(daily),
    }


def scan_symbol(symbol: str, meta: dict[str, Any], strategy: dict[str, Any], provider_map: dict[str, str]) -> dict[str, Any]:
    scan_time = datetime.now(timezone.utc).isoformat()
    key_value = float(strategy.get("key_value", 2))
    atr_period = int(strategy.get("atr_period", 6))
    lookbacks = strategy.get("lookback_candles", {"monthly": 6, "weekly": 24})
    bare_symbol = symbol.split(":", 1)[1] if ":" in symbol else symbol
    provider_symbol = provider_map.get(symbol) or provider_map.get(bare_symbol) or symbol
    row_meta = meta.get(symbol, {})
    signals: dict[str, Any] = {}

    try:
        candles_by_timeframe = fetch_timeframe_candles(provider_symbol)
    except Exception as exc:  # noqa: BLE001
        candles_by_timeframe = {}
        fetch_error = str(exc)
    else:
        fetch_error = ""

    for timeframe in ["weekly", "monthly"]:
        try:
            candles = candles_by_timeframe.get(timeframe, [])
            if not candles and fetch_error:
                raise RuntimeError(fetch_error)
            tf_data = ut_bot_alerts(candles, key_value, atr_period, int(lookbacks.get(timeframe, 3)))
            signal = state_from_tf(tf_data)
            candles_ago, signal_price = signal_metrics(signal, tf_data)
            close = tf_data.get("close")
            signals[timeframe] = {
                "timeframe": timeframe,
                "signal": signal,
                "candlesAgo": candles_ago,
                "signalPrice": signal_price,
                "currentPrice": float(close) if close is not None else None,
                "scannedAt": scan_time,
            }
        except Exception as exc:  # noqa: BLE001
            signals[timeframe] = {
                "timeframe": timeframe,
                "signal": "NEUTRAL",
                "candlesAgo": None,
                "signalPrice": None,
                "currentPrice": None,
                "scannedAt": scan_time,
                "error": str(exc),
            }

    weekly_signal = signals["weekly"]["signal"]
    monthly_signal = signals["monthly"]["signal"]
    if weekly_signal == "BUY" and monthly_signal == "BUY":
        status = "Aligned BUY"
    elif weekly_signal == "BUY" and monthly_signal == "NEUTRAL":
        status = "Weekly BUY, Monthly Neutral"
    elif weekly_signal != monthly_signal and weekly_signal != "NEUTRAL" and monthly_signal != "NEUTRAL":
        status = "Conflict"
    else:
        status = "Avoid"

    return {
        "symbol": symbol,
        "ticker": bare_symbol,
        "symbolName": row_meta.get("name") or bare_symbol,
        "market": row_meta.get("market") or "UNKNOWN",
        "status": status,
        "weekly": signals["weekly"],
        "monthly": signals["monthly"],
    }


def write_snapshot(rows: list[dict[str, Any]]) -> None:
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "rows": rows,
    }
    path = DATA_DIR / "latest_alignment.json"
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    if os.name == "nt" and path.exists():
        path.unlink()
    temp.replace(path)


def seed_database(rows: list[dict[str, Any]]) -> None:
    load_dotenv_file()
    database_url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not database_url:
        return

    try:
        import psycopg
    except ImportError:
        print("psycopg is not installed; skipped database seed")
        return

    create_sql = """
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
    );
    create index if not exists idx_signal_snapshots_symbol_tf_time
      on signal_snapshots(symbol, timeframe, scanned_at desc);
    """
    upsert_sql = """
    insert into signal_snapshots
      (symbol, symbol_name, market, timeframe, signal, price, signal_price, candles_ago, scanned_at)
    values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    on conflict (symbol, timeframe, scanned_at) do update set
      symbol_name = excluded.symbol_name,
      market = excluded.market,
      signal = excluded.signal,
      price = excluded.price,
      signal_price = excluded.signal_price,
      candles_ago = excluded.candles_ago;
    """

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(create_sql)
            for row in rows:
                for timeframe in ["weekly", "monthly"]:
                    signal = row[timeframe]
                    cursor.execute(
                        upsert_sql,
                        (
                            row["symbol"],
                            row["symbolName"],
                            row["market"],
                            timeframe,
                            signal["signal"],
                            signal["currentPrice"],
                            signal["signalPrice"],
                            signal["candlesAgo"],
                            signal["scannedAt"],
                        ),
                    )
        connection.commit()
    print(f"seeded {len(rows) * 2} timeframe rows into Neon/Postgres")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=16)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--seed-db", action="store_true")
    parser.add_argument("--checkpoint", type=int, default=250)
    args = parser.parse_args()

    universe = load_json(DATA_DIR / "universe.json", {"symbols": []})
    meta = load_json(DATA_DIR / "symbol_meta.json", {})
    provider_map = load_json(DATA_DIR / "provider_map.json", {})
    strategy = load_json(DATA_DIR / "strategy.json", {})
    symbols = [str(symbol).strip().upper() for symbol in universe.get("symbols", []) if str(symbol).strip()]
    if args.limit > 0:
        symbols = symbols[: args.limit]

    rows: list[dict[str, Any]] = []
    started = time.time()
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = {executor.submit(scan_symbol, symbol, meta, strategy, provider_map): symbol for symbol in symbols}
        for index, future in enumerate(as_completed(futures), start=1):
            rows.append(future.result())
            if index % max(1, args.checkpoint) == 0 or index == len(symbols):
                rows.sort(key=lambda row: (row["status"] != "Aligned BUY", row["ticker"]))
                write_snapshot(rows)
                print(f"scanned={index}/{len(symbols)} elapsed={time.time() - started:.1f}s")

    rows.sort(key=lambda row: (row["status"] != "Aligned BUY", row["ticker"]))
    write_snapshot(rows)
    if args.seed_db:
        seed_database(rows)

    counts = {
        status: sum(1 for row in rows if row["status"] == status)
        for status in ["Aligned BUY", "Weekly BUY, Monthly Neutral", "Conflict", "Avoid"]
    }
    print(f"updated alignment snapshot: {counts}")


if __name__ == "__main__":
    main()
