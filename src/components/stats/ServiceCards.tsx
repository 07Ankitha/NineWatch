import type { StatsService } from '../../lib/api.ts'
import { getSeverity } from '../../lib/copy.ts'
import { formatDuration, formatMs, formatNumber, formatPercent } from '../../lib/format.ts'

type ServiceCardsProps = {
  services: StatsService[]
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M3.5 8.5L6.5 11.5L12.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M8 3L13.5 13H2.5L8 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 7V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11.4" r="0.6" fill="currentColor" />
    </svg>
  )
}

export default function ServiceCards({ services }: ServiceCardsProps) {
  const ordered = [...services].sort((a, b) => {
    if (a.availabilityPct !== b.availabilityPct) {
      return a.availabilityPct - b.availabilityPct
    }
    return a.serviceId.localeCompare(b.serviceId)
  })

  if (ordered.length === 0) {
    return <p className="text-sm text-neutral-300">No services in this upload.</p>
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ordered.map((service) => {
        const severity = getSeverity(service.availabilityPct)
        const Icon = severity.id === 'meets' ? CheckIcon : WarningIcon
        const usedVisual =
          service.allowedDowntimeMinutes === 0
            ? 0
            : Math.min(
                100,
                (service.actualDowntimeMinutes / service.allowedDowntimeMinutes) * 100,
              )

        return (
          <article
            key={service.serviceId}
            className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-neutral-50">{service.serviceName}</h3>
                <p className="text-xs text-neutral-400">{service.serviceId}</p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${severity.badgeClass}`}
              >
                <Icon />
                {severity.label}
              </span>
            </div>

            <p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-50">
              {formatPercent(service.availabilityPct)}
            </p>

            <div className="mt-3">
              <div
                className="h-2 overflow-hidden rounded-full bg-neutral-800"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(usedVisual)}
                aria-label={`${severity.label}: share of allowed downtime used`}
              >
                <div
                  className={`h-full rounded-full ${severity.barClass}`}
                  style={{ width: `${usedVisual}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-neutral-300">
                Allowed: {formatDuration(service.allowedDowntimeMinutes)} / Actual:{' '}
                {formatDuration(service.actualDowntimeMinutes)} downtime
              </p>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-2 sm:gap-x-3">
              <div>
                <dt className="text-neutral-400">Failed checks</dt>
                <dd className="tabular-nums text-neutral-100">
                  {formatNumber(service.failedChecks)} of{' '}
                  {formatNumber(service.totalChecks)} checks failed
                </dd>
              </div>
              <div>
                <dt className="text-neutral-100">Longer failures</dt>
                <dd className="text-xs text-neutral-400">2 or more failed checks in a row</dd>
                <dd className="tabular-nums text-neutral-100">
                  {formatNumber(service.outageCount)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-100">One-off failures</dt>
                <dd className="text-xs text-neutral-400">single failed checks</dd>
                <dd className="tabular-nums text-neutral-100">
                  {formatNumber(service.isolatedErrorCount)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-100">
                  Typical speed{' '}
                  <span className="text-xs font-normal text-neutral-400">p50</span>
                </dt>
                <dd className="tabular-nums text-neutral-100">
                  {service.p50LatencyMs == null ? '—' : formatMs(service.p50LatencyMs)}
                </dd>
                <dt className="mt-2 text-neutral-100">
                  Slowest 5%{' '}
                  <span className="text-xs font-normal text-neutral-400">p95</span>
                </dt>
                <dd className="tabular-nums text-neutral-100">
                  {service.p95LatencyMs == null ? '—' : formatMs(service.p95LatencyMs)}
                </dd>
              </div>
            </dl>
          </article>
        )
      })}
    </div>
  )
}
