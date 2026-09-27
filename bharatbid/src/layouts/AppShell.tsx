import { useState, useEffect } from 'react'
import { Link, useNavigate, Outlet } from 'react-router-dom'
import {
  LogOut,
  User as UserIcon,
  ShieldCheck,
  Bell,
  Sun,
  Moon,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { Button } from '@/components/ui/Button'
import { GovtFooter } from '@/components/GovtFooter'
import { useAuth } from '@/providers/AuthProvider'
import { useI18n } from '@/providers/I18nProvider'

export function AppShell() {
  const { user, logout, isAuthenticated } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  // Dark Mode State
  const [isDark, setIsDark] = useState<boolean>(() => {
    return (
      localStorage.getItem('bharatbid_theme') === 'dark' ||
      document.documentElement.classList.contains('dark')
    )
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('bharatbid_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('bharatbid_theme', 'light')
    }
  }, [isDark])

  // Notifications Popover State
  const [showNotifications, setShowNotifications] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Role flags
  const isAdmin = user?.role === 'admin'
  const isBidder = user?.role === 'bidder'

  return (
    <div className="min-h-screen flex flex-col justify-between bg-cream-50 dark:bg-[#071324] text-ink-900 dark:text-[#F8FAFC] transition-colors">
      {/* ─── Top Sovereign Navbar ──────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full bg-paper/95 dark:bg-[#0B1B34]/95 backdrop-blur-sm border-b border-line dark:border-[#1C3B68] shadow-xs transition-colors">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            {/* Sovereign Logo */}
            <Link
              to={isAdmin ? '/admin' : isBidder ? '/bidder' : '/tenders'}
              className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500 rounded py-1 pr-2"
              aria-label="BharatBid Home"
            >
              <Logo size={32} />
              <div className="hidden xl:flex flex-col border-l border-line dark:border-[#1C3B68] pl-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-saffron-600 dark:text-saffron-400 font-sans">
                  Govt. of India
                </span>
                <span className="text-[11px] font-semibold text-ink-600 dark:text-slate-300 leading-tight">
                  Procurement Portal
                </span>
              </div>
            </Link>
          </div>

          {/* Right Action Toolbar */}
          <div className="flex items-center gap-2.5">
            {/* Language Toggle */}
            <LanguageToggle />

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg text-ink-700 dark:text-slate-200 hover:bg-cream-100 dark:hover:bg-[#102649] border border-line dark:border-[#1C3B68] transition-colors"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Dark Mode"
            >
              {isDark ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-navy-800" />}
            </button>

            {/* Notifications Button */}
            {isAuthenticated && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg text-ink-700 dark:text-slate-200 hover:bg-cream-100 dark:hover:bg-[#102649] border border-line dark:border-[#1C3B68] transition-colors"
                  title="Statutory Alerts & Notifications"
                  aria-label="View notifications"
                >
                  <Bell className="w-4.5 h-4.5 text-navy-800 dark:text-slate-200" />
                  <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-risk-critical text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    3
                  </span>
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-paper dark:bg-[#0B1B34] rounded-xl border border-line dark:border-[#1C3B68] shadow-xl p-4 z-50 flex flex-col gap-3 animate-fade-in text-ink-900 dark:text-[#F8FAFC]">
                    <div className="flex items-center justify-between pb-2 border-b border-line dark:border-[#1C3B68]">
                      <span className="font-bold text-sm">Notifications &amp; Alerts</span>
                      <span className="text-xs bg-saffron-100 dark:bg-saffron-900/40 text-saffron-800 dark:text-saffron-300 font-semibold px-2 py-0.5 rounded">
                        3 New
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto">
                      <div className="p-2.5 rounded-lg bg-cream-50 dark:bg-[#102649] border border-line dark:border-[#1C3B68] flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-risk-low dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div className="flex flex-col text-xs">
                          <span className="font-semibold text-ink-900 dark:text-slate-100">Udyam MSME Verified</span>
                          <span className="text-ink-600 dark:text-slate-300">
                            Automated statutory cross-check passed. EMD exemption confirmed.
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/60 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex flex-col text-xs">
                          <span className="font-semibold text-amber-900 dark:text-amber-200">
                            GST Annual Filing Renewal
                          </span>
                          <span className="text-amber-800 dark:text-amber-300">
                            GST registration certificate requires annual renewal in 30 days.
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-cream-50 dark:bg-[#102649] border border-line dark:border-[#1C3B68] flex items-start gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-navy-700 dark:text-sky-400 shrink-0 mt-0.5" />
                        <div className="flex flex-col text-xs">
                          <span className="font-semibold text-ink-900 dark:text-slate-100">Trust Score Upgraded</span>
                          <span className="text-ink-600 dark:text-slate-300">
                            Standing upgraded to 88/100 (Verified Veteran Badge unlocked).
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      className="w-full text-center text-xs text-navy-800 dark:text-saffron-400 font-semibold pt-2 border-t border-line dark:border-[#1C3B68] hover:underline"
                    >
                      Close Panel
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* User Profile / Auth Chrome */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3 pl-3 border-l border-line dark:border-[#1C3B68]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-cream-100 dark:bg-[#152E54] text-navy-900 dark:text-saffron-400 flex items-center justify-center font-bold text-xs shadow-xs border border-line dark:border-[#1C3B68]">
                    {user.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'BB'}
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-sm font-bold text-ink-900 dark:text-[#F8FAFC] leading-tight">
                      {user.name}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-saffron-700 dark:text-saffron-400">
                      {user.role === 'officer'
                        ? 'Procurement Officer'
                        : user.role === 'admin'
                        ? 'Administrator'
                        : 'Verified Bidder'}
                    </span>
                  </div>
                </div>

                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={handleLogout}
                  title="Sign out of BharatBid session"
                  leftIcon={<LogOut className="w-4 h-4 text-ink-600 dark:text-slate-300" />}
                  className="dark:text-slate-200 dark:hover:bg-[#102649]"
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

      {/* ─── Official Sovereign Government Footer ─────────────────────── */}
      <GovtFooter />
    </div>
  )
}
