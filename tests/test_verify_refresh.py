from __future__ import annotations

import importlib
import importlib.util
import unittest
from datetime import datetime, timedelta, timezone


NOW = datetime(2026, 6, 9, 2, 0, tzinfo=timezone.utc)


class RefreshVerificationTests(unittest.TestCase):
    def validate(self, summary: dict[str, object]) -> dict[str, object]:
        spec = importlib.util.find_spec("scripts.verify_refresh")
        self.assertIsNotNone(spec, "scripts.verify_refresh must be implemented")
        module = importlib.import_module("scripts.verify_refresh")
        return module.validate_refresh_summary(
            summary,
            expected_symbols=11_054,
            max_age_hours=6,
            now=NOW,
        )

    def test_accepts_one_fresh_complete_timestamp(self) -> None:
        summary = {
            "scanned_at": NOW - timedelta(hours=1),
            "symbol_count": 11_054,
            "timeframe_row_count": 22_108,
            "timestamp_count": 1,
        }

        validated = self.validate(summary)

        self.assertEqual(validated["symbol_count"], 11_054)

    def test_rejects_incomplete_rows(self) -> None:
        summary = {
            "scanned_at": NOW - timedelta(hours=1),
            "symbol_count": 11_053,
            "timeframe_row_count": 22_106,
            "timestamp_count": 1,
        }

        with self.assertRaisesRegex(Exception, "incomplete"):
            self.validate(summary)

    def test_rejects_mixed_timestamps(self) -> None:
        summary = {
            "scanned_at": NOW - timedelta(hours=1),
            "symbol_count": 11_054,
            "timeframe_row_count": 22_108,
            "timestamp_count": 2,
        }

        with self.assertRaisesRegex(Exception, "timestamp"):
            self.validate(summary)

    def test_rejects_stale_run(self) -> None:
        summary = {
            "scanned_at": NOW - timedelta(hours=7),
            "symbol_count": 11_054,
            "timeframe_row_count": 22_108,
            "timestamp_count": 1,
        }

        with self.assertRaisesRegex(Exception, "stale"):
            self.validate(summary)


if __name__ == "__main__":
    unittest.main()
