BEGIN;

-- Group nearby multi-check outages into incidents (gap <= 30 minutes).
-- Keep in sync with INCIDENT_MERGE_GAP_MINUTES in api/_lib/config.ts.
CREATE VIEW v_incidents AS
WITH multi AS (
  SELECT
    upload_id,
    service_id,
    service_name,
    started_at,
    ended_at,
    failed_checks,
    status_codes
  FROM v_outages
  WHERE NOT is_isolated
),
marked AS (
  SELECT
    upload_id,
    service_id,
    service_name,
    started_at,
    ended_at,
    failed_checks,
    status_codes,
    CASE
      WHEN lag(ended_at) OVER (
        PARTITION BY upload_id, service_id
        ORDER BY started_at, ended_at
      ) IS NULL THEN 1
      WHEN started_at > lag(ended_at) OVER (
        PARTITION BY upload_id, service_id
        ORDER BY started_at, ended_at
      ) + INTERVAL '30 minutes'
      THEN 1
      ELSE 0
    END AS new_group
  FROM multi
),
grouped AS (
  SELECT
    upload_id,
    service_id,
    service_name,
    started_at,
    ended_at,
    failed_checks,
    status_codes,
    SUM(new_group) OVER (
      PARTITION BY upload_id, service_id
      ORDER BY started_at, ended_at
    ) AS group_id
  FROM marked
),
aggregated AS (
  SELECT
    upload_id,
    service_id,
    group_id,
    MIN(service_name) AS service_name,
    MIN(started_at) AS started_at,
    MAX(ended_at) AS ended_at,
    EXTRACT(EPOCH FROM (MAX(ended_at) - MIN(started_at))) / 60.0 AS window_minutes,
    SUM(failed_checks)::integer AS failed_checks,
    (SUM(failed_checks) * 15)::integer AS downtime_minutes,
    COUNT(*)::integer AS segments
  FROM grouped
  GROUP BY upload_id, service_id, group_id
),
codes AS (
  SELECT
    upload_id,
    service_id,
    group_id,
    ARRAY_AGG(DISTINCT code ORDER BY code) AS status_codes
  FROM grouped,
  LATERAL unnest(status_codes) AS code
  GROUP BY upload_id, service_id, group_id
)
SELECT
  a.upload_id,
  a.service_id,
  a.service_name,
  a.started_at,
  a.ended_at,
  a.window_minutes,
  a.failed_checks,
  a.downtime_minutes,
  a.segments,
  c.status_codes
FROM aggregated a
JOIN codes c
  ON c.upload_id = a.upload_id
 AND c.service_id = a.service_id
 AND c.group_id = a.group_id;

COMMIT;
