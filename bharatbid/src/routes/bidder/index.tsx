import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Building,
  Search,
  FileText,
  FileCheck2,
  Truck,
  Bell,
  Settings,
  ShieldCheck,
  Award,
  Clock,
  AlertTriangle,
  CheckCircle2,
  UploadCloud,
  RefreshCw,
  Trash2,
  Bookmark,
  BookmarkCheck,
  KeyRound,
  Menu,
  HelpCircle,
  Download,
  AlertOctagon,
} from 'lucide-react'
import apiClient from '@/lib/apiClient'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'
import { formatDate, formatDateTime } from '@/lib/dates'
import {
  Button,
  Badge,
  Input,
  EmptyState,
  Confirm,
  notify,
} from '@/components/ui'
import { useUploadWithPolling } from '@/hooks/useUploadWithPolling'
import { VerificationStepper, StatusPill, StageDetailRow } from '@/components/verification/VerificationStepper'

import type { Tender } from '@/types'

// ─── UPLOAD RULES (Fix 29 client-side pre-validation) ─────────────────────────
interface UploadRule {
  allowedMimeTypes: string[]
  maxSizeBytes: number
  magicBytes: number[]
  description: string
}

const UPLOAD_RULES: Record<string, UploadRule> = {
  pan_card: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'Official PAN Card PDF from Income Tax Department',
  },
  gst_certificate: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'GSTIN Registration Certificate PDF from GST Portal',
  },
  udyam_certificate: {
    allowedMimeTypes: ['application/pdf', 'application/xml', 'text/xml'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'Udyam/MSME Certificate PDF or DigiLocker XML',
  },
  udyam_certificate_pdf: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'Udyam Certificate PDF',
  },
  udyam_certificate_xml: {
    allowedMimeTypes: ['application/xml', 'text/xml'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x3C, 0x3F, 0x78, 0x6D],
    description: 'DigiLocker/DSC Signed Udyam XML',
  },
  itr_document: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 10 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'Income Tax Return PDF',
  },
  oem_authorization: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'OEM Authorization Letter PDF',
  },
}

async function validateFilePreUpload(file: File, docType: string): Promise<string | null> {
  const rule = UPLOAD_RULES[docType]
  if (!rule) return null

  // Allow image fallback if type is empty or standard
  const isValidMime = rule.allowedMimeTypes.includes(file.type) || 
    (file.name.endsWith('.pdf') && rule.allowedMimeTypes.includes('application/pdf')) ||
    (file.name.endsWith('.xml') && rule.allowedMimeTypes.includes('application/xml')) ||
    (file.name.match(/\.(jpg|jpeg|png)$/i) && rule.allowedMimeTypes.some(m => m.startsWith('image/')))

  if (!isValidMime) {
    return `${docType.replace(/_/g, ' ').toUpperCase()} must be ${rule.description}. Received ${file.type || file.name}.`
  }
  if (file.size > rule.maxSizeBytes) {
    return `File too large. Max ${rule.maxSizeBytes / 1024 / 1024} MB. Yours is ${(file.size / 1024 / 1024).toFixed(1)} MB.`
  }

  // Magic bytes inspection
  try {
    const slice = await file.slice(0, 4).arrayBuffer()
    const bytes = new Uint8Array(slice)
    const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
    const isXml = (bytes[0] === 0x3c && bytes[1] === 0x3f && bytes[2] === 0x78 && bytes[3] === 0x6d) || bytes[0] === 0x3c
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8

    if (!isPdf && !isXml && !isPng && !isJpg) {
      return 'This file appears corrupted or is not a recognized document format (PDF, PNG, JPG, XML).'
    }
  } catch {
    // Ignore arrayBuffer slice failure
  }
  return null
}

// ─── STAGES PER DOC TYPE (Fix 30) ─────────────────────────────────────────────
const DOC_STAGES: Record<string, string[]> = {
  pan_card: ['uploaded', 'ai_extraction', 'cross_check', 'portal_verification', 'officer_review'],
  gst_certificate: ['uploaded', 'ai_extraction', 'cross_check', 'portal_verification', 'expiry_check', 'officer_review'],
  udyam_certificate_pdf: ['uploaded', 'ai_extraction', 'cross_check', 'portal_verification', 'officer_review'],
  udyam_certificate_xml: ['uploaded', 'signature_verification', 'officer_review'],
  itr_document: ['uploaded', 'ai_extraction', 'cross_check', 'officer_review'],
  oem_authorization: ['uploaded', 'ai_extraction', 'cross_check', 'expiry_check', 'officer_review'],
}

const STAGE_LABELS: Record<string, string> = {
  uploaded: 'Upload',
  ai_extraction: 'AI Extraction',
  cross_check: 'Cross-Check',
  portal_verification: 'Portal',
  expiry_check: 'Expiry Check',
  signature_verification: 'Signature',
  officer_review: 'Officer Review',
}

// Fallback documents so workspace documents view and upload actions never disappear
const FALLBACK_DOCUMENTS: Record<string, any> = {
  pan_card: {
    docType: 'pan_card',
    label: 'PAN Card (Income Tax Dept)',
    fileName: 'PAN_AAWBS9999P.pdf',
    sizeBytes: 420112,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    uploadedAt: '2026-09-15T11:20:00Z',
    status: 'verified',
    extractedValue: 'AAWBS9999P',
    confidence: 0.94,
    cryptoVerification: {
      hasSignature: true,
      verified: true,
      trustedCA: 'Income Tax Dept CA (Valid)',
      signerName: 'Tax Authorities of India',
      signedAt: '2025-08-15T10:23:04Z',
      signatureHash: 'a3f8c2b190d47e11',
      message: 'Digitally signed by Income Tax Authority. Certificate valid.',
    },
    tiedToActiveBid: true,
    activeBidTenderId: 'tender-001',
  },
  gst_certificate: {
    docType: 'gst_certificate',
    label: 'GST Registration Certificate',
    fileName: 'GST_27AAWBS9999P1Z5.pdf',
    sizeBytes: 823421,
    sha256: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    uploadedAt: '2026-08-20T09:15:00Z',
    status: 'warning',
    extractedValue: '27AAWBS9999P1Z5',
    confidence: 0.89,
    expiresInDays: 30,
    cryptoVerification: {
      hasSignature: true,
      verified: true,
      trustedCA: 'GSTN Portal CA (Valid)',
      signerName: 'GSTN Signing Authority',
      signedAt: '2025-08-20T09:15:00Z',
      signatureHash: 'b4a9d3e218c50f22',
      message: 'Digitally signed by GSTN Authority. Certificate valid.',
    },
    tiedToActiveBid: false,
  },
  udyam_certificate: {
    docType: 'udyam_certificate',
    label: 'Udyam MSME Certificate',
    fileName: 'Udyam_Registration_Certificate_UDYAM-MH-01-00892.pdf',
    sizeBytes: 154200,
    sha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    uploadedAt: '2026-09-22T14:20:00Z',
    status: 'in_progress',
    extractedValue: 'UDYAM-MH-01-00892',
    confidence: 0.98,
    cryptoVerification: {
      hasSignature: true,
      verified: true,
      trustedCA: 'NIC DigiLocker CA (Valid)',
      signerName: 'National Informatics Centre',
      signedAt: '2025-08-15T10:23:00Z',
      signatureHash: 'c7d8e9f012a34b56',
      message: 'Digitally signed by DigiLocker Authority. Certificate valid.',
    },
    tiedToActiveBid: false,
  },
  itr_document: {
    docType: 'itr_document',
    label: 'Income Tax Return (ITR-V Acknowledgement)',
    fileName: 'ITR_V_Acknowledgement_AY2024-25.pdf',
    sizeBytes: 1204550,
    sha256: 'fe9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedc',
    uploadedAt: '2026-07-10T16:00:00Z',
    status: 'verified',
    extractedValue: 'AY 2024-25 (Gross: ₹45,00,000)',
    confidence: 0.91,
    cryptoVerification: {
      hasSignature: true,
      verified: true,
      trustedCA: 'Income Tax CPC CA (Valid)',
      signerName: 'Centralized Processing Centre',
      signedAt: '2024-07-10T16:00:00Z',
      signatureHash: 'fe9876543210fedc',
      message: 'Digitally signed by Income Tax CPC. Certificate valid.',
    },
    tiedToActiveBid: false,
  },
  oem_authorization: {
    docType: 'oem_authorization',
    label: 'OEM Authorization Letter',
    fileName: 'OEM_Authorization_Letter.pdf',
    sizeBytes: 1625,
    sha256: '9f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9068',
    uploadedAt: '2026-09-24T10:00:00Z',
    status: 'verified',
    extractedValue: 'SafetyFirst Industries Ltd',
    confidence: 0.94,
    tiedToActiveBid: false,
  },
}

