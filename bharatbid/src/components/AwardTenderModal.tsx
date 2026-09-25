import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Award, Plus, Trash2, ShieldCheck, AlertTriangle } from 'lucide-react'
import apiClient from '@/lib/apiClient'
import type { Bidder } from '@/types'
import {
  Modal,
  Button,
  Badge,
  RiskBadge,
  Textarea,
  Input,
  notify,
} from '@/components/ui'

interface StandoutFactor {
  factor: string
  note: string
}

interface AwardTenderModalProps {
  isOpen: boolean
  onClose: () => void
  tenderId: string
  tenderTitle: string
  bidders: Bidder[]
}

export function AwardTenderModal({
  isOpen,
  onClose,
  tenderId,
  tenderTitle,
  bidders,
}: AwardTenderModalProps) {
  const queryClient = useQueryClient()

  const [step, setStep] = useState<'select' | 'justify'>(
    'select'
  )
  const [selectedBidder, setSelectedBidder] = useState<Bidder | null>(null)
  const [justification, setJustification] = useState('')
  const [factors, setFactors] = useState<StandoutFactor[]>([
    { factor: '', note: '' },
  ])

  const qualifiedBidders = bidders.filter(
    (b) => b.officerDecision?.status === 'qualified'
  )

  const addFactor = () =>
    setFactors((prev) => [...prev, { factor: '', note: '' }])

  const removeFactor = (idx: number) =>
    setFactors((prev) => prev.filter((_, i) => i !== idx))

  const updateFactor = (
    idx: number,
    field: keyof StandoutFactor,
    value: string
  ) =>
    setFactors((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f))
    )

  const isJustifyValid =
    justification.trim().length >= 80 &&
    factors.every((f) => f.factor.trim() && f.note.trim())

  const awardMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBidder) throw new Error('No bidder selected')
      const res = await apiClient.post(`/tenders/${tenderId}/award`, {
        winningBidderId: selectedBidder.id,
        justification: justification.trim(),
        standoutFactors: factors.map((f) => ({
          factor: f.factor.trim(),
          note: f.note.trim(),
        })),
      })
      return res.data
    },
    onSuccess: (data: any) => {
      notify.success('Award decision submitted', {
        description: `Stage: Primary Award — Ledger entry ${data?.ledgerId?.slice(0, 8) ?? ''}… committed. Awaiting 2nd officer approval.`,
      })
      queryClient.invalidateQueries({ queryKey: ['tenders'] })
      queryClient.invalidateQueries({ queryKey: ['tender', tenderId] })
      onClose()
      resetForm()
    },
    onError: (err: any) => {
      const code = err?.code || ''
      if (code === 'UNQUALIFIED_WINNER') {
        notify.error('Award blocked: Bidder not qualified', {
          description: 'An officer must qualify this bidder before award.',
        })
      } else if (code === 'errors.awardBlockedStaleVerification') {
        notify.error('Award blocked: Stale verification', {
          description:
            "Winning bidder's statutory checks are expired. Re-verify before awarding.",
        })
      } else if (code === 'FEE_UNPAID') {
        notify.error('Award blocked: Application fee unpaid', {
          description: 'The winning bidder has not paid the application fee.',
        })
      } else {
        notify.error('Award submission failed', { description: err.message })
      }
    },
  })

  const resetForm = () => {
    setStep('select')
    setSelectedBidder(null)
    setJustification('')
    setFactors([{ factor: '', note: '' }])
  }

  const handleClose = () => {
    onClose()
    resetForm()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Award Tender"
      description={tenderTitle}
      size="lg"
      footer={
        step === 'select' ? (
          <div className="flex items-center justify-between w-full">
            <Button variant="secondary" size="md" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Award className="w-4 h-4" />}
              disabled={!selectedBidder}
              onClick={() => setStep('justify')}
            >
              Next: Compose Justification
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setStep('select')}
            >
              ← Back
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Award className="w-4 h-4" />}
              disabled={!isJustifyValid || awardMutation.isPending}
              isLoading={awardMutation.isPending}
              onClick={() => awardMutation.mutate()}
            >
              Submit Award Decision
            </Button>
          </div>
        )
      }
    >
      {step === 'select' ? (
        <div className="flex flex-col gap-4">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-micro text-ink-500 font-mono uppercase tracking-wider">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-navy-900 text-cream-50 font-semibold text-[10px]">
              1
            </span>
            <span>Select Winning Bidder</span>
            <span className="mx-2 text-ink-300">→</span>
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-line text-ink-400 font-semibold text-[10px]">
              2
            </span>
            <span className="text-ink-400">Compose Justification</span>
          </div>

          {qualifiedBidders.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle className="w-8 h-8 text-risk-medium" />
              <p className="text-body font-medium text-ink-700">
                No qualified bidders
              </p>
              <p className="text-small text-ink-500">
                At least one bidder must be marked{' '}
                <strong>qualified</strong> by an officer before the tender can
                be awarded.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {qualifiedBidders.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBidder(b)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedBidder?.id === b.id
                      ? 'border-navy-900 bg-cream-100 shadow-md'
                      : 'border-line bg-paper hover:border-navy-300 hover:bg-cream-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-ink-900">
                        {b.companyName}
                      </span>
                      <div className="flex items-center gap-3 mt-1 text-micro font-mono text-ink-500">
                        <span>PAN: {b.pan || '—'}</span>
                        <span>·</span>
                        <span>
                          GSTIN: {b.gstin ? b.gstin.slice(0, 6) + '…' : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge level={b.overallRisk} score={b.riskScore} />
                      <Badge variant="success">Qualified</Badge>
                      {selectedBidder?.id === b.id && (
                        <ShieldCheck className="w-5 h-5 text-navy-900" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Non-qualified bidders (dimmed) */}
          {bidders.filter((b) => b.officerDecision?.status !== 'qualified')
            .length > 0 && (
            <div>
              <p className="text-micro text-ink-400 font-medium uppercase tracking-wider mb-2">
                Not yet qualified ({
                  bidders.filter(
                    (b) => b.officerDecision?.status !== 'qualified'
                  ).length
                })
              </p>
              <div className="flex flex-col gap-1 opacity-50 pointer-events-none">
                {bidders
                  .filter((b) => b.officerDecision?.status !== 'qualified')
                  .slice(0, 3)
                  .map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-lg border border-line bg-paper flex items-center justify-between"
                    >
                      <span className="text-small text-ink-700">
                        {b.companyName}
                      </span>
                      <Badge variant="default">
                        {b.officerDecision?.status || 'Pending'}
                      </Badge>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-micro text-ink-500 font-mono uppercase tracking-wider">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-line text-ink-400 font-semibold text-[10px]">
              1
            </span>
            <span className="text-ink-400">Select Winning Bidder</span>
            <span className="mx-2 text-ink-300">→</span>
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-navy-900 text-cream-50 font-semibold text-[10px]">
              2
            </span>
            <span>Compose Justification</span>
          </div>

          {/* Selected winner summary */}
          <div className="p-3 bg-cream-100 rounded-lg border border-line flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-micro text-ink-500">Selected Winner</span>
              <span className="font-semibold text-ink-900">
                {selectedBidder?.companyName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <RiskBadge
                level={selectedBidder!.overallRisk}
                score={selectedBidder!.riskScore}
              />
              <Badge variant="success">Qualified</Badge>
            </div>
          </div>

          {/* Justification field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-small font-medium text-ink-700">
              Award Justification{' '}
              <span className="text-ink-400 text-micro font-normal">
                (min. 80 characters)
              </span>
            </label>
            <Textarea
              id="award-justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Document the compliance evaluation rationale, risk assessment outcome, and why this bidder represents the best statutory fit for this GeM procurement…"
              rows={5}
            />
            <p
              className={`text-micro text-right ${
                justification.trim().length >= 80
                  ? 'text-risk-low'
                  : 'text-ink-400'
              }`}
            >
              {justification.trim().length} / 80 min chars
            </p>
          </div>

          {/* Standout factors */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-small font-medium text-ink-700">
                Standout Compliance Factors
              </label>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={addFactor}
              >
                Add Factor
              </Button>
            </div>

            {factors.map((f, idx) => (
              <div
                key={idx}
                className="p-3 bg-paper rounded-lg border border-line flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-micro text-ink-500 font-medium">
                    Factor {idx + 1}
                  </span>
                  {factors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFactor(idx)}
                      className="text-ink-400 hover:text-risk-critical transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Factor name (e.g. MSME Compliant)"
                    value={f.factor}
                    onChange={(e) =>
                      updateFactor(idx, 'factor', e.target.value)
                    }
                  />
                  <Input
                    placeholder="Supporting note"
                    value={f.note}
                    onChange={(e) => updateFactor(idx, 'note', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Dual-officer notice */}
          <div className="p-3 bg-cream-50 rounded-lg border border-line text-micro text-ink-600">
            <strong className="text-ink-800">Dual-Officer Approval Required:</strong>{' '}
            Your submission creates a primary award record in status{' '}
            <code className="font-mono bg-cream-100 px-1 rounded">
              evaluation_awarded_pending_2nd
            </code>
            . A second officer must confirm via the{' '}
            <code className="font-mono">POST /award/second-approval</code>{' '}
            endpoint before the tender status transitions to{' '}
            <code className="font-mono bg-cream-100 px-1 rounded">awarded</code>.
          </div>
        </div>
      )}
    </Modal>
  )
}
