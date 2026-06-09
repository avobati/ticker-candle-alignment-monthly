from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any

try:
    from scripts.scan_signals import DATA_DIR, load_dotenv_file, load_json
except ModuleNotFoundError:
    from scan_signals import DATA_DIR, load_dotenv_file, load_json


class RefreshVerificationError(RuntimeError):
    pass


def as_utc_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        raise RefreshVerificationError("refresh timestamp is missing or invalid")

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def validate_refresh_summary(
    summary: dict[str, Any],
    expected_symbols: int,
    max_age_hours: float,
    now: datetime | None = None,
) -> dict[str, Any]:
    current_time = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    scanned_at = as_utc_datetime(summary.get("scanned_at"))
    symbol_count = int(summary.get("symbol_count") or 0)
    timeframe_row_count = int(summary.get("timeframe_row_count") or 0)
    timestamp_count = int(summary.get("timestamp_count") or 0)
    expected_timeframe_rows = expected_symbols * 2

    if timestamp_count != 1:
        raise RefreshVerificationError(
            f"refresh must use one shared timestamp; received {timestamp_count}"
        )
    if symbol_count != expected_symbols or timeframe_row_count != expected_timeframe_rows:
        raise RefreshVerificationError(
            "refresh is incomplete: "
            f"symbols={symbol_count}/{expected_symbols} "
            f"timeframe_rows={timeframe_row_count}/{expected_timeframe_rows}"
        )
    if scanned_at > current_time + timedelta(minutes=5):
        raise RefreshVerificationError("refresh timestamp is unexpectedly in the future")
    if current_time - scanned_at > timedelta(hours=max_age_hours):
        raise RefreshVerificationError(
            f"refresh is stale: scanned_at={scanned_at.isoformat()} max_age_hours={max_age_hours}"
        )

    return {
        "scanned_at": scanned_at.isoformat(),
        "symbol_count": symbol_count,
        "timeframe_row_count": timeframe_row_count,
        "timestamp_count": timestamp_count,
    }


def fetch_latest_summary(database_url: str) -> dict[str, Any]:
    try:
        import psycopg
    except ImportError as exc:
        raise RuntimeError("psycopg is required to verify a refresh") from exc

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select
                  scanned_at,
                  count(distinct symbol)::integer as symbol_count,
                  count(*)::integer as timeframe_row_count,
                  count(distinct scanned_at)::integer as timestamp_count
                from signal_snapshots
                where timeframe in ('weekly', 'monthly')
                group by scanned_at
                order by scanned_at desc
                limit 1
                """
            )
            row = cursor.fetchone()

    if not row:
        raise RefreshVerificationError("signal_snapshots contains no refresh rows")
    return {
        "scanned_at": row[0],
        "symbol_count": row[1],
        "timeframe_row_count": row[2],
        "timestamp_count": row[3],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--expected-symbols", type=int, default=0)
    parser.add_argument("--max-age-hours", type=float, default=6)
    args = parser.parse_args()

    load_dotenv_file()
    database_url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL or POSTGRES_URL is required")

    expected_symbols = args.expected_symbols
    if expected_symbols <= 0:
        universe = load_json(DATA_DIR / "universe.json", {"symbols": []})
        expected_symbols = len(universe.get("symbols", []))

    summary = fetch_latest_summary(database_url)
    validated = validate_refresh_summary(
        summary,
        expected_symbols=expected_symbols,
        max_age_hours=args.max_age_hours,
    )
    print(json.dumps(validated, sort_keys=True))


if __name__ == "__main__":
    main()
