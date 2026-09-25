import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { router } from './router'
import { I18nProvider } from '@/providers/I18nProvider'

// ─── TanStack Query client ────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,      // 30s — government data doesn't change every second
      gcTime: 5 * 60_000,     // 5min garbage collect
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

// ─── Root app ─────────────────────────────────────────────────────────────────
// AuthProvider is *inside* RouterProvider so it can use useNavigate.
// I18nProvider wraps everything so t() is available everywhere.

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <RouterProvider router={router} />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-small)',
              color: 'var(--color-ink-900)',
              background: 'var(--color-paper)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
            },
          }}
        />
      </I18nProvider>
    </QueryClientProvider>
  )
}
