import type { StatsOverall } from '../../lib/api.ts'
import {
  getSeverity,
  overAllowanceText,
  targetBadgeLabel,
} from '../../lib/copy.ts'
import { formatDuration, formatPercent } from '../../lib/format.ts'

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

function WarningIcon() {
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

export default function SlaSummary({ overall }: SlaSummaryProps) {
  const severity = getSeverity(overall.availabilityPct)
  const overText = overAllowanceText(
    overall.actualDowntimeMinutes,
    overall.allowedDowntimeMinutes,
  )
  const usedRatio =
    overall.allowedDowntimeMinutes === 0
      ? 0
      : Math.min(100, (overall.actualDowntimeMinutes / overall.allowedDowntimeMinutes) * 100)

  const Icon =
    severity.id === 'meets' ? CheckIcon : severity.id === 'far' ? AlertIcon : WarningIcon

  return (
    <section className={`rounded-xl border p-5 ${severity.panelClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-300">Time the services were working</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-neutral-50">
            {formatPercent(overall.availabilityPct)}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${severity.badgeClass}`}
        >
          <Icon />
          {targetBadgeLabel(overall.meetsSla)}
        </span>
      </div>

      <div className="mt-4 space-y-1 text-sm text-neutral-200">
        <p>
          Allowed downtime:{' '}
          <span className="font-medium tabular-nums text-neutral-50">
            {formatDuration(overall.allowedDowntimeMinutes)}
          </span>
        </p>
        <p>
          Actual downtime:{' '}
          <span className="font-medium tabular-nums text-neutral-50">
            {formatDuration(overall.actualDowntimeMinutes)}
          </span>
        </p>
        {overText && <p className="font-medium text-neutral-100">{overText}</p>}
      </div>

      <div className="mt-3">
        <div
          className="h-2 overflow-hidden rounded-full bg-neutral-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(usedRatio)}
          aria-label="Share of allowed downtime used"
        >
          <div
            className={`h-full rounded-full ${severity.barClass}`}
            style={{ width: `${usedRatio}%` }}
          />
        </div>
      </div>
    </section>
  )
}