// ─── Main Bidder Portal Workspace Component ────────────────────────────────────
export default function BidderPortalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { section } = useParams<{ section?: string }>()

  // Sidebar selection — initialized from URL section param
  const [activeNav, setActiveNav] = useState<'company' | 'tenders' | 'bids' | 'documents' | 'deliveries' | 'alerts' | 'settings'>(() => {
    if (section === 'documents') return 'documents'
    if (section === 'profile') return 'company'
    if (section === 'bids' || section === 'vault') return 'bids'
    if (section === 'tenders') return 'tenders'
    if (section === 'deliveries') return 'deliveries'
    if (section === 'alerts') return 'alerts'
    if (section === 'settings') return 'settings'
    return 'company'
  })
  const [companySub, setCompanySub] = useState<'overview' | 'compliance' | 'trust'>(() =>
    section === 'profile' ? 'trust' : section === 'compliance' ? 'compliance' : 'overview'
  )
  const [tendersSub, setTendersSub] = useState<'all' | 'matching' | 'applied' | 'saved'>('all')
  const [bidsSub, setBidsSub] = useState<'active' | 'won' | 'lost' | 'vault'>(() =>
    section === 'vault' ? 'vault' : 'active'
  )
  const [docSub, setDocSub] = useState<string>('pan_card')

  // Sync state when URL param changes (navigating via top navbar)
  useEffect(() => {
    if (!section) { setActiveNav('company'); setCompanySub('overview'); return }
    if (section === 'documents') setActiveNav('documents')
    else if (section === 'profile') { setActiveNav('company'); setCompanySub('trust') }
    else if (section === 'compliance') { setActiveNav('company'); setCompanySub('compliance') }
    else if (section === 'bids') { setActiveNav('bids'); setBidsSub('active') }
    else if (section === 'vault') { setActiveNav('bids'); setBidsSub('vault') }
    else if (section === 'tenders') setActiveNav('tenders')
    else if (section === 'deliveries') setActiveNav('deliveries')
    else if (section === 'alerts') setActiveNav('alerts')
    else if (section === 'settings') setActiveNav('settings')
  }, [section])

  // Search & Filters in Tenders view
  const [tenderSearch, setTenderSearch] = useState('')
  const [tenderSort, setTenderSort] = useState<'newest' | 'fee'>('newest')

  // Sidebar collapse toggle state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Document management modal state (Fix 35)
  const [deleteDocTarget, setDeleteDocTarget] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [reverifyingDocType, setReverifyingDocType] = useState<string | null>(null)

  // ─── Data Queries ──────────────────────────────────────────────────────────
  const { data: profile } = useQuery({
    queryKey: ['bidder', 'me', 'profile'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/bidder/me/profile')
      return res.data
    },
  })

  const { data: compliance } = useQuery({
    queryKey: ['bidder', 'me', 'compliance-summary'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/bidder/me/compliance-summary')
      return res.data
    },
  })

  const { data: alertsList = [] } = useQuery({
    queryKey: ['bidder', 'me', 'alerts'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/bidder/me/alerts')
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const { data: deliveriesData } = useQuery({
    queryKey: ['bidder', 'me', 'deliveries'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/bidder/me/deliveries')
      return res.data
    },
  })

  const { data: documentsList = [], refetch: refetchDocs } = useQuery({
    queryKey: ['bidder', 'me', 'documents'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any>('/bidder/me/documents')
        if (Array.isArray(res.data)) return res.data
        if (Array.isArray(res.data?.data)) return res.data.data
        return []
      } catch {
        return []
      }
    },
    refetchInterval: 1500,
  })

  const { data: allTenders = [] } = useQuery<Tender[]>({
    queryKey: ['tenders', 'open'],
    queryFn: async () => {
      const res = await apiClient.get<Tender[]>('/tenders?status=open')
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const { data: matchingTenders = [] } = useQuery<Tender[]>({
    queryKey: ['tenders', 'matching'],
    queryFn: async () => {
      const res = await apiClient.get<Tender[]>('/tenders?status=open&matchProfile=self')
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const { data: savedTenders = [], refetch: refetchSaved } = useQuery<Tender[]>({
    queryKey: ['bidder', 'me', 'saved-tenders'],
    queryFn: async () => {
      const res = await apiClient.get<Tender[]>('/bidder/me/saved-tenders')
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const { data: vaultBids = [] } = useQuery<any[]>({
    queryKey: ['bidder', 'me', 'vault'],
    queryFn: async () => {
      const res = await apiClient.get<any[]>('/bidder/me/vault')
      return Array.isArray(res.data) ? res.data : []
    },
  })

  // Saved tenders mutations
  const toggleSaveMutation = useMutation({
    mutationFn: async ({ tenderId, isSaved }: { tenderId: string; isSaved: boolean }) => {
      if (isSaved) {
        await apiClient.delete(`/bidder/me/saved-tenders/${tenderId}`)
      } else {
        await apiClient.post(`/bidder/me/saved-tenders/${tenderId}`)
      }
    },
    onSuccess: () => {
      refetchSaved()
      notify.success('Saved tenders list updated')
    },
  })

  // Document soft delete mutation (Fix 35)
  const deleteDocMutation = useMutation({
    mutationFn: async (docType: string) => {
      const res = await apiClient.delete(`/bidder/me/documents/${docType}`)
      return res.data
    },
    onSuccess: () => {
      refetchDocs()
      setDeleteDocTarget(null)
      notify.success('Document removed', {
        description: 'Removed from active profile. A secure backup is retained for government records.',
      })
    },
    onError: (err: any) => {
      notify.error('Delete failed', { description: err.message })
    },
  })

  const {
    uploadMutation,
    statusQuery,
    lastUploadedFile,
  } = useUploadWithPolling(docSub, profile?.id || 'user-bidder-001')
  const [inspectOpen, setInspectOpen] = useState(true)

  // Handlers
  const handleFileUpload = async (docType: string, file: File) => {
    setUploadError(null)
    const err = await validateFilePreUpload(file, docType)
    if (err) {
      setUploadError(err)
      return
    }

    setIsUploading(true)
    setReverifyingDocType(docType)

    try {
      await uploadMutation.mutateAsync(file)
      notify.success('Document uploaded successfully', {
        description: 'Multi-stage progressive verification pipeline initiated.',
      })
      refetchDocs()
      setTimeout(() => refetchDocs(), 1200)
      setTimeout(() => refetchDocs(), 2400)
      setTimeout(() => {
        refetchDocs()
        setReverifyingDocType(null)
      }, 6000)
    } catch (apiErr: any) {
      setUploadError(apiErr?.message || 'Upload failed')
      setReverifyingDocType(null)
    } finally {
      setIsUploading(false)
    }
  }

  // Active documents lookup with fallback guarantee so UI never goes blank
  const effectiveDocsList = Array.isArray(documentsList) && documentsList.length > 0 ? documentsList : Object.values(FALLBACK_DOCUMENTS)
  const currentDoc = effectiveDocsList.find((d: any) => d.docType === docSub) || FALLBACK_DOCUMENTS[docSub] || effectiveDocsList[0]
  const isDocReverifying = reverifyingDocType === docSub || reverifyingDocType === currentDoc?.docType || (isUploading && docSub === currentDoc?.docType) || currentDoc?.status === 'in_progress'

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-8rem)]">
      {/* ─── Fixed Workspace Sidebar Rail ──────────────────── */}
      <aside
        className={cn(
          'shrink-0 flex flex-col gap-2 p-3.5 bg-paper dark:bg-slate-900 rounded-xl border border-line dark:border-slate-800 shadow-xs self-start transition-all duration-200',
          sidebarCollapsed ? 'w-full md:w-20' : 'w-full md:w-64'
        )}
      >
        {/* Toggle Collapse Hamburger & Workspace Header */}
        <div className="flex items-center justify-between pb-2 border-b border-line dark:border-slate-800">
          {!sidebarCollapsed && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-slate-400 font-mono">
              Bidder Workspace
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-ink-600 dark:text-slate-300 hover:bg-cream-100 dark:hover:bg-slate-800 transition-colors ml-auto"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle navigation sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Company Header Card */}
        <div className="p-2.5 bg-cream-50 dark:bg-slate-800/60 rounded-xl border border-line dark:border-slate-700 mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-navy-900 dark:bg-saffron-600 text-cream-50 flex items-center justify-center font-bold text-base shrink-0">
              AE
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-base text-ink-900 dark:text-cream-50 truncate">
                  {profile?.displayName || 'Ananya Enterprises'}
                </span>
                <span className="text-xs font-mono text-ink-500 dark:text-slate-400 truncate">
                  PAN: AAWBS9999P
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 1: Company */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => {
              setActiveNav('company')
              if (sidebarCollapsed) setSidebarCollapsed(false)
            }}
            title="Company Profile"
            className={cn(
              'flex items-center rounded-lg text-sm font-medium transition-colors',
              sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5',
              activeNav === 'company'
                ? 'bg-navy-900/5 dark:bg-saffron-600/20 text-navy-900 dark:text-saffron-300 font-semibold border-l-2 border-saffron-500'
                : 'text-ink-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-cream-50 dark:hover:bg-slate-800'
            )}
          >
            <span className="flex items-center gap-2.5">
              <Building className="w-5 h-5 text-ink-500 dark:text-slate-400" />
              {!sidebarCollapsed && <span>Company</span>}
            </span>
          </button>
          {!sidebarCollapsed && activeNav === 'company' && (
            <div className="ml-7 pl-2.5 border-l border-line dark:border-slate-800 flex flex-col gap-1 my-1.5">
              <button
                type="button"
                onClick={() => setCompanySub('overview')}
                className={`text-left text-sm py-1.5 px-2.5 rounded-md ${
                  companySub === 'overview' ? 'font-semibold text-navy-900 bg-cream-100 dark:bg-slate-800 dark:text-saffron-400' : 'text-ink-600 dark:text-slate-300 hover:text-ink-900'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setCompanySub('compliance')}
                className={`text-left text-sm py-1.5 px-2.5 rounded-md ${
                  companySub === 'compliance' ? 'font-semibold text-navy-900 bg-cream-100 dark:bg-slate-800 dark:text-saffron-400' : 'text-ink-600 dark:text-slate-300 hover:text-ink-900'
                }`}
              >
                Compliance (4/5)
              </button>
              <button
                type="button"
                onClick={() => setCompanySub('trust')}
                className={`text-left text-sm py-1.5 px-2.5 rounded-md ${
                  companySub === 'trust' ? 'font-semibold text-navy-900 bg-cream-100 dark:bg-slate-800 dark:text-saffron-400' : 'text-ink-600 dark:text-slate-300 hover:text-ink-900'
                }`}
              >
                Trust Score ({profile?.trustScore ?? 88})
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Open Tenders */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => {
              setActiveNav('tenders')
              if (sidebarCollapsed) setSidebarCollapsed(false)
            }}
            title="Open Tenders"
            className={cn(
              'flex items-center rounded-lg text-sm font-medium transition-colors',
              sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5',
              activeNav === 'tenders'
                ? 'bg-navy-900/5 dark:bg-saffron-600/20 text-navy-900 dark:text-saffron-300 font-semibold border-l-2 border-saffron-500'
                : 'text-ink-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-cream-50 dark:hover:bg-slate-800'
            )}
          >
            <span className="flex items-center gap-2.5">
              <Search className="w-5 h-5 text-ink-500 dark:text-slate-400" />
              {!sidebarCollapsed && <span>Open Tenders</span>}
            </span>
            {!sidebarCollapsed && (
              <span className="font-mono text-xs text-ink-600 dark:text-slate-300 bg-cream-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-semibold">
                {allTenders.length}
              </span>
            )}
          </button>
          {!sidebarCollapsed && activeNav === 'tenders' && (
            <div className="ml-7 pl-2.5 border-l border-line dark:border-slate-800 flex flex-col gap-1 my-1.5">
              <button
                type="button"
                onClick={() => setTendersSub('all')}
                className={`text-left text-sm py-1.5 px-2.5 rounded-md ${
                  tendersSub === 'all' ? 'font-semibold text-navy-900 bg-cream-100 dark:bg-slate-800 dark:text-saffron-400' : 'text-ink-600 dark:text-slate-300 hover:text-ink-900'
                }`}
              >
                All Open ({allTenders.length})
              </button>
              <button
                type="button"
                onClick={() => setTendersSub('matching')}
                className={`text-left text-sm py-1.5 px-2.5 rounded-md ${
                  tendersSub === 'matching' ? 'font-semibold text-navy-900 bg-cream-100 dark:bg-slate-800 dark:text-saffron-400' : 'text-ink-600 dark:text-slate-300 hover:text-ink-900'
                }`}
              >
                Matching My Profile ({matchingTenders.length})
              </button>
              <button
                type="button"
                onClick={() => setTendersSub('saved')}
                className={`text-left text-sm py-1.5 px-2.5 rounded-md ${
                  tendersSub === 'saved' ? 'font-semibold text-navy-900 bg-cream-100 dark:bg-slate-800 dark:text-saffron-400' : 'text-ink-600 dark:text-slate-300 hover:text-ink-900'
                }`}
              >
                Saved ({savedTenders.length})
              </button>
            </div>
          )}
        </div>

        {/* Section 3: My Bids */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => {
              setActiveNav('bids')
              if (sidebarCollapsed) setSidebarCollapsed(false)
            }}
            title="My Bids"
            className={cn(
              'flex items-center rounded-lg text-sm font-medium transition-colors',
              sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5',
              activeNav === 'bids'
                ? 'bg-navy-900/5 dark:bg-saffron-600/20 text-navy-900 dark:text-saffron-300 font-semibold border-l-2 border-saffron-500'
                : 'text-ink-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-cream-50 dark:hover:bg-slate-800'
            )}
          >
            <span className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-ink-500 dark:text-slate-400" />
              {!sidebarCollapsed && <span>My Bids</span>}
            </span>
            {!sidebarCollapsed && (
              <span className="font-mono text-xs text-ink-600 dark:text-slate-300 bg-cream-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-semibold">
                3
              </span>
            )}
          </button>
          {!sidebarCollapsed && activeNav === 'bids' && (
            <div className="ml-7 pl-2.5 border-l border-line dark:border-slate-800 flex flex-col gap-1 my-1.5">
              <button
                type="button"
                onClick={() => setBidsSub('active')}
                className={`text-left text-sm py-1.5 px-2.5 rounded-md ${
                  bidsSub === 'active' ? 'font-semibold text-navy-900 bg-cream-100 dark:bg-slate-800 dark:text-saffron-400' : 'text-ink-600 dark:text-slate-300 hover:text-ink-900'
                }`}
              >
                Active (3)
              </button>
              <button
                type="button"
                onClick={() => setBidsSub('won')}
                className={`text-left text-sm py-1.5 px-2.5 rounded-md ${
                  bidsSub === 'won' ? 'font-semibold text-navy-900 bg-cream-100 dark:bg-slate-800 dark:text-saffron-400' : 'text-ink-600 dark:text-slate-300 hover:text-ink-900'
                }`}
              >
                Won (2)
              </button>
              <button
                type="button"
                onClick={() => setBidsSub('lost')}
                className={`text-left text-sm py-1.5 px-2.5 rounded-md ${
                  bidsSub === 'lost' ? 'font-semibold text-navy-900 bg-cream-100 dark:bg-slate-800 dark:text-saffron-400' : 'text-ink-600 dark:text-slate-300 hover:text-ink-900'
                }`}
              >
                Lost (4)
              </button>
              <button
                type="button"
                onClick={() => setBidsSub('vault')}
                className={`text-left text-sm py-1.5 px-2.5 rounded-md ${
                  bidsSub === 'vault' ? 'font-semibold text-navy-900 bg-cream-100 dark:bg-slate-800 dark:text-saffron-400' : 'text-ink-600 dark:text-slate-300 hover:text-ink-900'
                }`}
              >
                Vault & Reports
              </button>
            </div>
          )}
        </div>

        {/* Section 4: Documents */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => {
              setActiveNav('documents')
              if (sidebarCollapsed) setSidebarCollapsed(false)
            }}
            title="Documents Vault"
            className={cn(
              'flex items-center rounded-lg text-sm font-medium transition-colors',
              sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5',
              activeNav === 'documents'
                ? 'bg-navy-900/5 dark:bg-saffron-600/20 text-navy-900 dark:text-saffron-300 font-semibold border-l-2 border-saffron-500'
                : 'text-ink-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-cream-50 dark:hover:bg-slate-800'
            )}
          >
            <span className="flex items-center gap-2.5">
              <FileCheck2 className="w-5 h-5 text-ink-500 dark:text-slate-400" />
              {!sidebarCollapsed && <span>Documents</span>}
            </span>
            {!sidebarCollapsed && (
              <span className="font-mono text-xs text-ink-600 dark:text-slate-300 bg-cream-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-semibold">
                4
              </span>
            )}
          </button>
          {!sidebarCollapsed && activeNav === 'documents' && (
            <div className="ml-7 pl-2.5 border-l border-line dark:border-slate-800 flex flex-col gap-1 my-1.5">
              <button
                type="button"
                onClick={() => setDocSub('pan_card')}
                className={`text-left text-sm py-1.5 px-2.5 rounded-md ${
                  docSub === 'pan_card' ? 'font-semibold text-navy-900 bg-cream-100 dark:bg-slate-800 dark:text-saffron-400' : 'text-ink-600 dark:text-slate-300 hover:text-ink-900'
                }`}
              >
                PAN Card
              </button>
              <button
                type="button"
                onClick={() => setDocSub('gst_certificate')}
                className={`text-left text-sm py-1.5 px-2.5 rounded-md ${
                  docSub === 'gst_certificate' ? 'font-semibold text-navy-900 bg-cream-100 dark:bg-slate-800 dark:text-saffron-400' : 'text-ink-600 dark:text-slate-300 hover:text-ink-900'
                }`}
              >
                GST Certificate
              </button>
              <button
                type="button"
                onClick={() => setDocSub('udyam_certificate')}
                className={`text-left text-sm py-1.5 px-2.5 rounded-md ${
                  docSub === 'udyam_certificate' ? 'font-semibold text-navy-900 bg-cream-100 dark:bg-slate-800 dark:text-saffron-400' : 'text-ink-600 dark:text-slate-300 hover:text-ink-900'
                }`}
              >
                Udyam MSME
              </button>
              <button
                type="button"
                onClick={() => setDocSub('itr_document')}
                className={`text-left text-sm py-1.5 px-2.5 rounded-md ${
                  docSub === 'itr_document' ? 'font-semibold text-navy-900 bg-cream-100 dark:bg-slate-800 dark:text-saffron-400' : 'text-ink-600 dark:text-slate-300 hover:text-ink-900'
                }`}
              >
                ITR Documents
              </button>
            </div>
          )}
        </div>

        {/* Section 5: Deliveries */}
        <button
          type="button"
          onClick={() => {
            setActiveNav('deliveries')
            if (sidebarCollapsed) setSidebarCollapsed(false)
          }}
          title="Deliveries"
          className={cn(
            'flex items-center rounded-lg text-sm font-medium transition-colors',
            sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5',
            activeNav === 'deliveries'
              ? 'bg-navy-900/5 dark:bg-saffron-600/20 text-navy-900 dark:text-saffron-300 font-semibold border-l-2 border-saffron-500'
              : 'text-ink-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-cream-50 dark:hover:bg-slate-800'
          )}
        >
          <span className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-ink-500 dark:text-slate-400" />
            {!sidebarCollapsed && <span>Deliveries</span>}
          </span>
          {!sidebarCollapsed && (
            <span className="font-mono text-xs text-ink-600 dark:text-slate-300 bg-cream-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-semibold">
              2
            </span>
          )}
        </button>

        {/* Section 6: Alerts */}
        <button
          type="button"
          onClick={() => {
            setActiveNav('alerts')
            if (sidebarCollapsed) setSidebarCollapsed(false)
          }}
          title="Notices & Alerts"
          className={cn(
            'flex items-center rounded-lg text-sm font-medium transition-colors',
            sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5',
            activeNav === 'alerts'
              ? 'bg-navy-900/5 dark:bg-saffron-600/20 text-navy-900 dark:text-saffron-300 font-semibold border-l-2 border-saffron-500'
              : 'text-ink-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-cream-50 dark:hover:bg-slate-800'
          )}
        >
          <span className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-ink-500 dark:text-slate-400" />
            {!sidebarCollapsed && <span>Alerts</span>}
          </span>
          {!sidebarCollapsed && (
            <span className="font-mono text-xs text-white bg-risk-critical px-2 py-0.5 rounded-full font-bold">
              {alertsList.filter((a: any) => !a.read).length || 3}
            </span>
          )}
        </button>

        {/* Section 7: Settings */}
        <button
          type="button"
          onClick={() => {
            setActiveNav('settings')
            if (sidebarCollapsed) setSidebarCollapsed(false)
          }}
          title="Settings"
          className={cn(
            'flex items-center rounded-lg text-sm font-medium transition-colors',
            sidebarCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3.5 py-2.5',
            activeNav === 'settings'
              ? 'bg-navy-900/5 dark:bg-saffron-600/20 text-navy-900 dark:text-saffron-300 font-semibold border-l-2 border-saffron-500'
              : 'text-ink-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-cream-50 dark:hover:bg-slate-800'
          )}
        >
          <Settings className="w-5 h-5 text-ink-500 dark:text-slate-400" />
          {!sidebarCollapsed && <span>Settings</span>}
        </button>
      </aside>

      {/* ─── Main Content Workspace Area ──────────────────────────────── */}
      <main className="flex-1 flex flex-col gap-6 min-w-0">
        {/* ─── VIEW A: COMPANY OVERVIEW / COMPLIANCE / TRUST SCORE ─────── */}
        {activeNav === 'company' && companySub === 'overview' && (
          <div className="flex flex-col gap-6">
            {/* Sovereign Welcome Banner */}
            <div className="p-5 bg-gradient-to-r from-navy-900 to-navy-800 text-cream-50 rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="text-micro font-mono uppercase tracking-wider text-saffron-400 font-semibold">
                  Authorized Bidder Portal
                </span>
                <h1 className="text-h2 font-display font-semibold mt-0.5">
                  Welcome back, {user?.name || 'Ananya'}
                </h1>
                <p className="text-small text-cream-200 mt-1">
                  Managing: <strong>Ananya Enterprises Pvt Ltd</strong> · PAN:{' '}
                  <span className="font-mono">AAWBS9999P</span> · GSTIN:{' '}
                  <span className="font-mono">27AAWBS****1Z5</span> · Udyam:{' '}
                  <span className="font-mono">UDYAM-MH-01-00892</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setActiveNav('tenders')
                    setTendersSub('all')
                  }}
                  className="bg-saffron-500 hover:bg-saffron-600 text-navy-950 font-bold"
                >
                  Browse Tenders
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveNav('documents')}
                  className="bg-navy-800 text-cream-50 border-navy-700 hover:bg-navy-700"
                >
                  Upload Document
                </Button>
              </div>
            </div>

            {/* 6 Metric KPI Tiles (Fix 25) — connected panel */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-line rounded-lg border border-line overflow-hidden shadow-xs">
              <div className="p-3.5 bg-paper flex flex-col justify-between">
                <span className="text-micro text-ink-500 font-medium">Trust Score</span>
                <p className="text-h2 font-display font-bold text-navy-900 mt-1">
                  {profile?.trustScore ?? 88} <span className="text-micro font-sans font-normal text-ink-500">/ 100</span>
                </p>
                <span className="text-micro font-semibold text-risk-low mt-1">Verified Veteran</span>
              </div>

              <div className="p-3.5 bg-paper flex flex-col justify-between">
                <span className="text-micro text-ink-500 font-medium">Active Bids</span>
                <p className="text-h2 font-display font-bold text-navy-900 mt-1">3</p>
                <span className="text-micro text-ink-500 mt-1">2 in evaluation</span>
              </div>

              <div className="p-3.5 bg-paper flex flex-col justify-between">
                <span className="text-micro text-ink-500 font-medium">Fees Paid</span>
                <p className="text-h2 font-display font-bold text-navy-900 mt-1">₹15,000</p>
                <span className="text-micro text-ink-500 mt-1">Across 3 tenders</span>
              </div>

              <div className="p-3.5 bg-paper flex flex-col justify-between">
                <span className="text-micro text-ink-500 font-medium">Compliance</span>
                <p className="text-h2 font-display font-bold text-risk-low mt-1">4 of 5 ✓</p>
                <span className="text-micro text-risk-medium mt-1">GST renew in 30d</span>
              </div>

              <div className="p-3.5 bg-paper flex flex-col justify-between">
                <span className="text-micro text-ink-500 font-medium">Delivery Rate</span>
                <p className="text-h2 font-display font-bold text-navy-900 mt-1">95%</p>
                <span className="text-micro text-risk-low mt-1">On-time track</span>
              </div>

              <div className="p-3.5 bg-paper flex flex-col justify-between">
                <span className="text-micro text-ink-500 font-medium">Alerts</span>
                <p className="text-h2 font-display font-bold text-risk-medium mt-1">3</p>
                <span className="text-micro text-ink-500 mt-1">1 renewal pending</span>
              </div>
            </div>

            {/* Alerts Box */}
            <div className="p-4 bg-cream-100/60 rounded-xl border border-line flex flex-col gap-2.5">
              <span className="text-micro font-semibold text-ink-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-risk-medium" /> Active Alerts &amp; Government Notices
              </span>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between p-2.5 bg-paper rounded border border-line text-small">
                  <span className="flex items-center gap-2 text-ink-800">
                    <span className="w-2 h-2 rounded-full bg-risk-medium" />
                    GSTIN registration certificate expires in 30 days (24 Oct 2026).
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveNav('documents')
                      setDocSub('gst_certificate')
                    }}
                    className="text-small font-semibold text-navy-900 hover:underline"
                  >
                    Renew Now →
                  </button>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-paper rounded border border-line text-small">
                  <span className="flex items-center gap-2 text-ink-800">
                    <span className="w-2 h-2 rounded-full bg-trust-ai" />
                    4 open government procurements match your MSME profile in IT Hardware.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveNav('tenders')
                      setTendersSub('matching')
                    }}
                    className="text-small font-semibold text-navy-900 hover:underline"
                  >
                    View Matching →
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="p-5 bg-paper rounded-xl border border-line shadow-xs flex flex-col gap-3">
              <span className="text-micro font-semibold text-ink-800 uppercase tracking-wider">
                Recent Activity (Last 30 Days)
              </span>
              <div className="flex flex-col divide-y divide-line/60">
                <div className="py-2.5 flex items-center justify-between text-small">
                  <span className="text-ink-800">
                    📌 <strong>Officer Priya Sharma</strong> qualified your bid on Procurement of Server Racks
                  </span>
                  <span className="text-micro font-mono text-ink-500">22 Sep 2026, 15:47 IST</span>
                </div>
                <div className="py-2.5 flex items-center justify-between text-small">
                  <span className="text-ink-800">
                    📌 Automated statutory verification passed for <strong>Udyam Certificate</strong>
                  </span>
                  <span className="text-micro font-mono text-ink-500">22 Sep 2026, 14:20 IST</span>
                </div>
                <div className="py-2.5 flex items-center justify-between text-small">
                  <span className="text-ink-800">
                    📌 Successfully applied to <strong>Digital Display Panels and Kiosks</strong>
                  </span>
                  <span className="text-micro font-mono text-ink-500">18 Sep 2026, 09:12 IST</span>
                </div>
                <div className="py-2.5 flex items-center justify-between text-small">
                  <span className="text-ink-800">
                    📌 Unlocked badge: <strong>Verified Veteran</strong> (10+ bids submitted, trust score &gt;85)
                  </span>
                  <span className="text-micro font-mono text-ink-500">10 Sep 2026, 16:45 IST</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── VIEW A2: COMPLIANCE TAB (5 Checks + Cross-Check Matrix) ──── */}
        {activeNav === 'company' && companySub === 'compliance' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-h3 font-semibold text-ink-900">Statutory Compliance Status</h2>
                <p className="text-small text-ink-600">
                  Real-time synchronization with sovereign tax, MSME, and debarment registries
                </p>
              </div>
              <Badge variant="success">4 of 5 Verified</Badge>
            </div>

            {/* 5 Statutory Check Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(compliance?.checks || []).map((chk: any) => (
                <div key={chk.id} className="p-4 bg-paper rounded-lg border border-line shadow-xs flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-ink-900 text-small">{chk.name}</h4>
                      <p className="text-micro text-ink-500 mt-0.5">{chk.portal}</p>
                    </div>
                    {chk.status === 'verified' ? (
                      <Badge variant="success">Verified ✓</Badge>
                    ) : (
                      <Badge variant="warning">Expiring in 30d ⚠</Badge>
                    )}
                  </div>
                  <p className="text-small text-ink-700 mt-2 font-mono bg-cream-50 p-2 rounded border border-line">
                    {chk.detail}
                  </p>
                </div>
              ))}
            </div>

            {/* Cross-Check Matrix (Fix 25) */}
            <div className="p-5 bg-paper rounded-xl border border-line shadow-xs flex flex-col gap-3">
              <span className="text-micro font-semibold text-ink-800 uppercase tracking-wider">
                Cross-Document Consistency Matrix
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-small">
                  <thead>
                    <tr className="border-b border-line text-left text-micro font-mono text-ink-500">
                      <th className="pb-2 font-medium">Field</th>
                      <th className="pb-2 font-medium">PAN Card</th>
                      <th className="pb-2 font-medium">GST Certificate</th>
                      <th className="pb-2 font-medium">Udyam MSME</th>
                      <th className="pb-2 font-medium">ITR Filing</th>
                      <th className="pb-2 font-medium text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    <tr className="hover:bg-cream-50/50">
                      <td className="py-2.5 font-medium text-ink-900">Company PAN</td>
                      <td className="py-2.5 font-mono text-ink-700">AAWBS9999P</td>
                      <td className="py-2.5 font-mono text-ink-700">AAWBS9999P</td>
                      <td className="py-2.5 font-mono text-ink-700">AAWBS9999P</td>
                      <td className="py-2.5 font-mono text-ink-700">AAWBS9999P</td>
                      <td className="py-2.5 text-right font-bold text-risk-low">MATCH ✓</td>
                    </tr>
                    <tr className="hover:bg-cream-50/50">
                      <td className="py-2.5 font-medium text-ink-900">Legal Name</td>
                      <td className="py-2.5 text-ink-700">Ananya Enterprises</td>
                      <td className="py-2.5 text-ink-700">Ananya Enterprises</td>
                      <td className="py-2.5 text-ink-700">Ananya Enterprises</td>
                      <td className="py-2.5 text-ink-700">Ananya Enterprises</td>
                      <td className="py-2.5 text-right font-bold text-risk-low">MATCH ✓</td>
                    </tr>
                    <tr className="hover:bg-cream-50/50">
                      <td className="py-2.5 font-medium text-ink-900">Registered Address</td>
                      <td className="py-2.5 text-ink-700">Mumbai, MH</td>
                      <td className="py-2.5 text-ink-700">Mumbai, MH</td>
                      <td className="py-2.5 text-ink-700">Andheri E, Mumbai</td>
                      <td className="py-2.5 text-ink-700">Mumbai, MH</td>
                      <td className="py-2.5 text-right font-bold text-risk-medium">PARTIAL ⚠</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── VIEW A3: TRUST SCORE TAB ─────────────────────────────────── */}
        {activeNav === 'company' && companySub === 'trust' && (
          <div className="flex flex-col gap-6">
            <div className="p-6 bg-paper rounded-xl border border-line shadow-xs flex flex-col md:flex-row items-center gap-8 justify-around">
              {/* 200px Score Dial */}
              <div className="flex flex-col items-center">
                <div className="w-48 h-48 rounded-full border-8 border-saffron-500 bg-cream-50 flex flex-col items-center justify-center shadow-inner">
                  <span className="text-h1 font-display font-extrabold text-navy-900 leading-none">
                    {profile?.trustScore ?? 88}
                  </span>
                  <span className="text-micro font-mono uppercase tracking-wider text-ink-500 mt-1">
                    Out of 100
                  </span>
                </div>
                <span className="mt-3 px-3 py-1 rounded-full bg-risk-low/10 text-risk-low border border-risk-low/30 text-small font-semibold">
                  Verified Veteran Standing
                </span>
              </div>

              {/* Arithmetic Breakdown */}
              <div className="flex-1 max-w-md flex flex-col gap-2 text-small">
                <span className="text-micro font-semibold text-ink-800 uppercase tracking-wider mb-1">
                  Trust Score Composition
                </span>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-600">Base Statutory Checks (4/5 verified)</span>
                  <span className="font-mono font-semibold text-navy-900">+40 pts</span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-600">On-Time Delivery History (95%)</span>
                  <span className="font-mono font-semibold text-navy-900">+25 pts</span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-600">Cryptographic Proofs &amp; DigiLocker</span>
                  <span className="font-mono font-semibold text-navy-900">+15 pts</span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-600">Clean Anti-Cartel Record</span>
                  <span className="font-mono font-semibold text-navy-900">+8 pts</span>
                </div>
                <div className="flex justify-between py-1 font-bold text-navy-900">
                  <span>Total Composite Trust Score</span>
                  <span className="font-mono">88 / 100</span>
                </div>
              </div>
            </div>

            {/* Badges Grid */}
            <div className="p-5 bg-paper rounded-xl border border-line shadow-xs flex flex-col gap-3">
              <span className="text-micro font-semibold text-ink-800 uppercase tracking-wider">
                Earned Sovereign Badges
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-cream-50 rounded-lg border border-line flex items-center gap-2.5">
                  <Award className="w-5 h-5 text-saffron-600" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-small text-ink-900">MSME Verified</span>
                    <span className="text-micro text-ink-500">Udyam Active</span>
                  </div>
                </div>
                <div className="p-3 bg-cream-50 rounded-lg border border-line flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-risk-low" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-small text-ink-900">Zero GST Defaults</span>
                    <span className="text-micro text-ink-500">No late penalties</span>
                  </div>
                </div>
                <div className="p-3 bg-cream-50 rounded-lg border border-line flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-navy-900" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-small text-ink-900">Class-1 Supplier</span>
                    <span className="text-micro text-ink-500">&gt;50% Domestic</span>
                  </div>
                </div>
                <div className="p-3 bg-cream-50 rounded-lg border border-line flex items-center gap-2.5 opacity-60">
                  <Clock className="w-5 h-5 text-ink-400" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-small text-ink-600">5-Year Veteran</span>
                    <span className="text-micro text-ink-400">Unlocks at 50 bids</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── VIEW B: OPEN TENDERS DISCOVERY (Fix 27) ─────────────────── */}
        {activeNav === 'tenders' && (
          <div className="flex flex-col gap-5">
            {/* Filter & Search Bar */}
            <div className="p-4 bg-paper rounded-xl border border-line shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex-1 w-full max-w-sm">
                <Input
                  placeholder="Search tenders by title or GEM ID…"
                  value={tenderSearch}
                  onChange={(e) => setTenderSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4 text-ink-500" />}
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <select
                  value={tenderSort}
                  onChange={(e) => setTenderSort(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded border border-line bg-paper text-small font-medium text-ink-700 focus:outline-none"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="fee">Sort: Lowest Fee</option>
                </select>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['tenders'] })}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Refresh
                </Button>
              </div>
            </div>

            {/* Sub-nav tabs */}
            <div className="flex items-center gap-2 border-b border-line pb-2">
              <button
                type="button"
                onClick={() => setTendersSub('all')}
                className={`px-3 py-1.5 rounded-md text-small font-medium transition-colors ${
                  tendersSub === 'all' ? 'bg-navy-900 text-cream-50' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                All Open ({allTenders.length})
              </button>
              <button
                type="button"
                onClick={() => setTendersSub('matching')}
                className={`px-3 py-1.5 rounded-md text-small font-medium transition-colors ${
                  tendersSub === 'matching' ? 'bg-navy-900 text-cream-50' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                Matching My Profile ({matchingTenders.length})
              </button>
              <button
                type="button"
                onClick={() => setTendersSub('saved')}
                className={`px-3 py-1.5 rounded-md text-small font-medium transition-colors ${
                  tendersSub === 'saved' ? 'bg-navy-900 text-cream-50' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                Saved Tenders ({savedTenders.length})
              </button>
            </div>

            {/* Tenders Grid */}
            {(() => {
              const listToDisplay =
                tendersSub === 'matching'
                  ? matchingTenders
                  : tendersSub === 'saved'
                  ? savedTenders
                  : allTenders

              const filtered = listToDisplay.filter((t) => {
                const q = tenderSearch.toLowerCase()
                return (
                  t.title.toLowerCase().includes(q) ||
                  (t.gemTenderId && t.gemTenderId.toLowerCase().includes(q))
                )
              })

              if (filtered.length === 0) {
                return (
                  <EmptyState
                    title="No open tenders found"
                    description="No tenders currently match your query or filters. Check back soon."
                    icon={<Search className="w-8 h-8 text-ink-400" />}
                  />
                )
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filtered.map((t) => {
                    const isSaved = savedTenders.some((s) => s.id === t.id)
                    const matchReason = (t as any).matchReasoning || 'MSME Qualified · Domestic Value Add &gt;50%'

                    return (
                      <div
                        key={t.id}
                        className="p-5 bg-paper rounded-xl border border-line shadow-xs flex flex-col justify-between gap-3 hover:border-navy-900/30 transition-colors"
                      >
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono text-micro text-navy-800 bg-cream-100 px-2 py-0.5 rounded font-semibold border border-line">
                              {t.gemTenderId}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleSaveMutation.mutate({ tenderId: t.id, isSaved })}
                              className="text-ink-400 hover:text-saffron-600 transition-colors p-1"
                              title={isSaved ? 'Remove from Saved' : 'Save Tender'}
                            >
                              {isSaved ? (
                                <BookmarkCheck className="w-4 h-4 text-saffron-600 fill-saffron-600" />
                              ) : (
                                <Bookmark className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          <h3 className="font-semibold text-ink-900 text-base leading-snug">
                            {t.title}
                          </h3>

                          {tendersSub === 'matching' && (
                            <div className="p-2 rounded bg-cream-100/70 text-micro text-navy-900 font-medium border border-line mt-1">
                              🎯 {matchReason}
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-micro text-ink-500 mt-1 font-mono">
                            <span>Fee: ₹{Number(t.applicationFee || 5000).toLocaleString('en-IN')}</span>
                            <span>·</span>
                            <span>EMD: Exempted (MSME)</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-line">
                          <Link
                            to={`/tenders/${t.id}`}
                            className="text-small font-medium text-ink-600 hover:text-navy-900"
                          >
                            View Details
                          </Link>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/bidder/tenders/${t.id}/apply`)}
                            className="bg-navy-900 text-cream-50 hover:bg-navy-800"
                          >
                            Apply for Tender
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}

        {/* ─── VIEW C: MY BIDS / VAULT ─────────────────────────────────── */}
        {activeNav === 'bids' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-h3 font-semibold text-ink-900">Bid Submissions &amp; Pitch Vault</h2>
                <p className="text-small text-ink-600">
                  Immutable audit records and verifiable cryptographic proofs of your participation
                </p>
              </div>
            </div>

            {/* Sub-nav */}
            <div className="flex items-center gap-2 border-b border-line pb-2">
              <button
                type="button"
                onClick={() => setBidsSub('active')}
                className={`px-3 py-1.5 rounded-md text-small font-medium transition-colors ${
                  bidsSub === 'active' ? 'bg-navy-900 text-cream-50' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                Active Review (3)
              </button>
              <button
                type="button"
                onClick={() => setBidsSub('won')}
                className={`px-3 py-1.5 rounded-md text-small font-medium transition-colors ${
                  bidsSub === 'won' ? 'bg-navy-900 text-cream-50' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                Won Awards (2)
              </button>
              <button
                type="button"
                onClick={() => setBidsSub('lost')}
                className={`px-3 py-1.5 rounded-md text-small font-medium transition-colors ${
                  bidsSub === 'lost' ? 'bg-navy-900 text-cream-50' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                Past Concluded (4)
              </button>
              <button
                type="button"
                onClick={() => setBidsSub('vault')}
                className={`px-3 py-1.5 rounded-md text-small font-medium transition-colors ${
                  bidsSub === 'vault' ? 'bg-navy-900 text-cream-50' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                Verifiable Vault (PDF Reports)
              </button>
            </div>

            {/* Bids List */}
            {vaultBids.length === 0 ? (
              <div className="p-6 bg-paper rounded-xl border border-line text-center text-ink-500">
                No active bids recorded in vault.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {vaultBids.map((b) => (
                  <div key={b.bidderId} className="p-4 bg-paper rounded-xl border border-line shadow-xs flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-semibold text-ink-900 text-base">
                          {b.tender?.title || 'Government Procurement'}
                        </span>
                        <span className="font-mono text-micro text-ink-500">
                          GEM ID: {b.tender?.gemTenderId || 'GEM-2026-B-001'} · Submitted: {formatDate(b.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="success">Qualified</Badge>
                        <a
                          href={`http://localhost:4000/bidder/me/vault/${b.tenderId}/report`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-cream-100 hover:bg-cream-200 text-navy-900 text-small font-medium border border-line"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Signed Report (PDF)</span>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── VIEW D: DOCUMENTS WORKSPACE (Fix 26, 29, 30, 31, 35) ────── */}
        {activeNav === 'documents' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-h3 font-semibold text-ink-900">Compliance Document Vault</h2>
                <p className="text-small text-ink-600">
                  Cryptographically verified document proofs with sovereign CA chain verification
                </p>
              </div>
            </div>


            {/* Per-Doc Sub Navigation */}
            <div className="flex items-center gap-2 border-b border-line pb-3 flex-wrap">
              <button
                type="button"
                onClick={() => setDocSub('pan_card')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  docSub === 'pan_card' ? 'bg-navy-900 text-cream-50' : 'text-ink-700 hover:text-ink-900 hover:bg-cream-100'
                }`}
              >
                PAN Card (PDF)
              </button>
              <button
                type="button"
                onClick={() => setDocSub('gst_certificate')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  docSub === 'gst_certificate' ? 'bg-navy-900 text-cream-50' : 'text-ink-700 hover:text-ink-900 hover:bg-cream-100'
                }`}
              >
                GST Certificate
              </button>
              <button
                type="button"
                onClick={() => setDocSub('oem_authorization')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  docSub === 'oem_authorization' ? 'bg-navy-900 text-cream-50' : 'text-ink-700 hover:text-ink-900 hover:bg-cream-100'
                }`}
              >
                OEM Authorization
              </button>
              <button
                type="button"
                onClick={() => setDocSub('udyam_certificate')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  docSub === 'udyam_certificate' ? 'bg-navy-900 text-cream-50' : 'text-ink-700 hover:text-ink-900 hover:bg-cream-100'
                }`}
              >
                Udyam MSME
              </button>
              <button
                type="button"
                onClick={() => setDocSub('itr_document')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  docSub === 'itr_document' ? 'bg-navy-900 text-cream-50' : 'text-ink-700 hover:text-ink-900 hover:bg-cream-100'
                }`}
              >
                ITR Documents
              </button>
            </div>

            {/* Upload Error Banner (Fix 29) */}
            {uploadError && (
              <div className="p-3.5 bg-risk-critical/10 border border-risk-critical/30 rounded-lg text-risk-critical text-sm flex items-start gap-2.5">
                <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong>Upload Rejected: </strong>
                  <span>{uploadError}</span>
                </div>
                <button type="button" onClick={() => setUploadError(null)} className="font-bold text-base px-1">
                  ×
                </button>
              </div>
            )}

            {/* Document Card */}
            {currentDoc && (
              <div className="p-6 bg-paper rounded-xl border border-line shadow-xs flex flex-col gap-6">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-ink-500 font-semibold">
                      Current Version
                    </span>
                    <h3 className="text-xl font-bold text-ink-900 mt-1">{currentDoc.label}</h3>
                    <p className="text-sm text-ink-600 mt-1">
                      File: <strong className="text-ink-900">{statusQuery.data?.data?.filename || lastUploadedFile?.name || currentDoc.fileName}</strong> · Size:{' '}
                      {(((lastUploadedFile?.size || currentDoc.sizeBytes)) / 1024).toFixed(0)} KB · Uploaded:{' '}
                      {formatDate(currentDoc.uploadedAt)}
                    </p>
                  </div>

                  {statusQuery.data?.data ? (
                    <Badge
                      variant={
                        statusQuery.data.data.overallStatus === 'verified'
                          ? 'success'
                          : statusQuery.data.data.overallStatus === 'warning' || statusQuery.data.data.overallStatus === 'human_review'
                          ? 'warning'
                          : statusQuery.data.data.overallStatus === 'failed'
                          ? 'danger'
                          : 'info'
                      }
                      className="text-sm px-3.5 py-1"
                    >
                      {statusQuery.data.data.overallStatus === 'verified'
                        ? 'Verified ✓'
                        : statusQuery.data.data.overallStatus === 'warning'
                        ? 'Warning ⚠'
                        : statusQuery.data.data.overallStatus === 'failed'
                        ? 'Failed ✕'
                        : statusQuery.data.data.overallStatus === 'human_review'
                        ? 'Human Review Required ⚠'
                        : 'Verifying... ⏳'}
                    </Badge>
                  ) : isDocReverifying ? (
                    <Badge variant="info" className="text-sm px-3.5 py-1 animate-pulse">⏳ Re-verifying New Document...</Badge>
                  ) : currentDoc.status === 'verified' ? (
                    <Badge variant="success" className="text-sm px-3.5 py-1">Verified ✓</Badge>
                  ) : currentDoc.status === 'warning' ? (
                    <Badge variant="warning" className="text-sm px-3.5 py-1">Expiring in 30d ⚠</Badge>
                  ) : currentDoc.status === 'failed' ? (
                    <Badge variant="danger" className="text-sm px-3.5 py-1">Failed ✕</Badge>
                  ) : (
                    <Badge variant="info" className="text-sm px-3.5 py-1 animate-pulse">Verifying... ⏳</Badge>
                  )}
                </div>

                {/* SHA-256 Checksum */}
                <div className="p-3 bg-cream-50 rounded-lg border border-line flex items-center justify-between text-xs sm:text-sm font-mono text-ink-700">
                  <span className="truncate mr-2">
                    SHA-256: {lastUploadedFile?.sha256 || currentDoc.sha256}
                  </span>
                  <span className="text-ink-500 shrink-0 font-sans font-medium">
                    {uploadMutation.isPending ? 'Ingestion In Progress' : 'Immutable Hash'}
                  </span>
                </div>

                {/* Live Progressive Verification Pipeline (Fix 39) */}
                {statusQuery.data?.data ? (
                  <div className="p-4 bg-cream-50/80 rounded-xl border border-line flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-navy-800 uppercase tracking-wider">
                        Progressive Verification Stepper (Mode: {statusQuery.data.data.docType || currentDoc?.docType || 'DOCUMENT'})
                      </span>
                      <span className="text-xs font-mono text-navy-600 font-bold">
                        {(statusQuery.data.data.overallStatus || 'IN_PROGRESS').toUpperCase()}
                      </span>
                    </div>

                    <VerificationStepper stages={statusQuery.data.data.stages || []} />

                    <StatusPill
                      status={statusQuery.data.data.overallStatus || 'in_progress'}
                      isOpen={inspectOpen}
                      onClick={() => setInspectOpen(!inspectOpen)}
                    />

                    {inspectOpen && (
                      <div className="flex flex-col gap-2 mt-2">
                        {(statusQuery.data.data.stages || []).map(
                          (s: any) => s.completedAt && <StageDetailRow key={s.stage} stage={s} />
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Progressive Verification Pipeline Stepper */
                  <div className="p-4 bg-cream-50/60 rounded-xl border border-line flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink-800 uppercase tracking-wider">
                        Progressive Verification Stepper (Mode: {currentDoc?.docType || 'DOCUMENT'})
                      </span>
                      <span className="text-xs font-mono text-ink-500">
                        Status: {isDocReverifying ? 'RE-VERIFYING...' : (currentDoc?.status || 'PENDING').toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 overflow-x-auto py-2">
                      {(DOC_STAGES[currentDoc.docType] || DOC_STAGES.pan_card).map((stg, i, arr) => {
                        const stageObj = currentDoc.stages?.find((s: any) => s.stage === stg)
                        const stageStatus = isDocReverifying
                          ? (i === 0 ? 'passed' : i === 1 ? 'in_progress' : 'pending')
                          : stageObj
                          ? stageObj.status
                          : currentDoc.status === 'verified'
                          ? 'passed'
                          : i === 0
                          ? 'passed'
                          : 'pending'

                        return (
                          <div key={stg} className="flex items-center gap-2.5 shrink-0">
                            <div
                              className={cn(
                                'flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-sm font-medium shadow-2xs transition-all',
                                stageStatus === 'passed'
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                  : stageStatus === 'in_progress'
                                  ? 'bg-amber-50 text-amber-900 border-amber-300 animate-pulse'
                                  : stageStatus === 'failed'
                                  ? 'bg-red-50 text-red-900 border-red-300'
                                  : 'bg-paper text-ink-400 border-line'
                              )}
                            >
                              <span
                                className={cn(
                                  'w-2.5 h-2.5 rounded-full',
                                  stageStatus === 'passed'
                                    ? 'bg-risk-low'
                                    : stageStatus === 'in_progress'
                                    ? 'bg-amber-500 animate-ping'
                                    : stageStatus === 'failed'
                                    ? 'bg-risk-critical'
                                    : 'bg-ink-300'
                                )}
                              />
                              <span>{STAGE_LABELS[stg] || stg}</span>
                              {stageStatus === 'passed' && (
                                <span className="text-xs text-emerald-600 font-bold ml-0.5">✓</span>
                              )}
                              {stageStatus === 'in_progress' && (
                                <span className="text-xs text-amber-600 font-bold ml-0.5">⏳</span>
                              )}
                            </div>
                            {i < arr.length - 1 && <span className="text-ink-400 font-bold">→</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Cryptographic Verification Block */}
                <div className="p-4 bg-paper rounded-xl border border-line shadow-2xs flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 font-semibold text-ink-900 text-sm">
                    <KeyRound className="w-5 h-5 text-navy-800" />
                    <span>Cryptographic Verification</span>
                  </div>

                  {isDocReverifying ? (
                    <div className="p-3.5 bg-amber-50/80 rounded-lg border border-amber-300 text-sm text-amber-900 flex flex-col gap-1.5 animate-pulse">
                      <span className="font-semibold text-amber-800 flex items-center gap-1.5">
                        <Clock className="w-5 h-5 text-amber-600 animate-spin" />
                        Re-verifying Digital Signatures &amp; CA Trust Chains
                      </span>
                      <span className="text-xs text-amber-700">
                        Inspecting newly uploaded file bytes, calculating digest, and validating certificate hierarchy...
                      </span>
                    </div>
                  ) : currentDoc.cryptoVerification?.verified ? (
                    <div className="p-3.5 bg-risk-low/10 rounded-lg border border-risk-low/30 text-sm text-ink-800 flex flex-col gap-1.5">
                      <span className="font-semibold text-risk-low flex items-center gap-1.5">
                        <CheckCircle2 className="w-5 h-5" />
                        Digitally signed by {currentDoc.cryptoVerification.trustedCA}
                      </span>
                      <span className="text-xs text-ink-600">
                        ✓ Certificate chain valid via Sovereign Trust Store
                      </span>
                      <span className="text-xs text-ink-600">
                        ✓ Not tampered since {formatDate(currentDoc.cryptoVerification.signedAt)}
                      </span>
                      <span className="font-mono text-xs text-ink-500 mt-1">
                        Signature digest: {currentDoc.cryptoVerification.signatureHash}
                      </span>
                    </div>
                  ) : currentDoc.cryptoVerification?.reason === 'signature_invalid' ? (
                    <div className="p-3.5 bg-risk-critical/10 rounded-lg border border-risk-critical/30 text-sm text-risk-critical flex flex-col gap-1.5">
                      <span className="font-semibold flex items-center gap-1.5">
                        <AlertOctagon className="w-5 h-5" /> Signature Invalid — Tampering Detected
                      </span>
                      <span className="text-xs text-ink-700">
                        Document has been modified after signature was applied. Cannot verify authenticity.
                      </span>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-cream-50 rounded-lg border border-line text-sm text-ink-600 flex flex-col gap-1.5">
                      <span className="font-semibold flex items-center gap-1.5 text-ink-700">
                        ○ Digital signature check in progress / No digital signature found
                      </span>
                      <span className="text-xs text-ink-500">
                        If you have a DigiLocker-issued version or DSC signed copy, upload it for stronger verification.
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions row: View / Replace / Delete */}
                <div className="flex items-center justify-between pt-4 border-t border-line flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-navy-900 text-cream-50 hover:bg-navy-800 text-sm font-semibold transition-colors shadow-xs">
                      <UploadCloud className="w-4 h-4" />
                      <span>{isUploading ? 'Uploading…' : 'Replace Document'}</span>
                      <input
                        type="file"
                        accept="application/pdf,application/xml,image/jpeg,image/png"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) handleFileUpload(currentDoc.docType, f)
                        }}
                      />
                    </label>

                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() =>
                        notify.info('Document viewed', {
                          description: `Opened ${currentDoc.fileName} for review.`,
                        })
                      }
                    >
                      View Original
                    </Button>
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => setDeleteDocTarget(currentDoc.docType)}
                    disabled={currentDoc.tiedToActiveBid}
                    title={
                      currentDoc.tiedToActiveBid
                        ? `Cannot delete — required for active bid on ${currentDoc.activeBidTenderId}`
                        : 'Delete document'
                    }
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentDoc.tiedToActiveBid
                        ? 'opacity-40 cursor-not-allowed text-ink-400 border border-line'
                        : 'text-risk-critical hover:bg-risk-critical/10 border border-risk-critical/20'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── VIEW E: DELIVERIES ───────────────────────────────────────── */}
        {activeNav === 'deliveries' && (
          <div className="flex flex-col gap-6">
            <h2 className="text-h3 font-semibold text-ink-900">Procurement Delivery Milestones</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-paper rounded-lg border border-line">
                <span className="text-micro text-ink-500">Pending Milestones</span>
                <p className="text-h2 font-bold text-navy-900 mt-1">2</p>
              </div>
              <div className="p-3 bg-paper rounded-lg border border-line">
                <span className="text-micro text-ink-500">Completed On-Time</span>
                <p className="text-h2 font-bold text-risk-low mt-1">4</p>
              </div>
              <div className="p-3 bg-paper rounded-lg border border-line">
                <span className="text-micro text-ink-500">On-Time Performance Rate</span>
                <p className="text-h2 font-bold text-navy-900 mt-1">95%</p>
              </div>
            </div>

            <div className="p-5 bg-paper rounded-xl border border-line shadow-xs flex flex-col gap-3">
              <span className="text-micro font-semibold text-ink-800 uppercase tracking-wider">
                Active Contracts Track
              </span>
              <div className="flex flex-col divide-y divide-line/60">
                {(deliveriesData?.items || []).map((item: any) => (
                  <div key={item.id} className="py-3 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-ink-900 text-small">{item.tenderTitle}</span>
                      <span className="font-mono text-micro text-ink-500">
                        {item.gemTenderId} · Milestone: {item.milestone}
                      </span>
                    </div>
                    {item.status === 'completed' ? (
                      <Badge variant="success">Completed On-Time ✓</Badge>
                    ) : (
                      <Badge variant="warning">Due {formatDate(item.dueDate)}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── VIEW F: ALERTS ───────────────────────────────────────────── */}
        {activeNav === 'alerts' && (
          <div className="flex flex-col gap-6">
            <h2 className="text-h3 font-semibold text-ink-900">Notifications &amp; Alerts</h2>
            <div className="flex flex-col gap-3">
              {alertsList.map((a: any) => (
                <div
                  key={a.id}
                  className="p-4 bg-paper rounded-xl border border-line shadow-xs flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    {a.type === 'critical' ? (
                      <AlertOctagon className="w-5 h-5 text-risk-critical shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-risk-medium shrink-0 mt-0.5" />
                    )}
                    <div className="flex flex-col">
                      <span className="font-semibold text-ink-900 text-small">{a.title}</span>
                      <p className="text-small text-ink-600 mt-0.5">{a.message}</p>
                      <span className="text-micro font-mono text-ink-400 mt-1">
                        {formatDateTime(a.createdAt)}
                      </span>
                    </div>
                  </div>

                  {a.actionLabel && (
                    <button
                      type="button"
                      onClick={() => {
                        if (a.actionHref === '/bidder/documents') {
                          setActiveNav('documents')
                        } else if (a.actionHref === '/bidder/vault') {
                          setActiveNav('bids')
                          setBidsSub('vault')
                        } else {
                          setActiveNav('tenders')
                        }
                      }}
                      className="px-3 py-1.5 rounded bg-cream-100 hover:bg-cream-200 text-navy-900 font-semibold text-small shrink-0 border border-line"
                    >
                      {a.actionLabel}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── VIEW G: SETTINGS ─────────────────────────────────────────── */}
        {activeNav === 'settings' && (
          <div className="flex flex-col gap-6">
            <h2 className="text-h3 font-semibold text-ink-900">Organization Settings</h2>
            <div className="p-5 bg-paper rounded-xl border border-line shadow-xs flex flex-col gap-4 max-w-xl">
              <div className="flex flex-col gap-1">
                <span className="text-small font-medium text-ink-700">Company Legal Name</span>
                <span className="font-semibold text-ink-900">Ananya Enterprises Pvt Ltd</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-small font-medium text-ink-700">Permanent Account Number (PAN)</span>
                <span className="font-mono text-ink-900">AAWBS9999P</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-small font-medium text-ink-700">GSTIN</span>
                <span className="font-mono text-ink-900">27AAWBS9999P1Z5</span>
              </div>
              <div className="pt-3 border-t border-line flex items-center justify-between">
                <span className="text-small text-ink-500">Download sovereign audit profile record</span>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => notify.success('Profile archive downloaded')}
                >
                  Export JSON
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Procurement Terms Explained Simply (Common People Friendly) ─── */}
        <div className="p-5 bg-paper dark:bg-slate-900 rounded-xl border border-line dark:border-slate-800 shadow-xs flex flex-col gap-3 mt-4">
          <div className="flex items-center gap-2 text-ink-900 dark:text-cream-50">
            <HelpCircle className="w-5 h-5 text-saffron-600 dark:text-saffron-400" />
            <h4 className="text-base font-bold">
              Procurement Terms Explained Simply (सरल शब्दावली)
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-ink-600 dark:text-slate-300 mt-1">
            <div className="p-3 rounded-lg bg-cream-50 dark:bg-slate-800 border border-line dark:border-slate-700">
              <span className="font-bold text-ink-900 dark:text-cream-50 block mb-1">
                Trust Score (विश्वसनीयता स्कोर)
              </span>
              A rating from 0 to 100 based on regular GST/ITR filings, on-time deliveries, and clean independent bidding.
            </div>
            <div className="p-3 rounded-lg bg-cream-50 dark:bg-slate-800 border border-line dark:border-slate-700">
              <span className="font-bold text-ink-900 dark:text-cream-50 block mb-1">
                Bidding Ring / Group Fraud (मिलीभगत)
              </span>
              When competing companies secretly team up, share directors, or coordinate bid amounts to fix prices.
            </div>
            <div className="p-3 rounded-lg bg-cream-50 dark:bg-slate-800 border border-line dark:border-slate-700">
              <span className="font-bold text-ink-900 dark:text-cream-50 block mb-1">
                MSME / Udyam (उद्यम प्रमाणपत्र)
              </span>
              Government certificate for micro, small, and medium enterprises providing tender fee waivers and priority.
            </div>
            <div className="p-3 rounded-lg bg-cream-50 dark:bg-slate-800 border border-line dark:border-slate-700">
              <span className="font-bold text-ink-900 dark:text-cream-50 block mb-1">
                Permanent Record (स्थायी रिकॉर्ड)
              </span>
              A secure digital log that cannot be altered or deleted, ensuring complete transparency for government audits.
            </div>
          </div>
        </div>
      </main>

      {/* ─── Document Delete Confirmation Modal (Fix 35) ───────────────── */}
      <Confirm
        isOpen={!!deleteDocTarget}
        onClose={() => setDeleteDocTarget(null)}
        onConfirm={() => {
          if (deleteDocTarget) deleteDocMutation.mutate(deleteDocTarget)
        }}
        title="Delete Compliance Document?"
        actionName="document deletion"
        consequence="remove this document from your active profile. A secure backup record is kept for government audit compliance"
        description="Are you sure you want to delete this document from your bidder compliance vault?"
        confirmText="Confirm Delete"
        isDestructive
        isLoading={deleteDocMutation.isPending}
      />
    </div>
  )
}
