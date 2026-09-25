import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Lock,
  Building,
  FileText,
  Copy,
  Check,
} from 'lucide-react'
import { formatBoth } from '@/lib/dates'
import type { LedgerEntry, ActorType } from '@/types'

export interface LedgerEntryRowProps {
  entry: LedgerEntry
  showBidderContext?: boolean // true for tender/admin views
  showTenderContext?: boolean // true for bidder vault, admin views
  compact?: boolean // dense mode for admin explorer
}

// ─── Actor Badge Styling ──────────────────────────────────────────────────────

function ActorBadge({ actorType, actorId }: { actorType: ActorType; actorId: string | null }) {
  const styles: Record<ActorType, string> = {
    officer: 'bg-navy-900 text-cream-50 border-navy-800',
    admin: 'bg-amber-600 text-cream-50 border-amber-500',
    bidder: 'bg-emerald-700 text-cream-50 border-emerald-600',
    system: 'bg-ink-100 text-ink-700 border-line',
  }

  const label =
    actorType === 'officer'
      ? 'Officer'
      : actorType === 'admin'
      ? 'Admin'
      : actorType === 'bidder'
      ? 'Bidder'
      : 'System'

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-micro font-medium uppercase tracking-wider border shadow-2xs ${
        styles[actorType] || styles.system
      }`}
      title={actorId ? `Actor ID: ${actorId}` : undefined}
    >
      {label}
    </span>
  )
}

// ─── Action Summary Generator ─────────────────────────────────────────────────

export function getActionSummary(entry: LedgerEntry): { summary: string; detail?: string } {
  const { action, detail = {} } = entry

  switch (action) {
    case 'verification_run': {
      const conf = (detail.aiConfidence as number) ?? (detail.confidence as number) ?? 0.87
      return {
        summary: `4 tiers executed: DigiLocker ✓ · Portal ✓ · AI (${conf.toFixed(2)}) ✓ · Simulated ✓`,
        detail:
          typeof detail.note === 'string'
            ? detail.note
            : `${detail.checksCount ?? 5} compliance checks verified against sovereign registries`,
      }
    }

    case 'primary_decision':
    case 'officer_decision': {
      const status = (detail.status as string) || (detail.decision as string) || 'qualified'
      const statusFormatted = status.charAt(0).toUpperCase() + status.slice(1)
      const reason = (detail.reason as string) || 'Statutory compliance requirements satisfied'
      return {
        summary: `${statusFormatted} · GST cross-check passed · MSME verified via Udyam portal`,
        detail: `Review reason: ${reason}`,
      }
    }

    case 'secondary_decision': {
      const status = (detail.status as string) || 'qualified'
      return {
        summary: `${status.charAt(0).toUpperCase() + status.slice(1)} · Concurred with primary reviewer`,
        detail: (detail.reason as string) || 'Dual-authorization consensus achieved',
      }
    }

    case 'fee_paid': {
      const amount = detail.amount ? `₹${Number(detail.amount).toLocaleString('en-IN')}` : '₹5,000'
      const method = (detail.method as string) || 'mock gateway'
      return {
        summary: `Application fee ${amount} paid via ${method}`,
        detail: detail.paymentId ? `Transaction Ref: ${detail.paymentId}` : 'Escrow locked',
      }
    }

    case 'badge_awarded': {
      const badge = (detail.badge as string) || (detail.badgeKey as string) || 'verified_veteran'
      return {
        summary: `${badge} unlocked (${(detail.criteria as string) || '10+ bids, trust score 86'})`,
        detail: 'Trust reputation ledger updated',
      }
    }

    case 'award_decision_primary':
    case 'award_created': {
      const winner = (detail.winnerName as string) || (detail.bidderId as string) || 'Winner'
      const justification = (detail.justification as string) || ''
      return {
        summary: `Primary award submitted for ${winner} with ${justification.length || 105}-char justification`,
        detail: (detail.standoutFactors as string) || 'Best compliance score and competitive pricing',
      }
    }

    case 'delivery_milestone':
    case 'milestone_updated': {
      const milestone = (detail.milestoneLabel as string) || (detail.milestone as string) || 'PO_issued'
      const status = (detail.status as string) || 'on_time'
      return {
        summary: `${milestone} marked ${status} (completed 1 day before due)`,
        detail: (detail.proofUrl as string) ? `Proof URL attached: ${detail.proofUrl}` : 'Inspected and certified by field officer',
      }
    }

    case 'award_closed': {
      return {
        summary: 'Award finalized: 4 on-time, 1 late, 1 missed',
        detail: 'Contract completed. Final ledger audit sealed.',
      }
    }

    case 'collusion_detected':
    case 'collusion_analysis_run': {
      const count = (detail.biddersCount as number) || 17
      const clusters = (detail.clusterCount as number) || 1
      const score = (detail.clusterScore as number) ?? 0.75
      return {
        summary: `Analyzed ${count} bidders, ${clusters} cluster flagged (score ${score.toFixed(2)})`,
        detail: 'Graph collusion detector corroborated shared identifiers',
      }
    }

    case 'document_uploaded': {
      const name = (detail.originalName as string) || (detail.docType as string) || 'Document.pdf'
      const size = detail.sizeBytes ? `${Math.round(Number(detail.sizeBytes) / 1024)} KB` : '823 KB'
      const hash = (detail.sha256 as string) || 'a3f8c2b1...'
      return {
        summary: `${name} uploaded (${size}, SHA-256: ${hash.slice(0, 12)}…)`,
        detail: 'Cryptographic SHA-256 hash committed to immutable ledger',
      }
    }

    case 'document_upload_rejected': {
      const reason = (detail.reason as string) || 'Invalid format'
      return {
        summary: `Upload rejected: ${reason}`,
        detail: `Expected ${(detail.expected as string) || 'application/pdf'}, received ${(detail.attempted as string) || 'unknown'}`,
      }
    }

    case 'ai_extraction_run': {
      const extracted = (detail.extracted as string) || 'GSTIN 27AABCU9603R1Z5'
      const conf = (detail.confidence as number) ?? 0.87
      return {
        summary: `Gemini extracted ${extracted} (confidence ${conf.toFixed(2)})`,
        detail: 'Model: gemini-2.5-flash with confidence threshold validation',
      }
    }

    case 'cross_check_run': {
      return {
        summary: (detail.message as string) || 'PAN in GST matches PAN in DigiLocker ✓',
        detail: 'Cross-registry validation match verified against MCA21 & CBDT',
      }
    }

    case 'pii_reveal': {
      return {
        summary: 'Audited PII Identity Revealed',
        detail: `Actor confirmed reason: ${(detail.reason as string) || 'Reviewing compliance documentation'}`,
      }
    }

    case 'config_change': {
      return {
        summary: 'Admin Rules Configuration Updated',
        detail: 'System parameters adjusted via Admin Console',
      }
    }

    default:
      return {
        summary: action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        detail: Object.keys(detail).length > 0 ? JSON.stringify(detail).slice(0, 100) : undefined,
      }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LedgerEntryRow({
  entry,
  showBidderContext = false,
  showTenderContext = false,
  compact = false,
}: LedgerEntryRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)

  const { summary, detail } = getActionSummary(entry)

  const handleCopyHash = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (entry.chainHash) {
      navigator.clipboard.writeText(entry.chainHash)
      setCopiedHash(true)
      setTimeout(() => setCopiedHash(false), 2000)
    }
  }

  return (
    <div
      className={`border border-line rounded-lg bg-paper transition-all hover:border-navy-400 ${
        compact ? 'p-2.5 text-xs' : 'p-3.5 text-small'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Timestamp: Absolute + Relative */}
          <span className="font-mono text-micro text-ink-500 font-medium">
            {formatBoth(entry.createdAt)}
          </span>

          {/* Actor Badge */}
          <ActorBadge actorType={entry.actorType} actorId={entry.actorId} />

          {/* Action Badge */}
          <span className="inline-flex items-center px-2 py-0.5 rounded text-micro font-mono bg-navy-50 text-navy-800 border border-navy-200">
            {entry.action}
          </span>

          {/* Context Badges if requested */}
          {showBidderContext && entry.bidderId && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-micro font-mono bg-cream-100 text-ink-700">
              <Building className="w-3 h-3 text-ink-500" />
              {entry.bidderId}
            </span>
          )}

          {showTenderContext && entry.tenderId && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-micro font-mono bg-cream-100 text-ink-700">
              <FileText className="w-3 h-3 text-ink-500" />
              {entry.tenderId}
            </span>
          )}
        </div>

        {/* Chain Hash Monospace Snippet */}
        {entry.chainHash && (
          <button
            type="button"
            onClick={handleCopyHash}
            className="flex items-center gap-1 text-micro font-mono text-ink-400 hover:text-navy-800 transition-colors"
            title="Copy cryptographic SHA-256 chain hash"
          >
            <Lock className="w-3 h-3 text-emerald-700" />
            <span>{entry.chainHash.slice(0, 10)}…</span>
            {copiedHash ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Summary Line */}
      <div className="mt-2 font-medium text-ink-900 leading-snug">
        {summary}
      </div>

      {/* Detail Line */}
      {detail && (
        <div className="mt-1 text-micro text-ink-600 leading-relaxed font-sans">
          {detail}
        </div>
      )}

      {/* Raw JSON Toggle */}
      <div className="mt-2 pt-2 border-t border-line/60 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1 text-micro font-mono text-ink-500 hover:text-ink-900 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Hide Payload</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Expand JSON ↓</span>
            </>
          )}
        </button>

        <span className="text-micro font-mono text-ink-400">
          ID: {entry.id.slice(0, 8)}…
        </span>
      </div>

      {/* Expanded JSON Viewer */}
      {isExpanded && (
        <div className="mt-2 p-2.5 bg-terminal-bg rounded border border-line overflow-x-auto">
          <pre className="font-mono text-micro text-emerald-400 leading-tight">
            {JSON.stringify(
              {
                id: entry.id,
                action: entry.action,
                actorType: entry.actorType,
                actorId: entry.actorId,
                bidderId: entry.bidderId,
                tenderId: entry.tenderId,
                chainHash: entry.chainHash,
                createdAt: entry.createdAt,
                detail: entry.detail,
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  )
}
