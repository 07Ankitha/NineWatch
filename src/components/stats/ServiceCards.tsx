import type { StatsService } from '../../lib/api.ts'
import { formatMs, formatNumber, formatPercent } from '../../lib/format.ts'
import BudgetUsedBar from './BudgetUsedBar.tsx'

type ServiceCardsProps = {
  services: StatsService[]
}

export default function ServiceCards({ services }: ServiceCardsProps) {
  const ordered = [...services].sort((a, b) => {
    if (a.availabilityPct !== b.availabilityPct) {
      return a.availabilityPct - b.availabilityPct
    }
    return a.serviceId.localeCompare(b.serviceId)
  })

  if (ordered.length === 0) {
    return (
      <p className="text-sm text-neutral-400">No services in this upload.</p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ordered.map((service) => (
        <article
          key={service.serviceId}
          className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-neutral-50">{service.serviceName}</h3>
              <p className="text-xs text-neutral-500">{service.serviceId}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                service.meetsSla
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : 'bg-rose-500/15 text-rose-200'
              }`}
            >
              {service.meetsSla ? 'Meets SLA' : 'Breached'}
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-50">
            {formatPercent(service.availabilityPct)}
          </p>
          <div className="mt-3">
            <BudgetUsedBar usedPct={service.downtimeBudgetUsedPct} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div>
              <dt className="text-neutral-500">Failed checks</dt>
              <dd className="tabular-nums text-neutral-200">
                {formatNumber(service.failedChecks)} of {formatNumber(service.totalChecks)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Outages</dt>
              <dd className="tabular-nums text-neutral-200">
                {formatNumber(service.outageCount)}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-neutral-500">
                Isolated errors
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-600 text-[10px] font-semibold text-neutral-300"
                  title="Isolated errors are single failed checks that did not form an outage."
                >
                  ?
                </span>
              </dt>
              <dd className="tabular-nums text-neutral-200">
                {formatNumber(service.isolatedErrorCount)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Latency p50 / p95</dt>
              <dd className="tabular-nums text-neutral-200">
                {service.p50LatencyMs == null ? '—' : formatMs(service.p50LatencyMs)}
                {' / '}
                {service.p95LatencyMs == null ? '—' : formatMs(service.p95LatencyMs)}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  )
}
