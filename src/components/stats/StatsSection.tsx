import { useEffect, useState } from 'react'
import { fetchStats, type StatsResponse } from '../../lib/api.ts'
import { formatDateTime, formatNumber } from '../../lib/format.ts'
import DailyAvailabilityChart from './DailyAvailabilityChart.tsx'
import DataQualityNote from './DataQualityNote.tsx'
import ErrorBreakdown from './ErrorBreakdown.tsx'
import LatencyChart from './LatencyChart.tsx'
import OutagesTable from './OutagesTable.tsx'
import ServiceCards from './ServiceCards.tsx'
import SlaSummary from './SlaSummary.tsx'

type StatsSectionProps = {
  uploadId?: number
  refreshKey: number
  onServicesLoaded?: (services: Array<{ serviceId: string; serviceName: string }>) => void
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="h-4 w-2/3 rounded bg-neutral-800" />
      <div className="h-28 rounded-xl bg-neutral-800/80" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-40 rounded-xl bg-neutral-800/80" />
        <div className="h-40 rounded-xl bg-neutral-800/80" />
      </div>
      <div className="h-64 rounded-xl bg-neutral-800/80" />
    </div>
  )
}

function periodLabel(start: string | null, end: string | null): string {
  if (!start && !end) return 'Unknown period'
  const from = start ? formatDateTime(start) : 'Unknown'
  const to = end ? formatDateTime(end) : 'Unknown'
  return `${from} to ${to}`
}

export default function StatsSection({
  uploadId,
  refreshKey,
  onServicesLoaded,
}: StatsSectionProps) {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'empty' | 'error' | 'ready'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError(null)

    fetchStats(uploadId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setStats(result)
        setStatus(result == null ? 'empty' : 'ready')
        onServicesLoaded?.(
          result?.services.map((service) => ({
            serviceId: service.serviceId,
            serviceName: service.serviceName,
          })) ?? [],
        )
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        const message =
          caught instanceof Error && caught.message.trim() !== ''
            ? caught.message
            : 'Failed to load stats. Please try again.'
        setError(message)
        setStatus('error')
      })

    return () => controller.abort()
  }, [uploadId, refreshKey, retryToken, onServicesLoaded])

  if (status === 'loading') {
    return (
      <div>
        <p className="sr-only" aria-live="polite">
          Loading SLA stats
        </p>
        <Skeleton />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-500/40 bg-red-950/40 p-4"
      >
        <p className="text-sm font-medium text-red-200">Could not load SLA stats</p>
        <p className="mt-1 text-sm text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => setRetryToken((token) => token + 1)}
          className="mt-3 rounded-lg border border-red-400/50 bg-red-900/60 px-3 py-1.5 text-sm font-medium text-red-50 transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
        >
          Retry
        </button>
      </div>
    )
  }

  if (status === 'empty' || stats == null) {
    return (
      <p className="text-sm text-neutral-400" aria-live="polite">
        No data yet. Upload a CSV above.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-300" aria-live="polite">
        <span className="font-medium text-neutral-100">{stats.upload.filename}</span>
        <span className="text-neutral-500"> · </span>
        {periodLabel(stats.upload.dataStart, stats.upload.dataEnd)}
        <span className="text-neutral-500"> · </span>
        Rows kept {formatNumber(stats.upload.rowsKept)} of{' '}
        {formatNumber(stats.upload.rowsReceived)}
      </p>

      <SlaSummary overall={stats.overall} slaTargetPct={stats.slaTargetPct} />
      <ServiceCards services={stats.services} />

      <div className="grid gap-4 lg:grid-cols-2">
        <DailyAvailabilityChart
          dailyAvailability={stats.dailyAvailability}
          slaTargetPct={stats.slaTargetPct}
        />
        <LatencyChart services={stats.services} />
      </div>

      <OutagesTable outages={stats.outages} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ErrorBreakdown errorBreakdown={stats.errorBreakdown} />
        <DataQualityNote issueCounts={stats.dataQuality.issueCounts} />
      </div>
    </div>
  )
}
