import { useCallback, useState } from 'react'
import LogsSection from './components/logs/LogsSection.tsx'
import StatsSection from './components/stats/StatsSection.tsx'
import UploadCard from './components/upload/UploadCard.tsx'
import type { UploadResult } from './lib/api.ts'
import type { ServiceOption } from './lib/logsView.ts'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function App() {
  const [activeUpload, setActiveUpload] = useState<UploadResult | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [statsOpen, setStatsOpen] = useState(true)
  const [logsOpen, setLogsOpen] = useState(true)
  const [logServices, setLogServices] = useState<ServiceOption[]>([])

  function handleUploaded(result: UploadResult): void {
    setActiveUpload(result)
    setRefreshKey((key) => key + 1)
  }

  const handleServicesLoaded = useCallback((services: ServiceOption[]) => {
    setLogServices(services)
  }, [])

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-50 sm:text-4xl">
            NineWatch
          </h1>
          <p className="mt-2 max-w-2xl text-base text-neutral-400">
            Turn messy uptime logs into trustworthy SLA numbers.
          </p>
        </header>

        <UploadCard onUploaded={handleUploaded} />

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-sm">
          <h2>
            <button
              type="button"
              aria-expanded={statsOpen}
              onClick={() => setStatsOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 rounded-lg text-left text-lg font-semibold tracking-tight text-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
            >
              SLA Stats
              <Chevron open={statsOpen} />
            </button>
          </h2>
          <div className={statsOpen ? 'mt-4' : 'hidden'}>
            <StatsSection
              uploadId={activeUpload?.uploadId}
              refreshKey={refreshKey}
              onServicesLoaded={handleServicesLoaded}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-sm">
          <h2>
            <button
              type="button"
              aria-expanded={logsOpen}
              onClick={() => setLogsOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 rounded-lg text-left text-lg font-semibold tracking-tight text-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
            >
              Check Logs
              <Chevron open={logsOpen} />
            </button>
          </h2>
          <div className={logsOpen ? 'mt-4' : 'hidden'}>
            <LogsSection
              key={`${activeUpload?.uploadId ?? 'latest'}-${refreshKey}`}
              uploadId={activeUpload?.uploadId}
              refreshKey={refreshKey}
              services={logServices}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
