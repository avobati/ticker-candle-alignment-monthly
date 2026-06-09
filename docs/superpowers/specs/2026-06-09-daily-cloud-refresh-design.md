# Daily Cloud Refresh Design

## Goal

Refresh the production weekly/monthly alignment dataset every day after the
latest UTC daily candle has closed, without depending on the user's laptop,
Codex availability, or Codex credits.

## Schedule

The cloud job runs daily at `01:07 UTC`.

- During Australian Eastern Standard Time, this is `11:07 AEST`.
- During Australian Eastern Daylight Time, this is `12:07 AEDT`.
- In both seasons, the run starts approximately one hour after the `00:00 UTC`
  daily candle boundary.

The seven-minute offset avoids GitHub Actions' busiest start-of-hour scheduling
window. GitHub may still queue scheduled jobs briefly during platform load.

## Execution Architecture

GitHub Actions runs the existing Python scanner on a standard Ubuntu hosted
runner. The repository is public, so standard hosted-runner execution does not
consume paid GitHub Actions minutes under the current GitHub billing model.

The workflow:

1. Checks out the default branch.
2. Installs Python and the PostgreSQL driver.
3. Runs the complete 11,054-symbol scan.
4. Validates scan completeness and provider failure rate.
5. Publishes the completed dataset to Neon in one atomic transaction.
6. Queries Neon to verify the published run.
7. Calls the production data endpoint and records its reported freshness.

The workflow also supports manual dispatch for deployment verification and
recovery. A concurrency group prevents overlapping refreshes.

Vercel remains the read-only application host. It reads the latest successful
dataset from Neon and does not execute the long-running scan.

Because GitHub disables scheduled workflows in public repositories after 60
days without repository activity, the workflow creates an empty maintenance
commit on the first UTC day of each month. This keeps the schedule active
without committing generated market data or requiring the user's laptop.

## Candle Semantics

Yahoo daily data is aggregated into ISO weeks. The final aggregate is the
ongoing weekly candle and is included in UT Bot calculations.

For age reporting:

- A signal on the ongoing weekly candle has `candlesAgo = 0`.
- A signal on the immediately preceding weekly candle has `candlesAgo = 1`.
- Older signals increment from there.

The same current-period convention remains in place for monthly candles.
Tests use fixed daily candles to prove that the latest partial ISO week is
included and is index zero for signal age.

## Safe Publishing

The scanner must not expose a partial checkpoint as a successful production
refresh. It collects the complete result set before publishing to Neon.

Before publication, it verifies:

- The result count equals the requested universe count.
- Every symbol has both weekly and monthly result objects.
- The failed-symbol rate is no greater than 5%.
- A failed symbol is one where either timeframe contains a fetch or calculation
  error.

If validation fails, the process exits non-zero and leaves the previous Neon
dataset unchanged.

For a valid scan, publication occurs in one database transaction. The new rows
share one run timestamp. The transaction commits only after every row has been
written, so the website never observes a half-published run.

## Production Reads

The application selects one coherent latest scan timestamp rather than taking
the newest row independently for each symbol and timeframe. This ensures the
dashboard represents one completed run.

If Neon is unavailable, the existing bundled fallback remains available, but
production verification must report that fallback state rather than treating it
as a fresh cloud refresh.

## Secrets

`DATABASE_URL` is stored as a GitHub Actions repository secret. It is loaded
from the existing local environment without printing its value. No database
credentials are committed or included in logs.

## Failure Handling

- Provider or quality-gate failure: workflow fails and preserves the previous
  successful dataset.
- Database failure: transaction rolls back and workflow fails.
- Production endpoint failure: scan remains published, but verification fails
  so the issue is visible in GitHub Actions.
- Scheduled-run delay: the job starts when a runner becomes available; manual
  dispatch remains available.
- Public-repository inactivity: a monthly empty maintenance commit prevents
  GitHub from disabling the scheduled workflow after 60 inactive days.
- Overlapping run: the existing refresh is allowed to finish and a duplicate
  run does not start concurrently.

## Verification

Implementation is complete only after:

1. Unit tests prove ongoing-week `candlesAgo = 0` behavior.
2. Unit tests prove incomplete and excessive-failure scans are rejected.
3. The full test, lint, and production build commands pass locally.
4. The workflow is committed and present on the default branch.
5. `DATABASE_URL` exists as a GitHub repository secret.
6. A manual GitHub Actions run succeeds.
7. Neon contains one complete latest run with all expected symbols and both
   timeframes.
8. The production Vercel endpoint reports the new run timestamp and current
   weekly zero-age results.
