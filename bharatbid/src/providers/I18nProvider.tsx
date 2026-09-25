import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import apiClient from '@/lib/apiClient'
import type { I18nGlossary } from '@/types'
import { HINDI_TRANSLATIONS } from '@/i18n/hi'
import { ENGLISH_TRANSLATIONS } from '@/i18n/en'

// ─── Context ──────────────────────────────────────────────────────────────────

interface I18nContextValue {
  locale: 'en' | 'hi'
  setLocale: (locale: 'en' | 'hi') => void
  t: (key: string, fallback?: string) => string
  isLoading: boolean
}

const I18nContext = createContext<I18nContextValue | null>(null)

// ─── Fallback English strings ─────────────────────────────────────────────────
// These are the minimum required strings in case the backend is unreachable.

const FALLBACK_EN: I18nGlossary = {
  ...ENGLISH_TRANSLATIONS,
  'app.name': 'BharatBid',
  'app.tagline': 'Trust Ledger for GeM procurement — verification, evidence, and decisions in one place.',
  'nav.tenders': 'Tenders',
  'nav.admin': 'Admin',
  'nav.ledger': 'Trust Ledger',
  'nav.bidder': 'My Applications',
  'nav.profile': 'Profile',
  'nav.components': 'UI Gallery',
  'login.title': 'Sign in to BharatBid',
  'login.subtitle': 'Select a demo profile, use National SSO, or enter authorized credentials',
  'login.email': 'Email address',
  'login.password': 'Password',
  'login.submit': 'Sign in',
  'login.demo.officer': 'Demo Officer',
  'login.demo.admin': 'Demo Admin',
  'login.demo.bidder': 'Demo Bidder',
  'login.demo.title': 'One-Click Demo Profiles:',
  'login.demo.note': 'For judging demo access, use the Demo Officer / Admin / Bidder buttons above.',
  'login.sessionExpired': 'Your session has expired. Please sign in again.',
  'auth.rateLimited': 'Too many login attempts. Please wait {seconds}s before trying again.',
  'trust.disclaimer': 'Verification data is sourced from government portals. Results reflect information at time of verification.',
  'award.warning.appendedToLedger': 'This award decision will be permanently appended to the Trust Ledger and cannot be reversed.',
  'secondary.awaitingPrimary': 'Primary reviewer has completed review. Submit your independent decision to reveal it.',
  'banner.staleVerification': 'Verification data for this bidder may be outdated. Consider re-verifying before making a decision.',
  'cta.reverifyNow': 'Re-Verify Now',
  'cta.inspectAndDecide': 'Inspect & Decide',
  'cta.openTriage': 'Open Triage Workspace',
  'decision.qualify': 'Qualify',
  'decision.disqualify': 'Disqualify',
  'decision.clarification': 'Request Clarification',
  'decision.reason.placeholder': 'State the specific reason for this decision (minimum 80 characters).',
  'decision.reason.required': 'A reason is mandatory when disqualifying or requesting clarification.',
  'decision.submitted': 'Decision recorded and appended to the Trust Ledger.',
  'pii.reveal': 'Reveal Full PII',
  'pii.revealed': 'PII Unmasked — Audit Trail Entry Logged',
  'pii.confirm.title': 'Reveal Bidder PII',
  'pii.confirm.body': 'Revealing PII will be logged in the Trust Ledger with your officer ID and timestamp. This action cannot be undone.',
  'collusion.detect': 'Detect Collusion',
  'collusion.detecting': 'Analysing...',
  'collusion.detected': 'Cartel cluster detected',
  'collusion.none': 'No collusion patterns detected',
  'riskLevel.critical': 'Critical',
  'riskLevel.high': 'High',
  'riskLevel.medium': 'Medium',
  'riskLevel.low': 'Low',
  'trustSource.digilocker': 'DigiLocker Verified',
  'trustSource.portal_verified': 'Portal Verified',
  'trustSource.ai_extracted': 'AI Extracted',
  'trustSource.simulated': 'Simulated',
  'tenderStatus.draft': 'Draft',
  'tenderStatus.open': 'Open',
  'tenderStatus.evaluation': 'Evaluation',
  'tenderStatus.awarded': 'Awarded',
  'tenderStatus.closed': 'Closed',
  'empty.noBidders': 'No bidders found for this tender.',
  'empty.noTenders': 'No tenders match your filters.',
  'empty.noLedger': 'No ledger entries found.',
  'tenders.title': 'Procurement Tenders',
  'tenders.subtitle': 'GeM compliance evaluation workspace — verify, triage, and award.',
  'error.generic': 'Something went wrong. Please try again.',
  'error.networkError': 'Unable to reach the server. Please check your connection.',
  'common.loading': 'Loading…',
  'common.retry': 'Retry',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.save': 'Save changes',
  'common.close': 'Close',
  'common.copy': 'Copy',
  'common.copied': 'Copied!',
  'common.download': 'Download',
  'common.export': 'Export',
}

