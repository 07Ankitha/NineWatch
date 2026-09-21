BEGIN;

-- Per-service uptime and latency for one upload. Filter with WHERE upload_id = $1.
CREATE VIEW v_service_availability AS
SELECT
  upload_id,
  service_id,
  service_name,
  COUNT(*)::integer AS total_checks,
  COUNT(*) FILTER (WHERE is_success)::integer AS successful_checks,
  COUNT(*) FILTER (WHERE NOT is_success)::integer AS failed_checks,
  ROUND(
    (COUNT(*) FILTER (WHERE is_success)::numeric / NULLIF(COUNT(*), 0)) * 100,
    3
  ) AS availability_pct,
  MIN(checked_at) AS first_check_at,
  MAX(checked_at) AS last_check_at,
  ROUND(
    (
      percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms)
        FILTER (WHERE latency_ms IS NOT NULL)
    )::numeric,
    1
  ) AS p50_latency_ms,
  ROUND(
    (
      percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
        FILTER (WHERE latency_ms IS NOT NULL)
    )::numeric,
    1
  ) AS p95_latency_ms,
  ROUND(
    (
      percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms)
        FILTER (WHERE latency_ms IS NOT NULL)
    )::numeric,
    1
  ) AS p99_latency_ms,
  ROUND(AVG(latency_ms)::numeric, 2) AS avg_latency_ms
FROM checks
GROUP BY upload_id, service_id, service_name;

-- Failed-check runs: consecutive 15-minute failures. A success or a missing slot breaks the run.
CREATE VIEW v_outages AS
WITH numbered AS (
  SELECT
    upload_id,
    service_id,
    service_name,
    checked_at,
    status_code,
    is_success,
    ROW_NUMBER() OVER (
      PARTITION BY upload_id, service_id
      ORDER BY checked_at
    ) AS rn
  FROM checks
),
failed AS (
  SELECT
    upload_id,
    service_id,
    service_name,
    checked_at,
    status_code,
    rn,
    rn - ROW_NUMBER() OVER (
      PARTITION BY upload_id, service_id
      ORDER BY checked_at
    ) AS island
  FROM numbered
  WHERE NOT is_success
),
marked AS (
  SELECT
    upload_id,
    service_id,
    service_name,
    checked_at,
    status_code,
    island,
    CASE
      WHEN lag(checked_at) OVER (
        PARTITION BY upload_id, service_id, island
        ORDER BY checked_at
      ) = checked_at - INTERVAL '15 minutes'
      THEN 0
      ELSE 1
    END AS new_run
  FROM failed
),
runs AS (
  SELECT
    upload_id,
    service_id,
    service_name,
    checked_at,
    status_code,
    island,
    SUM(new_run) OVER (
      PARTITION BY upload_id, service_id, island
      ORDER BY checked_at
    ) AS run_id
  FROM marked
)
SELECT
  upload_id,
  service_id,
  MIN(service_name) AS service_name,
  MIN(checked_at) AS started_at,
  MAX(checked_at) + INTERVAL '15 minutes' AS ended_at,
  EXTRACT(EPOCH FROM (MAX(checked_at) + INTERVAL '15 minutes' - MIN(checked_at)))
    / 60.0 AS duration_minutes,
  COUNT(*)::integer AS failed_checks,
  ARRAY_AGG(DISTINCT status_code ORDER BY status_code) AS status_codes,
  (COUNT(*) = 1) AS is_isolated
FROM runs
GROUP BY upload_id, service_id, island, run_id;

-- Non-2xx status counts per service in an upload. Filter with WHERE upload_id = $1.
CREATE VIEW v_error_breakdown AS
SELECT
  upload_id,
  service_id,
  status_code,
  COUNT(*)::integer AS count
FROM checks
WHERE NOT is_success
GROUP BY upload_id, service_id, status_code;

-- Daily UTC availability per service. Filter with WHERE upload_id = $1.
CREATE VIEW v_daily_availability AS
SELECT
  upload_id,
  service_id,
  (checked_at AT TIME ZONE 'UTC')::date AS day,
  COUNT(*)::integer AS total_checks,
  COUNT(*) FILTER (WHERE NOT is_success)::integer AS failed_checks,
  ROUND(
    (COUNT(*) FILTER (WHERE is_success)::numeric / NULLIF(COUNT(*), 0)) * 100,
    3
  ) AS availability_pct
FROM checks
GROUP BY upload_id, service_id, (checked_at AT TIME ZONE 'UTC')::date;

COMMIT;
