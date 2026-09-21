import type { StatsOutage } from '../../lib/api.ts'
import { formatDateTime, formatDuration, formatNumber } from '../../lib/format.ts'

type OutagesTableProps = {
  outages: StatsOutage[]
}

export default function OutagesTable({ outages }: OutagesTableProps) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Outages
      </h3>
      {outages.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">
          No multi-check outages detected.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-500">
                <th className="whitespace-nowrap py-2 pr-4 font-medium">Service</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">Started (UTC)</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">Ended (UTC)</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">Duration</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">Failed checks</th>
                <th className="whitespace-nowrap py-2 font-medium">Status codes</th>
              </tr>
            </thead>
            <tbody>
              {outages.map((outage) => (
                <tr
                  key={`${outage.serviceId}-${outage.startedAt}`}
                  className="border-b border-neutral-800/80 last:border-0"
                >
                  <td className="whitespace-nowrap py-2.5 pr-4 text-neutral-200">
                    <span className="font-medium text-neutral-100">{outage.serviceName}</span>
                    <span className="ml-2 text-xs text-neutral-500">{outage.serviceId}</span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-neutral-300">
                    {formatDateTime(outage.startedAt)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-neutral-300">
                    {formatDateTime(outage.endedAt)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-neutral-300">
                    {formatDuration(outage.durationMinutes)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-neutral-300">
                    {formatNumber(outage.failedChecks)}
                  </td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {outage.statusCodes.map((code) => (
                        <span
                          key={code}
                          className="rounded-md border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-xs tabular-nums text-neutral-100"
                        >
                          {code}
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
