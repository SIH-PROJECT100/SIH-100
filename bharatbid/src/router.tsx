import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { RootLayout } from '@/layouts/RootLayout'
import { AppShell } from '@/layouts/AppShell'
import { useAuth } from '@/providers/AuthProvider'
import type { UserRole } from '@/types'

// ─── Loading fallback ─────────────────────────────────────────────────────────

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] bg-cream-50">
      <div className="text-ink-500 text-small font-mono animate-pulse">Loading BharatBid…</div>
    </div>
  )
}

// ─── Route guards ─────────────────────────────────────────────────────────────

function RequireRole({ role }: { role: UserRole | UserRole[] }) {
  const { user, isLoading, isAuthenticated } = useAuth()

  if (isLoading) return <LoadingFallback />

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const allowed = Array.isArray(role) ? role : [role]
  if (user && !allowed.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}

// ─── Lazy-loaded screens ──────────────────────────────────────────────────────

function wrap(factory: () => Promise<{ default: React.ComponentType }>) {
  const Component = lazy(factory)
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Component />
    </Suspense>
  )
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  {
    // RootLayout provides AuthProvider to everything inside the router
    element: <RootLayout />,
    children: [
      // Public login outside AppShell (custom split screen)
      { path: '/login', element: wrap(() => import('@/routes/login')) },

      // AppShell layout wrapper
      {
        element: <AppShell />,
        children: [
          // Dev gallery (no auth required)
          { path: '/dev/components', element: wrap(() => import('@/routes/dev/components')) },

          // Officer + Admin shared routes
          {
            element: <RequireRole role={['officer', 'admin']} />,
            children: [
              { index: true, element: <Navigate to="/tenders" replace /> },
              { path: '/tenders', element: wrap(() => import('@/routes/tenders/index')) },
              { path: '/tenders/create', element: wrap(() => import('@/routes/tenders/create')) },
              { path: '/tenders/:tenderId', element: wrap(() => import('@/routes/tenders/detail')) },
              { path: '/bidders/:bidderId', element: wrap(() => import('@/routes/bidders/detail')) },
            ],
          },

          // Admin-only routes
          {
            element: <RequireRole role="admin" />,
            children: [
              { path: '/admin', element: wrap(() => import('@/routes/admin/index')) },
              { path: '/admin/security-test', element: wrap(() => import('@/routes/admin/security-test')) },
              { path: '/admin/ledger', element: wrap(() => import('@/routes/admin/ledger')) },
              { path: '/admin/:tab', element: wrap(() => import('@/routes/admin/index')) },
            ],
          },

          // Bidder-only routes
          {
            element: <RequireRole role="bidder" />,
            children: [
              { index: true, element: <Navigate to="/tenders" replace /> },
              { path: '/tenders', element: wrap(() => import('@/routes/tenders/index')) },
              { path: '/tenders/:tenderId', element: wrap(() => import('@/routes/tenders/detail')) },
              { path: '/bidder', element: wrap(() => import('@/routes/bidder/index')) },
              { path: '/bidder/tenders/:tenderId/apply', element: wrap(() => import('@/routes/bidder/apply')) },
              { path: '/bidder/tenders/:tenderId/status', element: wrap(() => import('@/routes/bidder/index')) },
              { path: '/bidder/:section', element: wrap(() => import('@/routes/bidder/index')) },
            ],
          },

          // Utility pages
          { path: '/unauthorized', element: wrap(() => import('@/routes/unauthorized')) },
          { path: '*', element: wrap(() => import('@/routes/not-found')) },
        ],
      },
    ],
  },
])
