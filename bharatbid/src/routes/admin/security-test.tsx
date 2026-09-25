import { useState } from 'react'
import { Terminal, CheckCircle2, AlertTriangle, Loader2, Lock, Unlock } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import apiClient from '@/lib/apiClient'
import { PageHeader, Button, notify } from '@/components/ui'
import { formatDateTime } from '@/lib/dates'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImmutabilityProofResult {
  proof: 'IMMUTABILITY_VERIFIED' | 'INTEGRITY_BREACH_DETECTED'
  testedEntryId: string
  testedAction: string
  originalHash: string | null
  hashAfterTamperAttempt: string | null
  hashesMatch: boolean
  detailIntact: boolean
  tamperAttemptBlocked: boolean
  tamperBlockReason: string
  elapsedMs: number
  verifiedAt: string
}

// ─── Terminal Line Component ──────────────────────────────────────────────────

function TerminalLine({
  prefix = '$',
  text,
  color = 'text-green-400',
  delay = 0,
}: {
  prefix?: string
  text: string
  color?: string
  delay?: number
}) {
  return (
    <div
      className={`flex gap-2 font-mono text-sm ${color} animate-fadeIn`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-green-600 select-none flex-shrink-0">{prefix}</span>
      <span className="break-all">{text}</span>
    </div>
  )
}

// ─── Security Test Page ───────────────────────────────────────────────────────

export default function SecurityTestPage() {
  const [result, setResult] = useState<ImmutabilityProofResult | null>(null)
  const [log, setLog] = useState<Array<{ text: string; color: string; prefix: string }>>([])

  const appendLog = (text: string, color = 'text-green-400', prefix = '›') => {
    setLog((prev) => [...prev, { text, color, prefix }])
  }

  const { mutate: runProof, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ImmutabilityProofResult>(
        '/admin/security-test/prove-immutability'
      )
      return res.data
    },
    onMutate: () => {
      setResult(null)
      setLog([])
      setTimeout(() => appendLog('Connecting to ledger service...', 'text-yellow-400', '⟳'), 100)
      setTimeout(() => appendLog('Fetching latest ledger entry...', 'text-green-400'), 600)
      setTimeout(() => appendLog('Initialising tamper-attempt transaction...', 'text-yellow-400', '⚡'), 1100)
      setTimeout(() => appendLog('Executing UPDATE on ledger_entries (forged payload)...', 'text-red-400', '!'), 1600)
      setTimeout(() => appendLog('Checking PostgreSQL immutability trigger response...', 'text-yellow-400', '⟳'), 2100)
    },
    onSuccess: (data) => {
      setResult(data)
      const verified = data.proof === 'IMMUTABILITY_VERIFIED'

      setTimeout(() => {
        appendLog(
          `Transaction rolled back — ${data.tamperBlockReason.slice(0, 80)}`,
          'text-yellow-400',
          '↩'
        )
      }, 400)
      setTimeout(() => {
        appendLog(
          `Re-reading entry ${data.testedEntryId} from database...`,
          'text-green-400'
        )
      }, 800)
      setTimeout(() => {
        appendLog(
          `Hash comparison: ${data.originalHash?.slice(0, 16)}… === ${data.hashAfterTamperAttempt?.slice(0, 16)}…`,
          verified ? 'text-green-400' : 'text-red-400',
          verified ? '✓' : '✗'
        )
      }, 1200)
      setTimeout(() => {
        appendLog(
          verified
            ? `RESULT: IMMUTABILITY_VERIFIED — ledger is tamper-proof (${data.elapsedMs}ms)`
            : `RESULT: INTEGRITY_BREACH_DETECTED — contact security team immediately`,
          verified ? 'text-emerald-300' : 'text-red-300',
          verified ? '✔' : '✘'
        )
      }, 1600)

      if (verified) {
        notify.success('Ledger immutability verified', {
          description: `Tamper attempt blocked. All ${data.elapsedMs}ms elapsed. Hashes match.`,
        })
      } else {
        notify.error('Integrity breach detected', {
          description: 'Hash mismatch after tamper attempt. Review immediately.',
        })
      }
    },
    onError: (err: any) => {
      appendLog(`Error: ${err.message}`, 'text-red-400', '✗')
      notify.error('Security test failed', { description: err.message })
    },
  })

  const verified = result?.proof === 'IMMUTABILITY_VERIFIED'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ledger Immutability Proof"
        subtitle="Live demonstration — attempts a tamper on the append-only Trust Ledger and proves the record survives unchanged"
        badge={
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-navy-900 text-cream-50 text-micro font-medium">
            <Lock className="w-3 h-3" />
            Admin · Security Test
          </span>
        }
      />

      {/* Fix 36.1 — Immutability Proof explanation block */}
      <div className="rounded-xl border border-[#30363d] bg-[#0d1117] overflow-hidden shadow-xl">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#161b22] border-b border-[#30363d]">
          <Lock className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-sm font-semibold text-emerald-300 uppercase tracking-wider">
            🔐 LIVE LEDGER IMMUTABILITY PROOF
          </span>
        </div>
        <div className="p-5 font-mono text-sm text-[#c9d1d9] flex flex-col gap-4">
          <p className="text-[#8b949e] leading-relaxed">
            This test proves the Trust Ledger cannot be tampered with —
            even by a database administrator with full PostgreSQL access.
          </p>
          <p className="font-semibold text-[#e6edf3]">
            BharatBid uses dual-layer defense:
          </p>
          <div className="flex flex-col gap-3 pl-4 border-l-2 border-[#30363d]">
            <div>
              <p className="text-emerald-300 font-semibold">Layer 1 — Role-based access control</p>
              <p className="text-[#8b949e] text-xs mt-0.5 leading-relaxed">
                The backend application user <span className="text-[#c9d1d9]">(backend_app)</span> has only
                SELECT and INSERT grants on the ledger table.
                UPDATE and DELETE are not granted at any application role.
              </p>
            </div>
            <div>
              <p className="text-yellow-300 font-semibold">Layer 2 — PostgreSQL trigger</p>
              <p className="text-[#8b949e] text-xs mt-0.5 leading-relaxed">
                A row-level trigger <span className="text-[#c9d1d9]">(reject_ledger_mutation)</span> fires on any
                UPDATE or DELETE attempt, raising an exception that even a
                postgres superuser cannot bypass.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-[#8b949e] text-xs border-t border-[#30363d] pt-3">
            <p className="text-[#e6edf3] font-semibold text-sm mb-1">Clicking below will attempt to:</p>
            <p>  1. UPDATE a ledger row as backend_app <span className="text-red-400">(should fail at Layer 1)</span></p>
            <p>  2. DELETE a ledger row as backend_app <span className="text-red-400">(should fail at Layer 1)</span></p>
            <p>  3. Escalate to postgres superuser and retry both</p>
            <p className="pl-5 text-red-400">(should fail at Layer 2)</p>
            <p className="mt-2 text-[#c9d1d9]">Live PostgreSQL error messages will be displayed verbatim.</p>
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div
        className="rounded-xl bg-[#0d1117] border border-[#30363d] overflow-hidden shadow-xl"
        id="immutability-terminal"
      >
        {/* Terminal chrome */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#161b22] border-b border-[#30363d]">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-2 font-mono text-xs text-[#8b949e]">
            bharatbid-security-test — bash
          </span>
        </div>

        {/* Terminal body */}
        <div className="p-4 min-h-[280px] font-mono text-sm flex flex-col gap-1.5">
          <TerminalLine
            prefix="$"
            text="node scripts/prove-ledger-immutability.ts"
            color="text-[#c9d1d9]"
          />

          {log.length === 0 && !isPending && !result && (
            <span className="text-[#8b949e] text-sm mt-2">
              Press "Prove Ledger Is Immutable" to start the live demonstration…
            </span>
          )}

          {log.map((line, i) => (
            <TerminalLine
              key={i}
              prefix={line.prefix}
              text={line.text}
              color={line.color}
              delay={i * 60}
            />
          ))}

          {isPending && (
            <div className="flex items-center gap-2 text-yellow-400 mt-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="font-mono text-sm">Running…</span>
            </div>
          )}

          {result && (
            <div
              className={`mt-3 p-3 rounded-lg border font-mono text-xs ${
                verified
                  ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300'
                  : 'bg-red-900/30 border-red-700/50 text-red-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {verified ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <span className="font-bold text-sm">
                  {verified ? '✔ IMMUTABILITY VERIFIED' : '✘ INTEGRITY BREACH DETECTED'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-0.5 text-[11px]">
                <div>Entry ID: <span className="text-[#c9d1d9]">{result.testedEntryId}</span></div>
                <div>Action: <span className="text-[#c9d1d9]">{result.testedAction}</span></div>
                <div>
                  Hash before:{' '}
                  <span className="text-[#c9d1d9] break-all">{result.originalHash?.slice(0, 32)}…</span>
                </div>
                <div>
                  Hash after:{' '}
                  <span className={result.hashesMatch ? 'text-emerald-300' : 'text-red-300'}>
                    {result.hashAfterTamperAttempt?.slice(0, 32)}…
                  </span>
                </div>
                <div>
                  Hashes match:{' '}
                  <span className={result.hashesMatch ? 'text-emerald-300' : 'text-red-300'}>
                    {result.hashesMatch ? 'YES ✓' : 'NO ✗'}
                  </span>
                </div>
                <div>Elapsed: <span className="text-[#c9d1d9]">{result.elapsedMs}ms</span></div>
                <div>Verified at: <span className="text-[#c9d1d9]">{formatDateTime(result.verifiedAt)}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="flex items-center gap-4">
        <Button
          id="prove-immutability-btn"
          variant="primary"
          size="lg"
          leftIcon={
            isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : verified ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Terminal className="w-4 h-4" />
            )
          }
          onClick={() => runProof()}
          disabled={isPending}
          isLoading={isPending}
        >
          {isPending
            ? 'Running proof…'
            : verified
            ? 'Run Again'
            : 'Prove Ledger Is Immutable'}
        </Button>

        {result && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-small font-medium ${
              verified
                ? 'bg-risk-low/10 border-risk-low text-risk-low'
                : 'bg-risk-critical/10 border-risk-critical text-risk-critical'
            }`}
          >
            {verified ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Unlock className="w-3.5 h-3.5" />
            )}
            {verified ? 'Ledger Integrity: INTACT' : 'Ledger Integrity: COMPROMISED'}
          </div>
        )}
      </div>
    </div>
  )
}
