import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  LayoutList,
  Network,
  Users,
  IndianRupee,
  ShieldAlert,
  Award,
  ChevronRight,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sliders,
  AlertOctagon,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Shield,
  Filter,
  ShieldCheck,
  Clock,
} from 'lucide-react'
import apiClient from '@/lib/apiClient'
import { formatDate, formatDateTime } from '@/lib/dates'
import { LedgerEntryRow } from '@/components/ledger/LedgerEntryRow'
import type { Tender, Bidder, CollusionDetectionResult } from '@/types'

const STATUTORY_SLOTS = [
  { id: 'msme', name: 'MSME Status', shortLabel: 'MSME', portal: 'Udyam Portal' },
  { id: 'gst', name: 'GST Compliance', shortLabel: 'GST', portal: 'GSTN Portal' },
  { id: 'pan_itr', name: 'PAN/ITR Consistency', shortLabel: 'PAN/ITR', portal: 'CBDT Portal' },
  { id: 'blacklist', name: 'Blacklist Screening', shortLabel: 'Blacklist', portal: 'GeM Debarment' },
  { id: 'make_in_india', name: 'Make in India', shortLabel: 'MII', portal: 'DPIIT Portal' },
] as const
import { useAuth } from '@/providers/AuthProvider'
import { useI18n } from '@/providers/I18nProvider'
import {
  PageHeader,
  Button,
  Input,
  Select,
  Badge,
  RiskBadge,
  TrustBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  CopyableId,
  Skeleton,
  EmptyState,
  notify,
  Modal,
} from '@/components/ui'
import { BidderDetailDrawer } from '@/components/BidderDetailDrawer'
import { CartelGraph } from '@/components/CartelGraph'
import { AwardTenderModal } from '@/components/AwardTenderModal'
import { useRateLimitedAction } from '@/hooks/useRateLimitedAction'

