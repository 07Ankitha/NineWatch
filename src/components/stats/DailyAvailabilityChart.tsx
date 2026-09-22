import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { StatsDailyAvailability, StatsService } from '../../lib/api.ts'
import { colorForService, dailyAvailabilityYDomain } from '../../lib/chart.ts'
import { DAILY_CHART_CAPTION, DAILY_CHART_TITLE } from '../../lib/copy.ts'
import { formatDay, formatPercent } from '../../lib/format.ts'

type DailyAvailabilityChartProps = {
  dailyAvailability: StatsDailyAvailability[]
  slaTargetPct: number
  services: StatsService[]
}

const tooltipStyle = {
  backgroundColor: '#171717',
  border: '1px solid #404040',
  borderRadius: '8px',
  color: '#f5f5f5',
}

export default function DailyAvailabilityChart({
  dailyAvailability,
  slaTargetPct,
  services,
}: DailyAvailabilityChartProps) {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const nameById = new Map(services.map((service) => [service.serviceId, service.serviceName]))
  const serviceIds = [...new Set(dailyAvailability.map((row) => row.serviceId))].sort()
  const days = [...new Set(dailyAvailability.map((row) => row.day))].sort()
  const lookup = new Map(
    dailyAvailability.map((row) => [`${row.serviceId}:${row.day}`, row.availabilityPct]),
  )
  const points = days.map((day) => {
    const point: Record<string, string | number | null> = { day }
    for (const serviceId of serviceIds) {
      point[serviceId] = lookup.get(`${serviceId}:${day}`) ?? null
    }
    return point
  })
  const yValues = dailyAvailability.map((row) => row.availabilityPct)
  const domain = dailyAvailabilityYDomain(yValues)
  const tickInterval = narrow ? Math.max(0, Math.ceil(days.length / 5) - 1) : 0

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
        {DAILY_CHART_TITLE}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-neutral-400">{DAILY_CHART_CAPTION}</p>
      {points.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-300">No daily availability data.</p>
      ) : (
        <div className="mt-4 min-h-[320px] w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tickFormatter={formatDay}
                interval={tickInterval}
                tick={{ fill: '#a3a3a3', fontSize: 12 }}
                stroke="#525252"
              />
              <YAxis
                domain={domain}
                tickFormatter={(value: number) => formatPercent(value, 1)}
                tick={{ fill: '#a3a3a3', fontSize: 12 }}
                stroke="#525252"
                width={64}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) => formatDay(String(label))}
                formatter={(value, name) => {
                  const id = String(name)
                  const label = `${nameById.get(id) ?? id}`
                  return [
                    typeof value === 'number' ? formatPercent(value) : '—',
                    label,
                  ]
                }}
              />
              <Legend
                wrapperStyle={{ color: '#e5e5e5', fontSize: 12 }}
                formatter={(value) => {
                  const id = String(value)
                  const name = nameById.get(id) ?? id
                  return `${name} (${id})`
                }}
              />
              <ReferenceLine y={slaTargetPct} stroke="#fafafa" strokeDasharray="6 4" />
              {serviceIds.map((serviceId) => (
                <Line
                  key={serviceId}
                  type="monotone"
                  dataKey={serviceId}
                  name={serviceId}
                  stroke={colorForService(serviceId, serviceIds)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
