import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { uploadCsv, type UploadResult } from '../../lib/api.ts'
import {
  formatDateTime,
  formatNumber,
  humanizeIssueType,
} from '../../lib/format.ts'

const MAX_CSV_BYTES = 4_000_000

type UploadStatus = 'idle' | 'ready' | 'processing' | 'success' | 'error'

type UploadCardProps = {
  onUploaded: (result: UploadResult) => void
}

export function validateCsvFile(file: { name: string; size: number }): string | null {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return 'Please choose a .csv file.'
  }
  if (file.size === 0) {
    return 'That file is empty. Please choose a CSV with some rows in it.'
  }
  if (file.size > MAX_CSV_BYTES) {
    return 'That file is over 4 MB. Please choose a smaller CSV.'
  }
  return null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function removedPercent(received: number, dropped: number): string {
  if (received <= 0) return '0.0%'
  return `${((dropped / received) * 100).toFixed(1)}%`
}

function sortedIssueEntries(
  issueCounts: Record<string, number>,
): Array<[string, number]> {
  return Object.entries(issueCounts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })
}

function dataPeriodLabel(start: string | null, end: string | null): string {
  if (!start && !end) return 'Unknown'
  const from = start ? formatDateTime(start) : 'Unknown'
  const to = end ? formatDateTime(end) : 'Unknown'
  return `${from} to ${to}`
}

