BEGIN;

-- uploads: one row per ingested CSV file; identity, processing status, and summary counts.
CREATE TABLE uploads (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  filename TEXT NOT NULL,
  file_sha256 TEXT NOT NULL UNIQUE, -- prevents re-processing the same file
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  rows_received INTEGER NOT NULL DEFAULT 0,
  rows_kept INTEGER NOT NULL DEFAULT 0,
  rows_dropped INTEGER NOT NULL DEFAULT 0,
  data_start TIMESTAMPTZ NULL,
  data_end TIMESTAMPTZ NULL,
  error_message TEXT NULL
);

-- checks: cleaned probe results for an upload; checked_at is always stored in UTC.
CREATE TABLE checks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  upload_id BIGINT NOT NULL REFERENCES uploads (id) ON DELETE CASCADE,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL, -- always stored in UTC
  status_code SMALLINT NOT NULL,
  is_success BOOLEAN NOT NULL, -- true when status_code is 2xx
  latency_ms NUMERIC(10, 2) NULL CHECK (latency_ms IS NULL OR latency_ms >= 0),
  agent TEXT NOT NULL,
  region TEXT NOT NULL,
  UNIQUE (upload_id, service_id, checked_at)
);

CREATE INDEX idx_checks_upload_id_checked_at ON checks (upload_id, checked_at);
CREATE INDEX idx_checks_upload_id_service_id_checked_at ON checks (upload_id, service_id, checked_at);
CREATE INDEX idx_checks_checked_at ON checks (checked_at);

-- data_issues: per-row cleaning audit (dropped, fixed, nulled, or flagged) with original CSV context.
CREATE TABLE data_issues (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  upload_id BIGINT NOT NULL REFERENCES uploads (id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL, -- e.g. duplicate_row, bad_timestamp, invalid_status, negative_latency, missing_latency, unit_converted, timezone_normalized, conflicting_duplicate
  action TEXT NOT NULL CHECK (action IN ('dropped', 'fixed', 'nulled', 'flagged')),
  source_row INTEGER NULL, -- row number in the original CSV
  raw_row JSONB NULL, -- original row for traceability
  detail TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_issues_upload_id ON data_issues (upload_id);
CREATE INDEX idx_data_issues_upload_id_issue_type ON data_issues (upload_id, issue_type);

COMMIT;
