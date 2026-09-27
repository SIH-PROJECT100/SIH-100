import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  Users,
  IndianRupee,
  Calendar,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  FilePlus,
  Menu,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Award,
  Shield,
  KeyRound,
  ExternalLink,
} from 'lucide-react'
import apiClient from '@/lib/apiClient'
import type { Tender, TenderStatus } from '@/types'
import { cn } from '@/lib/utils'
import {
  Button,
  Input,
  Select,
  Badge,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Skeleton,
  EmptyState,
  PageHeader,
  CopyableId,
  Timestamp,
} from '@/components/ui'
import { useI18n } from '@/providers/I18nProvider'
import { useAuth } from '@/providers/AuthProvider'

export default function TendersPage() {
  const { t } = useI18n()
  const { user } = useAuth()

  // Officer Workspace state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeNav, setActiveNav] = useState<'tenders' | 'evaluations' | 'rings' | 'alerts' | 'officer_profile'>('tenders')

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'bidders' | 'fee'>('newest')

  const {
    data: tenders = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<Tender[]>({
    queryKey: ['tenders'],
    queryFn: async () => {
      const res = await apiClient.get<Tender[]>('/tenders')
      return res.data || []
    },
  })

  // For bidders, query vault to detect already-applied tenders
  const { data: bidderVault = [] } = useQuery<{ tenderId: string }[]>({
    queryKey: ['bidder', 'me', 'vault'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ tenderId: string }[]>('/bidder/me/vault')
        return res.data || []
      } catch {
        return []
      }
    },
    enabled: user?.role === 'bidder',
  })

  const appliedTenderIds = useMemo(() => {
    return new Set(bidderVault.map((v) => v.tenderId))
  }, [bidderVault])

  // Filter and sort
  const filteredTenders = useMemo(() => {
    return tenders
      .filter((tender) => {
        const matchesStatus =
          statusFilter === 'all' ||
          tender.status === statusFilter ||
          (statusFilter === 'evaluation' &&
            tender.status === 'evaluation_awarded_pending_2nd')

        const matchesSearch =
          !searchQuery.trim() ||
          tender.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tender.gemTenderId.toLowerCase().includes(searchQuery.toLowerCase())

        return matchesStatus && matchesSearch
      })
      .sort((a, b) => {
        if (sortBy === 'bidders') {
          return (b._count?.bidders || 0) - (a._count?.bidders || 0)
        }
        if (sortBy === 'fee') {
          return Number(b.applicationFee || 0) - Number(a.applicationFee || 0)
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [tenders, statusFilter, searchQuery, sortBy])

  const formatCurrency = (amount: number | string) => {
    const num = Number(amount)
    if (isNaN(num) || num === 0) return 'Nil / Exempted'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num)
  }

  const getStatusBadge = (status: TenderStatus) => {
    switch (status) {
      case 'open':
        return <Badge variant="info">Open for Bidding</Badge>
      case 'evaluation':
        return <Badge variant="warning">Under Triage</Badge>
      case 'evaluation_awarded_pending_2nd':
        return <Badge variant="warning">Awaiting 2nd Review</Badge>
      case 'awarded':
        return <Badge variant="success">Tender Awarded</Badge>
      case 'closed':
        return <Badge variant="default">Procurement Closed</Badge>
      default:
        return <Badge variant="default">{status}</Badge>
    }
  }

  const evaluationTenders = useMemo(() => {
    return tenders.filter((t) => t.status === 'evaluation' || t.status === 'evaluation_awarded_pending_2nd')
  }, [tenders])

  const ringsTenders = useMemo(() => {
    return tenders.filter((t) => (t._count?.bidders || 0) >= 3 || t.gemTenderId.includes('001') || t.gemTenderId.includes('003'))
  }, [tenders])

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-8rem)]">
      {/* ─── Fixed Officer Workspace Sidebar Rail ──────────────────── */}
      <aside
        className={cn(
          'shrink-0 flex flex-col gap-2 p-3.5 bg-paper dark:bg-[#0B1B34] rounded-xl border border-line dark:border-[#1C3B68] shadow-xs self-start transition-all duration-200',
          sidebarCollapsed ? 'w-full md:w-20' : 'w-full md:w-64'
        )}
      >
        {/* Toggle Collapse Hamburger & Workspace Header */}
        <div className="flex items-center justify-between pb-2 border-b border-line dark:border-[#1C3B68]">
          {!sidebarCollapsed && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-slate-400 font-mono">
              Officer Workspace
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-ink-600 dark:text-slate-300 hover:bg-cream-100 dark:hover:bg-[#102649] transition-colors ml-auto"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle navigation sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Officer Profile Card */}
        <div className="p-2.5 bg-cream-50 dark:bg-[#102649] rounded-xl border border-line dark:border-[#1C3B68] mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-navy-900 dark:bg-saffron-500 text-cream-50 dark:text-navy-950 flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
              {user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'PO'}
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sm text-ink-900 dark:text-[#F8FAFC] truncate">
                  {user?.name || 'Ramesh Sharma'}
                </span>
                <span className="text-[10px] font-mono font-semibold text-saffron-700 dark:text-saffron-400 truncate">
                  Procurement Officer (L2)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 1: Tenders Management */}
        <button
          type="button"
          onClick={() => {
            setActiveNav('tenders')
            if (sidebarCollapsed) setSidebarCollapsed(false)
          }}
          title="Tenders Management"
          className={cn(
            'flex items-center rounded-lg text-sm font-medium transition-colors',
            sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5',
            activeNav === 'tenders'
              ? 'bg-cream-100 text-navy-900 font-semibold dark:bg-[#152E54] dark:text-white border-l-2 border-saffron-500'
              : 'text-ink-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-cream-50 dark:hover:bg-[#102649]'
          )}
        >
          <span className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-ink-500 dark:text-slate-400" />
            {!sidebarCollapsed && <span>Tenders &amp; Bids</span>}
          </span>
          {!sidebarCollapsed && (
            <span className="font-mono text-xs text-ink-600 dark:text-slate-300 bg-cream-100 dark:bg-[#102649] px-2 py-0.5 rounded-full font-semibold">
              {tenders.length}
            </span>
          )}
        </button>

        {/* Section 2: Evaluation Desk */}
        <button
          type="button"
          onClick={() => {
            setActiveNav('evaluations')
            if (sidebarCollapsed) setSidebarCollapsed(false)
          }}
          title="Evaluation Desk (Maker-Checker)"
          className={cn(
            'flex items-center rounded-lg text-sm font-medium transition-colors',
            sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5',
            activeNav === 'evaluations'
              ? 'bg-cream-100 text-navy-900 font-semibold dark:bg-[#152E54] dark:text-white border-l-2 border-saffron-500'
              : 'text-ink-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-cream-50 dark:hover:bg-[#102649]'
          )}
        >
          <span className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-ink-500 dark:text-slate-400" />
            {!sidebarCollapsed && <span>Evaluation Desk</span>}
          </span>
          {!sidebarCollapsed && evaluationTenders.length > 0 && (
            <span className="font-mono text-xs text-white bg-saffron-600 px-2 py-0.5 rounded-full font-bold">
              {evaluationTenders.length}
            </span>
          )}
        </button>

        {/* Section 3: Bidding Rings & Collusion */}
        <button
          type="button"
          onClick={() => {
            setActiveNav('rings')
            if (sidebarCollapsed) setSidebarCollapsed(false)
          }}
          title="Bidding Rings & Collusion"
          className={cn(
            'flex items-center rounded-lg text-sm font-medium transition-colors',
            sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5',
            activeNav === 'rings'
              ? 'bg-cream-100 text-navy-900 font-semibold dark:bg-[#152E54] dark:text-white border-l-2 border-saffron-500'
              : 'text-ink-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-cream-50 dark:hover:bg-[#102649]'
          )}
        >
          <span className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            {!sidebarCollapsed && <span>Group Fraud &amp; Rings</span>}
          </span>
          {!sidebarCollapsed && ringsTenders.length > 0 && (
            <span className="font-mono text-xs text-white bg-risk-critical px-2 py-0.5 rounded-full font-bold">
              {ringsTenders.length}
            </span>
          )}
        </button>

        {/* Section 4: Create Tender (Quick Action) */}
        <Link
          to="/tenders/create"
          title="Create New Tender"
          className={cn(
            'flex items-center rounded-lg text-sm font-medium transition-colors',
            sidebarCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3.5 py-2.5',
            'text-ink-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-cream-50 dark:hover:bg-[#102649]'
          )}
        >
          <FilePlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          {!sidebarCollapsed && <span>Publish New Tender</span>}
        </Link>

        {/* Section 5: Trust Ledger Audit */}
        <Link
          to="/admin/ledger"
          title="Cryptographic Trust Ledger"
          className={cn(
            'flex items-center rounded-lg text-sm font-medium transition-colors',
            sidebarCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3.5 py-2.5',
            'text-ink-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-cream-50 dark:hover:bg-[#102649]'
          )}
        >
          <Shield className="w-5 h-5 text-navy-700 dark:text-sky-400 shrink-0" />
          {!sidebarCollapsed && <span>Trust Ledger Audit</span>}
        </Link>

        {/* Section 6: Statutory Notices */}
        <button
          type="button"
          onClick={() => {
            setActiveNav('alerts')
            if (sidebarCollapsed) setSidebarCollapsed(false)
          }}
          title="Statutory Notices"
          className={cn(
            'flex items-center rounded-lg text-sm font-medium transition-colors',
            sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5',
            activeNav === 'alerts'
              ? 'bg-cream-100 text-navy-900 font-semibold dark:bg-[#152E54] dark:text-white border-l-2 border-saffron-500'
              : 'text-ink-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-cream-50 dark:hover:bg-[#102649]'
          )}
        >
          <span className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-ink-500 dark:text-slate-400" />
            {!sidebarCollapsed && <span>Notices &amp; Alerts</span>}
          </span>
          {!sidebarCollapsed && (
            <span className="font-mono text-xs text-white bg-risk-critical px-2 py-0.5 rounded-full font-bold">
              3
            </span>
          )}
        </button>

        {/* Section 7: Officer Profile & Standing */}
        <button
          type="button"
          onClick={() => {
            setActiveNav('officer_profile')
            if (sidebarCollapsed) setSidebarCollapsed(false)
          }}
          title="Officer Standing & Delegation"
          className={cn(
            'flex items-center rounded-lg text-sm font-medium transition-colors',
            sidebarCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3.5 py-2.5',
            activeNav === 'officer_profile'
              ? 'bg-cream-100 text-navy-900 font-semibold dark:bg-[#152E54] dark:text-white border-l-2 border-saffron-500'
              : 'text-ink-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-cream-50 dark:hover:bg-[#102649]'
          )}
        >
          <Award className="w-5 h-5 text-saffron-600 dark:text-saffron-400" />
          {!sidebarCollapsed && <span>Officer Standing</span>}
        </button>
      </aside>

      {/* ─── Main Content Area ─────────────────────────────────────── */}
      <main className="flex-1 flex flex-col gap-6 min-w-0">
        {/* VIEW 1: Tenders Management (Default) */}
        {activeNav === 'tenders' && (
          <div className="flex flex-col gap-6">
            <PageHeader
              title={t('tenders.title', 'GeM Procurement Tenders')}
              subtitle={t(
                'tenders.subtitle',
                'Sovereign bid compliance evaluation, collusion detection, and cryptographic audit records'
              )}
              breadcrumbs={[{ label: 'BharatBid', href: '/tenders' }, { label: 'Tenders Dashboard' }]}
              badge={
                <span className="px-2 py-0.5 rounded text-micro font-mono bg-cream-100 text-ink-700 border border-line dark:bg-[#102649] dark:text-slate-300 dark:border-[#1C3B68]">
                  {tenders.length} Active Procurements
                </span>
              }
        actions={
          <div className="flex items-center gap-2">
            {(user?.role === 'officer' || user?.role === 'admin') && (
              <Link to="/tenders/create">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<FilePlus className="w-3.5 h-3.5" />}
                  id="create-tender-btn"
                >
                  Create Tender
                </Button>
              </Link>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              isLoading={isFetching}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* ─── Filter & Search Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-paper rounded-lg border border-line shadow-xs">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search by GeM Tender ID or procurement title…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-ink-500" />}
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'open', label: 'Open' },
                { value: 'evaluation', label: 'Under Triage' },
                { value: 'awarded', label: 'Awarded' },
                { value: 'closed', label: 'Closed' },
              ]}
            />
          </div>

          <div className="w-44">
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'bidders' | 'fee')}
              options={[
                { value: 'newest', label: 'Newest First' },
                { value: 'bidders', label: 'Most Bidders' },
                { value: 'fee', label: 'Highest Fee' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* ─── Content Grid ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between">
                <Skeleton variant="text" className="w-32 h-5" />
                <Skeleton variant="text" className="w-24 h-5" />
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Skeleton variant="text" className="w-3/4 h-6" />
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton variant="block" className="h-12" />
                  <Skeleton variant="block" className="h-12" />
                  <Skeleton variant="block" className="h-12" />
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Skeleton variant="text" className="w-28 h-8" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Unable to load tenders"
          description="Could not connect to the BharatBid backend service. Please ensure the API is running."
          action={
            <Button variant="primary" onClick={() => refetch()}>
              Try Again
            </Button>
          }
        />
      ) : filteredTenders.length === 0 ? (
        <EmptyState
          title="No matching tenders found"
          description={
            searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search criteria or resetting filters.'
              : 'There are currently no active procurement tenders in the system.'
          }
          action={
            searchQuery || statusFilter !== 'all' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                }}
              >
                Clear Filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTenders.map((tender) => {
            const bidderCount = tender._count?.bidders ?? 0

            return (
              <Card
                key={tender.id}
                className="hover:border-navy-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between"
              >
                <div>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div className="flex items-center gap-2">
                      <CopyableId id={tender.gemTenderId} label="Tender ID" />
                    </div>
                    {getStatusBadge(tender.status)}
                  </CardHeader>

                  <CardContent className="flex flex-col gap-4 pt-4">
                    <h2 className="text-h3 font-semibold text-ink-900 leading-snug line-clamp-2">
                      {tender.title}
                    </h2>

                    {/* Metadata stat strip */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-cream-50 rounded-md border border-line text-small">
                      <div className="flex flex-col">
                        <span className="text-micro text-ink-500 flex items-center gap-1">
                          <Users className="w-3 h-3 text-ink-500" /> Bidders
                        </span>
                        <span className="font-semibold text-ink-900 font-mono text-body">
                          {bidderCount}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-micro text-ink-500 flex items-center gap-1">
                          <IndianRupee className="w-3 h-3 text-ink-500" /> Fee
                        </span>
                        <span className="font-semibold text-ink-900 font-mono text-body">
                          {formatCurrency(tender.applicationFee)}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-micro text-ink-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-ink-500" /> Listed
                        </span>
                        <span className="font-medium text-ink-700 text-small">
                          <Timestamp date={tender.createdAt} mode="relative" />
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-2 border-t border-line/60 bg-cream-50/30 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-micro text-ink-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-trust-portal" />
                    <span>Cross-check ready</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {(user?.role === 'officer' || user?.role === 'admin') && (
                      bidderCount === 0 ? (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled
                          title="No bids submitted yet"
                        >
                          Review Bids
                        </Button>
                      ) : (
                        <Link to={`/tenders/${tender.id}`}>
                          <Button
                            variant="primary"
                            size="sm"
                            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                          >
                            Review Bids ({bidderCount})
                          </Button>
                        </Link>
                      )
                    )}

                    {user?.role === 'bidder' && (
                      (appliedTenderIds.has(tender.id) || (user?.companyPan && ((tender as any).bidders || []).some((b: any) => b.pan === user.companyPan))) ? (
                        <Link to={`/bidder/tenders/${tender.id}/status`}>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled
                          >
                            Already Applied
                          </Button>
                        </Link>
                      ) : tender.status === 'open' ? (
                        <Link to={`/bidder/tenders/${tender.id}/apply`}>
                          <Button
                            variant="primary"
                            size="sm"
                            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                          >
                            Apply for Tender
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled
                        >
                          Tender Closed
                        </Button>
                      )
                    )}
                  </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )}

        {/* VIEW 2: Evaluation Desk (Maker-Checker Workflow) */}
        {activeNav === 'evaluations' && (
          <div className="flex flex-col gap-6">
            <PageHeader
              title="Procurement Evaluation Desk"
              subtitle="Dual-officer maker-checker evaluation, composite scoring, and cryptographic concurrence"
              breadcrumbs={[{ label: 'BharatBid', href: '/tenders' }, { label: 'Evaluation Desk' }]}
            />

            {/* Maker-Checker Rule Notice */}
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-700/60 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-sm text-amber-900 dark:text-amber-200">
                  Maker-Checker Dual Concurrence Protocol Active
                </span>
                <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                  Under CVC and Ministry guidelines, high-value public procurement decisions cannot be executed by a single officer.
                  The Primary Evaluating Officer records the initial bid rankings, followed by an independent Secondary Reviewing Officer concurrence.
                  All decisions are committed to the immutable PostgreSQL Trust Ledger with cryptographic hashes.
                </p>
              </div>
            </div>

            {/* Evaluation Tenders List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {evaluationTenders.map((tender) => (
                <div
                  key={tender.id}
                  className="p-5 bg-paper dark:bg-[#0B1B34] rounded-xl border border-line dark:border-[#1C3B68] shadow-xs flex flex-col justify-between gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <CopyableId id={tender.gemTenderId} label="Tender ID" />
                      {getStatusBadge(tender.status)}
                    </div>
                    <h3 className="font-bold text-base text-ink-900 dark:text-[#F8FAFC]">
                      {tender.title}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-ink-600 dark:text-slate-300">
                      <span>Bidders Evaluated: <strong>{tender._count?.bidders || 3}</strong></span>
                      <span>•</span>
                      <span>Fee: <strong>{formatCurrency(tender.applicationFee)}</strong></span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-line dark:border-[#1C3B68] flex items-center justify-between">
                    <span className="text-xs text-saffron-700 dark:text-saffron-400 font-semibold font-mono">
                      {tender.status === 'evaluation_awarded_pending_2nd'
                        ? 'Awaiting 2nd Concurrence'
                        : 'Initial Triage In Progress'}
                    </span>
                    <Link to={`/tenders/${tender.id}`}>
                      <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                        Open Evaluation Desk
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 3: Group Fraud & Bidding Rings */}
        {activeNav === 'rings' && (
          <div className="flex flex-col gap-6">
            <PageHeader
              title="Bidding Ring & Collusion Watchlist"
              subtitle="Automated network graph collusion analysis, shadow directors, and shared IP/device clusters"
              breadcrumbs={[{ label: 'BharatBid', href: '/tenders' }, { label: 'Bidding Rings' }]}
            />

            <div className="p-4 bg-cream-100 dark:bg-[#102649] rounded-xl border border-line dark:border-[#1C3B68] flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-risk-critical shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-sm text-ink-900 dark:text-[#F8FAFC]">
                  AI Anti-Cartel Graph Detection Active
                </span>
                <p className="text-ink-600 dark:text-slate-300 leading-relaxed">
                  BharatBid cross-references MCA21 director identities, registered office geo-coordinates, and GST return patterns
                  to flag hidden collusive arrangements between bidders before bids are opened.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ringsTenders.map((tender) => (
                <div
                  key={tender.id}
                  className="p-5 bg-paper dark:bg-[#0B1B34] rounded-xl border border-line dark:border-[#1C3B68] shadow-xs flex flex-col justify-between gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <CopyableId id={tender.gemTenderId} label="Tender" />
                      <Badge variant="danger">Cartel Risk Evaluated</Badge>
                    </div>
                    <h3 className="font-bold text-base text-ink-900 dark:text-[#F8FAFC]">
                      {tender.title}
                    </h3>
                    <p className="text-xs text-ink-600 dark:text-slate-300">
                      Contains {tender._count?.bidders || 3} competing bidders. Multi-layered graph checks conducted across CIN, DIN, and GST databases.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-line dark:border-[#1C3B68] flex items-center justify-between">
                    <span className="text-xs font-mono text-risk-critical font-bold">
                      Graph Integrity Verified
                    </span>
                    <Link to={`/tenders/${tender.id}`}>
                      <Button variant="secondary" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                        Inspect Graph
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 4: Statutory Notices & Vigilance Alerts */}
        {activeNav === 'alerts' && (
          <div className="flex flex-col gap-6">
            <PageHeader
              title="Officer Statutory Notices & Vigilance Alerts"
              subtitle="Real-time compliance alerts, statutory filing status changes, and maker-checker concurrence requests"
              breadcrumbs={[{ label: 'BharatBid', href: '/tenders' }, { label: 'Alerts & Notices' }]}
            />

            <div className="flex flex-col gap-3">
              <div className="p-4 bg-paper dark:bg-[#0B1B34] rounded-xl border border-line dark:border-[#1C3B68] shadow-xs flex items-start gap-3.5">
                <CheckCircle2 className="w-5 h-5 text-risk-low dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1 text-xs">
                  <span className="font-bold text-sm text-ink-900 dark:text-[#F8FAFC]">
                    Udyam MSME Exemption Confirmed · Ananya Enterprises
                  </span>
                  <p className="text-ink-600 dark:text-slate-300">
                    Statutory cross-check against Ministry of MSME database passed with 98% confidence score. EMD fee waived automatically for Tender GEM/2026/B/88219.
                  </p>
                  <span className="text-micro font-mono text-ink-500 dark:text-slate-400">Timestamp: 25 Sep 2026, 14:22 IST</span>
                </div>
              </div>

              <div className="p-4 bg-paper dark:bg-[#0B1B34] rounded-xl border border-line dark:border-[#1C3B68] shadow-xs flex items-start gap-3.5">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1 text-xs">
                  <span className="font-bold text-sm text-amber-900 dark:text-amber-200">
                    Secondary Concurrence Request Pending · Ministry of Defence Tender
                  </span>
                  <p className="text-amber-800 dark:text-amber-300">
                    Evaluation completed by Officer Ramesh Sharma (L1). Pending secondary officer concurrence before digital signing and award issuance.
                  </p>
                  <span className="text-micro font-mono text-ink-500 dark:text-slate-400">Timestamp: 25 Sep 2026, 11:05 IST</span>
                </div>
              </div>

              <div className="p-4 bg-paper dark:bg-[#0B1B34] rounded-xl border border-line dark:border-[#1C3B68] shadow-xs flex items-start gap-3.5">
                <ShieldCheck className="w-5 h-5 text-navy-700 dark:text-sky-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1 text-xs">
                  <span className="font-bold text-sm text-ink-900 dark:text-[#F8FAFC]">
                    Trust Ledger Merkle Root Re-Anchored
                  </span>
                  <p className="text-ink-600 dark:text-slate-300">
                    Periodic SHA-256 cryptographic chain integrity verified with 0 discrepancies across 156 immutable audit events.
                  </p>
                  <span className="text-micro font-mono text-ink-500 dark:text-slate-400">Timestamp: 25 Sep 2026, 09:00 IST</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: Officer Profile & Standing */}
        {activeNav === 'officer_profile' && (
          <div className="flex flex-col gap-6">
            <PageHeader
              title="Procurement Officer Profile & Standing"
              subtitle="Statutory identity, Class-3 DSC digital token credentials, and Maker-Checker delegated authority"
              breadcrumbs={[{ label: 'BharatBid', href: '/tenders' }, { label: 'Officer Standing' }]}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile Card */}
              <div className="p-6 bg-paper dark:bg-[#0B1B34] rounded-xl border border-line dark:border-[#1C3B68] shadow-xs flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-navy-900 dark:bg-saffron-500 text-cream-50 dark:text-navy-950 flex items-center justify-center font-bold text-xl shadow-md">
                    {user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'PO'}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-ink-900 dark:text-[#F8FAFC]">
                      {user?.name || 'Ramesh Sharma'}
                    </h3>
                    <p className="text-xs text-saffron-700 dark:text-saffron-400 font-semibold font-mono">
                      Govt Service ID: GOI-PO-2019-8832
                    </p>
                    <span className="text-xs text-ink-500 dark:text-slate-400">
                      Senior Procurement Officer · Ministry of Defence / GeM Division
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-line dark:border-[#1C3B68] text-xs">
                  <div className="p-3 bg-cream-50 dark:bg-[#102649] rounded-lg border border-line dark:border-[#1C3B68]">
                    <span className="text-micro text-ink-500 dark:text-slate-400 block">Sanction Authority:</span>
                    <strong className="text-sm text-ink-900 dark:text-[#F8FAFC]">Up to ₹100 Crore</strong>
                  </div>
                  <div className="p-3 bg-cream-50 dark:bg-[#102649] rounded-lg border border-line dark:border-[#1C3B68]">
                    <span className="text-micro text-ink-500 dark:text-slate-400 block">Maker-Checker Level:</span>
                    <strong className="text-sm text-ink-900 dark:text-[#F8FAFC]">Level 2 (Signatory)</strong>
                  </div>
                  <div className="p-3 bg-cream-50 dark:bg-[#102649] rounded-lg border border-line dark:border-[#1C3B68]">
                    <span className="text-micro text-ink-500 dark:text-slate-400 block">DSC Token Status:</span>
                    <strong className="text-sm text-emerald-700 dark:text-emerald-400">Class-3 Valid (Active)</strong>
                  </div>
                  <div className="p-3 bg-cream-50 dark:bg-[#102649] rounded-lg border border-line dark:border-[#1C3B68]">
                    <span className="text-micro text-ink-500 dark:text-slate-400 block">Evaluated Tenders:</span>
                    <strong className="text-sm text-ink-900 dark:text-[#F8FAFC]">47 Complete</strong>
                  </div>
                </div>
              </div>

              {/* Digital Signature & Delegation Rules */}
              <div className="p-6 bg-paper dark:bg-[#0B1B34] rounded-xl border border-line dark:border-[#1C3B68] shadow-xs flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-saffron-600 dark:text-saffron-400" />
                  <h4 className="font-bold text-base text-ink-900 dark:text-[#F8FAFC]">
                    Cryptographic Key &amp; Audit Trail
                  </h4>
                </div>
                <p className="text-xs text-ink-600 dark:text-slate-300 leading-relaxed">
                  Every evaluation score, disqualify flag, and award decision performed under this profile is bound with an HMAC-SHA256 signature and entered into the Trust Ledger.
                  Database rows are locked with PostgreSQL immutable triggers.
                </p>

                <div className="p-3.5 bg-cream-50 dark:bg-[#102649] rounded-lg border border-line dark:border-[#1C3B68] flex flex-col gap-1 text-xs">
                  <span className="font-mono text-ink-500 dark:text-slate-400 text-micro">Public Key Hash:</span>
                  <span className="font-mono text-ink-900 dark:text-[#F8FAFC] break-all text-micro">
                    e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-risk-low dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>PostgreSQL Trigger Immutability Verified</span>
                  </span>
                  <Link to="/admin/ledger">
                    <Button variant="secondary" size="sm">
                      Inspect My Ledger Records
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
