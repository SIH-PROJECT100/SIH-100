import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import {
  FileText,
  Shield,
  Sliders,
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  Layers,
  Award,
  FileCheck2,
  ShieldCheck,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { Button } from '@/components/ui/Button'
import { HealthFooter } from '@/components/HealthFooter'
import { useAuth } from '@/providers/AuthProvider'
import { useI18n } from '@/providers/I18nProvider'
import { cn } from '@/lib/utils'

export function AppShell() {
  const { user, logout, isAuthenticated } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Navigation items based on role
  const isOfficerOrAdmin = user?.role === 'officer' || user?.role === 'admin'
  const isAdmin = user?.role === 'admin'
  const isBidder = user?.role === 'bidder'

  const navLinks = [
    ...(isOfficerOrAdmin
      ? [
          {
            label: t('nav.tenders', 'Tenders'),
            href: '/tenders',
            icon: FileText,
            isActive: location.pathname.startsWith('/tenders'),
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            label: t('nav.admin', 'Admin Console'),
            href: '/admin',
            icon: Sliders,
            isActive: location.pathname.startsWith('/admin') && !location.pathname.includes('/ledger') && !location.pathname.includes('/security-test'),
          },
          {
            label: t('nav.ledger', 'Trust Ledger'),
            href: '/admin/ledger',
            icon: Shield,
            isActive: location.pathname.includes('/ledger'),
          },
          {
            label: t('nav.securityTest', 'Immutability Proof'),
            href: '/admin/security-test',
            icon: ShieldCheck,
            isActive: location.pathname.includes('/security-test'),
          },
        ]
      : []),
    ...(isBidder
      ? [
          {
            label: t('nav.documents', 'Compliance Documents'),
            href: '/bidder/documents',
            icon: FileCheck2,
            isActive: location.pathname === '/bidder/documents',
          },
          {
            label: t('nav.profile', 'Trust Profile'),
            href: '/bidder/profile',
            icon: Award,
            isActive: location.pathname.startsWith('/bidder/profile'),
          },
          {
            label: t('nav.bidder', 'My Submissions'),
            href: '/bidder/vault',
            icon: LayoutDashboard,
            isActive: location.pathname === '/bidder/vault' || location.pathname === '/bidder',
          },
        ]
      : []),
    ...(import.meta.env.DEV
      ? [
          {
            label: t('nav.components', 'UI Gallery'),
            href: '/dev/components',
            icon: Layers,
            isActive: location.pathname.startsWith('/dev'),
          },
        ]
      : []),
  ]

  return (
    <div className="min-h-screen flex flex-col justify-between bg-cream-50 text-ink-900">
      {/* ─── Top Sovereign Navbar ──────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full bg-paper/95 backdrop-blur-sm border-b border-line shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link
              to={isAdmin ? '/admin' : isBidder ? '/bidder' : '/tenders'}
              className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500 rounded"
              aria-label="BharatBid Home"
            >
              <Logo size={32} />
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Navigation">
              {navLinks.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors select-none',
                      item.isActive
                        ? 'bg-cream-100 text-navy-900 font-semibold'
                        : 'text-ink-700 hover:text-navy-900 hover:bg-cream-50'
                    )}
                  >
                    <Icon className="w-5 h-5 text-ink-500" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right Action Chrome */}
          <div className="flex items-center gap-3">
            <LanguageToggle />

            {isAuthenticated && user ? (
              <div className="flex items-center gap-3 pl-3 border-l border-line">
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-sm font-semibold text-ink-900 leading-tight">
                    {user.name}
                  </span>
                  <span className="text-xs font-mono uppercase tracking-wider text-saffron-600 bg-saffron-100 px-2 py-0.5 rounded font-medium">
                    {t('role.' + user.role, user.role)}
                  </span>
                </div>

                <Button
                  variant="tertiary"
                  size="md"
                  onClick={handleLogout}
                  title="Sign out of BharatBid session"
                  leftIcon={<LogOut className="w-4 h-4 text-ink-500" />}
                >
                  <span className="hidden sm:inline">{t('nav.signOut', 'Sign Out')}</span>
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button variant="primary" size="md" leftIcon={<UserIcon className="w-4 h-4" />}>
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main Page Content ────────────────────────────────────────── */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5">
        <Outlet />
      </main>

      {/* ─── Mobile Bottom Destination Bar ────────────────────────────── */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden sticky bottom-0 z-20 w-full bg-paper border-t border-line shadow-lg flex items-center justify-around py-2 px-1"
      >
        {navLinks.slice(0, 4).map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded text-micro select-none',
                item.isActive ? 'text-navy-900 font-semibold' : 'text-ink-500 hover:text-ink-900'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ─── Sovereign Health Footer ─────────────────────────────────── */}
      <HealthFooter />
    </div>
  )
}
