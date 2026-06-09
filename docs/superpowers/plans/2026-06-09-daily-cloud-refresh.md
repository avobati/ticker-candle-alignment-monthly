# Daily Cloud Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the complete weekly/monthly scanner in GitHub Actions every day at 01:07 UTC, publish one atomic validated run to Neon, and make the production app read that coherent run with the ongoing weekly candle represented as week zero.

**Architecture:** Keep Python as the calculation and publishing engine, with small pure functions for candle aggregation and scan validation covered by `unittest`. GitHub Actions executes the long scan and verifies Neon; Next.js selects the latest complete shared-timestamp run, while retaining its legacy read path until the first complete cloud run exists.

**Tech Stack:** Python 3.12, `unittest`, `psycopg` 3, GitHub Actions, Neon Postgres, Next.js 16, TypeScript, Vercel

---

## File Structure

- `tests/test_scan_signals.py`: Python regression tests for current-week aggregation, week-zero signal age, and scan-quality rejection.
- `scripts/scan_signals.py`: Shared run timestamp, quality gate, and atomic Neon publication.
- `scripts/verify_refresh.py`: Post-publication Neon verification used by GitHub Actions.
- `src/lib/db.ts`: Prefer the latest complete shared-timestamp run and label the data source.
- `src/lib/db-run-selection.test.mts`: Pure SQL-selection helper tests without requiring live Neon.
- `src/lib/db-run-selection.ts`: Query-shape and complete-run threshold helpers.
- `.github/workflows/daily-refresh.yml`: Daily and manual cloud execution, concurrency, verification, and periodic activity heartbeat.
- `README.md`: Exact UTC/AEST/AEDT schedule and operational recovery notes.

### Task 1: Prove Ongoing Weekly Candle Is Week Zero

**Files:**
- Create: `tests/test_scan_signals.py`
- Modify: `scripts/scan_signals.py`

- [ ] **Step 1: Write failing aggregation and signal-age tests**

Create fixed daily candles spanning a completed ISO week and an incomplete
current ISO week. Assert `aggregate_weekly()` includes the incomplete current
week as its last candle. Feed deterministic candles to `ut_bot_alerts()` and
assert a signal on the final aggregate reports `bars_since_buy == 0`.

- [ ] **Step 2: Run the focused Python tests and verify RED**

Run:

```powershell
python -m unittest tests.test_scan_signals -v
```

Expected: the new current-week contract test fails if the scanner excludes or
misindexes the ongoing weekly candle.

- [ ] **Step 3: Implement the minimal current-week contract**

Keep ISO-week aggregation ordered chronologically and ensure all signal-age
math uses `len(candles) - 1 - signal_index`, making the final ongoing aggregate
index zero.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
python -m unittest tests.test_scan_signals -v
```

Expected: all Task 1 tests pass.

### Task 2: Add Scan Quality Gates and Atomic Publication

**Files:**
- Modify: `tests/test_scan_signals.py`
- Modify: `scripts/scan_signals.py`

- [ ] **Step 1: Write failing quality-gate tests**

Add tests asserting:

```python
validate_scan_results(valid_rows, expected_count=2, max_failure_rate=0.05)
```

returns counts for a complete valid scan, while duplicate/missing symbols,
missing timeframe objects, and a failed-symbol rate above 5% raise
`ScanValidationError`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
python -m unittest tests.test_scan_signals.ScanValidationTests -v
```

Expected: FAIL because `ScanValidationError` and `validate_scan_results` do not
exist.

- [ ] **Step 3: Implement validation and one shared run timestamp**

Add:

```python
class ScanValidationError(RuntimeError):
    pass


def validate_scan_results(
    rows: list[dict[str, Any]],
    expected_count: int,
    max_failure_rate: float = 0.05,
) -> dict[str, int | float]:
    ...
```

Generate one UTC `run_timestamp` in `main()`, pass it into every `scan_symbol`
call, and use it for both timeframe snapshots.

- [ ] **Step 4: Replace row-by-row publication with one transaction**

Update `seed_database()` to validate before opening the transaction, insert all
weekly/monthly rows using `executemany`, verify the inserted row count for the
shared timestamp, and commit only after the count equals
`expected_count * 2`. Any exception must roll back.

- [ ] **Step 5: Run Python tests and verify GREEN**

Run:

```powershell
python -m unittest discover -s tests -v
```

Expected: all Python tests pass.

### Task 3: Read One Coherent Production Run

**Files:**
- Create: `src/lib/db-run-selection.ts`
- Create: `src/lib/db-run-selection.test.mts`
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Write failing complete-run selection tests**

Test that the helper requires exactly two timeframe rows per expected symbol
and returns a minimum row count of `universeSize * 2`. Test source labels:
`database-coherent`, `database-legacy`, and `fallback`.

- [ ] **Step 2: Run TypeScript tests and verify RED**

Run:

