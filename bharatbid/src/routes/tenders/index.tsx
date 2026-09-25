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
} from 'lucide-react'
import apiClient from '@/lib/apiClient'
import type { Tender, TenderStatus } from '@/types'
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

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title={t('tenders.title', 'GeM Procurement Tenders')}
        subtitle={t(
          'tenders.subtitle',
          'Sovereign bid compliance evaluation, collusion detection, and cryptographic audit records'
        )}
        breadcrumbs={[{ label: 'BharatBid', href: '/tenders' }, { label: 'Tenders Dashboard' }]}
        badge={
          <span className="px-2 py-0.5 rounded text-micro font-mono bg-cream-100 text-ink-700 border border-line">
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
  )
}