export default function TenderDetailPage() {
  const { tenderId } = useParams<{ tenderId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useI18n()
  const queryClient = useQueryClient()

  // View state
  const [viewMode, setViewMode] = useState<'table' | 'graph' | 'ledger'>('table')
  const [tableDensity, setTableDensity] = useState<'normal' | 'compact'>('normal')
  const [searchQuery, setSearchQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  // PII reveal toggle for CartelGraph (masked by default to protect bidder identities)
  const [piiGraphRevealed, setPiiGraphRevealed] = useState(false)

  // Drawer state
  const [selectedBidderId, setSelectedBidderId] = useState<string | null>(null)
  const [drawerInitialTab, setDrawerInitialTab] = useState('overview')
  const [drawerExpandedCheck, setDrawerExpandedCheck] = useState<string | undefined>(undefined)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Award modal state
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false)
  // Mobile accordion toggle for signals breakdown panel
  const [signalsPanelOpen, setSignalsPanelOpen] = useState(true)

  // Tender Ledger tab query & filters (Fix 23)
  const [ledgerActionFilter, setLedgerActionFilter] = useState('all')
  const [ledgerActorFilter, setLedgerActorFilter] = useState('all')
  const [ledgerBidderFilter, setLedgerBidderFilter] = useState('all')

  const { data: tenderLedger = [], isLoading: isLedgerLoading } = useQuery<any[]>({
    queryKey: ['tender-ledger', tenderId],
    queryFn: async () => {
      if (!tenderId) return []
      try {
        const res = await apiClient.get<any>(`/ledger/tender/${tenderId}`)
        return Array.isArray(res.data) ? res.data : []
      } catch {
        return []
      }
    },
    enabled: !!tenderId,
  })

  // Fetch admin rules config for dynamic collusion signal weights & threshold
  const { data: rulesData } = useQuery<{ config?: any }>({
    queryKey: ['admin', 'rules'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/admin/rules')
      return res.data
    },
    staleTime: 60_000,
  })

  // Fetch Tender metadata
  const { data: tender } = useQuery<Tender>({
    queryKey: ['tender', tenderId],
    queryFn: async () => {
      if (!tenderId) return null as any
      const res = await apiClient.get<Tender>(`/tenders/${tenderId}`)
      return res.data
    },
    enabled: !!tenderId,
  })

  // Fetch Bidders for this tender
  const {
    data: bidders = [],
    isLoading: isLoadingBidders,
    refetch: refetchBidders,
    isFetching: isFetchingBidders,
  } = useQuery<Bidder[]>({
    queryKey: ['tenders', tenderId, 'bidders'],
    queryFn: async () => {
      if (!tenderId) return []
      const res = await apiClient.get<Bidder[]>(`/tenders/${tenderId}/bidders`)
      return res.data || []
    },
    enabled: !!tenderId,
  })

  // Fetch Tender Award Decision (Dual-Officer Governance)
  const { data: awardData } = useQuery<{
    id: string
    tenderId: string
    winningBidderId: string
    primaryOfficerId: string
    secondaryOfficerId?: string | null
    justification: string
    standoutFactors: Array<{ factor: string; note: string }>
    submittedAt: string
    finalizedAt?: string | null
    winningBidder?: {
      id: string
      companyName: string
      pan?: string
      gstin?: string
    }
  } | null>({
    queryKey: ['tender-award', tenderId],
    queryFn: async () => {
      if (!tenderId) return null
      try {
        const res = await apiClient.get<any>(`/tenders/${tenderId}/award`)
        return res.data || null
      } catch {
        return null
      }
    },
    enabled: !!tenderId,
  })

  // Second Approval State & Dual-Officer Computations
  const [isSecondApprovalModalOpen, setIsSecondApprovalModalOpen] = useState(false)
  const isPrimaryOfficer = user?.id === awardData?.primaryOfficerId
  const canSecondApprove =
    (user?.role === 'officer' || user?.role === 'admin') &&
    !!awardData &&
    !awardData.finalizedAt &&
    !isPrimaryOfficer
  const isPendingSecondApproval =
    tender?.status === 'evaluation_awarded_pending_2nd' && !!awardData && !awardData.finalizedAt
  const isAwardFinalized = tender?.status === 'awarded' || !!awardData?.finalizedAt

  const secondApprovalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/tenders/${tenderId}/award/second-approval`)
      return res.data
    },
    onSuccess: (data: any) => {
      notify.success('Award Certified & Finalized!', {
        description: `Stage: Secondary Award Finalized. Ledger ID: ${data?.ledgerId?.slice(0, 8) || ''}... committed.`,
      })
      queryClient.invalidateQueries({ queryKey: ['tender', tenderId] })
      queryClient.invalidateQueries({ queryKey: ['tender-award', tenderId] })
      queryClient.invalidateQueries({ queryKey: ['tender-ledger', tenderId] })
      queryClient.invalidateQueries({ queryKey: ['tenders'] })
      setIsSecondApprovalModalOpen(false)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || 'Second approval failed'
      notify.error('Secondary Approval Failed', { description: msg })
    },
  })

  // Collusion detection query / cache state
  const [collusionData, setCollusionData] = useState<CollusionDetectionResult | null>(null)

  // Rate-limited Collusion Detector mutation
  const {
    mutate: runCollusionDetection,
    isPending: isDetectingCollusion,
    cooldownSeconds,
    isRateLimited,
  } = useRateLimitedAction<CollusionDetectionResult, Error, void>({
    mutationFn: async () => {
      const res = await apiClient.post<CollusionDetectionResult>(
        `/tenders/${tenderId}/detect-collusion`,
        { forceFresh: true }
      )
      return res.data
    },
    onSuccess: (result) => {
      setCollusionData(result)
      const clusterCount = result.clusters?.length || 0
      if (clusterCount > 0) {
        notify.warning(`Suspicious Bidding Ring Detected! ${clusterCount} Group identified`, {
          description: `Identified ${result.clusters[0]?.signalsFired.length || 0} matching patterns across ${result.clusters[0]?.bidderIds.length || 0} bidders coordinating together`,
        })
        setViewMode('graph')
      } else {
        notify.success('Anti-rigging scan complete: All bidders independent (zero suspicious groups detected)')
      }
      refetchBidders()
    },
    onError: (err: any) => {
      if (!isRateLimited) {
        notify.error('Collusion analysis failed', { description: err.message })
      }
    },
  })

  // Filtered bidders
  const filteredBidders = useMemo(() => {
    return bidders.filter((b) => {
      const matchesSearch =
        !searchQuery.trim() ||
        b.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.pan && b.pan.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.gstin && b.gstin.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesRisk = riskFilter === 'all' || b.overallRisk === riskFilter

      const decisionStatus = b.officerDecision?.status || 'pending'
      const matchesStatus = statusFilter === 'all' || decisionStatus === statusFilter

      return matchesSearch && matchesRisk && matchesStatus
    })
  }, [bidders, searchQuery, riskFilter, statusFilter])

  // Risk Distribution Statistics (Fix 33)
  const totalBidders = bidders.length
  const distribution = useMemo(() => {
    return {
      critical: bidders.filter((b) => (b.overallRisk || (b as any).riskLevel) === 'critical').length,
      high: bidders.filter((b) => (b.overallRisk || (b as any).riskLevel) === 'high').length,
      medium: bidders.filter((b) => (b.overallRisk || (b as any).riskLevel) === 'medium').length,
      low: bidders.filter((b) => (b.overallRisk || (b as any).riskLevel) === 'low').length,
    }
  }, [bidders])

  const pct = (n: number) => (totalBidders > 0 ? Math.round((n / totalBidders) * 100) : 0)

  const makerCheckerStats = useMemo(() => {
    let dualApproved = 0
    let makerApproved = 0
    let disqualified = 0
    let pending = 0

    for (const b of bidders) {
      const isDual = !!b.secondaryReviewerId || (b.officerDecision as any)?.stage === 'secondary' || b.approvalState === 'awarded'
      const isMaker = !isDual && (!!b.primaryReviewerId || (b.officerDecision as any)?.stage === 'primary' || b.officerDecision?.status === 'qualified')
      const isDisq = b.officerDecision?.status === 'disqualified' || b.approvalState === 'disqualified'

      if (isDual) dualApproved++
      else if (isMaker) makerApproved++
      else if (isDisq) disqualified++
      else pending++
    }

    return { dualApproved, makerApproved, disqualified, pending }
  }, [bidders])

  const openBidder = (id: string, initialTab: string = 'overview', checkId?: string) => {
    setSelectedBidderId(id)
    setDrawerInitialTab(initialTab)
    setDrawerExpandedCheck(checkId)
    setIsDrawerOpen(true)
  }

  // Filtered Tender Ledger (Fix 23)
  const filteredTenderLedger = useMemo(() => {
    return tenderLedger.filter((entry: any) => {
      const matchesAction = ledgerActionFilter === 'all' || entry.action === ledgerActionFilter
      const matchesActor = ledgerActorFilter === 'all' || entry.actorType === ledgerActorFilter
      const matchesBidder = ledgerBidderFilter === 'all' || entry.bidderId === ledgerBidderFilter
      return matchesAction && matchesActor && matchesBidder
    })
  }, [tenderLedger, ledgerActionFilter, ledgerActorFilter, ledgerBidderFilter])

  const formatCurrency = (amount: number | string) => {
    const num = Number(amount)
    if (isNaN(num) || num === 0) return 'Exempted / Nil'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num)
  }

  const collusionButtonLabel = isRateLimited
    ? `Try again in ${cooldownSeconds}s`
    : isDetectingCollusion
    ? 'Running Graph Engine…'
    : 'Detect Collusion'

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Breadcrumb & Summary PageHeader ─────────────────────────── */}
      <PageHeader
        title={tender?.title || 'Tender Compliance Triage'}
        subtitle={
          tender
            ? `GeM Tender ID: ${tender.gemTenderId} · Evaluation Stage`
            : 'Loading procurement dossier…'
        }
        onBack={() => navigate('/tenders')}
        breadcrumbs={[
          { label: 'BharatBid', href: '/tenders' },
          { label: 'Tenders', href: '/tenders' },
          { label: tender?.gemTenderId || 'Detail' },
        ]}
        badge={
          tender ? (
            <div className="flex items-center gap-2">
              <CopyableId id={tender.gemTenderId} label="Tender ID" />
              {isAwardFinalized ? (
                <Badge variant="success">Award Finalized ✓</Badge>
              ) : isPendingSecondApproval ? (
                <Badge variant="warning" className="bg-amber-100 text-amber-900 border-amber-300">
                  Pending 2nd Approval
                </Badge>
              ) : (
                <Badge variant="info">Evaluation Phase</Badge>
              )}
            </div>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 bg-paper rounded-md border border-line">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-small font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-cream-100 text-navy-900 font-semibold'
                    : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                <LayoutList className="w-4 h-4" />
                <span>Triage Table</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-small font-medium transition-colors ${
                  viewMode === 'graph'
                    ? 'bg-cream-100 text-navy-900 font-semibold'
                    : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                <Network className="w-4 h-4 text-risk-critical" />
                <span>Bidding Ring Map (Collusion Graph)</span>
                {collusionData?.clusters && collusionData.clusters.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-risk-critical" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setViewMode('ledger')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-small font-medium transition-colors ${
                  viewMode === 'ledger'
                    ? 'bg-cream-100 text-navy-900 font-semibold'
                    : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                <Shield className="w-4 h-4 text-navy-800" />
                <span>Tender Ledger</span>
                {tenderLedger.length > 0 && (
                  <span className="font-mono text-micro bg-cream-200 px-1.5 py-0.2 rounded font-semibold text-navy-900">
                    {tenderLedger.length}
                  </span>
                )}
              </button>
            </div>

            {/* Detect Collusion Button with Rate Limit Countdown */}
            <Button
              variant="destructive"
              size="md"
              onClick={() => runCollusionDetection()}
              disabled={isRateLimited || isDetectingCollusion}
              isLoading={isDetectingCollusion}
              leftIcon={<ShieldAlert className="w-4 h-4" />}
              id="detect-collusion-btn"
            >
              {collusionButtonLabel}
            </Button>

            {/* Award Tender CTA with Dual-Officer State Awareness */}
            {isAwardFinalized ? (
              <Badge variant="success" size="md" className="px-3 py-1.5 text-small font-semibold">
                <CheckCircle2 className="w-4 h-4 mr-1 text-risk-low inline" /> Award Finalized
              </Badge>
            ) : isPendingSecondApproval ? (
              canSecondApprove ? (
                <Button
                  variant="primary"
                  size="md"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-600 shadow-sm"
                  leftIcon={<ShieldCheck className="w-4 h-4" />}
                  onClick={() => setIsSecondApprovalModalOpen(true)}
                  id="counter-sign-header-btn"
                >
                  Counter-Sign Award
                </Button>
              ) : (
                <Badge variant="warning" size="md" className="px-3 py-1.5 text-small font-medium bg-saffron-100 text-saffron-900 border-saffron-300">
                  <Clock className="w-4 h-4 mr-1 inline" /> Awaiting 2nd Officer
                </Badge>
              )
            ) : (
              <Button
                variant="primary"
                size="md"
                leftIcon={<Award className="w-4 h-4" />}
                onClick={() => setIsAwardModalOpen(true)}
              >
                Award Tender
              </Button>
            )}
          </div>
        }
      />

      {/* ─── Sovereign Dual-Officer Maker-Checker Governance Protocol ────── */}
      <div className="p-4 bg-gradient-to-r from-navy-900 to-navy-800 text-cream-50 rounded-xl border border-navy-700 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-micro font-mono uppercase bg-saffron-500 text-navy-950 font-bold tracking-wider">
              GeM Rule 14.2 Protocol
            </span>
            <span className="text-small font-semibold text-cream-100">
              {t('makerChecker.title', 'Dual-Officer Maker-Checker Protocol Active')}
            </span>
          </div>
          <p className="text-micro text-cream-300 max-w-2xl leading-relaxed">
            {t('makerChecker.desc', 'Primary Officer initiates qualification triage; Secondary Officer performs independent concurrence before tender can be awarded.')}
          </p>
          <div className="flex items-center gap-3 mt-1 text-micro">
            <span className="text-cream-300">
              Logged in as:{' '}
              <strong className="text-saffron-400">
                {user?.name || user?.email || 'Officer'}
              </strong>{' '}
              ({user?.role === 'officer' ? t('makerChecker.maker', 'Primary Officer (Maker)') : user?.role === 'admin' ? t('makerChecker.checker', 'Secondary Officer (Checker)') : 'Observer View'})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="px-3 py-1.5 rounded-lg bg-navy-950/70 border border-navy-700 flex flex-col items-center">
            <span className="text-[10px] text-cream-400 font-medium">Dual Approved</span>
            <span className="text-body font-mono font-bold text-risk-low">{makerCheckerStats.dualApproved} / {bidders.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-navy-950/70 border border-navy-700 flex flex-col items-center">
            <span className="text-[10px] text-cream-400 font-medium">Maker Approved</span>
            <span className="text-body font-mono font-bold text-saffron-400">{makerCheckerStats.makerApproved}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-navy-950/70 border border-navy-700 flex flex-col items-center">
            <span className="text-[10px] text-cream-400 font-medium">Pending Triage</span>
            <span className="text-body font-mono font-bold text-cream-200">{makerCheckerStats.pending}</span>
          </div>
        </div>
      </div>

      {/* ─── Secondary Award Concurrence Banner (4-Eye Governance USP) ────── */}
      {isPendingSecondApproval && awardData && (
        <div className="p-5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-cream-50 border-2 border-amber-500/40 rounded-xl shadow-md flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-micro font-mono font-bold tracking-wide uppercase bg-amber-500 text-slate-950 animate-pulse">
                <Clock className="w-3.5 h-3.5" /> Action Required: 2nd Officer Concurrence
              </span>
              <span className="text-small font-bold text-ink-900">
                Tender Award Stage 1 Complete — Awaiting Secondary Officer Sign-off
              </span>
            </div>
            <span className="text-micro font-mono text-ink-500">
              Submitted {formatDateTime(awardData.submittedAt)}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Winner Details */}
            <div className="p-3.5 bg-paper rounded-lg border border-line flex flex-col justify-between">
              <span className="text-micro text-ink-500 font-medium">Selected Winning Bidder</span>
              <div className="mt-1">
                <p className="text-body font-bold text-navy-900 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-600 shrink-0" />
                  {awardData.winningBidder?.companyName || awardData.winningBidderId}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-micro font-mono text-ink-600">
                  {awardData.winningBidder?.pan && (
                    <span className="bg-cream-100 px-1.5 py-0.5 rounded border border-line">
                      PAN: {awardData.winningBidder.pan}
                    </span>
                  )}
                  {awardData.winningBidder?.gstin && (
                    <span className="bg-cream-100 px-1.5 py-0.5 rounded border border-line">
                      GST: {awardData.winningBidder.gstin}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Primary Reviewer */}
            <div className="p-3.5 bg-paper rounded-lg border border-line flex flex-col justify-between">
              <span className="text-micro text-ink-500 font-medium">Primary Reviewer (Maker)</span>
              <div className="mt-1">
                <p className="text-body font-bold text-navy-900 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-navy-800 shrink-0" />
                  {awardData.primaryOfficerId === 'user-officer-001' ? 'Priya Sharma (Officer 1)' : awardData.primaryOfficerId}
                </p>
                <p className="text-micro text-ink-500 mt-1">
                  Status: <strong className="text-saffron-600">Primary Award Recorded</strong> (Ledger Committed)
                </p>
              </div>
            </div>

            {/* Action Area */}
            <div className="p-3.5 bg-paper rounded-lg border border-line flex flex-col justify-center gap-2">
              <span className="text-micro text-ink-500 font-medium">4-Eye Governance Action</span>
              {canSecondApprove ? (
                <Button
                  variant="primary"
                  size="md"
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm font-semibold flex items-center justify-center gap-2"
                  leftIcon={<ShieldCheck className="w-4 h-4" />}
                  onClick={() => setIsSecondApprovalModalOpen(true)}
                  id="counter-sign-award-btn"
                >
                  Review & Counter-Sign Award
                </Button>
              ) : isPrimaryOfficer ? (
                <div className="p-2 bg-amber-50 rounded border border-amber-200 text-micro text-amber-900 leading-tight">
                  <strong>Self-Review Blocked:</strong> You submitted this award as Primary Officer. An independent second officer must counter-sign.
                </div>
              ) : (
                <div className="p-2 bg-cream-100 rounded border border-line text-micro text-ink-600">
                  Awaiting secondary officer login to counter-sign.
                </div>
              )}
            </div>
          </div>

          {/* Primary Officer Justification & Standout Factors Preview */}
          <div className="p-3 bg-paper/80 rounded-lg border border-line text-small flex flex-col gap-2">
            <span className="text-micro font-bold text-ink-700 uppercase tracking-wider">
              Primary Officer Accountability Justification:
            </span>
            <p className="text-small text-ink-800 italic bg-cream-50/60 p-2.5 rounded border border-line/60">
              "{awardData.justification}"
            </p>

            {awardData.standoutFactors && awardData.standoutFactors.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-micro font-semibold text-ink-500">Standout Factors:</span>
                {awardData.standoutFactors.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-micro bg-cream-100 border border-line text-ink-700"
                  >
                    <strong className="text-ink-900">{f.factor}:</strong> {f.note}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Finalized Award Banner ─────────────────────────────────── */}
      {isAwardFinalized && (
        <div className="p-4 bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-navy-950 text-cream-50 rounded-xl border border-emerald-500/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-micro font-mono uppercase bg-emerald-500 text-slate-950 font-bold tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Award Certified & Finalized
              </span>
              <span className="text-small font-semibold text-emerald-100">
                GeM Dual-Officer Sign-Off Complete
              </span>
            </div>
            <p className="text-small text-cream-200 mt-0.5">
              Winner:{' '}
              <strong className="text-cream-50 font-bold text-body">
                {awardData?.winningBidder?.companyName || 'Winning Bidder'}
              </strong>
            </p>
            <div className="flex items-center gap-4 text-micro text-cream-300 mt-0.5 flex-wrap">
              <span>Maker: <strong>{awardData?.primaryOfficerId === 'user-officer-001' ? 'Priya Sharma' : awardData?.primaryOfficerId}</strong> ({formatDate(awardData?.submittedAt)})</span>
              <span>•</span>
              <span>Checker: <strong>{awardData?.secondaryOfficerId === 'user-officer-002' ? 'Rajesh Kumar' : awardData?.secondaryOfficerId}</strong> ({formatDate(awardData?.finalizedAt)})</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('ledger')}
              className="px-3 py-1.5 bg-emerald-800/80 hover:bg-emerald-700 text-cream-50 text-small rounded-lg border border-emerald-600 font-medium transition-colors flex items-center gap-1.5"
            >
              <Shield className="w-4 h-4" /> View Ledger Audit Trail
            </button>
          </div>
        </div>
      )}

      {/* ─── Summary KPI Bar ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-line rounded-lg border border-line overflow-hidden shadow-xs">
        {/* Total Bidders */}
        <div className="p-3.5 bg-paper flex flex-col justify-between">
          <span className="text-micro text-ink-500 flex items-center gap-1 font-medium">
            <Users className="w-3.5 h-3.5 text-ink-500" /> Total Bidders
          </span>
          <p className="text-h2 font-semibold text-ink-900 font-mono mt-1">
            {bidders.length}
          </p>
        </div>

        {/* Fees Collected */}
        <div className="p-3.5 bg-paper flex flex-col justify-between">
          <span className="text-micro text-ink-500 flex items-center gap-1 font-medium">
            <IndianRupee className="w-3.5 h-3.5 text-ink-500" /> Fees Collected
          </span>
          <p className="text-body font-semibold text-ink-900 font-mono mt-1 truncate">
            {tender ? formatCurrency(Number(tender.applicationFee) * bidders.length) : '₹0'}
          </p>
        </div>

        {/* Risk Distribution Pills (Fix 33) */}
        <div className="col-span-2 md:col-span-3 p-3.5 bg-paper flex flex-col justify-between">
          <span className="text-micro text-ink-500 font-medium">
            Evaluated Statutory Risk Distribution {totalBidders > 0 ? `(${totalBidders} bidder${totalBidders === 1 ? '' : 's'})` : ''}
          </span>
          {totalBidders === 0 ? (
            <p className="text-small text-ink-400 italic mt-1">No bidders yet — awaiting applications.</p>
          ) : (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <button
                type="button"
                onClick={() => setRiskFilter(riskFilter === 'critical' ? 'all' : 'critical')}
                className={`focus-visible:outline-none transition-transform hover:scale-[1.02] ${riskFilter === 'critical' ? 'ring-2 ring-risk-critical rounded' : ''}`}
                title={`Filter by Critical risk: ${distribution.critical} of ${totalBidders}`}
              >
                <span className="inline-flex items-center font-medium rounded border select-none px-2 py-0.5 text-micro gap-1 bg-[#FAECEB] text-risk-critical border-[#EFC2BF]">
                  <AlertOctagon className="w-3 h-3 shrink-0" />
                  <span>Critical: {distribution.critical} of {totalBidders} ({pct(distribution.critical)}%)</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRiskFilter(riskFilter === 'high' ? 'all' : 'high')}
                className={`focus-visible:outline-none transition-transform hover:scale-[1.02] ${riskFilter === 'high' ? 'ring-2 ring-risk-high rounded' : ''}`}
                title={`Filter by High risk: ${distribution.high} of ${totalBidders}`}
              >
                <span className="inline-flex items-center font-medium rounded border select-none px-2 py-0.5 text-micro gap-1 bg-[#FDF0E9] text-risk-high border-[#F8D0BD]">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>High: {distribution.high} of {totalBidders} ({pct(distribution.high)}%)</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRiskFilter(riskFilter === 'medium' ? 'all' : 'medium')}
                className={`focus-visible:outline-none transition-transform hover:scale-[1.02] ${riskFilter === 'medium' ? 'ring-2 ring-risk-medium rounded' : ''}`}
                title={`Filter by Medium risk: ${distribution.medium} of ${totalBidders}`}
              >
                <span className="inline-flex items-center font-medium rounded border select-none px-2 py-0.5 text-micro gap-1 bg-[#FBF6EA] text-risk-medium border-[#EBDCB4]">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>Medium: {distribution.medium} of {totalBidders} ({pct(distribution.medium)}%)</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRiskFilter(riskFilter === 'low' ? 'all' : 'low')}
                className={`focus-visible:outline-none transition-transform hover:scale-[1.02] ${riskFilter === 'low' ? 'ring-2 ring-risk-low rounded' : ''}`}
                title={`Filter by Low risk: ${distribution.low} of ${totalBidders}`}
              >
                <span className="inline-flex items-center font-medium rounded border select-none px-2 py-0.5 text-micro gap-1 bg-[#EBF3EC] text-risk-low border-[#C7DEC9]">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>Low: {distribution.low} of {totalBidders} ({pct(distribution.low)}%)</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── View 1: Triage Table View ───────────────────────────────── */}
      {viewMode === 'table' && (
        <div className="flex flex-col gap-4">
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 bg-paper rounded-lg border border-line shadow-sm">
            <div className="flex-1 max-w-sm">
              <Input
                placeholder="Search company, PAN, or GSTIN…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-ink-500" />}
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Risk Filter */}
              <div className="w-36">
                <Select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Risks' },
                    { value: 'critical', label: 'Critical' },
                    { value: 'high', label: 'High' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'low', label: 'Low' },
                  ]}
                />
              </div>

              {/* Status Filter */}
              <div className="w-40">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Decisions' },
                    { value: 'pending', label: 'Pending Review' },
                    { value: 'qualified', label: 'Qualified' },
                    { value: 'disqualified', label: 'Disqualified' },
                    { value: 'clarification_requested', label: 'Clarification' },
                  ]}
                />
              </div>

              {/* Density Toggle */}
              <div className="flex items-center gap-1 border border-line rounded p-0.5 bg-cream-50">
                <button
                  type="button"
                  onClick={() => setTableDensity('compact')}
                  className={`px-2 py-1 rounded text-micro ${
                    tableDensity === 'compact'
                      ? 'bg-paper font-semibold shadow-xs text-navy-900'
                      : 'text-ink-500'
                  }`}
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setTableDensity('normal')}
                  className={`px-2 py-1 rounded text-micro ${
                    tableDensity === 'normal'
                      ? 'bg-paper font-semibold shadow-xs text-navy-900'
                      : 'text-ink-500'
                  }`}
                >
                  Normal
                </button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => refetchBidders()}
                isLoading={isFetchingBidders}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Table Container */}
          {isLoadingBidders ? (
            <div className="p-6 bg-paper rounded-lg border border-line flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} variant="tableRow" />
              ))}
            </div>
          ) : filteredBidders.length === 0 ? (
            <EmptyState
              title="No bidders match criteria"
              description="Try adjusting risk levels, status filters, or search keywords."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setRiskFilter('all')
                    setStatusFilter('all')
                  }}
                >
                  Reset Filters
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-line bg-paper shadow-sm">
              {/* Statutory Checks Legend (Fix 32) */}
              <div className="flex items-center justify-between px-4 py-2 bg-cream-50/80 border-b border-line text-micro text-ink-600 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink-700">Statutory Checks:</span>
                  <span className="text-ink-500">MSME · GST · PAN/ITR · Blacklist · Make in India</span>
                </div>
                <div className="flex items-center gap-3 text-ink-600">
                  <span className="flex items-center gap-1 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-risk-low inline-block" /> Verified
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-risk-medium inline-block" /> Partial / Expiring
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-risk-critical inline-block" /> Failed
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full border border-ink-400 bg-transparent inline-block" /> Not Applicable / Pending
                  </span>
                </div>
              </div>

              <Table density={tableDensity}>
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>Company & Identification</TableHead>
                    <TableHead>Overall Risk</TableHead>
                    <TableHead>Trust Source</TableHead>
                    <TableHead>
                      <div className="flex flex-col">
                        <span>Statutory Checks</span>
                        <span className="text-[10px] font-normal text-ink-500 normal-case tracking-normal">
                          MSME · GST · PAN/ITR · Blacklist · MII
                        </span>
                      </div>
                    </TableHead>
                    <TableHead>Officer Decision</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBidders.map((b) => {
                    const isCartelMember =
                      b.overallRisk === 'critical' ||
                      b.id === 'bidder-c1' ||
                      b.id === 'bidder-c2' ||
                      b.id === 'bidder-c3'

                    return (
                      <TableRow
                        key={b.id}
                        isInteractive
                        onClick={() => openBidder(b.id)}
                        className={isCartelMember ? 'bg-[#FAECEB]/25 hover:bg-[#FAECEB]/40' : ''}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-ink-900 leading-tight">
                              {b.companyName}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 text-micro font-mono text-ink-500">
                              <span>PAN: {b.pan || '—'}</span>
                              <span>·</span>
                              <span>GST: {b.gstin ? b.gstin.slice(0, 5) + '…' : '—'}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <RiskBadge level={b.overallRisk} score={b.riskScore} />
                        </TableCell>

                        <TableCell>
                          <TrustBadge
                            source={
                              b.checks?.[0]?.trust_source ||
                              (b.overallRisk === 'critical' ? 'ai_extracted' : 'digilocker')
                            }
                            confidence={b.checks?.[0]?.confidence}
                          />
                        </TableCell>

                        <TableCell>
                          {/* 5-slot statutory checks indicator (Fix 32) */}
                          <div className="flex items-center gap-1.5" aria-label="Statutory Checks: MSME, GST, PAN/ITR, Blacklist, Make in India">
                            {STATUTORY_SLOTS.map((slot) => {
                              const chk = (b.checks || []).find((c: any) => {
                                const cat = (c.category || '').toLowerCase()
                                const title = (c.title || c.name || '').toLowerCase()
                                if (slot.id === 'msme') return cat.includes('msme') || title.includes('msme') || title.includes('udyam')
                                if (slot.id === 'gst') return cat.includes('gst') || title.includes('gst')
                                if (slot.id === 'pan_itr') return cat.includes('pan') || title.includes('pan') || cat.includes('itr') || title.includes('itr')
                                if (slot.id === 'blacklist') return cat.includes('blacklist') || title.includes('blacklist') || title.includes('debarment')
                                if (slot.id === 'make_in_india') return cat.includes('make_in_india') || title.includes('india') || title.includes('mii') || cat.includes('local')
                                return false
                              })

                              if (!chk) {
                                return (
                                  <button
                                    key={slot.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openBidder(b.id, 'compliance', slot.id)
                                    }}
                                    title={`${slot.name}: ○ Not applicable to this tender category / Pending`}
                                    className="w-3.5 h-3.5 rounded-full border-2 border-ink-300 hover:border-ink-500 bg-transparent flex items-center justify-center transition-transform hover:scale-125 focus:outline-none"
                                    aria-label={`${slot.name}: Not applicable or pending`}
                                  />
                                )
                              }

                              const status = (chk.status || '').toLowerCase()
                              const isPassed = status === 'passed' || status === 'verified'
                              const isFlagged = status === 'flagged' || status === 'failed'
                              const isAmber = !isPassed && !isFlagged

                              let tooltip = `${slot.name}: ✓ Verified via ${slot.portal} (${formatDate(chk.verifiedAt || tender?.closingDate || '2026-09-22')})`
                              if (isFlagged) {
                                tooltip = `${slot.name}: ✗ Verification Failed / Flagged mismatch`
                              } else if (isAmber) {
                                tooltip = `${slot.name}: ⚠ Expires in 30 days (${formatDate((chk as any).expiresAt || '2026-10-22')})`
                              }

                              return (
                                <button
                                  key={slot.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openBidder(b.id, 'compliance', slot.id)
                                  }}
                                  title={tooltip}
                                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold transition-transform hover:scale-125 focus:outline-none ${
                                    isPassed
                                      ? 'bg-risk-low text-white shadow-xs'
                                      : isFlagged
                                      ? 'bg-risk-critical text-white shadow-xs'
                                      : 'bg-risk-medium text-navy-900 shadow-xs'
                                  }`}
                                  aria-label={tooltip}
                                >
                                  {isPassed ? '●' : isFlagged ? '✗' : '⚠'}
                                </button>
                              )
                            })}
                          </div>
                        </TableCell>

                        <TableCell>
                          {(() => {
                            const isDualApproved = !!b.secondaryReviewerId || (b.officerDecision as any)?.stage === 'secondary' || b.approvalState === 'awarded'
                            const isMakerApproved = !isDualApproved && (!!b.primaryReviewerId || (b.officerDecision as any)?.stage === 'primary' || b.officerDecision?.status === 'qualified')
                            const isDisqualified = b.officerDecision?.status === 'disqualified' || b.approvalState === 'disqualified'

                            if (isDualApproved) {
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <Badge variant="success" className="font-semibold text-[11px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60">
                                    ✓ Dual-Approved (2/2)
                                  </Badge>
                                  <span className="text-[10px] text-ink-500 dark:text-cream-400 font-mono">
                                    Maker &amp; Checker Signed
                                  </span>
                                </div>
                              )
                            }

                            if (isMakerApproved) {
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <Badge variant="warning" className="font-semibold text-[11px] bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700/60">
                                    Maker Approved (1/2)
                                  </Badge>
                                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                                    Awaiting Checker Concurrence
                                  </span>
                                </div>
                              )
                            }

                            if (isDisqualified) {
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <Badge variant="danger" className="font-semibold text-[11px]">
                                    Disqualified
                                  </Badge>
                                  <span className="text-[10px] text-risk-critical">
                                    Action Recorded in Ledger
                                  </span>
                                </div>
                              )
                            }

                            return (
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="default" className="text-[11px]">
                                  Pending Review (0/2)
                                </Badge>
                                <span className="text-[10px] text-ink-400">
                                  Ready for Initial Triage
                                </span>
                              </div>
                            )
                          })()}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openBidder(b.id)
                            }}
                            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                          >
                            Open Drawer
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ─── View 2: Cartel Network Graph View ───────────────────────── */}
      {viewMode === 'graph' && (
        <div className="flex flex-col gap-4">
          {/* PII Reveal Toggle */}
          <div className="flex items-center justify-between p-3 bg-paper rounded-lg border border-line">
            <div className="text-small text-ink-700">
              <span className="font-semibold">Identity Protection: </span>
              {piiGraphRevealed
                ? 'Company names are visible. Audit action recorded.'
                : 'Company names masked as Bidder-XXXX. Click Reveal to expose.'}
            </div>
            <Button
              variant={piiGraphRevealed ? 'destructive' : 'secondary'}
              size="sm"
              leftIcon={piiGraphRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              onClick={() => setPiiGraphRevealed((v) => !v)}
            >
              {piiGraphRevealed ? 'Mask Identities' : 'Reveal Identities'}
            </Button>
          </div>

          {(() => {
            const activeCluster = collusionData?.clusters?.[0] || {
              bidderIds: ['bidder-c1', 'bidder-c2', 'bidder-c3'],
              signalsFired: [
                'shared_director_pan',
                'shared_address',
                'sequential_pan_issuance',
                'sequential_submissions',
                'price_clustering',
              ],
              aggregateScore: 0.85,
              pairs: [],
            }

            const collusionWeights = rulesData?.config?.collusion?.weights || {
              sharedDirectorPan: 0.25,
              sharedAddress: 0.15,
              sequentialPanIssuance: 0.10,
              sequentialSubmissions: 0.15,
              priceClustering: 0.20,
              identicalTemplates: 0.15,
            }
            const threshold = rulesData?.config?.collusion?.threshold ?? 0.60
            const aggregateScore = activeCluster.aggregateScore ?? 0.85
            const isFlagged = aggregateScore >= threshold

            const signalsList = [
              {
                id: 'shared_director_pan',
                name: 'Shared director PAN',
                weight: collusionWeights.sharedDirectorPan ?? 0.25,
                fired: activeCluster.signalsFired.includes('shared_director_pan'),
              },
              {
                id: 'shared_address',
                name: 'Address similarity ≥ 0.90',
                weight: collusionWeights.sharedAddress ?? 0.15,
                fired: activeCluster.signalsFired.includes('shared_address'),
              },
              {
                id: 'sequential_pan_issuance',
                name: 'Sequential PAN issuance (<30d)',
                weight: collusionWeights.sequentialPanIssuance ?? 0.10,
                fired: activeCluster.signalsFired.includes('sequential_pan_issuance'),
              },
              {
                id: 'sequential_submissions',
                name: 'Sequential submissions (<120s)',
                weight: collusionWeights.sequentialSubmissions ?? 0.15,
                fired: activeCluster.signalsFired.includes('sequential_submissions'),
              },
              {
                id: 'price_clustering',
                name: 'Price CV ≤ 1.4%',
                weight: collusionWeights.priceClustering ?? 0.20,
                fired: activeCluster.signalsFired.includes('price_clustering'),
              },
              {
                id: 'identical_templates',
                name: 'Identical document templates',
                weight: collusionWeights.identicalTemplates ?? 0.15,
                fired: activeCluster.signalsFired.includes('identical_templates'),
              },
            ]

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8">
                  <CartelGraph
                    cluster={activeCluster}
                    bidders={bidders}
                    onSelectBidder={openBidder}
                    piiRevealed={piiGraphRevealed}
                  />
                </div>

                <div className="lg:col-span-4 bg-paper rounded-lg border border-line shadow-sm overflow-hidden">
                  <div
                    className="p-4 bg-cream-50 border-b border-line flex items-center justify-between cursor-pointer lg:cursor-default"
                    onClick={() => setSignalsPanelOpen((v) => !v)}
                  >
                    <div>
                      <h4 className="font-semibold text-ink-900 text-small">Signals Breakdown</h4>
                      <p className="text-micro font-mono text-ink-500 mt-0.5">
                        Cluster A · {activeCluster.bidderIds.length} bidders · Score {aggregateScore.toFixed(2)}
                      </p>
                    </div>
                    <div className="lg:hidden text-ink-500">
                      {signalsPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  <div className={`${signalsPanelOpen ? 'block' : 'hidden lg:block'} p-4`}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-small">
                        <thead>
                          <tr className="border-b border-line text-left text-micro font-mono text-ink-500">
                            <th className="pb-2 font-medium">Signal</th>
                            <th className="pb-2 font-medium text-right">Weight</th>
                            <th className="pb-2 font-medium text-center w-12">Fired</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/60">
                          {signalsList.map((sig) => (
                            <tr key={sig.id} className="hover:bg-cream-50/50">
                              <td className="py-2.5 text-ink-800 font-medium text-small leading-tight">
                                {sig.name}
                              </td>
                              <td className="py-2.5 text-right font-mono text-ink-600 text-small">
                                {sig.weight.toFixed(2)}
                              </td>
                              <td className="py-2.5 text-center">
                                {sig.fired ? (
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-risk-critical/15 text-risk-critical font-bold text-xs" title="Fired">
                                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ink-100 text-ink-400 font-bold text-xs" title="Not Fired">
                                    <X className="w-3.5 h-3.5 stroke-[2]" />
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-line font-medium">
                            <td className="pt-3 font-semibold text-ink-900">Total:</td>
                            <td className="pt-3 text-right font-mono font-bold text-ink-900">
                              {aggregateScore.toFixed(2)}
                            </td>
                            <td className="pt-3"></td>
                          </tr>
                          <tr>
                            <td className="pt-1.5 text-ink-600 text-small">Threshold:</td>
                            <td className="pt-1.5 text-right font-mono text-ink-600 text-small">
                              {threshold.toFixed(2)}
                            </td>
                            <td className="pt-1.5"></td>
                          </tr>
                          <tr className="border-t border-line/60">
                            <td className="pt-3 font-semibold text-ink-900">Verdict:</td>
                            <td className="pt-3 text-right" colSpan={2}>
                              {isFlagged ? (
                                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-risk-critical text-paper shadow-sm">
                                  FLAGGED
                                </span>
                              ) : (
                                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-risk-low text-paper shadow-sm">
                                  CLEAR
                                </span>
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="mt-4 pt-3 border-t border-line/60 flex items-start gap-1.5 text-micro text-ink-500">
                      <Sliders className="w-3.5 h-3.5 mt-0.5 text-navy-700 flex-shrink-0" />
                      <span>
                        Signal weights and threshold configurable in{' '}
                        <Link
                          to="/admin?tab=collusion"
                          className="font-semibold text-navy-700 hover:text-navy-900 underline inline-flex items-center gap-0.5"
                        >
                          Admin → Rules Configurator → Collusion tab
                          <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                        </Link>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ─── View 3: Tender Ledger View (Fix 23) ────────────────────── */}
      {viewMode === 'ledger' && (
        <div className="flex flex-col gap-4">
          {/* Filter Bar */}
          <div className="p-4 bg-paper rounded-lg border border-line shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-small font-semibold text-ink-700 flex items-center gap-1.5 mr-1">
                <Filter className="w-4 h-4 text-ink-500" /> Filter Ledger:
              </span>
              <select
                value={ledgerActorFilter}
                onChange={(e) => setLedgerActorFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded border border-line bg-paper text-small font-medium text-ink-700 focus:outline-none"
              >
                <option value="all">All Actors</option>
                <option value="officer">Officer</option>
                <option value="admin">Admin</option>
                <option value="bidder">Bidder</option>
                <option value="system">System</option>
              </select>

              <select
                value={ledgerActionFilter}
                onChange={(e) => setLedgerActionFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded border border-line bg-paper text-small font-medium text-ink-700 focus:outline-none"
              >
                <option value="all">All Actions</option>
                <option value="verification_run">Verification Run</option>
                <option value="primary_decision">Primary Decision</option>
                <option value="fee_paid">Fee Paid</option>
                <option value="collusion_analysis_run">Collusion Analysis</option>
                <option value="document_uploaded">Document Uploaded</option>
                <option value="award_created">Award Created</option>
              </select>

              <select
                value={ledgerBidderFilter}
                onChange={(e) => setLedgerBidderFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded border border-line bg-paper text-small font-medium text-ink-700 focus:outline-none max-w-xs truncate"
              >
                <option value="all">All Bidders</option>
                {bidders.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-micro font-mono text-ink-500">
              Showing {filteredTenderLedger.length} of {tenderLedger.length} entries
            </div>
          </div>

          {/* Ledger List */}
          {isLedgerLoading ? (
            <div className="p-6 bg-paper rounded-lg border border-line flex flex-col gap-3">
              <Skeleton variant="text" className="w-1/4 h-6" />
              <Skeleton variant="tableRow" />
              <Skeleton variant="tableRow" />
              <Skeleton variant="tableRow" />
            </div>
          ) : filteredTenderLedger.length === 0 ? (
            <EmptyState
              title="No ledger events found"
              description="No cryptographic ledger records match your active filters for this tender."
              icon={<Shield className="w-8 h-8 text-ink-400" />}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredTenderLedger.map((entry) => (
                <LedgerEntryRow
                  key={entry.id}
                  entry={entry}
                  showBidderContext={true}
                  showTenderContext={false}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Bidder Detail Drawer ────────────────────────────────────── */}
      <BidderDetailDrawer
        bidderId={selectedBidderId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onDecisionSubmitted={() => refetchBidders()}
        initialTab={drawerInitialTab}
        expandedCheckCategory={drawerExpandedCheck}
      />

      {/* ─── Award Tender Modal ───────────────────────────────────────── */}
      <AwardTenderModal
        isOpen={isAwardModalOpen}
        onClose={() => setIsAwardModalOpen(false)}
        tenderId={tenderId!}
        tenderTitle={tender?.title || 'Tender'}
        bidders={bidders}
      />

      {/* ─── Second Approval / Counter-Sign Modal ───────────────────────── */}
      <Modal
        isOpen={isSecondApprovalModalOpen}
        onClose={() => setIsSecondApprovalModalOpen(false)}
        title="Counter-Sign Tender Award"
        description={`Secondary Concurrence for ${tender?.title || 'Tender'}`}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsSecondApprovalModalOpen(false)}
              disabled={secondApprovalMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-2"
              leftIcon={<ShieldCheck className="w-4 h-4" />}
              isLoading={secondApprovalMutation.isPending}
              disabled={secondApprovalMutation.isPending}
              onClick={() => secondApprovalMutation.mutate()}
              id="confirm-counter-sign-btn"
            >
              Confirm Concurrence & Finalize Award
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 text-small">
          <div className="p-3 bg-cream-50 rounded-lg border border-line flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <span className="text-micro text-ink-500 font-medium uppercase tracking-wider">Designated Winning Bidder</span>
              <p className="text-body font-bold text-navy-900">
                {awardData?.winningBidder?.companyName || awardData?.winningBidderId}
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-paper rounded-lg border border-line flex flex-col gap-2">
            <div className="flex items-center justify-between text-micro text-ink-500">
              <span>Primary Reviewer: <strong>{awardData?.primaryOfficerId === 'user-officer-001' ? 'Priya Sharma (Officer 1)' : awardData?.primaryOfficerId}</strong></span>
              <span>Submitted: {awardData?.submittedAt ? formatDateTime(awardData.submittedAt) : '—'}</span>
            </div>
            <div className="mt-1">
              <span className="text-micro font-semibold text-ink-700">Accountability Statement:</span>
              <p className="text-small text-ink-800 italic bg-cream-50 p-2.5 rounded border border-line mt-1">
                "{awardData?.justification}"
              </p>
            </div>

            {awardData?.standoutFactors && awardData.standoutFactors.length > 0 && (
              <div className="mt-2">
                <span className="text-micro font-semibold text-ink-700">Standout Factors Evaluated:</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                  {awardData.standoutFactors.map((f, i) => (
                    <div key={i} className="p-2 bg-cream-50 rounded border border-line text-micro">
                      <strong className="text-navy-900">{f.factor}</strong>
                      <p className="text-ink-600 mt-0.5">{f.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Regulatory Declaration */}
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-micro text-emerald-900 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Statutory GeM Dual-Officer Attestation</span>
            </div>
            <p className="leading-relaxed">
              By counter-signing, you certify as Secondary Officer (Checker) that you have independently reviewed the statutory compliance records, cartel detection signals, and qualification findings for this bidder.
            </p>
            <p className="font-mono text-[11px] text-emerald-800 mt-0.5">
              Action will permanently commit an <code className="bg-emerald-100 px-1 py-0.5 rounded font-bold">award_decision_secondary</code> entry to the immutable ledger.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