```powershell
npm test
```

Expected: FAIL because the run-selection helper does not exist.

- [ ] **Step 3: Implement complete-run selection**

Add a small helper exporting:

```typescript
export function expectedTimeframeRows(universeSize: number) {
  return universeSize * 2;
}
```

In `getAlignmentRows()`, query for the newest `scanned_at` grouped timestamp
whose row count equals the expected timeframe row count and whose distinct
symbol count equals the universe size. If found, read only that timestamp. If
not found, use the existing `DISTINCT ON` legacy query so the first deployment
does not hide existing data.

Return `datasetSource` with the API payload.

- [ ] **Step 4: Run TypeScript tests and verify GREEN**

Run:

```powershell
npm test
```

Expected: all Node tests pass.

### Task 4: Verify Neon After Publication

**Files:**
- Create: `scripts/verify_refresh.py`
- Modify: `tests/test_scan_signals.py`

- [ ] **Step 1: Add failing verification-summary tests**

Test a pure summary validator that accepts one timestamp, all expected symbols,
and exactly two rows per symbol, while rejecting stale, incomplete, or
mixed-timestamp summaries.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
python -m unittest discover -s tests -v
```

Expected: FAIL because the verification helper does not exist.

- [ ] **Step 3: Implement the verifier**

The script loads `DATABASE_URL`, queries the latest grouped timestamp, checks
expected symbol and row counts, checks the timestamp is no older than six
hours, prints only non-secret counts/timestamps, and exits non-zero on failure.

- [ ] **Step 4: Run Python tests and verify GREEN**

Run:

```powershell
python -m unittest discover -s tests -v
```

Expected: all Python tests pass.

### Task 5: Add Durable GitHub Automation

**Files:**
- Create: `.github/workflows/daily-refresh.yml`
- Modify: `README.md`

- [ ] **Step 1: Add the scheduled workflow**

Configure:

```yaml
on:
  schedule:
    - cron: "7 1 * * *"
  workflow_dispatch:

concurrency:
  group: daily-signal-refresh
  cancel-in-progress: false
```

Use `ubuntu-latest`, Python 3.12, a five-hour job timeout, `psycopg[binary]`,
`DATABASE_URL: ${{ secrets.DATABASE_URL }}`, the full scanner with
`--seed-db`, database verification, and a production `/api/data?limit=1`
freshness check.

- [ ] **Step 2: Add periodic public-repository activity**

On the first UTC day of each month, create and push an empty maintenance commit
using `GITHUB_TOKEN`. This prevents GitHub's 60-day inactivity rule from
disabling scheduled workflows. The step must not contain or commit generated
market data.

- [ ] **Step 3: Document operations**

Document `01:07 UTC`, `11:07 AEST`, `12:07 AEDT`, manual dispatch, the Neon
secret requirement, the 5% failure gate, and the fact that failed scans leave
the previous production run intact.

- [ ] **Step 4: Validate workflow syntax and repository diff**

Run:

```powershell
git diff --check
Get-Content .github\workflows\daily-refresh.yml
```

Expected: no whitespace errors and the intended schedule is visible.

### Task 6: Configure, Publish, and Verify

**Files:**
- Modify only files listed above.

- [ ] **Step 1: Run complete local verification**

Run:

```powershell
python -m unittest discover -s tests -v
npm test
npm run lint
npm run build
git diff --check
```

Expected: every command exits zero.

- [ ] **Step 2: Commit implementation on a feature branch**

Stage only the planned files and commit with:

```powershell
git commit -m "Add durable daily cloud refresh"
```

- [ ] **Step 3: Configure the GitHub secret without printing it**

Read `DATABASE_URL` from `.env.local` in memory and pipe it directly to:

```powershell
gh secret set DATABASE_URL --repo avobati/ticker-candle-alignment-monthly
```

Confirm only the secret name appears in `gh secret list`.

- [ ] **Step 4: Push, merge, and confirm default-branch workflow**

Push the feature branch, open a pull request, merge it after checks, and verify
`.github/workflows/daily-refresh.yml` exists on `master`.

- [ ] **Step 5: Trigger and monitor the first cloud refresh**

Run:

```powershell
gh workflow run daily-refresh.yml --repo avobati/ticker-candle-alignment-monthly
gh run watch --repo avobati/ticker-candle-alignment-monthly --exit-status
```

Expected: scan, quality gate, atomic Neon publication, Neon verification, and
production endpoint verification all succeed.

- [ ] **Step 6: Verify production truth**

Query the production API and Neon without printing credentials. Confirm:

- `datasetSource` is `database-coherent`.
- The latest run contains 11,054 distinct symbols and 22,108 timeframe rows.
- `generatedAt` matches the cloud run.
- At least one current weekly result has `candlesAgo = 0`.
- The next scheduled run is `01:07 UTC`, equivalent to `11:07 AEST` or
  `12:07 AEDT`.
