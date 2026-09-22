import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { StatsService } from '../../lib/api.ts'
import { SPEED_CHART_CAPTION, SPEED_CHART_TITLE } from '../../lib/copy.ts'
import { formatMs } from '../../lib/format.ts'

type LatencyChartProps = {
  services: StatsService[]
}

const tooltipStyle = {
  backgroundColor: '#171717',
  border: '1px solid #404040',
  borderRadius: '8px',
  color: '#f5f5f5',
}

const LATENCY_SERIES = [
  { key: 'p50', plain: 'Typical', jargon: 'p50', color: '#56B4E9' },
  { key: 'p95', plain: 'Slowest 5%', jargon: 'p95', color: '#E69F00' },
  { key: 'p99', plain: 'Slowest 1%', jargon: 'p99', color: '#CC79A7' },
] as const

export default function LatencyChart({ services }: LatencyChartProps) {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const ordered = [...services].sort((a, b) => a.serviceId.localeCompare(b.serviceId))
  const data = ordered.map((service) => ({
    service: service.serviceName,
    serviceId: service.serviceId,
    p50: service.p50LatencyMs,
    p95: service.p95LatencyMs,
    p99: service.p99LatencyMs,
  }))

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
        {SPEED_CHART_TITLE}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-neutral-400">{SPEED_CHART_CAPTION}</p>
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-300">No speed data.</p>
      ) : (
        <div className="mt-4 h-72 w-full min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
              <XAxis
                dataKey="service"
                interval={narrow ? Math.max(0, Math.ceil(data.length / 3) - 1) : 0}
                tick={{ fill: '#a3a3a3', fontSize: 12 }}
                stroke="#525252"
              />
              <YAxis
                tickFormatter={(value: number) => formatMs(value)}
                tick={{ fill: '#a3a3a3', fontSize: 12 }}
                stroke="#525252"
                width={64}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(_label, payload) => {
                  const row = payload?.[0]?.payload as
                    | { service?: string; serviceId?: string }
                    | undefined
                  if (!row?.service) return String(_label)
                  return `${row.service} (${row.serviceId ?? ''})`
                }}
                formatter={(value, name) => {
                  const series = LATENCY_SERIES.find((item) => item.key === name)
                  const label = series
                    ? `${series.plain} (${series.jargon})`
                    : String(name)
                  return [typeof value === 'number' ? formatMs(value) : '—', label]
                }}
              />
              <Legend
                wrapperStyle={{ color: '#e5e5e5', fontSize: 12 }}
                formatter={(value) => {
                  const series = LATENCY_SERIES.find((item) => item.key === value)
                  if (!series) return String(value)
                  return `${series.plain} (${series.jargon})`
                }}
              />
              {LATENCY_SERIES.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.key}
                  fill={series.color}
                  maxBarSize={28}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
