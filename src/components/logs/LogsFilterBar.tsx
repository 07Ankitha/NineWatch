import type { ServiceOption } from '../../lib/logsView.ts'
import { LOGS_UTC_NOTE } from '../../lib/copy.ts'
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
  'min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 sm:w-auto'

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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <fieldset className="w-full space-y-1 sm:w-auto">
          <legend className="text-xs font-medium text-neutral-400">Date mode</legend>
          <div className="flex min-h-11 rounded-lg border border-neutral-700 p-0.5">
            {(['single', 'range'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={dateMode === mode}
                onClick={() => onDateMode(mode)}
                className={`min-h-10 flex-1 rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:flex-none ${
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
          <label className="w-full space-y-1 text-sm sm:w-auto">
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
            <label className="w-full space-y-1 text-sm sm:w-auto">
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
            <label className="w-full space-y-1 text-sm sm:w-auto">
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

        <label className="w-full space-y-1 text-sm sm:w-auto">
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

        <label className="flex min-h-11 w-full items-center gap-3 text-sm text-neutral-200 sm:w-auto">
          <input
            type="checkbox"
            checked={failuresOnly}
            onChange={(event) => onFailuresOnly(event.target.checked)}
            className="h-5 w-5 rounded border-neutral-600 bg-neutral-900 text-sky-500 focus-visible:ring-2 focus-visible:ring-sky-400"
          />
          Show only failed checks
        </label>

        <button
          type="button"
          disabled={!filtered}
          onClick={onClear}
          className="min-h-11 w-full rounded-lg border border-neutral-600 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          Clear filters
        </button>
      </div>
      <p className="text-xs text-neutral-400">{LOGS_UTC_NOTE}</p>
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
