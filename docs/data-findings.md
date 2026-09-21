# Monitoring CSV data findings

Cleaning is implemented in `api/_lib/cleaning` (`cleanCsv`). Timestamps are stored as UTC `Date`s. Latency is stored in milliseconds. 5xx responses are real outages and are never dropped for being failures.

Input columns (header line 1): `service_id`, `service_name`, `timestamp`, `status_code`, `latency`, `latency_unit`, `agent`, `region`.

## Problems and cleaning rules

| Problem | How it is detected | What the code does | Why |
| --- | --- | --- | --- |
| Mixed timestamp formats | `parseTimestamp`: 10-digit unix seconds or 13-digit unix ms (`epoch`); ISO with `Z` (`iso_utc`); ISO with `+HH:MM`/`-HH:MM` (`offset`); ISO with no zone (`naive_assumed_utc`). Invalid / unparseable / year outside 2000–2100 → null | Drop the row (`bad_timestamp`). Count kept offset rows as `timezone_normalized` (fixed), kept epoch rows as `epoch_converted` (fixed), kept naive rows as `naive_timestamp_assumed_utc` (flagged) | All checks must share one UTC instant so windows and dedupe keys match |
| Latency in seconds vs milliseconds | `latency_unit` is `s` or `ms` | `s` → value × 1000, rounded to 2 decimals (`unit_converted`, fixed). `ms` left as-is | Downstream stats assume milliseconds |
| Blank latency (~1% of rows) | Empty / whitespace `latency` | Keep the row; set `latencyMs` to null (`missing_latency`, nulled) | The check still happened; only the measurement is missing |
| Negative latency (1 row per file) | Parsed latency &lt; 0 | Keep the row; set `latencyMs` to null (`negative_latency`, nulled) | Negative duration is impossible; do not invent a value |
| Unknown latency unit | Unit is not `ms` or `s` | Keep the row; set `latencyMs` to null (`unknown_latency_unit`, nulled) | Cannot convert without a known unit |
| Unparseable latency | Non-numeric latency | Keep the row; set `latencyMs` to null (`unparseable_latency`, nulled) | Same as missing: preserve the check |
| Invalid status `999` (1 row per file) | Status not an integer in 100–599 | Drop the row (`invalid_status`, dropped; `detail` is the raw value, e.g. `999`) | 999 is not an HTTP status |
| Exact duplicates | Same `serviceId` + `checkedAt` (ISO) and the same status | Keep the first-seen row; drop the rest. One summary issue `duplicate_row` with a `count` (not one issue per row) | Repeated identical checks must not double-count uptime |
| Same check from agent-1 and agent-2, slightly different latency | Same `serviceId` + `checkedAt` | Same as other duplicates: first-seen wins when statuses agree | One check, one row |
| Conflicting status on the same check | Same `serviceId` + `checkedAt`, different `statusCode` | Keep a failing (non-2xx) row; drop the rest. Per discarded row: `conflicting_duplicate` (flagged) plus the aggregated `duplicate_row` count | A success must not hide an outage |
| Unsorted rows | Input order is arbitrary | Sort kept checks by `checkedAt` ascending, then `serviceId` | Time series and incident windows need chronological order |
| Empty file / missing columns | 0 data rows, or required headers absent | Throw `ValidationError` (empty file, or list of missing columns) | Refuse to ingest an unusable file |
| 5xx status codes | `statusCode` 500–599 | **Kept** (they are valid HTTP statuses; `isSuccess` is false) | These are real outages |

`isSuccess` is `statusCode` 200–299. Summary: `rowsReceived` = data rows, `rowsKept` = checks kept, `rowsDropped` = received − kept (always accounts for every input row). High-volume timestamp/unit fixes are one summary issue per type with a `count`. Per-row issues carry `sourceRow` and `rawRow`.

Sample files contain no naive timestamps and no conflicting-status duplicates; those paths are covered by unit tests.

## Per-file counts (from `cleanCsv` integration test)

| File | received | kept | dropped | missing_latency | negative_latency | invalid_status | duplicate_row | unit_converted | timezone_normalized | epoch_converted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| monitoring_checks_9d_seed101.csv | 4672 | 4319 | 353 | 56 | 1 | 1 | 352 | 853 | 29 | 65 |
| monitoring_checks_12d_seed505.csv | 6230 | 5759 | 471 | 74 | 1 | 1 | 470 | 1139 | 42 | 85 |
| monitoring_checks_14d_seed202.csv | 7269 | 6720 | 549 | 87 | 1 | 1 | 548 | 1327 | 49 | 103 |
| monitoring_checks_21d_seed303.csv | 10904 | 10079 | 825 | 130 | 1 | 1 | 824 | 1985 | 69 | 149 |
| monitoring_checks_30d_seed404.csv | 15577 | 14399 | 1178 | 186 | 1 | 1 | 1177 | 2847 | 104 | 214 |

Dropped rows are almost all duplicates: `dropped = duplicate_row + invalid_status` in every file (one invalid `999` each). Blank and negative latencies are nulled, not dropped. `unit_converted` / `timezone_normalized` / `epoch_converted` count **kept** rows only.
