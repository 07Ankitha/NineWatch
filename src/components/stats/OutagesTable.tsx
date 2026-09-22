import type { StatsIncident } from '../../lib/api.ts'
import { burstsLabel, describeStatus, INCIDENTS_SUBTITLE, INCIDENTS_TITLE } from '../../lib/copy.ts'
import { formatDateTime, formatDuration, formatNumber } from '../../lib/format.ts'

type OutagesTableProps = {
  incidents: StatsIncident[]
}

export default function OutagesTable({ incidents }: OutagesTableProps) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
        {INCIDENTS_TITLE}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-neutral-400">{INCIDENTS_SUBTITLE}</p>
      {incidents.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-300">No longer failures detected.</p>
      ) : (
        <div className="mt-3 max-w-full overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400">
                <th className="whitespace-nowrap py-2 pr-4 font-medium">Service</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">Started (UTC)</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">Ended (UTC)</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">Lasted</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">Failed checks</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">Downtime</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">Bursts</th>
                <th className="whitespace-nowrap py-2 font-medium">Errors seen</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr
                  key={`${incident.serviceId}-${incident.startedAt}`}
                  className="border-b border-neutral-800/80 last:border-0"
                >
                  <td className="whitespace-nowrap py-2.5 pr-4 text-neutral-200">
                    <span className="font-medium text-neutral-100">{incident.serviceName}</span>
                    <span className="ml-2 text-xs text-neutral-400">{incident.serviceId}</span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-neutral-300">
                    {formatDateTime(incident.startedAt)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-neutral-300">
                    {formatDateTime(incident.endedAt)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-neutral-300">
                    {formatDuration(incident.windowMinutes)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-neutral-300">
                    {formatNumber(incident.failedChecks)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-neutral-300">
                    {formatDuration(incident.downtimeMinutes)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-neutral-300">
                    {burstsLabel(incident.segments)}
                  </td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {incident.statusCodes.map((code) => (
                        <span
                          key={code}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-100"
                        >
                          {describeStatus(code)}
                          <span className="tabular-nums text-neutral-400">{code}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
