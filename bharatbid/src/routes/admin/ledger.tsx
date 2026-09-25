import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Download, Filter, Clock, Hash, RefreshCw, AlertTriangle,
} from 'lucide-react'
import apiClient from '@/lib/apiClient'
import { LedgerEntryRow } from '@/components/ledger/LedgerEntryRow'
import {
  PageHeader, EmptyState, Button, notify,
} from '@/components/ui'
import type { LedgerEntry } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LedgerResponse {
  entries: LedgerEntry[]
  chainHash: string
  totalCount: number
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({
  onSearch,
  onExportCsv,
}: {
  onSearch: (q: string) => void
  onExportCsv: () => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
        <input
          type="text"
          placeholder="Search entries, actors, actions, bidder or tender ID..."
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded border border-line bg-terminal-bg text-terminal-text font-mono text-small focus:outline-none focus:border-terminal-text/40 focus:ring-1 focus:ring-terminal-text/20"
          id="ledger-search-input"
        />
      </div>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Download className="w-3.5 h-3.5" />}
        onClick={onExportCsv}
        id="ledger-export-csv"
      >
        Export CSV
      </Button>
    </div>
  )
}

// ─── Chain Hash Footer ────────────────────────────────────────────────────────

function ChainHashFooter({ hash, count }: { hash: string; count: number }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="p-3 bg-terminal-bg rounded-lg border border-terminal-text/20 flex items-center gap-3">
      <Hash className="w-4 h-4 text-terminal-text/60 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-terminal-text/60 text-micro font-mono mr-2">
          X-Ledger-Chain-Hash ({count} entries):
        </span>
        <span
          className="font-mono text-small text-terminal-text break-all"
          id="ledger-chain-hash"
        >
          {hash}
        </span>
      </div>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 text-micro font-mono text-terminal-text/60 hover:text-terminal-text transition-colors px-2 py-1 rounded border border-terminal-text/20 hover:border-terminal-text/40"
        id="ledger-copy-hash"
      >
        {copied ? 'Copied \u2713' : 'Copy'}
      </button>
    </div>
  )
}

// ─── Main Ledger Explorer ─────────────────────────────────────────────────────

export default function AdminLedgerPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading, error, refetch } = useQuery<LedgerResponse>({
    queryKey: ['admin', 'ledger'],
    queryFn: async () => {
      const res = await apiClient.get<LedgerResponse>('/admin/ledger')
      return res.data
    },
    refetchInterval: 30_000,
    retry: 1,
  })

  const entries = data?.entries ?? []
  const chainHash = data?.chainHash ?? ''
  const totalCount = data?.totalCount ?? entries.length

  const filtered = searchQuery
    ? entries.filter((e) => {
        const q = searchQuery.toLowerCase()
        return (
          (e.action ?? '').toLowerCase().includes(q) ||
          (e.actorId ?? '').toLowerCase().includes(q) ||
          (e.tenderId ?? '').toLowerCase().includes(q) ||
          (e.bidderId ?? '').toLowerCase().includes(q) ||
          JSON.stringify(e.detail ?? (e as any).payload ?? {}).toLowerCase().includes(q)
        )
      })
    : entries

  const handleExportCsv = () => {
    try {
      const header = 'timestamp,actor_type,actor_id,action,tender_id,bidder_id'
      const rows = filtered.map((e) =>
        [
          '"' + e.createdAt + '"',
          e.actorType,
          e.actorId ?? '',
          e.action,
          e.tenderId ?? '',
          e.bidderId ?? '',
        ].join(',')
      )
      const csv = [header, ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'bharatbid-ledger-' + Date.now() + '.csv'
      a.click()
      URL.revokeObjectURL(url)
      notify.success('CSV exported', {
        description: filtered.length + ' entries exported.',
      })
    } catch {
      notify.error('Export failed')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Trust Ledger Explorer"
        subtitle="Immutable cryptographic audit log. All events append-only. No entry can be modified or deleted."
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => refetch()}
            id="ledger-refresh"
          >
            Refresh
          </Button>
        }
      />

      {/* Mode B \u2014 terminal dark styling per architecture rules */}
      <div className="bg-terminal-bg rounded-xl border border-terminal-text/20 overflow-hidden">
        <div className="px-4 pt-4 pb-2 border-b border-terminal-text/10">
          <FilterBar onSearch={setSearchQuery} onExportCsv={handleExportCsv} />
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded bg-terminal-text/5 animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <EmptyState
              title="Ledger unavailable"
              description="Could not load ledger entries from the backend."
              icon={<AlertTriangle className="w-8 h-8 text-risk-medium" />}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={
                searchQuery ? 'No matching entries' : 'No ledger entries yet'
              }
              description={
                searchQuery
                  ? 'Try a different search term.'
                  : 'Events will appear here as actions are recorded on the platform.'
              }
              icon={
                <Clock className="w-8 h-8 text-terminal-text/30" />
              }
            />
          ) : (
            <div className="flex flex-col divide-y divide-terminal-text/10">
              {filtered.map((entry, idx) => (
                <div key={entry.id ?? idx} className="py-1">
                  <LedgerEntryRow
                    entry={entry}
                    showBidderContext={true}
                    showTenderContext={true}
                    compact={true}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {chainHash && (
          <div className="px-4 pb-4">
            <ChainHashFooter hash={chainHash} count={totalCount} />
          </div>
        )}
      </div>

      <div className="p-3 bg-cream-50 rounded-lg border border-line flex items-start gap-2 text-micro text-ink-500">
        <Filter className="w-3.5 h-3.5 text-ink-400 flex-shrink-0 mt-0.5" />
        <p>
          The ledger is append-only. Every row has a SHA-256 hash chain linking
          it to the previous entry.{' '}
          <code className="font-mono text-ink-700">X-Ledger-Chain-Hash</code>{' '}
          above reflects the cumulative integrity hash across all shown entries.
          {searchQuery && (
            <span className="ml-1 font-medium text-ink-700">
              Showing {filtered.length} of {totalCount} entries (filtered).
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