export default function UploadCard({ onUploaded }: UploadCardProps) {
  const inputId = useId()
  const errorId = useId()
  const statusId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const [status, setStatus] = useState<UploadStatus>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const submittingRef = useRef(false)

  const isProcessing = status === 'processing'
  const controlsDisabled = isProcessing

  useEffect(() => {
    if (!isProcessing) return
    setElapsedSeconds(0)
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 250)
    return () => window.clearInterval(timer)
  }, [isProcessing])

  function acceptFile(next: File): void {
    if (submittingRef.current) return
    const error = validateCsvFile(next)
    setResult(null)
    setServerError(null)
    if (error) {
      setFile(null)
      setValidationError(error)
      setStatus('idle')
      return
    }
    setFile(next)
    setValidationError(null)
    setStatus('ready')
  }

  function onFileInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const next = event.target.files?.[0]
    if (next) acceptFile(next)
    event.target.value = ''
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setIsDragging(false)
    if (controlsDisabled) return
    const next = event.dataTransfer.files[0]
    if (next) acceptFile(next)
  }

  async function processFile(target: File): Promise<void> {
    if (submittingRef.current) return
    submittingRef.current = true
    setStatus('processing')
    setServerError(null)
    setValidationError(null)
    try {
      const uploaded = await uploadCsv(target)
      setResult(uploaded)
      setStatus('success')
      onUploaded(uploaded)
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim() !== ''
          ? error.message
          : 'Upload failed. Please try again.'
      setServerError(message)
      setStatus('error')
    } finally {
      submittingRef.current = false
    }
  }

  function handleUpload(): void {
    if (!file || controlsDisabled) return
    void processFile(file)
  }

  function handleTryAgain(): void {
    if (!file || controlsDisabled) return
    void processFile(file)
  }

  function handleReset(): void {
    if (controlsDisabled) return
    submittingRef.current = false
    setStatus('idle')
    setFile(null)
    setValidationError(null)
    setServerError(null)
    setResult(null)
    setElapsedSeconds(0)
    setIsDragging(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const issueRows = result
    ? sortedIssueEntries(result.summary.issueCounts)
    : []

  const liveStatus =
    status === 'processing'
      ? `Cleaning and saving your data. Elapsed ${elapsedSeconds} seconds.`
      : status === 'success'
        ? result?.alreadyProcessed
          ? 'This file was uploaded before, so we reused the stored results.'
          : 'Upload complete. Data quality report is ready.'
        : status === 'error'
          ? serverError ?? 'Upload failed.'
          : validationError ?? (status === 'ready' && file ? `Ready to upload ${file.name}` : '')

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight text-neutral-50">
        Upload CSV
      </h2>
      <p className="mt-1 text-sm text-neutral-400">
        Drop an uptime log to clean it and save the results.
      </p>

      <div id={statusId} className="sr-only" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </div>

      {status !== 'success' && (
        <>
          <div
            onDragEnter={(event) => {
              event.preventDefault()
              if (!controlsDisabled) setIsDragging(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              if (!controlsDisabled) setIsDragging(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              const next = event.relatedTarget
              if (next instanceof Node && event.currentTarget.contains(next)) return
              setIsDragging(false)
            }}
            onDrop={onDrop}
            role="group"
            aria-label="CSV file drop zone"
            aria-disabled={controlsDisabled}
            className={`mt-5 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              isDragging
                ? 'border-sky-400 bg-sky-950/40'
                : validationError
                  ? 'border-red-500/70 bg-red-950/20'
                  : 'border-neutral-700 bg-neutral-950/40'
            } ${controlsDisabled ? 'opacity-60' : ''}`}
          >
            <p className="text-sm text-neutral-300">
              Drag and drop a CSV file here
            </p>
            <p className="mt-1 text-xs text-neutral-500">or</p>
            <label htmlFor={inputId} className="sr-only">
              CSV file
            </label>
            <button
              type="button"
              disabled={controlsDisabled}
              onClick={() => inputRef.current?.click()}
              className="mt-3 rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Choose CSV file
            </button>
            <input
              id={inputId}
              ref={inputRef}
              type="file"
              accept=".csv"
              className="sr-only"
              disabled={controlsDisabled}
              aria-invalid={validationError ? true : undefined}
              aria-describedby={validationError ? errorId : undefined}
              onChange={onFileInputChange}
            />
          </div>

          {validationError && (
            <p id={errorId} role="alert" className="mt-3 text-sm text-red-400">
              {validationError}
            </p>
          )}

          {status === 'ready' && file && (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-neutral-200">
                <span className="font-medium">{file.name}</span>
                <span className="text-neutral-400"> · {formatFileSize(file.size)}</span>
              </p>
              <button
                type="button"
                onClick={handleUpload}
                disabled={controlsDisabled}
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Upload &amp; process
              </button>
            </div>
          )}

          {status === 'processing' && (
            <div
              className="mt-5 flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4"
              aria-busy="true"
            >
              <span
                className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-sky-400 border-t-transparent"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-neutral-100">
                  Elapsed {elapsedSeconds}s
                </p>
                <p className="mt-1 text-sm text-neutral-400">
                  Cleaning and saving your data. Larger files can take up to 30
                  seconds.
                </p>
              </div>
            </div>
          )}

          {status === 'error' && serverError && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-500/40 bg-red-950/40 p-4"
            >
              <p className="text-sm font-medium text-red-200">Upload failed</p>
              <p className="mt-1 text-sm text-red-300">{serverError}</p>
              <button
                type="button"
                onClick={handleTryAgain}
                className="mt-3 rounded-lg border border-red-400/50 bg-red-900/60 px-3 py-1.5 text-sm font-medium text-red-50 transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
              >
                Try again
              </button>
            </div>
          )}
        </>
      )}

      {status === 'success' && result && (
        <div className="mt-5">
          {result.alreadyProcessed ? (
            <p
              role="status"
              className="rounded-xl border border-sky-500/40 bg-sky-950/50 px-4 py-3 text-sm text-sky-100"
            >
              This file was uploaded before, so we reused the stored results
            </p>
          ) : (
            <p
              role="status"
              className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100"
            >
              Upload complete. Your data is cleaned and saved.
            </p>
          )}

          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Data quality report
            </h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-neutral-500">Rows received</dt>
                <dd className="mt-0.5 text-lg font-medium text-neutral-50">
                  {formatNumber(result.summary.rowsReceived)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Rows kept</dt>
                <dd className="mt-0.5 text-lg font-medium text-neutral-50">
                  {formatNumber(result.summary.rowsKept)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Rows removed</dt>
                <dd className="mt-0.5 text-lg font-medium text-neutral-50">
                  {formatNumber(result.summary.rowsDropped)}{' '}
                  <span className="text-sm font-normal text-neutral-400">
                    ({removedPercent(
                      result.summary.rowsReceived,
                      result.summary.rowsDropped,
                    )}
                    )
                  </span>
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-neutral-300">
              <span className="text-neutral-500">Data period: </span>
              {dataPeriodLabel(result.summary.dataStart, result.summary.dataEnd)}
            </p>
            <h4 className="mt-4 text-sm font-medium text-neutral-200">Issues</h4>
            {issueRows.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">No issues recorded.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {issueRows.map(([type, count]) => (
                  <li
                    key={type}
                    className="flex items-baseline justify-between gap-4 text-sm"
                  >
                    <span className="text-neutral-300">{humanizeIssueType(type)}</span>
                    <span className="font-medium tabular-nums text-neutral-100">
                      {formatNumber(count)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="mt-4 rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
          >
            Upload another file
          </button>
        </div>
      )}
    </div>
  )
}
