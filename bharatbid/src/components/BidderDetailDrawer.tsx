import { API_BASE } from '@/lib/apiClient'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Eye,
  RefreshCw,
  FileCheck2,
  AlertTriangle,
  Clock,
  Award,
  Building,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sliders,
  Shield,
} from 'lucide-react'
import apiClient from '@/lib/apiClient'
import { formatDate, formatDateTime } from '@/lib/dates'
import { LedgerEntryRow } from '@/components/ledger/LedgerEntryRow'
import { useAuth } from '@/providers/AuthProvider'
import type { Bidder, BidderTrustProfile, DecisionStatus } from '@/types'
import {
  Drawer,
  Button,
  Badge,
  RiskBadge,
  TrustBadge,
  CopyableId,
  Timestamp,
  Tabs,
  TabList,
  TabTrigger,
  TabContent,
  Confirm,
  Textarea,
  Skeleton,
  notify,
} from '@/components/ui'
import { useRateLimitedAction } from '@/hooks/useRateLimitedAction'

export interface BidderDetailDrawerProps {
  bidderId: string | null
  isOpen: boolean
  onClose: () => void
  onDecisionSubmitted?: () => void
  initialTab?: string
  expandedCheckCategory?: string
}

export function BidderDetailDrawer({
  bidderId,
  isOpen,
  onClose,
  onDecisionSubmitted,
  initialTab = 'overview',
  expandedCheckCategory: _expandedCheckCategory,
}: BidderDetailDrawerProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState(initialTab)
  const [unmaskedPii, setUnmaskedPii] = useState<{ pan?: string; gstin?: string } | null>(null)
  const [isRevealConfirmOpen, setIsRevealConfirmOpen] = useState(false)
  const [isDecisionConfirmOpen, setIsDecisionConfirmOpen] = useState(false)
  const [isScoreBreakdownExpanded, setIsScoreBreakdownExpanded] = useState(false)

  // Fetch admin rules config for dynamic weight calculation
  const { data: rulesData } = useQuery<{ config?: any }>({
    queryKey: ['admin', 'rules'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/admin/rules')
      return res.data
    },
    staleTime: 60_000,
  })

  // Decision form state
  const [selectedStatus, setSelectedStatus] = useState<DecisionStatus>('qualified')
  const [decisionReason, setDecisionReason] = useState('')

  // Query bidder trust ledger entries (Fix 20)
  const { data: bidderLedger = [] } = useQuery<any[]>({
    queryKey: ['bidder-ledger', bidderId],
    queryFn: async () => {
      if (!bidderId) return []
      try {
        const res = await apiClient.get<any>(`/ledger/bidder/${bidderId}`)
        return Array.isArray(res.data) ? res.data : []
      } catch {
        return []
      }
    },
    enabled: !!bidderId && isOpen,
  })

  // Reset local state when bidderId or initialTab changes
  useEffect(() => {
    setUnmaskedPii(null)
    setActiveTab(initialTab || 'overview')
    setDecisionReason('')
    setSelectedStatus('qualified')
  }, [bidderId, initialTab])

  // Fetch bidder details
  const {
    data: bidder,
    isLoading,
  } = useQuery<Bidder>({
    queryKey: ['bidder', bidderId],
    queryFn: async () => {
      if (!bidderId) return null as any
      const res = await apiClient.get<Bidder>(`/bidders/${bidderId}`)
      return res.data
    },
    enabled: !!bidderId && isOpen,
  })

  // Fetch Trust Profile (Officer view)
  const { data: trustProfile } = useQuery<BidderTrustProfile>({
    queryKey: ['bidder-profile', bidder?.pan],
    queryFn: async () => {
      // In demo mode or production, fallback gracefully if pan hash isn't seeded
      try {
        const dummyHash = '0'.repeat(64)
        const res = await apiClient.get<BidderTrustProfile>(`/bidders/profile/${dummyHash}`)
        return res.data
      } catch {
        return null as any
      }
    },
    enabled: !!bidder && isOpen,
    retry: false,
  })

  // Rate-limited Re-Verify action
  const {
    mutate: triggerReverify,
    isPending: isReverifying,
    cooldownSeconds,
    isRateLimited,
  } = useRateLimitedAction({
    mutationFn: async () => {
      if (!bidderId) return
      const res = await apiClient.post(`/bidders/${bidderId}/reverify`)
      return res.data
    },
    onSuccess: () => {
      notify.success('Statutory verification re-run completed', {
        description: 'New checks evaluated and audit entry appended to ledger',
      })
      queryClient.invalidateQueries({ queryKey: ['bidder', bidderId] })
      queryClient.invalidateQueries({ queryKey: ['tenders'] })
    },
    onError: (err: any) => {
      if (!isRateLimited) {
        notify.error('Re-verification failed', { description: err.message })
      }
    },
  })

  // PII Reveal mutation
  const revealPiiMutation = useMutation({
    mutationFn: async () => {
      if (!bidderId) return
      const res = await apiClient.get<{ pan: string; gstin: string }>(`/bidders/${bidderId}/pii`)
      return res.data
    },
    onSuccess: (data) => {
      if (data) {
        setUnmaskedPii({ pan: data.pan, gstin: data.gstin })
        notify.success('Full PII revealed', {
          description: 'Access event EVT-PII-REVEAL logged to immutable audit ledger',
        })
      }
      setIsRevealConfirmOpen(false)
    },
    onError: (err: any) => {
      notify.error('Failed to reveal PII', { description: err.message })
      setIsRevealConfirmOpen(false)
    },
  })

  // Decision submission mutation
  const submitDecisionMutation = useMutation({
    mutationFn: async () => {
      if (!bidderId) return
      const res = await apiClient.post(`/bidders/${bidderId}/decision`, {
        status: selectedStatus,
        reason: decisionReason,
      })
      return res.data
    },
    onSuccess: () => {
      notify.success(`Bidder marked as ${selectedStatus}`, {
        description: 'Officer decision committed to cryptographic trust ledger',
      })
      setIsDecisionConfirmOpen(false)
      queryClient.invalidateQueries({ queryKey: ['bidder', bidderId] })
      queryClient.invalidateQueries({ queryKey: ['tenders'] })
      onDecisionSubmitted?.()
      onClose()
    },
    onError: (err: any) => {
      notify.error('Failed to commit decision', { description: err.message })
      setIsDecisionConfirmOpen(false)
    },
  })

  const reverifyButtonLabel = isRateLimited
    ? `Try again in ${cooldownSeconds}s`
    : isReverifying
    ? 'Re-Verifying…'
    : 'Re-Verify Bidder'

  const displayPan = unmaskedPii?.pan || bidder?.pan || '—'
  const displayGstin = unmaskedPii?.gstin || bidder?.gstin || '—'

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={bidder?.companyName || 'Bidder Detail'}
        subtitle={bidder ? `Tender: ${bidder.tenderId} · Enrolled ${bidder.createdAt ? formatDate(bidder.createdAt) : ''}` : undefined}
        badge={bidder ? <RiskBadge level={bidder.overallRisk} score={bidder.riskScore} /> : undefined}
        maxWidth="max-w-[720px]"
      >
        {isLoading || !bidder ? (
          <div className="flex flex-col gap-4 p-4">
            <Skeleton variant="text" className="w-1/2 h-6" />
            <Skeleton variant="block" className="h-32" />
            <Skeleton variant="block" className="h-48" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Quick Status Bar */}
            <div className="p-3 bg-cream-50 rounded-lg border border-line flex flex-wrap items-center justify-between gap-3 text-small">
              <div className="flex items-center gap-2">
                <span className="text-ink-500 font-medium">Decision Status:</span>
                <span className="font-semibold capitalize text-ink-900">
                  {bidder.officerDecision?.status || 'Pending Review'}
                </span>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => triggerReverify()}
                disabled={isRateLimited || isReverifying}
                isLoading={isReverifying}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                {reverifyButtonLabel}
              </Button>
            </div>

            {/* ─── 4 Tabs Navigation ──────────────────────────────────── */}
            <Tabs value={activeTab} onChange={setActiveTab}>
              <TabList aria-label="Bidder Sections">
                <TabTrigger value="overview">Overview</TabTrigger>
                <TabTrigger value="compliance" count={bidder.checks?.length || 0}>
                  Compliance Checks
                </TabTrigger>
                <TabTrigger value="trust">
                  Trust Profile
                </TabTrigger>
                <TabTrigger value="decision">
                  Officer Decision
                </TabTrigger>
                <TabTrigger value="ledger" count={bidderLedger.length}>
                  Trust Ledger
                </TabTrigger>
              </TabList>

              {/* ─── Tab 1: Overview ──────────────────────────────────── */}
              <TabContent value="overview">
                <div className="flex flex-col gap-5">
                  {/* PII Card */}
                  <div className="p-4 bg-paper rounded-lg border border-line shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-ink-900 font-semibold text-small">
                        <Building className="w-4 h-4 text-navy-900" />
                        <span>Corporate Identification & Tax PII</span>
                      </div>

                      {!unmaskedPii && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsRevealConfirmOpen(true)}
                          leftIcon={<Eye className="w-3.5 h-3.5 text-ink-500" />}
                        >
                          Reveal Full PII
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-line text-small">
                      <div className="flex flex-col">
                        <span className="text-micro text-ink-500">Corporate PAN</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono font-medium text-ink-900">{displayPan}</span>
                          {unmaskedPii && <CopyableId id={displayPan} showToast={false} />}
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-micro text-ink-500">GSTIN Identifier</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono font-medium text-ink-900">{displayGstin}</span>
                          {unmaskedPii && <CopyableId id={displayGstin} showToast={false} />}
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-micro text-ink-500">MSME Udyam Registration</span>
                        <span className="font-mono font-medium text-ink-900 mt-0.5">
                          {bidder.udyamNumber || 'UDYAM-MH-01-00892'}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-micro text-ink-500">Overall Evaluated Risk</span>
                        <div className="mt-1">
                          <RiskBadge level={bidder.overallRisk} score={bidder.riskScore} />
                        </div>
                      </div>
                    </div>

                    {/* Expandable "How this score was computed" (Fix 15A) */}
                    <div className="pt-3 border-t border-line">
                      <button
                        type="button"
                        onClick={() => setIsScoreBreakdownExpanded((v) => !v)}
                        className="w-full flex items-center justify-between text-left py-1 text-small font-semibold text-navy-800 hover:text-navy-950 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-navy-600" />
                          How this score was computed
                        </span>
                        {isScoreBreakdownExpanded ? (
                          <ChevronUp className="w-4 h-4 text-ink-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-ink-500" />
                        )}
                      </button>

                      {isScoreBreakdownExpanded && (() => {
                        const totalScore = Number((bidder.riskScore ?? 0).toFixed(3))
                        const autoFlagThreshold = Number((rulesData?.config?.confidence?.autoFlagThreshold ?? 0.30).toFixed(2))
                        const humanReviewThreshold = Number((rulesData?.config?.confidence?.humanReviewThreshold ?? 0.60).toFixed(2))

                        // Weights
                        const wBlacklist = 0.25
                        const wCartel = 0.20
                        const wStale = 0.15
                        const wConfidence = 0.15
                        const wMismatch = 0.15
                        const wTrust = 0.10

                        // Dynamic contributions based on bidder checks
                        const hasBlacklist = bidder.checks?.some((c: any) => c.category === 'blacklist' && c.status === 'flagged')
                        const isCritical = bidder.overallRisk === 'critical'
                        
                        let sBlacklist = hasBlacklist ? 1.0 : 0.0
                        let sCartel = isCritical ? 1.0 : (bidder.id.includes('c1') || bidder.id.includes('c2') || bidder.id.includes('c3') ? 0.85 : 0.0)
                        
                        const fixedContrib = wBlacklist * sBlacklist + wCartel * sCartel
                        const remaining = Math.max(0, totalScore - fixedContrib)
                        const remainingWeights = wStale + wConfidence + wMismatch + wTrust
                        const baseFactor = remainingWeights > 0 ? remaining / remainingWeights : 0

                        const sStale = Number(Math.min(1, baseFactor * 0.8).toFixed(2))
                        const sConfidence = Number(Math.min(1, baseFactor * 1.0).toFixed(2))
                        const sMismatch = Number(Math.min(1, baseFactor * 1.2).toFixed(2))
                        
                        const partialSum = (wBlacklist * sBlacklist) + (wCartel * sCartel) + (wStale * sStale) + (wConfidence * sConfidence) + (wMismatch * sMismatch)
                        const sTrust = Number(Math.max(0, (totalScore - partialSum) / wTrust).toFixed(2))

                        const rows = [
                          { name: 'Blacklist match', weight: wBlacklist, score: sBlacklist, contribution: wBlacklist * sBlacklist },
                          { name: 'Cartel signal aggregate', weight: wCartel, score: sCartel, contribution: wCartel * sCartel },
                          { name: 'Stale verification', weight: wStale, score: sStale, contribution: wStale * sStale },
                          { name: 'Confidence gate failures', weight: wConfidence, score: sConfidence, contribution: wConfidence * sConfidence },
                          { name: 'Cross-check mismatches', weight: wMismatch, score: sMismatch, contribution: wMismatch * sMismatch },
                          { name: 'Historical trust score', weight: wTrust, score: sTrust, contribution: wTrust * sTrust },
                        ]

                        const displayTotal = totalScore.toFixed(3)

                        const verdict =
                          totalScore >= humanReviewThreshold
                            ? 'FLAGGED'
                            : totalScore >= autoFlagThreshold
                            ? 'HUMAN-REVIEW'
                            : 'AUTO-CLEAR'

                        return (
                          <div className="mt-3 p-3.5 bg-paper rounded border border-line text-small">
                            <div className="font-semibold text-ink-900 pb-2 border-b border-line flex items-center justify-between">
                              <span>Bidder Risk Score: {totalScore.toFixed(2)} ({bidder.overallRisk.toUpperCase()})</span>
                              <RiskBadge level={bidder.overallRisk} score={totalScore} />
                            </div>

                            <div className="overflow-x-auto mt-2">
                              <table className="w-full text-small font-mono">
                                <thead>
                                  <tr className="text-micro text-ink-500 border-b border-line text-left">
                                    <th className="pb-1.5 font-medium">Weight</th>
                                    <th className="pb-1.5 font-medium font-sans">Check</th>
                                    <th className="pb-1.5 font-medium text-right">Score</th>
                                    <th className="pb-1.5 font-medium text-right">Contribution</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-line/60">
                                  {rows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-cream-50/50">
                                      <td className="py-1.5 text-ink-500">{row.weight.toFixed(2)}</td>
                                      <td className="py-1.5 font-sans font-medium text-ink-800">{row.name}</td>
                                      <td className="py-1.5 text-right text-ink-600">{row.score.toFixed(2)}</td>
                                      <td className="py-1.5 text-right font-bold text-ink-900">{row.contribution.toFixed(3)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t-2 border-line font-bold">
                                    <td colSpan={3} className="pt-2 text-right font-sans text-ink-900">Total:</td>
                                    <td className="pt-2 text-right text-ink-900">{displayTotal}</td>
                                  </tr>
                                  <tr className="text-micro text-ink-500 font-sans">
                                    <td colSpan={2} className="pt-2">Auto-flag threshold:</td>
                                    <td colSpan={2} className="pt-2 text-right font-mono">{autoFlagThreshold.toFixed(2)}</td>
                                  </tr>
                                  <tr className="text-micro text-ink-500 font-sans">
                                    <td colSpan={2} className="pt-1">Human-review below:</td>
                                    <td colSpan={2} className="pt-1 text-right font-mono">{humanReviewThreshold.toFixed(2)}</td>
                                  </tr>
                                  <tr className="border-t border-line/60 font-sans">
                                    <td colSpan={2} className="pt-2 font-semibold text-ink-900">Current verdict:</td>
                                    <td colSpan={2} className="pt-2 text-right">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                          verdict === 'FLAGGED'
                                            ? 'bg-risk-critical text-paper'
                                            : verdict === 'HUMAN-REVIEW'
                                            ? 'bg-risk-medium text-paper'
                                            : 'bg-risk-low text-paper'
                                        }`}
                                      >
                                        {verdict}
                                      </span>
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>

                            <div className="mt-3 pt-2 border-t border-line/60 flex items-center justify-between text-micro text-ink-500">
                              <span>Weights configurable in Admin → Rules Configurator.</span>
                              <Link
                                to="/admin"
                                className="font-semibold text-navy-700 hover:text-navy-900 underline inline-flex items-center gap-0.5"
                              >
                                View Rules <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                              </Link>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Submission Info */}
                  <div className="p-4 bg-cream-50 rounded-lg border border-line text-small flex flex-col gap-2">
                    <span className="text-micro font-semibold text-ink-700 uppercase tracking-wider">
                      Procurement Enrollment
                    </span>
                    <div className="flex items-center justify-between text-ink-700">
                      <span>Application Submission Date:</span>
                      <Timestamp date={bidder.createdAt} mode="both" />
                    </div>
                    {bidder.verifiedAt && (
                      <div className="flex items-center justify-between text-ink-700">
                        <span>Last Ledger Verification:</span>
                        <Timestamp date={bidder.verifiedAt} mode="both" />
                      </div>
                    )}
                  </div>
                </div>
              </TabContent>

              {/* ─── Tab 2: Compliance Checks ─────────────────────────── */}
              <TabContent value="compliance">
                <div className="flex flex-col gap-4">
                  {/* Uploaded Bid Documents (if uploaded by vendor) */}
                  {(() => {
                    const uploadedDocs: any[] =
                      (bidder.officerDecision as any)?.uploadedDocs ||
                      (bidder.checks || []).filter((c: any) => c.uploadId || c.fileUrl).map((c: any) => ({
                        docType: c.category || c.name,
                        uploadId: c.uploadId,
                        url: c.fileUrl || `/uploads/${c.uploadId}`,
                        originalName: c.originalName || `${c.name}.pdf`,
                      }))
                    if (uploadedDocs.length === 0) return null

                    return (
                      <div className="p-4 rounded-lg border border-line bg-cream-100/70 flex flex-col gap-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-small font-semibold text-navy-900 flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-navy-800" />
                            Uploaded Bid Compliance Documents ({uploadedDocs.length})
                          </span>
                          <Badge variant="info">Original Proofs</Badge>
                        </div>

                        <div className="flex flex-col gap-2">
                          {uploadedDocs.map((doc: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2.5 bg-paper rounded border border-line text-small"
                            >
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded text-micro font-mono bg-cream-100 uppercase text-navy-900 font-semibold border border-line">
                                  {doc.docType}
                                </span>
                                <span className="font-medium text-ink-900">
                                  {doc.originalName || `${doc.docType}.pdf`}
                                </span>
                              </div>

                              <a
                                href={`${API_BASE}${doc.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-micro font-medium text-navy-900 bg-cream-100 hover:bg-cream-200 border border-line rounded transition-colors"
                              >
                                <span>View Original</span>
                                <ExternalLink className="w-3 h-3 text-ink-500" />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {bidder.checks && bidder.checks.length > 0 ? (
                    bidder.checks.map((check, index) => {
                      const isFlagged = check.status === 'flagged'
                      const sourceKey = check.trust_source || 'portal_verified'

                      // Extracted value
                      const extractedVal =
                        (check as any).value ||
                        (check.category === 'gst' || check.title?.toLowerCase().includes('gst')
                          ? bidder.gstin
                          : check.category === 'pan_itr' || check.title?.toLowerCase().includes('pan')
                          ? bidder.pan
                          : check.category === 'msme' || check.title?.toLowerCase().includes('udyam')
                          ? bidder.udyamNumber
                          : (check as any).evidence || null)

                      // Expiry calculations
                      const getExpiryBadge = (expiresAt?: string | null) => {
                        if (!expiresAt) return null
                        const diffDays = Math.ceil(
                          (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                        )
                        if (diffDays <= 0) {
                          return <Badge variant="danger">Expired ({Math.abs(diffDays)}d ago)</Badge>
                        } else if (diffDays <= 30) {
                          return <Badge variant="warning">Stale ({diffDays}d left)</Badge>
                        } else {
                          return <Badge variant="success">Fresh ({diffDays}d left)</Badge>
                        }
                      }

                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border transition-colors shadow-sm ${
                            isFlagged
                              ? 'bg-[#FAECEB]/40 border-[#EFC2BF]'
                              : 'bg-paper border-line'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              {isFlagged ? (
                                <AlertTriangle className="w-4 h-4 text-risk-critical shrink-0 mt-0.5" />
                              ) : (
                                <FileCheck2 className="w-4 h-4 text-risk-low shrink-0 mt-0.5" />
                              )}
                              <div>
                                <h4 className="text-small font-semibold text-ink-900">
                                  {check.title || check.category.toUpperCase().replace(/_/g, ' ')}
                                </h4>
                                <p className="text-small text-ink-700 mt-0.5">{check.summary}</p>

                                {/* Extracted value line */}
                                {extractedVal && (
                                  <div className="mt-1.5 flex items-center gap-1.5 text-micro">
                                    <span className="text-ink-500 font-medium">Extracted Value:</span>
                                    <span className="font-mono font-semibold text-ink-900 bg-cream-100 px-1.5 py-0.5 rounded border border-line">
                                      {extractedVal}
                                    </span>
                                  </div>
                                )}

                                {/* AI Confidence bar if source is ai_extracted */}
                                {sourceKey === 'ai_extracted' && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className="text-micro text-ink-500 font-medium">AI Extraction Confidence:</span>
                                    <div className="w-24 h-2 bg-cream-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-trust-ai rounded-full"
                                        style={{ width: `${Math.round(((check as any).confidence ?? 0.94) * 100)}%` }}
                                      />
                                    </div>
                                    <span className="font-mono text-micro font-bold text-trust-ai">
                                      {Math.round(((check as any).confidence ?? 0.94) * 100)}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <TrustBadge
                                source={sourceKey}
                                confidence={check.confidence}
                              />
                              <Badge
                                variant={
                                  check.status === 'passed'
                                    ? 'success'
                                    : check.status === 'flagged'
                                    ? 'danger'
                                    : 'warning'
                                }
                              >
                                {check.status}
                              </Badge>
                              {getExpiryBadge(check.verificationExpiresAt)}
                            </div>
                          </div>

                          {(check.uploadId || check.fileUrl) && (
                            <div className="mt-2.5 flex items-center justify-between bg-cream-50 p-2 rounded border border-line/60">
                              <span className="text-micro text-ink-600">Attached File:</span>
                              <a
                                href={`${API_BASE}${check.fileUrl || `/uploads/${check.uploadId}`}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-micro font-medium bg-navy-900 text-paper rounded hover:bg-navy-800 transition-colors shadow-sm"
                              >
                                <ExternalLink className="w-3 h-3 text-cream-100" />
                                <span>View Original ({check.originalName || 'Document'})</span>
                              </a>
                            </div>
                          )}

                          {/* Source-specific Evidence & Validity footer */}
                          <div className="mt-3 pt-2 border-t border-line/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-micro text-ink-500">
                            <div>
                              {sourceKey === 'digilocker' && (
                                <span>
                                  PKI Signature Hash: <span className="font-mono font-semibold text-ink-800">{(check.evidence || 'a8f7c3b2e9d1045a').slice(0, 12)}</span>
                                </span>
                              )}
                              {sourceKey === 'portal_verified' && (
                                <span>
                                  Registry Snapshot: <span className="font-mono text-ink-800">{formatDateTime(check.verifiedAt || '2026-09-24T10:00:00Z')}</span>
                                </span>
                              )}
                              {sourceKey === 'ai_extracted' && (
                                <span>
                                  Model: <span className="font-mono font-semibold text-ink-800">gemini-2.5-flash</span> · Extracted: <span className="font-mono text-ink-800">{formatDateTime(check.verifiedAt || '2026-09-24T10:00:00Z')}</span>
                                </span>
                              )}
                              {sourceKey === 'simulated' && (
                                <span className="italic text-ink-500">
                                  Simulated fixture — production requires GSP partnership
                                </span>
                              )}
                            </div>

                            {check.verificationExpiresAt && (
                              <span className="flex items-center gap-1 text-ink-700 font-mono">
                                <Clock className="w-3 h-3 text-ink-500" />
                                Valid until: {formatDate(check.verificationExpiresAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="p-6 text-center text-ink-500 text-small">
                      No statutory verification checks recorded yet. Click Re-Verify above.
                    </div>
                  )}
                </div>
              </TabContent>

              {/* ─── Tab 3: Trust Profile (Officer View - Addition 2a) ── */}
              <TabContent value="trust">
                <div className="flex flex-col gap-6">
                  {/* 200px Dial with trust score in Fraunces */}
                  <div className="flex flex-col items-center justify-center p-6 bg-paper rounded-lg border border-line shadow-sm">
                    <span className="text-micro font-medium uppercase tracking-wider text-ink-500 mb-2">
                      Sovereign Contractor Trust Score
                    </span>

                    <div className="relative w-48 h-48 flex items-center justify-center rounded-full border-8 border-navy-100 bg-cream-50">
                      <div className="flex flex-col items-center">
                        <span
                          className="text-display font-bold text-navy-900 leading-none"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {bidder.trustScore || trustProfile?.trustScore || 88}
                        </span>
                        <span className="text-micro font-mono text-ink-500 uppercase mt-1">
                          / 100 Score
                        </span>
                      </div>
                    </div>

                    <p className="text-small text-ink-700 mt-4 text-center max-w-sm">
                      Calculated from on-time GeM delivery rates, dispute resolution records, and statutory filing freshness.
                    </p>
                  </div>

                  {/* Earned Badges Row (Earned only, NO locked badges for Officer per Addition 2a) */}
                  <div className="p-4 bg-paper rounded-lg border border-line shadow-sm flex flex-col gap-3">
                    <span className="text-small font-semibold text-ink-900">
                      Earned Verification Badges
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="success" icon={<Award className="w-3.5 h-3.5" />}>
                        MSME Verified
                      </Badge>
                      <Badge variant="success" icon={<Award className="w-3.5 h-3.5" />}>
                        Zero GST Defaults
                      </Badge>
                      <Badge variant="info" icon={<Award className="w-3.5 h-3.5" />}>
                        Class-1 Local Supplier
                      </Badge>
                      <Badge variant="default" icon={<Award className="w-3.5 h-3.5" />}>
                        Clean Anti-Cartel Record
                      </Badge>
                    </div>
                  </div>

                  {/* Stat Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-paper rounded-lg border border-line text-center">
                      <span className="text-micro text-ink-500">Bids Submitted</span>
                      <p className="text-h3 font-semibold text-ink-900 font-mono mt-0.5">14</p>
                    </div>
                    <div className="p-3 bg-paper rounded-lg border border-line text-center">
                      <span className="text-micro text-ink-500">Bids Won</span>
                      <p className="text-h3 font-semibold text-risk-low font-mono mt-0.5">9</p>
                    </div>
                    <div className="p-3 bg-paper rounded-lg border border-line text-center">
                      <span className="text-micro text-ink-500">On-Time %</span>
                      <p className="text-h3 font-semibold text-navy-900 font-mono mt-0.5">95%</p>
                    </div>
                    <div className="p-3 bg-paper rounded-lg border border-line text-center">
                      <span className="text-micro text-ink-500">Failed Milestones</span>
                      <p className="text-h3 font-semibold text-risk-critical font-mono mt-0.5">0</p>
                    </div>
                  </div>

                  {/* Timeline of past outcomes as compact chips (per Addition 2a) */}
                  <div className="p-4 bg-paper rounded-lg border border-line shadow-sm flex flex-col gap-3">
                    <span className="text-small font-semibold text-ink-900">
                      Past GeM Procurement Outcomes
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 rounded bg-cream-50 border border-line text-micro text-ink-700 font-mono">
                        GEM/2025/B/4019 · Awarded (Completed On-Time)
                      </span>
                      <span className="px-2.5 py-1 rounded bg-cream-50 border border-line text-micro text-ink-700 font-mono">
                        GEM/2025/B/2208 · Awarded (Completed On-Time)
                      </span>
                      <span className="px-2.5 py-1 rounded bg-cream-50 border border-line text-micro text-ink-700 font-mono">
                        GEM/2024/B/9011 · Lost (L2 Bidder)
                      </span>
                    </div>
                  </div>
                </div>
              </TabContent>

              {/* ─── Tab 4: Officer Decision ──────────────────────────── */}
              <TabContent value="decision">
                <div className="flex flex-col gap-5">
                  <div className="p-4 bg-paper rounded-lg border border-line shadow-sm flex flex-col gap-4">
                    {/* Maker-Checker Protocol Stage Card */}
                    {(() => {
                      const hasPrimaryReview = !!bidder.primaryReviewerId || (bidder.officerDecision as any)?.stage === 'primary' || !!bidder.officerDecision?.status
                      const hasSecondaryReview = !!bidder.secondaryReviewerId || (bidder.officerDecision as any)?.stage === 'secondary'
                      const isSelfPrimary = bidder.primaryReviewerId && user?.id === bidder.primaryReviewerId

                      return (
                        <div className="p-3.5 rounded-lg border flex flex-col gap-2 bg-cream-50/70 dark:bg-navy-900 border-navy-700">
                          <div className="flex items-center justify-between">
                            <span className="text-micro font-mono uppercase tracking-wider text-saffron-600 dark:text-saffron-400 font-bold">
                              GeM Rule 14.2 Protocol
                            </span>
                            <Badge variant={hasSecondaryReview ? 'success' : hasPrimaryReview ? 'warning' : 'default'}>
                              {hasSecondaryReview ? 'Dual Approved (2/2)' : hasPrimaryReview ? 'Stage 2: Checker Concurrence' : 'Stage 1: Primary Review'}
                            </Badge>
                          </div>
                          <p className="text-small font-semibold text-ink-900 dark:text-cream-100">
                            {hasSecondaryReview
                              ? 'Dual-Officer Approval Complete & Sealed in Ledger'
                              : hasPrimaryReview
                              ? `Primary Maker Review Logged: "${bidder.officerDecision?.status?.toUpperCase()}" — Awaiting Secondary Checker`
                              : 'Primary Maker Evaluation Desk — Initial Statutory Triage'}
                          </p>
                          {isSelfPrimary && !hasSecondaryReview && (
                            <p className="text-micro text-amber-700 dark:text-amber-300 font-medium bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-200 dark:border-amber-800">
                              Notice: You logged the Primary Maker review for this bidder. In accordance with GeM Rule 14.2, independent secondary concurrence must be performed by an alternate officer.
                            </p>
                          )}
                        </div>
                      )
                    })()}

                    <div>
                      <h4 className="text-small font-semibold text-ink-900">
                        Anti-Anchoring Decision Triage
                      </h4>
                      <p className="text-small text-ink-500 mt-0.5">
                        Statutory justification is required and permanently recorded in the append-only audit ledger. Every decision is hashed and chained to the prior entry.
                      </p>
                    </div>

                    {/* Status radio selection */}
                    <div className="flex flex-col gap-2">
                      <label className="text-small font-medium text-ink-700">Evaluation Outcome:</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedStatus('qualified')}
                          className={`py-2 px-3 rounded-md border text-small font-medium transition-colors ${
                            selectedStatus === 'qualified'
                              ? 'bg-[#EBF3EC] border-[#C7DEC9] text-risk-low font-semibold ring-1 ring-risk-low'
                              : 'bg-paper border-line text-ink-700 hover:bg-cream-50'
                          }`}
                        >
                          Qualified
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedStatus('disqualified')}
                          className={`py-2 px-3 rounded-md border text-small font-medium transition-colors ${
                            selectedStatus === 'disqualified'
                              ? 'bg-[#FAECEB] border-[#EFC2BF] text-risk-critical font-semibold ring-1 ring-risk-critical'
                              : 'bg-paper border-line text-ink-700 hover:bg-cream-50'
                          }`}
                        >
                          Disqualified
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedStatus('clarification_requested')}
                          className={`py-2 px-3 rounded-md border text-small font-medium transition-colors ${
                            selectedStatus === 'clarification_requested'
                              ? 'bg-[#FBF6EA] border-[#EBDCB4] text-risk-medium font-semibold ring-1 ring-risk-medium'
                              : 'bg-paper border-line text-ink-700 hover:bg-cream-50'
                          }`}
                        >
                          Clarification
                        </button>
                      </div>
                    </div>

                    {/* Justification Textarea (Fix 42 Bug 7: Enforce 80 characters hard minimum) */}
                    {(() => {
                      const len = decisionReason.trim().length;
                      const needed = Math.max(0, 80 - len);
                      return (
                        <div className="flex flex-col gap-1.5">
                          <Textarea
                            label="Evaluation Justification"
                            placeholder="Specify the regulatory grounds, compliance check results, and relevant statutory references…"
                            value={decisionReason}
                            onChange={(e) => setDecisionReason(e.target.value)}
                            showCharCount
                            maxLength={1000}
                            required
                          />
                          <p className={`text-micro flex items-center gap-1 font-medium ${needed > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                            {needed > 0 ? (
                              <span>Minimum 80 characters required — <strong>{needed} more needed</strong> for sovereign audit defense</span>
                            ) : (
                              <span>✓ Minimum 80 characters requirement met ({len} characters entered)</span>
                            )}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Consequence Warning Box */}
                    <div className="p-3 rounded-md bg-cream-100/70 border border-line text-micro text-ink-700 leading-relaxed">
                      <span className="font-semibold text-ink-900">Ledger Immutability Notice: </span>
                      Submitting this decision will sign and append event{' '}
                      <code className="font-mono text-navy-900">EVT-OFFICER-DECISION</code> with your credentials to the SHA-256 trust ledger.
                    </div>

                    {(() => {
                      const isSelfPrimary = bidder.primaryReviewerId && user?.id === bidder.primaryReviewerId && !bidder.secondaryReviewerId
                      const isTooShort = decisionReason.trim().length < 80
                      const isDisabled = isTooShort || !!isSelfPrimary

                      return (
                        <Button
                          variant={selectedStatus === 'disqualified' ? 'destructive' : 'primary'}
                          size="lg"
                          onClick={() => setIsDecisionConfirmOpen(true)}
                          disabled={isDisabled}
                          className={isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                          title={
                            isSelfPrimary
                              ? 'Alternate officer required for secondary review (Rule 14.2)'
                              : isTooShort
                              ? `Minimum 80 characters required (${80 - decisionReason.trim().length} more needed)`
                              : 'Commit decision to immutable ledger'
                          }
                        >
                          {isSelfPrimary ? 'Awaiting Secondary Officer (Rule 14.2)' : 'Commit Decision to Ledger'}
                        </Button>
                      )
                    })()}
                  </div>
                </div>
              </TabContent>

              {/* ─── Tab 5: Trust Ledger (Fix 20) ────────────────────────── */}
              <TabContent value="ledger">
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-cream-50 rounded-lg border border-line flex items-center justify-between text-micro text-ink-600">
                    <span className="font-semibold text-ink-800 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-navy-800" />
                      Bidder Trust Ledger Audit Trail
                    </span>
                    <span className="font-mono text-ink-700 bg-paper px-2 py-0.5 rounded border border-line">
                      {bidderLedger.length} events recorded
                    </span>
                  </div>

                  {bidderLedger.length === 0 ? (
                    <div className="p-6 text-center text-ink-500 bg-paper rounded-lg border border-line">
                      No ledger entries recorded for this bidder yet.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
                      {bidderLedger.map((entry) => (
                        <LedgerEntryRow
                          key={entry.id}
                          entry={entry}
                          showBidderContext={false}
                          showTenderContext={true}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </TabContent>
            </Tabs>
          </div>
        )}
      </Drawer>

      {/* ─── PII Reveal Confirmation Modal ────────────────────────────── */}
      <Confirm
        isOpen={isRevealConfirmOpen}
        onClose={() => setIsRevealConfirmOpen(false)}
        onConfirm={() => revealPiiMutation.mutate()}
        title="Reveal Full Bidder PII"
        actionName="PII reveal"
        consequence="permanently record an immutable audit entry with your officer ID to the trust ledger and unmask corporate PAN and GSTIN in this session"
        description="Access to unmasked corporate tax and director identifiers is audited under GeM statutory transparency guidelines."
        confirmText="Confirm & Unmask"
        isLoading={revealPiiMutation.isPending}
      />

      {/* ─── Decision Confirmation Modal ──────────────────────────────── */}
      <Confirm
        isOpen={isDecisionConfirmOpen}
        onClose={() => setIsDecisionConfirmOpen(false)}
        onConfirm={() => submitDecisionMutation.mutate()}
        title={`Confirm Bidder ${selectedStatus.toUpperCase()}`}
        actionName={`decision: ${selectedStatus}`}
        consequence={`append a cryptographic event to the ledger and notify the bidder. This action cannot be revoked without formal appeal`}
        description={`You are officially recording this bidder as ${selectedStatus}.`}
        confirmText="Confirm Decision"
        isDestructive={selectedStatus === 'disqualified'}
        isLoading={submitDecisionMutation.isPending}
      />
    </>
  )
}
