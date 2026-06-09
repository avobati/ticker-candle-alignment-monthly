from __future__ import annotations

import unittest
from unittest.mock import patch

from scripts import scan_signals
from scripts.scan_signals import Candle, aggregate_weekly, ut_bot_alerts


def candle(timestamp: str, close: float) -> Candle:
    return Candle(
        timestamp=timestamp,
        open=close,
        high=close + 1,
        low=close - 1,
        close=close,
        volume=1,
    )


class WeeklyCandleTests(unittest.TestCase):
    def test_aggregate_weekly_includes_the_ongoing_iso_week(self) -> None:
        daily = [
            candle("2026-06-01", 10),
            candle("2026-06-02", 9),
            candle("2026-06-03", 8),
            candle("2026-06-04", 7),
            candle("2026-06-05", 6),
            candle("2026-06-08", 11),
            candle("2026-06-09", 12),
        ]

        weekly = aggregate_weekly(daily)

        self.assertEqual(len(weekly), 2)
        self.assertEqual(weekly[-1].timestamp, "2026-06-09")
        self.assertEqual(weekly[-1].close, 12)

    def test_signal_on_ongoing_week_is_week_zero(self) -> None:
        weekly = [
            candle("2026-05-11", 10),
            candle("2026-05-18", 9),
            candle("2026-05-25", 8),
            candle("2026-06-01", 7),
            candle("2026-06-09", 12),
        ]

        result = ut_bot_alerts(weekly, key_value=1, atr_period=2, lookback=10)

        self.assertEqual(result["bars_since_buy"], 0)
        self.assertEqual(result["last_buy_price"], 12)


def signal(timeframe: str, error: str | None = None) -> dict[str, object]:
    result: dict[str, object] = {
        "timeframe": timeframe,
        "signal": "BUY",
        "candlesAgo": 0,
        "signalPrice": 10,
        "currentPrice": 11,
        "scannedAt": "2026-06-09T01:07:00+00:00",
    }
    if error:
        result["error"] = error
    return result


def row(symbol: str, error: str | None = None) -> dict[str, object]:
    return {
        "symbol": symbol,
        "weekly": signal("weekly", error),
        "monthly": signal("monthly"),
    }


class ScanValidationTests(unittest.TestCase):
    def validate(self, rows: list[dict[str, object]], expected_count: int):
        validator = getattr(scan_signals, "validate_scan_results", None)
        self.assertIsNotNone(validator, "validate_scan_results must be implemented")
        return validator(rows, expected_count=expected_count, max_failure_rate=0.05)

    def test_accepts_a_complete_scan_below_the_failure_limit(self) -> None:
        rows = [row(f"TICKER-{index}") for index in range(20)]

        summary = self.validate(rows, expected_count=20)

        self.assertEqual(summary["symbol_count"], 20)
        self.assertEqual(summary["failed_symbol_count"], 0)
        self.assertEqual(summary["timeframe_row_count"], 40)

    def test_rejects_duplicate_or_missing_symbols(self) -> None:
        with self.assertRaisesRegex(Exception, "unique symbols"):
            self.validate([row("AAPL"), row("AAPL")], expected_count=2)

    def test_rejects_a_missing_timeframe(self) -> None:
        incomplete = row("AAPL")
        del incomplete["monthly"]

        with self.assertRaisesRegex(Exception, "weekly and monthly"):
            self.validate([incomplete], expected_count=1)

    def test_rejects_failure_rate_above_five_percent(self) -> None:
        rows = [row(f"TICKER-{index}", "provider failed" if index == 0 else None) for index in range(10)]

        with self.assertRaisesRegex(Exception, "failure rate"):
            self.validate(rows, expected_count=10)


class SymbolScanTests(unittest.TestCase):
    @patch("scripts.scan_signals.fetch_timeframe_candles", return_value={"weekly": [], "monthly": []})
    def test_empty_provider_response_is_recorded_as_failure(self, _fetch) -> None:
        result = scan_signals.scan_symbol(
            "EMPTY",
            meta={},
            strategy={"key_value": 2, "atr_period": 6},
            provider_map={},
            run_timestamp="2026-06-09T01:07:00+00:00",
        )

        self.assertIn("error", result["weekly"])
        self.assertIn("error", result["monthly"])


if __name__ == "__main__":
    unittest.main()
