import type { ServiceOption } from '../../lib/logsView.ts'
import { isStartAfterEnd } from '../../lib/logsView.ts'

type DateMode = 'single' | 'range'

type LogsFilterBarProps = {
  dateMode: DateMode
  date: string
  from: string
  to: string
  service: string
  failuresOnly: boolean
  minDate: string
  maxDate: string
  services: ServiceOption[]
  filtered: boolean
  rangeError: string | null
  onDateMode: (mode: DateMode) => void
  onDate: (value: string) => void
  onFrom: (value: string) => void
  onTo: (value: string) => void
  onService: (value: string) => void
  onFailuresOnly: (value: boolean) => void
  onClear: () => void
}

const fieldClass =
  'rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900'

export default function LogsFilterBar({
  dateMode,
  date,
  from,
  to,
  service,
  failuresOnly,
  minDate,
  maxDate,
  services,
  filtered,
  rangeError,
  onDateMode,
  onDate,
  onFrom,
  onTo,
  onService,
  onFailuresOnly,
  onClear,
}: LogsFilterBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium text-neutral-400">Date mode</legend>
          <div className="flex rounded-lg border border-neutral-700 p-0.5">
            {(['single', 'range'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={dateMode === mode}
                onClick={() => onDateMode(mode)}
                className={`rounded-md px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  dateMode === mode
                    ? 'bg-neutral-700 text-neutral-50'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {mode === 'single' ? 'Single day' : 'Date range'}
              </button>
            ))}
          </div>
        </fieldset>

        {dateMode === 'single' ? (
          <label className="space-y-1 text-sm">
            <span className="block text-xs font-medium text-neutral-400">Day (UTC)</span>
            <input
              type="date"
              value={date}
              min={minDate || undefined}
              max={maxDate || undefined}
              onChange={(event) => onDate(event.target.value)}
              className={fieldClass}
            />
          </label>
        ) : (
          <>
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-medium text-neutral-400">From (UTC)</span>
              <input
                type="date"
                value={from}
                min={minDate || undefined}
                max={maxDate || undefined}
                onChange={(event) => onFrom(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-medium text-neutral-400">To (UTC)</span>
              <input
                type="date"
                value={to}
                min={minDate || undefined}
                max={maxDate || undefined}
                onChange={(event) => onTo(event.target.value)}
                className={fieldClass}
              />
            </label>
          </>
        )}

        <label className="space-y-1 text-sm">
          <span className="block text-xs font-medium text-neutral-400">Service</span>
          <select
            value={service}
            onChange={(event) => onService(event.target.value)}
            className={fieldClass}
          >
            <option value="">All services</option>
            {services.map((item) => (
              <option key={item.serviceId} value={item.serviceId}>
                {item.serviceName} ({item.serviceId})
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 pb-2 text-sm text-neutral-200">
          <input
            type="checkbox"
            checked={failuresOnly}
            onChange={(event) => onFailuresOnly(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-600 bg-neutral-900 text-sky-500 focus-visible:ring-2 focus-visible:ring-sky-400"
          />
          Failures only
        </label>

        <button
          type="button"
          disabled={!filtered}
          onClick={onClear}
          className="rounded-lg border border-neutral-600 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear filters
        </button>
      </div>
      <p className="text-xs text-neutral-500">Dates are in UTC</p>
      {rangeError && (
        <p role="alert" className="text-sm text-red-400">
          {rangeError}
        </p>
      )}
    </div>
  )
}

export function hasActiveFilters(options: {
  date: string
  from: string
  to: string
  service: string
  failuresOnly: boolean
}): boolean {
  return Boolean(
    options.date || options.from || options.to || options.service || options.failuresOnly,
  )
}

export function rangeValidationError(
  dateMode: DateMode,
  from: string,
  to: string,
): string | null {
  if (dateMode !== 'range') return null
  if (isStartAfterEnd(from, to)) {
    return 'Start date must be on or before end date.'
  }
  return null
}
