import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/apiClient'
import type { HealthResponse } from '@/types'

export function HealthFooter() {
  const { data: health, isError } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await apiClient.get<HealthResponse>('/health')
      return res.data
    },
    refetchInterval: 30000,
    retry: 1,
  })

  return (
    <footer className="w-full border-t border-line bg-paper px-4 py-2 text-micro text-ink-500 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-navy-900">BharatBid</span>
        <span className="text-ink-300">·</span>
        <span>Sovereign GeM Bid Compliance</span>
      </div>

      <div className="flex items-center gap-3 font-mono">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isError
                ? 'bg-risk-critical'
                : health?.status === 'ok'
                ? 'bg-risk-low animate-pulse'
                : 'bg-risk-medium'
            }`}
          />
          <span>
            {isError
              ? 'Backend offline'
              : health
              ? `API ${health.status} (${health.version || 'v2.0'})`
              : 'Checking API…'}
          </span>
        </div>

        {health?.demo_mode && (
          <span className="px-1.5 py-0.5 rounded bg-saffron-100 text-saffron-600 font-medium">
            DEMO_MODE
          </span>
        )}
      </div>
    </footer>
  )
}