const FALLBACK_HI: I18nGlossary = {
  ...HINDI_TRANSLATIONS,
  'app.name': 'भारतबिड',
  'app.tagline': 'जीईएम खरीद हेतु ट्रस्ट लेजर — सत्यापन, साक्ष्य और निर्णय एक ही मंच पर।',
  'nav.tenders': 'निविदाएं',
  'nav.admin': 'प्रशासन व नियम',
  'nav.bidder': 'मेरे आवेदन',
  'nav.profile': 'ट्रस्ट प्रोफ़ाइल',
  'nav.components': 'घटक गैलरी',
  'login.title': 'भारतबिड में प्रवेश करें',
  'login.subtitle': 'अधिकृत क्रेडेंशियल या सरकारी सिंगल साइन-ऑन (एसएसओ) का उपयोग करें',
  'login.email': 'ईमेल पता',
  'login.password': 'पासवर्ड',
  'login.submit': 'पोर्टल में प्रवेश करें',
  'login.demo.officer': 'अधिकारी',
  'login.demo.admin': 'प्रशासक',
  'login.demo.bidder': 'बोलीदाता',
  'login.demo.title': 'एक-क्लिक डेमो प्रोफाइल:',
  'login.demo.note': 'मूल्यांकन हेतु त्वरित डेमो प्रोफाइल चुनें या अपने क्रेडेंशियल भरें',
  'login.sessionExpired': 'आपका सत्र समाप्त हो गया है। कृपया पुनः प्रवेश करें।',
  'auth.rateLimited': 'बहुत अधिक प्रयास। कृपया {seconds} सेकंड बाद पुनः प्रयास करें।',
  'trust.disclaimer': 'सत्यापन डेटा सरकारी पोर्टल व डिजिटल स्रोतों से प्राप्त है।',
  'award.warning.appendedToLedger': 'यह निर्णय ट्रस्ट लेजर में स्थायी रूप से दर्ज होगा और इसे बदला नहीं जा सकता।',
  'secondary.awaitingPrimary': 'प्राथमिक अधिकारी ने समीक्षा पूर्ण की है। निर्णय देखने के लिए स्वतंत्र अनुमोदन दर्ज करें।',
  'banner.staleVerification': 'सत्यापन डेटा पुराना हो सकता है। निर्णय से पूर्व पुनः सत्यापन करें।',
  'cta.reverifyNow': 'पुनः सत्यापित करें',
  'cta.inspectAndDecide': 'जांचें एवं निर्णय लें',
  'cta.openTriage': 'ट्राइएज वर्कस्पेस खोलें',
  'decision.qualify': 'पात्र घोषित करें',
  'decision.disqualify': 'अपात्र घोषित करें',
  'decision.clarification': 'स्पष्टीकरण मांगें',
  'decision.reason.placeholder': 'निर्णय का विशिष्ट कारण लिखें (न्यूनतम 80 अक्षर अनिवार्य)',
  'decision.reason.required': 'अपात्र घोषित करने या स्पष्टीकरण मांगने हेतु कारण देना अनिवार्य है।',
  'decision.submitted': 'निर्णय दर्ज कर ट्रस्ट लेजर में जोड़ दिया गया है।',
  'pii.reveal': 'पूर्ण व्यक्तिगत पहचान (पीआईआई) देखें',
  'pii.revealed': 'पीआईआई प्रकट — लेजर में ऑडिट ट्रेल दर्ज',
  'pii.confirm.title': 'बोलीदाता की गोपनीय पहचान प्रकट करें',
  'pii.confirm.body': 'पहचान देखना आपके अधिकारी आईडी और समय के साथ ट्रस्ट लेजर में स्थायी रूप से दर्ज होगा।',
  'collusion.detect': 'मिलीभगत की जांच करें',
  'collusion.detecting': 'विश्लेषण जारी है...',
  'collusion.detected': 'कार्टेल मिलीभगत पाई गई',
  'collusion.none': 'कोई मिलीभगत नहीं पाई गई',
  'riskLevel.critical': 'अति संवेदनशील',
  'riskLevel.high': 'उच्च जोखिम',
  'riskLevel.medium': 'मध्यम जोखिम',
  'riskLevel.low': 'कम जोखिम',
  'trustSource.digilocker': 'डिजिलॉकर सत्यापित',
  'trustSource.portal_verified': 'पोर्टल सत्यापित',
  'trustSource.ai_extracted': 'एआई निष्कर्षित',
  'trustSource.simulated': 'सिम्युलेटेड',
  'tenderStatus.draft': 'प्रारूप',
  'tenderStatus.open': 'बोली हेतु खुला',
  'tenderStatus.evaluation': 'मूल्यांकन जारी',
  'tenderStatus.awarded': 'निविदा आवंटित',
  'tenderStatus.closed': 'समाप्त',
  'empty.noBidders': 'इस निविदा हेतु कोई बोलीदाता नहीं मिला।',
  'empty.noTenders': 'कोई निविदा नहीं मिली।',
  'empty.noLedger': 'कोई लेजर प्रविष्टि नहीं मिली।',
  'tenders.title': 'सरकारी खरीद निविदाएं',
  'tenders.subtitle': 'जीईएम अनुपालन मूल्यांकन, कार्टेल जांच एवं क्रिप्टोग्राफिक ऑडिट ट्रेल',
  'error.generic': 'कुछ त्रुटि हुई। कृपया पुनः प्रयास करें।',
  'error.networkError': 'सर्वर से संपर्क नहीं हो सका। कृपया कनेक्शन जांचें।',
  'common.loading': 'लोड हो रहा है…',
  'common.retry': 'पुनः प्रयास करें',
  'common.cancel': 'रद्द करें',
  'common.confirm': 'पुष्टि करें',
  'common.save': 'सहेजें',
  'common.close': 'बंद करें',
  'common.copy': 'कॉपी करें',
  'common.copied': 'कॉपी हो गया!',
  'common.download': 'डाउनलोड करें',
  'common.export': 'निर्यात करें',
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface I18nProviderProps {
  children: ReactNode
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<'en' | 'hi'>(() => {
    return (localStorage.getItem('bb_locale') as 'en' | 'hi') ?? 'en'
  })
  const [glossary, setGlossary] = useState<I18nGlossary>(() => {
    const initial = (localStorage.getItem('bb_locale') as 'en' | 'hi') ?? 'en'
    return initial === 'hi' ? FALLBACK_HI : FALLBACK_EN
  })
  const [isLoading, setIsLoading] = useState(false)

  const fetchGlossary = useCallback(async (lang: 'en' | 'hi') => {
    setIsLoading(true)
    const baseFallback = lang === 'hi' ? FALLBACK_HI : FALLBACK_EN
    try {
      const response = await apiClient.get<{ [key: string]: string }>(
        `/i18n/strings?lang=${lang}`,
      )
      const data = response.data as I18nGlossary

      // Merge backend strings over our local dictionary
      const merged: I18nGlossary = { ...baseFallback, ...data }

      setGlossary(merged)
    } catch {
      // Backend unreachable — fallback is already active
      setGlossary(baseFallback)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGlossary(locale)
  }, [locale, fetchGlossary])

  const setLocale = useCallback(
    (lang: 'en' | 'hi') => {
      localStorage.setItem('bb_locale', lang)
      setLocaleState(lang)
      document.documentElement.lang = lang
      // Instantly switch dictionary synchronously to eliminate UI lag
      setGlossary(lang === 'hi' ? FALLBACK_HI : FALLBACK_EN)
      fetchGlossary(lang)
    },
    [fetchGlossary],
  )

  // Set initial document lang
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const t = useCallback(
    (key: string, fallback?: string): string => {
      return glossary[key] ?? fallback ?? key
    },
    [glossary],
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, isLoading }}>
      {children}
    </I18nContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used inside <I18nProvider>')
  }
  return ctx
}

export const useTranslation = useI18n

