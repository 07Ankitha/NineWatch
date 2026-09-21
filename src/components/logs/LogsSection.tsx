import { useEffect, useState } from 'react'
import { fetchLogs, type FetchLogsParams, type LogsResponse } from '../../lib/api.ts'
import {
  utcDateInputValue,
  type ServiceOption,
} from '../../lib/logsView.ts'
import LogsFilterBar, {
  hasActiveFilters,
  rangeValidationError,
} from './LogsFilterBar.tsx'
import LogsPagination from './LogsPagination.tsx'
import LogsTable from './LogsTable.tsx'

type DateMode = 'single' | 'range'

type LogsSectionProps = {
  uploadId?: number
  refreshKey: number
  services: ServiceOption[]
}

export default function LogsSection({
  uploadId,
  refreshKey,
  services,
}: LogsSectionProps) {
  const [dateMode, setDateMode] = useState<DateMode>('single')
  const [date, setDate] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [service, setService] = useState('')
  const [failuresOnly, setFailuresOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [data, setData] = useState<LogsResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'empty' | 'error' | 'ready'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  const rangeError = rangeValidationError(dateMode, from, to)
  const filtered = hasActiveFilters({ date, from, to, service, failuresOnly })

  useEffect(() => {
    if (rangeError) {
      setStatus((current) => (current === 'loading' ? 'ready' : current))
      return
    }

    const controller = new AbortController()
    setStatus('loading')
    setError(null)

    const params: FetchLogsParams = {
      uploadId,
      page,
      pageSize,
      failuresOnly: failuresOnly || undefined,
      service: service || undefined,
    }
    if (dateMode === 'single') {
      if (date) params.date = date
    } else {
      if (from) params.from = from
      if (to) params.to = to
    }

    fetchLogs(params, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setData(result)
        setStatus(result == null ? 'empty' : 'ready')
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        const message =
          caught instanceof Error && caught.message.trim() !== ''
            ? caught.message
            : 'Failed to load logs. Please try again.'
        setError(message)
        setStatus('error')
      })

    return () => controller.abort()
  }, [
    uploadId,
    refreshKey,
    dateMode,
    date,
    from,
    to,
    service,
    failuresOnly,
    page,
    pageSize,
    retryToken,
    rangeError,
  ])

  function resetPageThen(action: () => void): void {
    action()
    setPage(1)
  }

  function clearFilters(): void {
    setDateMode('single')
    setDate('')
    setFrom('')
    setTo('')
    setService('')
    setFailuresOnly(false)
    setPage(1)
  }

  const minDate = utcDateInputValue(data?.upload.dataStart)
  const maxDate = utcDateInputValue(data?.upload.dataEnd)
  const hasRows = (data?.rows.length ?? 0) > 0
  const showTable = status === 'loading' ? hasRows : status === 'ready' && hasRows
  const dimmed = status === 'loading' && hasRows

  return (
    <div className="space-y-4">
      <LogsFilterBar
        dateMode={dateMode}
        date={date}
        from={from}
        to={to}
        service={service}
        failuresOnly={failuresOnly}
        minDate={minDate}
        maxDate={maxDate}
        services={services}
        filtered={filtered}
        rangeError={rangeError}
        onDateMode={(mode) =>
          resetPageThen(() => {
            setDateMode(mode)
            setDate('')
            setFrom('')
            setTo('')
          })
        }
        onDate={(value) => resetPageThen(() => setDate(value))}
        onFrom={(value) => resetPageThen(() => setFrom(value))}
        onTo={(value) => resetPageThen(() => setTo(value))}
        onService={(value) => resetPageThen(() => setService(value))}
        onFailuresOnly={(value) => resetPageThen(() => setFailuresOnly(value))}
        onClear={clearFilters}
      />

      {status === 'loading' && (
        <p className="flex items-center gap-2 text-sm text-neutral-400" aria-live="polite">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent"
            aria-hidden="true"
          />
          Loading checks…
        </p>
      )}

      {status === 'error' && (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-950/40 p-4">
          <p className="text-sm font-medium text-red-200">Could not load checks</p>
          <p className="mt-1 text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => setRetryToken((token) => token + 1)}
            className="mt-3 rounded-lg border border-red-400/50 bg-red-900/60 px-3 py-1.5 text-sm font-medium text-red-50 hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {status === 'empty' && (
        <p className="text-sm text-neutral-400">No data yet. Upload a CSV above.</p>
      )}

      {status === 'ready' && data != null && !hasRows && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
          <p className="text-sm text-neutral-300">No checks match these filters.</p>
          {filtered && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 rounded-lg border border-neutral-600 px-3 py-1.5 text-sm text-neutral-100 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {showTable && data && <LogsTable rows={data.rows} dimmed={dimmed} />}

      {data && (status === 'ready' || dimmed) && (
        <LogsPagination
          page={data.page}
          pageSize={pageSize}
          total={data.total}
          totalPages={data.totalPages}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      )}
    </div>
  )
}
