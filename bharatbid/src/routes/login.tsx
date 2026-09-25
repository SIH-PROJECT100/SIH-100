import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'
import { useI18n } from '@/providers/I18nProvider'
import { useRateLimitedAction } from '@/hooks/useRateLimitedAction'
import { Logo } from '@/components/Logo'
import { Button, Input, LanguageToggle } from '@/components/ui'
import type { AuthResponse } from '@/types'
import { toast } from 'sonner'
import { Lock, Mail, Shield, UserCheck, Briefcase } from 'lucide-react'

// Demo credentials
const DEMO_USERS = {
  officer: { email: 'officer@demo.com', password: 'demo1234!', name: 'Officer' },
  admin: { email: 'admin@demo.com', password: 'demo1234!', name: 'Admin' },
  bidder: { email: 'bidder@demo.com', password: 'demo1234!', name: 'Bidder' },
}

export default function LoginPage() {
  const { t, locale } = useI18n()
  const { login, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Show session-expired toast if redirected here with state
  useEffect(() => {
    if ((location.state as { sessionExpired?: boolean })?.sessionExpired) {
      toast.error(t('login.sessionExpired', 'Your session has expired. Please sign in again.'))
    }
  }, [location.state, t])

  // Redirect after login based on role
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') navigate('/admin')
      else if (user.role === 'bidder') navigate('/bidder')
      else navigate('/tenders')
    }
  }, [isAuthenticated, user, navigate])

  const {
    mutate: submitLogin,
    isPending,
    cooldownSeconds,
    isRateLimited,
  } = useRateLimitedAction<AuthResponse, Error, { email: string; password: string }>({
    mutationFn: async (creds) => {
      await login(creds.email, creds.password)
      return {} as AuthResponse
    },
    onError: (err) => {
      if (!isRateLimited) {
        toast.error(err.message ?? t('error.generic', 'Authentication failed. Please check credentials.'))
      }
    },
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error(locale === 'hi' ? 'कृपया ईमेल और पासवर्ड दर्ज करें' : 'Please enter email and password')
      return
    }
    submitLogin({ email, password })
  }

  const fillDemo = (role: keyof typeof DEMO_USERS) => {
    setEmail(DEMO_USERS[role].email)
    setPassword(DEMO_USERS[role].password)
    toast.info(
      locale === 'hi'
        ? `डेमो ${DEMO_USERS[role].name} क्रेडेंशियल भरे गए`
        : `Filled credentials for Demo ${DEMO_USERS[role].name}`
    )
  }

  const buttonLabel = isRateLimited
    ? (locale === 'hi' ? `${cooldownSeconds}s बाद पुनः प्रयास करें` : `Try again in ${cooldownSeconds}s`)
    : isPending
    ? (locale === 'hi' ? 'सत्यापित किया जा रहा है…' : 'Authenticating…')
    : t('login.submit', 'Sign In to Portal')

  return (
    <div className="min-h-screen flex bg-cream-50 relative">
      {/* ─── Left Sovereign Panel (45%) ───────────────────────────────── */}
      <div className="hidden md:flex md:w-5/12 lg:w-1/2 bg-cream-100 flex-col items-center justify-between p-12 lg:p-16 relative overflow-hidden border-r border-line">
        <div className="w-full flex justify-start">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-600 font-semibold bg-paper/80 px-3 py-1 rounded-md border border-line">
            SMART INDIA HACKATHON 2026 · PS-100
          </span>
        </div>

        <div className="relative z-10 text-center flex flex-col items-center max-w-lg my-auto">
          <Logo size={64} />
          <h2
            className="mt-6 text-3xl lg:text-4xl font-bold text-navy-900 leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {locale === 'hi'
              ? 'जीईएम बोली अनुपालन एवं ट्रस्ट लेजर'
              : 'Sovereign GeM Bid Compliance & Trust Ledger'}
          </h2>
          <p className="mt-4 text-ink-700 text-base lg:text-lg leading-relaxed">
            {locale === 'hi'
              ? 'जीएसटी, एमएसएमई एवं एमसीए डेटा का वास्तविक समय सत्यापन, ग्राफ कार्टेल जांच एवं क्रिप्टोग्राफिक ऑडिट ट्रेल।'
              : 'Immutable cross-checking of GST, MSME, and MCA data with graph collusion detection and cryptographic proof generation.'}
          </p>

          <div className="mt-6 pt-5 border-t border-line/80 w-full text-ink-700 text-sm">
            <span className="font-semibold text-navy-900">
              {t('app.tagline', 'Trust Ledger for GeM procurement — verification, evidence, and decisions in one place.')}
            </span>
          </div>
        </div>

        <div className="w-full flex items-center justify-between text-ink-600 text-xs font-medium border-t border-line pt-4">
          <span>Smart India Hackathon 2026</span>
          <span className="font-mono bg-paper px-2 py-0.5 rounded border border-line">PS-100</span>
        </div>
      </div>

      {/* ─── Right Form Panel (55%) ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 lg:p-16 relative">
        {/* Language toggle top right */}
        <div className="absolute top-6 right-6">
          <LanguageToggle />
        </div>

        {/* Mobile top banner */}
        <div className="md:hidden mb-8 text-center">
          <Logo size={48} />
          <p className="text-base text-ink-600 mt-2 font-medium">GeM Bid Compliance Portal</p>
        </div>

        <div className="w-full max-w-md lg:max-w-lg flex flex-col gap-7">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-ink-900 tracking-tight">
              {t('login.title', 'Sign In to BharatBid')}
            </h1>
            <p className="text-base text-ink-600 mt-2">
              {t(
                'login.subtitle',
                'Select a demo profile or enter your authorized credentials'
              )}
            </p>
          </div>

          {/* Quick Demo Autofill Buttons */}
          <div className="flex flex-col gap-3 p-4 bg-paper rounded-xl border border-line shadow-xs">
            <span className="text-xs font-semibold text-ink-600 uppercase tracking-wider">
              {t('login.demo.title', 'One-Click Demo Profiles:')}
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              <Button
                variant="secondary"
                size="md"
                onClick={() => fillDemo('officer')}
                leftIcon={<Shield className="w-5 h-5 text-navy-900" />}
                className="py-2.5 text-sm font-semibold"
                id="demo-officer-btn"
              >
                {t('login.demo.officer', 'Officer')}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => fillDemo('admin')}
                leftIcon={<UserCheck className="w-5 h-5 text-navy-900" />}
                className="py-2.5 text-sm font-semibold"
                id="demo-admin-btn"
              >
                {t('login.demo.admin', 'Admin')}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => fillDemo('bidder')}
                leftIcon={<Briefcase className="w-5 h-5 text-navy-900" />}
                className="py-2.5 text-sm font-semibold"
                id="demo-bidder-btn"
              >
                {t('login.demo.bidder', 'Bidder')}
              </Button>
            </div>
          </div>

          {/* Form */}
          <form id="login-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              id="email"
              name="email"
              type="email"
              label={t('login.email', 'Email Address')}
              placeholder="officer@demo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-5 h-5 text-ink-500" />}
              className="text-base py-3"
              required
            />

            <Input
              id="password"
              name="password"
              type="password"
              label={t('login.password', 'Password')}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-5 h-5 text-ink-500" />}
              className="text-base py-3"
              required
            />

            <div className="pt-2">
              <Button
                id="login-submit-btn"
                type="submit"
                variant="primary"
                size="lg"
                className="w-full text-paper font-semibold hover:text-white py-3.5 text-base font-bold shadow-sm"
                disabled={isRateLimited || !email.trim() || !password.trim()}
                isLoading={isPending}
                loadingText={locale === 'hi' ? 'सत्यापित किया जा रहा है…' : 'Authenticating…'}
              >
                {buttonLabel}
              </Button>
            </div>
          </form>

          <div className="text-center">
            <p className="text-xs text-ink-500 font-mono">
              Session secured with HMAC SHA-256 JWT tokens & PostgreSQL Trigger Immutability
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
