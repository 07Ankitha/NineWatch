import type { StatsOverall } from '../../lib/api.ts'
import { formatDuration, formatPercent } from '../../lib/format.ts'
import BudgetUsedBar from './BudgetUsedBar.tsx'

type SlaSummaryProps = {
  overall: StatsOverall
  slaTargetPct: number
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M5 10.5L8.5 14L15 6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M10 4L17.5 16.5H2.5L10 4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 8.5V11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.8" fill="currentColor" />
    </svg>
  )
}

export default function SlaSummary({ overall, slaTargetPct }: SlaSummaryProps) {
  const usedPct =
    overall.allowedDowntimeMinutes === 0
      ? null
      : (overall.actualDowntimeMinutes / overall.allowedDowntimeMinutes) * 100

  return (
    <section
      className={`rounded-xl border p-5 ${
        overall.meetsSla
          ? 'border-emerald-500/40 bg-emerald-950/30'
          : 'border-rose-500/40 bg-rose-950/30'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-400">Overall availability</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-neutral-50">
            {formatPercent(overall.availabilityPct)}
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            Target {formatPercent(slaTargetPct)}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
            overall.meetsSla
              ? 'bg-emerald-500/20 text-emerald-100'
              : 'bg-rose-500/20 text-rose-100'
          }`}
        >
          {overall.meetsSla ? <CheckIcon /> : <AlertIcon />}
          {overall.meetsSla ? 'SLA met' : 'SLA breached'}
        </span>
      </div>
      <p className="mt-4 text-sm text-neutral-200">
        Actual downtime {formatDuration(overall.actualDowntimeMinutes)} vs allowed{' '}
        {formatDuration(overall.allowedDowntimeMinutes)}
      </p>
      <div className="mt-3">
        <BudgetUsedBar usedPct={usedPct} />
      </div>
    </section>
  )
}
