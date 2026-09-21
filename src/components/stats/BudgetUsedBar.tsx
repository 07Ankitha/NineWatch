import { formatPercent } from '../../lib/format.ts'

type BudgetUsedBarProps = {
  usedPct: number | null
}

export default function BudgetUsedBar({ usedPct }: BudgetUsedBarProps) {
  if (usedPct == null) {
    return (
      <p className="text-sm text-neutral-400">Downtime budget used: n/a</p>
    )
  }

  const visual = Math.min(100, Math.max(0, usedPct))
  const overBudget = usedPct > 100

  return (
    <div>
      <div
        className="h-2 overflow-hidden rounded-full bg-neutral-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(visual)}
        aria-label={`Downtime budget used ${Math.round(usedPct)} percent`}
      >
        <div
          className={`h-full rounded-full ${overBudget ? 'bg-rose-400' : 'bg-sky-400'}`}
          style={{ width: `${visual}%` }}
        />
      </div>
      <p className="mt-1.5 text-sm text-neutral-300">
        Downtime budget used:{' '}
        <span className="font-medium tabular-nums text-neutral-100">
          {formatPercent(usedPct, 0)}
        </span>
      </p>
    </div>
  )
}
