import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings,
  Scale,
  Clock,
  Target,
  Network,
  Truck,
  AlertTriangle,
  Timer,
  Save,
  RotateCcw,
  CheckCircle2,
  Shield,
  ShieldCheck,
  FileText,
  Sliders,
} from 'lucide-react'
import apiClient from '@/lib/apiClient'
import type { RulesConfig } from '@/types'
import {
  PageHeader,
  Button,
  Skeleton,
  EmptyState,
  notify,
} from '@/components/ui'
import { cn } from '@/lib/utils'

// ─── Typed Config ─────────────────────────────────────────────────────────────

type Config = RulesConfig['config']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-micro font-semibold text-ink-500 uppercase tracking-wider">
      {children}
    </span>
  )
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-line last:border-0">
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-small font-medium text-ink-800">{label}</span>
        {hint && <span className="text-micro text-ink-500 mt-0.5 leading-snug">{hint}</span>}
      </div>
      <div className="w-full sm:w-40 flex-shrink-0">{children}</div>
    </div>
  )
}

function NumericInput({
  value,
  onChange,
  min = 0,
  max,
  step = 0.01,
  prefix,
  suffix,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  prefix?: string
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-1">
      {prefix && (
        <span className="text-small text-ink-500 w-4 text-right">{prefix}</span>
      )}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-2 py-1.5 rounded border border-line bg-paper text-small font-mono text-ink-900 text-right focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-200 transition-colors"
      />
      {suffix && (
        <span className="text-small text-ink-500 w-8">{suffix}</span>
      )}
    </div>
  )
}

function BoolToggle({
  value,
  onChange,
  trueLabel = 'Required',
  falseLabel = 'Optional',
}: {
  value: boolean
  onChange: (v: boolean) => void
  trueLabel?: string
  falseLabel?: string
}) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-cream-50 rounded border border-line">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-2 py-1 rounded text-micro font-medium transition-colors ${
          value
            ? 'bg-navy-900 text-cream-50 shadow-sm'
            : 'text-ink-500 hover:text-ink-800'
        }`}
      >
        {trueLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-2 py-1 rounded text-micro font-medium transition-colors ${
          !value
            ? 'bg-paper text-ink-900 shadow-sm'
            : 'text-ink-500 hover:text-ink-800'
        }`}
      >
        {falseLabel}
      </button>
    </div>
  )
}

// ─── Default fallback config ───────────────────────────────────────────────────

const DEFAULT_CONFIG: Config = {
  msme: { weight: 0.25, requiredForTender: true },
  gst: { weight: 0.2, flaggedPenalty: 0.3 },
  pan_itr: { weight: 0.2, mismatchPenalty: 0.25 },
  blacklist: { weight: 0.25, flaggedPenalty: 1.0 },
  make_in_india: { weight: 0.1, requiredForTender: false },
  local_content: { minPercentage: 50, weight: 0.1 },
  verificationValidity: {
    msme: 1825,
    gst: 365,
    pan_itr: 365,
    blacklist: 90,
    make_in_india: 365,
  },
  confidenceThresholds: {
    auto_flag_below: 0.6,
    human_review_below: 0.8,
  },
  collusionSignalWeights: {
    sequential_pan: 0.2,
    address_similarity: 0.2,
    ip_prefix: 0.15,
    price_cv: 0.2,
    common_director: 0.15,
    registration_cluster: 0.1,
  },
  collusionThreshold: 0.6,
  deliveryGraceDays: 7,
  riskThresholds: { low: 0.3, medium: 0.6, high: 0.85 },
  session: { maxLifetimeSeconds: 3600 },
  compliance: {
    msme_verified: { weight: 10, enabled: true },
    zero_gst_defaults: { weight: 15, enabled: true },
    class_1_local_supplier: { weight: 10, enabled: true },
    clean_anti_cartel: { weight: 20, enabled: true },
    first_bid: { weight: 5, enabled: true },
    five_bids: { weight: 10, enabled: true },
    ten_bids: { weight: 15, enabled: true },
    on_time_streak_3: { weight: 15, enabled: true },
    verified_veteran: { weight: 20, enabled: true },
  },
}

export const COMPLIANCE_BADGE_KEYS = [
  { key: 'msme_verified', label: 'MSME Verified', hint: 'Active Udyam registration verified via portal', defaultWeight: 10 },
  { key: 'zero_gst_defaults', label: 'Zero GST Defaults', hint: 'No GST filing defaults in past 24 months', defaultWeight: 15 },
  { key: 'class_1_local_supplier', label: 'Class-1 Local Supplier', hint: 'Make in India ≥ 50% local content', defaultWeight: 10 },
  { key: 'clean_anti_cartel', label: 'Clean Bidding Record (No Group Fraud)', hint: 'Never flagged for secret bidding coordination with competitors', defaultWeight: 20 },
  { key: 'first_bid', label: 'First Bid Submitted', hint: 'Verified participation upon first tender submission', defaultWeight: 5 },
  { key: 'five_bids', label: 'Five Bids Milestone', hint: 'Reliable active bidder on GeM platform', defaultWeight: 10 },
  { key: 'ten_bids', label: 'Ten Bids Milestone', hint: 'High-volume qualified supplier', defaultWeight: 15 },
  { key: 'on_time_streak_3', label: 'On-Time Streak (3)', hint: '3 consecutive on-time milestone deliveries', defaultWeight: 15 },
  { key: 'verified_veteran', label: 'Verified Veteran', hint: '10+ bids and trust score ≥ 75', defaultWeight: 20 },
] as const

// ─── Tab components ───────────────────────────────────────────────────────────

function ComplianceTab({
  cfg,
  onChange,
}: {
  cfg: Config
  onChange: (patch: Partial<Config>) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* 9 Compliance Badge Weights (Fix 28) */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <SectionLabel>Trust Profile Compliance Badges (9 Weights)</SectionLabel>
        <p className="text-micro text-ink-500 mb-3 mt-1">
          Configure risk weights and activation status for procurement trust badges
        </p>

        {COMPLIANCE_BADGE_KEYS.map(({ key, label, hint, defaultWeight }) => {
          const config = (cfg as any)?.compliance?.[key] ?? { weight: defaultWeight, enabled: true }
          const enabled = config.enabled ?? true

          const handleToggle = async (currentEnabled: boolean) => {
            const optimistic = !currentEnabled
            // Optimistic local state update
            onChange({
              compliance: {
                ...((cfg as any)?.compliance || {}),
                [key]: {
                  ...config,
                  enabled: optimistic,
                },
              },
            })

            try {
              await apiClient.put('/admin/rules', {
                section: 'compliance',
                key,
                config: { enabled: optimistic },
              })
              notify.success(`Rule "${label}" ${optimistic ? 'enabled' : 'disabled'}`)
            } catch (err: any) {
              // Rollback on error
              onChange({
                compliance: {
                  ...((cfg as any)?.compliance || {}),
                  [key]: {
                    ...config,
                    enabled: currentEnabled,
                  },
                },
              })
              notify.error('Failed to update rule', { description: err.message })
            }
          }

          return (
            <FieldRow key={key} label={label} hint={hint}>
              <div className="flex items-center">
                <BoolToggle
                  value={enabled}
                  onChange={() => handleToggle(enabled)}
                  trueLabel="Enabled"
                  falseLabel="Disabled"
                />
              </div>
            </FieldRow>
          )
        })}
      </div>

      {/* MSME */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <SectionLabel>MSME Registration</SectionLabel>
        <FieldRow
          label="Compliance Weight"
          hint="Fraction of total risk score contributed by MSME check"
        >
          <NumericInput
            value={cfg?.msme?.weight ?? 0.25}
            onChange={(v) => onChange({ msme: { ...(cfg?.msme ?? DEFAULT_CONFIG.msme), weight: v } })}
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
        <FieldRow
          label="Required for Tender"
          hint="Block non-MSME bidders from qualification"
        >
          <BoolToggle
            value={cfg?.msme?.requiredForTender ?? true}
            onChange={(v) =>
              onChange({ msme: { ...(cfg?.msme ?? DEFAULT_CONFIG.msme), requiredForTender: v } })
            }
          />
        </FieldRow>
      </div>

      {/* GST */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <SectionLabel>GST Compliance</SectionLabel>
        <FieldRow label="Compliance Weight" hint="Fraction of total risk score">
          <NumericInput
            value={cfg?.gst?.weight ?? 0.2}
            onChange={(v) => onChange({ gst: { ...(cfg?.gst ?? DEFAULT_CONFIG.gst), weight: v } })}
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
        <FieldRow
          label="Flagged Penalty"
          hint="Risk score penalty when GST returns are flagged"
        >
          <NumericInput
            value={cfg?.gst?.flaggedPenalty ?? 0.3}
            onChange={(v) =>
              onChange({ gst: { ...(cfg?.gst ?? DEFAULT_CONFIG.gst), flaggedPenalty: v } })
            }
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
      </div>

      {/* PAN/ITR */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <SectionLabel>PAN / ITR</SectionLabel>
        <FieldRow label="Compliance Weight" hint="Fraction of total risk score">
          <NumericInput
            value={cfg?.pan_itr?.weight ?? 0.2}
            onChange={(v) =>
              onChange({ pan_itr: { ...(cfg?.pan_itr ?? DEFAULT_CONFIG.pan_itr), weight: v } })
            }
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
        <FieldRow
          label="Mismatch Penalty"
          hint="Risk score penalty on PAN–ITR name mismatch"
        >
          <NumericInput
            value={cfg?.pan_itr?.mismatchPenalty ?? 0.25}
            onChange={(v) =>
              onChange({ pan_itr: { ...(cfg?.pan_itr ?? DEFAULT_CONFIG.pan_itr), mismatchPenalty: v } })
            }
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
      </div>

      {/* Blacklist */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <SectionLabel>Blacklist Check</SectionLabel>
        <FieldRow label="Compliance Weight" hint="Fraction of total risk score">
          <NumericInput
            value={cfg?.blacklist?.weight ?? 0.25}
            onChange={(v) =>
              onChange({ blacklist: { ...(cfg?.blacklist ?? DEFAULT_CONFIG.blacklist), weight: v } })
            }
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
        <FieldRow
          label="Flagged Penalty"
          hint="Risk penalty when entity is on GeM/MCA blacklist (typically 1.0 = auto-critical)"
        >
          <NumericInput
            value={cfg?.blacklist?.flaggedPenalty ?? 1.0}
            onChange={(v) =>
              onChange({ blacklist: { ...(cfg?.blacklist ?? DEFAULT_CONFIG.blacklist), flaggedPenalty: v } })
            }
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
      </div>

      {/* Make in India */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <SectionLabel>Make in India / Local Content</SectionLabel>
        <FieldRow
          label="MII Compliance Weight"
          hint="Fraction of total risk score for Make in India"
        >
          <NumericInput
            value={cfg?.make_in_india?.weight ?? 0.1}
            onChange={(v) =>
              onChange({ make_in_india: { ...(cfg?.make_in_india ?? DEFAULT_CONFIG.make_in_india), weight: v } })
            }
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
        <FieldRow
          label="MII Required for Tender"
          hint="Block non-MII bidders from qualification"
        >
          <BoolToggle
            value={cfg?.make_in_india?.requiredForTender ?? false}
            onChange={(v) =>
              onChange({
                make_in_india: { ...(cfg?.make_in_india ?? DEFAULT_CONFIG.make_in_india), requiredForTender: v },
              })
            }
          />
        </FieldRow>
        <FieldRow
          label="Min Local Content %"
          hint="Minimum local content threshold for MII compliance"
        >
          <NumericInput
            value={cfg?.local_content?.minPercentage ?? 50}
            onChange={(v) =>
              onChange({
                local_content: { ...(cfg?.local_content ?? DEFAULT_CONFIG.local_content), minPercentage: v },
              })
            }
            min={0}
            max={100}
            step={5}
            suffix="%"
          />
        </FieldRow>
      </div>
    </div>
  )
}

function VerificationTab({
  cfg,
  onChange,
}: {
  cfg: Config
  onChange: (patch: Partial<Config>) => void
}) {
  const fields: Array<{
    key: keyof Config['verificationValidity']
    label: string
    hint: string
    defaultDays: number
  }> = [
    {
      key: 'msme',
      label: 'MSME Udyam',
      hint: 'Days after which MSME certificate must be re-verified',
      defaultDays: 1825,
    },
    {
      key: 'gst',
      label: 'GST Returns',
      hint: 'Days after which GST filing status must be re-checked',
      defaultDays: 365,
    },
    {
      key: 'pan_itr',
      label: 'PAN / ITR',
      hint: 'Days after which ITR status must be re-verified',
      defaultDays: 365,
    },
    {
      key: 'blacklist',
      label: 'Blacklist Check',
      hint: 'Days after which blacklist lookup must be re-run',
      defaultDays: 90,
    },
    {
      key: 'make_in_india',
      label: 'Make in India',
      hint: 'Days after which MII certification must be re-verified',
      defaultDays: 365,
    },
  ]

  return (
    <div className="p-4 bg-paper rounded-lg border border-line">
      <SectionLabel>Verification Validity Windows (days)</SectionLabel>
      {fields.map(({ key, label, hint }) => (
        <FieldRow key={key} label={label} hint={hint}>
          <NumericInput
            value={cfg.verificationValidity[key]}
            onChange={(v) =>
              onChange({
                verificationValidity: {
                  ...cfg.verificationValidity,
                  [key]: Math.round(v),
                },
              })
            }
            min={1}
            max={3650}
            step={30}
            suffix="d"
          />
        </FieldRow>
      ))}
    </div>
  )
}

function ConfidenceTab({
  cfg,
  onChange,
}: {
  cfg: Config
  onChange: (patch: Partial<Config>) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Fix 36.2 — Confidence thresholds explanation block */}
      <div className="rounded-xl border border-[#30363d] bg-[#0d1117] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#161b22] border-b border-[#30363d]">
          <Target className="w-4 h-4 text-yellow-400" />
          <span className="font-mono text-sm font-semibold text-yellow-300 uppercase tracking-wider">
            CONFIDENCE THRESHOLDS
          </span>
        </div>
        <div className="p-5 font-mono text-sm text-[#c9d1d9] flex flex-col gap-4">
          <p className="text-[#8b949e] leading-relaxed">
            BharatBid uses AI (Gemini) to extract structured data from
            uploaded documents (PAN numbers, GSTINs, company names, etc.).
            Each extraction returns a confidence score from 0.0 to 1.0.
          </p>
          <p className="font-semibold text-[#e6edf3]">
            These thresholds control how the system responds:
          </p>
          <div className="flex flex-col gap-3 pl-4 border-l-2 border-[#30363d] text-xs">
            <div>
              <p className="text-emerald-300 font-semibold">Auto-Approve Threshold <span className="text-[#8b949e]">(default 0.90)</span></p>
              <p className="text-[#8b949e] mt-0.5 leading-relaxed">
                Extractions above this confidence pass without human review.
              </p>
            </div>
            <div>
              <p className="text-yellow-300 font-semibold">Human Review Threshold <span className="text-[#8b949e]">(default 0.60)</span></p>
              <p className="text-[#8b949e] mt-0.5 leading-relaxed">
                Extractions between this and Auto-Approve show a "Human Review Required"
                flag in the officer's triage. Officer must manually verify the extracted value.
              </p>
            </div>
            <div>
              <p className="text-red-400 font-semibold">Auto-Reject Threshold <span className="text-[#8b949e]">(default 0.30)</span></p>
              <p className="text-[#8b949e] mt-0.5 leading-relaxed">
                Extractions below this are automatically rejected — the
                bidder is asked to re-upload a clearer document.
              </p>
            </div>
          </div>
          <div className="border-t border-[#30363d] pt-3 text-xs text-[#8b949e]">
            <p className="text-[#c9d1d9] font-semibold mb-1">Where this appears in Officer view:</p>
            <p>Bidder Detail Drawer → Compliance Checks tab → each check</p>
            <p className="mt-0.5">shows the AI confidence bar with color coding:</p>
            <p className="mt-1">  <span className="text-emerald-300">Green:</span> above Auto-Approve</p>
            <p>  <span className="text-yellow-300">Amber:</span> needs Human Review</p>
            <p>  <span className="text-red-400">Red:</span> below Auto-Reject</p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-paper rounded-lg border border-line">
        <SectionLabel>AI Confidence Thresholds</SectionLabel>
        <p className="text-micro text-ink-500 mt-1 mb-3">
          These thresholds govern when AI-extracted evidence is automatically
          flagged vs. queued for human review.
        </p>
        <FieldRow
          label="Auto-Flag Below"
          hint="Confidence score below this → automatic flag (risk elevated)"
        >
          <NumericInput
            value={cfg.confidenceThresholds.auto_flag_below}
            onChange={(v) =>
              onChange({
                confidenceThresholds: {
                  ...cfg.confidenceThresholds,
                  auto_flag_below: v,
                },
              })
            }
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
        <FieldRow
          label="Human Review Below"
          hint="Confidence score below this → queued for manual officer review"
        >
          <NumericInput
            value={cfg.confidenceThresholds.human_review_below}
            onChange={(v) =>
              onChange({
                confidenceThresholds: {
                  ...cfg.confidenceThresholds,
                  human_review_below: v,
                },
              })
            }
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
      </div>

      {/* Visual threshold bar */}
      <div className="p-4 bg-cream-50 rounded-lg border border-line">
        <SectionLabel>Threshold Visualizer</SectionLabel>
        <div className="mt-3 relative h-6 rounded-full overflow-hidden bg-line">
          <div
            className="absolute left-0 top-0 h-full bg-risk-critical/60"
            style={{
              width: `${cfg.confidenceThresholds.auto_flag_below * 100}%`,
            }}
          />
          <div
            className="absolute top-0 h-full bg-risk-medium/60"
            style={{
              left: `${cfg.confidenceThresholds.auto_flag_below * 100}%`,
              width: `${
                (cfg.confidenceThresholds.human_review_below -
                  cfg.confidenceThresholds.auto_flag_below) *
                100
              }%`,
            }}
          />
          <div
            className="absolute top-0 h-full bg-risk-low/60"
            style={{
              left: `${cfg.confidenceThresholds.human_review_below * 100}%`,
              right: 0,
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-micro text-ink-500">
          <span>0 — Auto-flag</span>
          <span>{cfg.confidenceThresholds.auto_flag_below} — Human review</span>
          <span>{cfg.confidenceThresholds.human_review_below} — Auto-pass</span>
          <span>1.0</span>
        </div>
      </div>
    </div>
  )
}

function CollusionTab({
  cfg,
  onChange,
}: {
  cfg: Config
  onChange: (patch: Partial<Config>) => void
}) {
  const signals: Array<{
    key: keyof Config['collusionSignalWeights']
    label: string
    hint: string
  }> = [
    {
      key: 'sequential_pan',
      label: 'Sequential PAN Issuance',
      hint: 'PAN numbers issued within close date range',
    },
    {
      key: 'address_similarity',
      label: 'Address Similarity',
      hint: 'Registered address fuzzy-match score',
    },
    {
      key: 'ip_prefix',
      label: 'IP Prefix Match',
      hint: 'Submission from same /24 subnet',
    },
    {
      key: 'price_cv',
      label: 'Price Clustering (CV)',
      hint: 'Coefficient of variation of quoted prices',
    },
    {
      key: 'common_director',
      label: 'Common Director PAN',
      hint: 'Shared director PAN across entities',
    },
    {
      key: 'registration_cluster',
      label: 'Registration Cluster',
      hint: 'MCA registration date within close window',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="p-4 bg-paper rounded-lg border border-line">
        <SectionLabel>Collusion Detection Threshold</SectionLabel>
        <FieldRow
          label="Aggregate Score Threshold"
          hint="Pairs with combined signal score above this are flagged as cartel"
        >
          <NumericInput
            value={cfg.collusionThreshold}
            onChange={(v) => onChange({ collusionThreshold: v })}
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
      </div>

      <div className="p-4 bg-paper rounded-lg border border-line">
        <SectionLabel>Signal Weights</SectionLabel>
        <p className="text-micro text-ink-500 mt-1 mb-3">
          Each signal contributes its weight to the aggregate collusion score for
          a bidder pair. Weights should sum to 1.0.
        </p>
        {signals.map(({ key, label, hint }) => (
          <FieldRow key={key} label={label} hint={hint}>
            <NumericInput
              value={cfg.collusionSignalWeights[key]}
              onChange={(v) =>
                onChange({
                  collusionSignalWeights: {
                    ...cfg.collusionSignalWeights,
                    [key]: v,
                  },
                })
              }
              min={0}
              max={1}
              step={0.05}
            />
          </FieldRow>
        ))}

        {/* Weight sum indicator */}
        <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
          <span className="text-small font-medium text-ink-700">
            Total Weight Sum
          </span>
          <span
            className={`font-mono font-semibold text-small ${
              Math.abs(
                Object.values(cfg.collusionSignalWeights).reduce(
                  (a, b) => a + b,
                  0
                ) - 1.0
              ) < 0.01
                ? 'text-risk-low'
                : 'text-risk-critical'
            }`}
          >
            {Object.values(cfg.collusionSignalWeights)
              .reduce((a, b) => a + b, 0)
              .toFixed(2)}
            {' '}/ 1.00
          </span>
        </div>
      </div>
    </div>
  )
}

function DeliveryRiskTab({
  cfg,
  onChange,
}: {
  cfg: Config
  onChange: (patch: Partial<Config>) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Delivery */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <SectionLabel>Delivery Grace Period</SectionLabel>
        <FieldRow
          label="Grace Days"
          hint="Milestone completion days beyond due date before marking 'missed'"
        >
          <NumericInput
            value={cfg.deliveryGraceDays}
            onChange={(v) => onChange({ deliveryGraceDays: Math.round(v) })}
            min={0}
            max={90}
            step={1}
            suffix="d"
          />
        </FieldRow>
      </div>

      {/* Risk Thresholds */}
      <div className="p-4 bg-paper rounded-lg border border-line">
        <SectionLabel>Risk Classification Thresholds</SectionLabel>
        <p className="text-micro text-ink-500 mt-1 mb-3">
          Risk score boundaries. Score ≤ low → Low; ≤ medium → Medium; ≤ high →
          High; above → Critical.
        </p>
        <FieldRow label="Low Boundary" hint="Risk score at or below → Low risk">
          <NumericInput
            value={cfg.riskThresholds.low}
            onChange={(v) =>
              onChange({
                riskThresholds: { ...cfg.riskThresholds, low: v },
              })
            }
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
        <FieldRow
          label="Medium Boundary"
          hint="Risk score at or below → Medium risk"
        >
          <NumericInput
            value={cfg.riskThresholds.medium}
            onChange={(v) =>
              onChange({
                riskThresholds: { ...cfg.riskThresholds, medium: v },
              })
            }
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
        <FieldRow
          label="High Boundary"
          hint="Risk score at or below → High risk; above → Critical"
        >
          <NumericInput
            value={cfg.riskThresholds.high}
            onChange={(v) =>
              onChange({
                riskThresholds: { ...cfg.riskThresholds, high: v },
              })
            }
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
      </div>
    </div>
  )
}

function SessionTab({
  cfg,
  onChange,
}: {
  cfg: Config
  onChange: (patch: Partial<Config>) => void
}) {
  const hours = Math.floor(cfg.session.maxLifetimeSeconds / 3600)
  const minutes = Math.floor((cfg.session.maxLifetimeSeconds % 3600) / 60)

  return (
    <div className="p-4 bg-paper rounded-lg border border-line">
      <SectionLabel>Session Security</SectionLabel>
      <FieldRow
        label="Max Session Lifetime"
        hint="JWT tokens expire after this many seconds; users must re-authenticate"
      >
        <NumericInput
          value={cfg.session.maxLifetimeSeconds}
          onChange={(v) =>
            onChange({ session: { maxLifetimeSeconds: Math.round(v) } })
          }
          min={300}
          max={86400}
          step={300}
          suffix="s"
        />
      </FieldRow>
      <div className="mt-3 p-2 bg-cream-50 rounded text-micro text-ink-600 font-mono">
        = {hours}h {minutes}m per session
      </div>
    </div>
  )
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'compliance', label: 'Compliance', icon: Scale },
  { id: 'verification', label: 'Verification', icon: Clock },
  { id: 'confidence', label: 'Confidence', icon: Target },
  { id: 'collusion', label: 'Collusion', icon: Network },
  { id: 'delivery', label: 'Delivery & Risk', icon: Truck },
  { id: 'session', label: 'Session', icon: Timer },
]

export default function AdminPage() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(tabParam || 'compliance')
  const [localConfig, setLocalConfig] = useState<Config | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const {
    data: rulesConfig,
    isLoading,
    error,
  } = useQuery<RulesConfig>({
    queryKey: ['admin', 'rules'],
    queryFn: async () => {
      const res = await apiClient.get<RulesConfig>('/admin/rules')
      return res.data
    },
    retry: 1,
  })

  // Seed local state from server
  useEffect(() => {
    if (rulesConfig?.config && !isDirty) {
      setLocalConfig(rulesConfig.config as Config)
    }
  }, [rulesConfig, isDirty])

  const cfg = useMemo<Config>(() => {
    const raw = (localConfig || rulesConfig?.config || DEFAULT_CONFIG) as any
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      msme: { ...DEFAULT_CONFIG.msme, ...(raw.msme || {}) },
      gst: { ...DEFAULT_CONFIG.gst, ...(raw.gst || {}) },
      pan_itr: { ...DEFAULT_CONFIG.pan_itr, ...(raw.pan_itr || {}) },
      blacklist: { ...DEFAULT_CONFIG.blacklist, ...(raw.blacklist || {}) },
      make_in_india: { ...DEFAULT_CONFIG.make_in_india, ...(raw.make_in_india || {}) },
      local_content: { ...DEFAULT_CONFIG.local_content, ...(raw.local_content || {}) },
      verificationValidity: { ...DEFAULT_CONFIG.verificationValidity, ...(raw.verificationValidity || {}) },
      confidenceThresholds: { ...DEFAULT_CONFIG.confidenceThresholds, ...(raw.confidenceThresholds || {}) },
      collusionSignalWeights: { ...DEFAULT_CONFIG.collusionSignalWeights, ...(raw.collusionSignalWeights || {}) },
      riskThresholds: { ...DEFAULT_CONFIG.riskThresholds, ...(raw.riskThresholds || {}) },
      session: { ...DEFAULT_CONFIG.session, ...(raw.session || {}) },
      compliance: {
        ...DEFAULT_CONFIG.compliance,
        ...(raw.compliance || {}),
      },
    }
  }, [localConfig, rulesConfig?.config])

  const handleChange = (patch: Partial<Config>) => {
    setLocalConfig((prev) => ({ ...(prev || cfg), ...patch }))
    setIsDirty(true)
  }

  const resetToServer = () => {
    if (rulesConfig?.config) {
      setLocalConfig(rulesConfig.config as Config)
      setIsDirty(false)
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.put('/admin/rules', cfg)
      return res.data
    },
    onSuccess: () => {
      setSavedAt(new Date())
      setIsDirty(false)
      queryClient.invalidateQueries({ queryKey: ['admin', 'rules'] })
      notify.success('Rules configuration saved', {
        description:
          'Config change committed. Ledger entry EVT-CFG-CHANGE appended.',
      })
    },
    onError: (err: any) => {
      notify.error('Failed to save configuration', { description: err.message })
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rules Configurator"
        subtitle="Tune compliance weights, verification windows, and detection thresholds"
        badge={
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-risk-medium/10 border border-risk-medium text-risk-medium text-micro font-medium">
                <AlertTriangle className="w-3 h-3" />
                Unsaved changes
              </span>
            )}
            {savedAt && !isDirty && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-risk-low/10 border border-risk-low text-risk-low text-micro font-medium">
                <CheckCircle2 className="w-3 h-3" />
                Saved {savedAt.toLocaleTimeString()}
              </span>
            )}
            {rulesConfig?.updatedAt && (
              <span className="text-micro text-ink-500">
                Last saved by:{' '}
                <strong className="text-ink-700">
                  {rulesConfig.updatedBy || 'system'}
                </strong>
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {/* 28.5 — Always visible; uses CSS disabled, never display:none */}
            <button
              type="button"
              onClick={isDirty && !saveMutation.isPending ? resetToServer : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-small font-medium transition-colors
                ${isDirty && !saveMutation.isPending
                  ? 'border-line bg-paper text-ink-700 hover:bg-cream-100 cursor-pointer'
                  : 'border-line bg-paper text-ink-300 opacity-50 cursor-not-allowed pointer-events-none'
                }`}
              aria-disabled={!isDirty || saveMutation.isPending}
              id="admin-revert-btn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Revert
            </button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Save className="w-4 h-4" />}
              onClick={() => saveMutation.mutate()}
              disabled={!isDirty || saveMutation.isPending}
              isLoading={saveMutation.isPending}
              id="admin-save-btn"
            >
              Save Configuration
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-4 p-6 bg-paper rounded-lg border border-line">
          <Skeleton variant="text" className="w-1/3 h-6" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="tableRow" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Rules configuration unavailable"
          description="Could not load the active rules config from the server. Showing defaults."
          icon={<AlertTriangle className="w-8 h-8 text-risk-medium" />}
        />
      ) : (
        <div className="flex gap-0 rounded-lg border border-line overflow-hidden shadow-xs bg-paper">
          {/* Left Sidebar Nav */}
          <aside className="w-56 flex-shrink-0 bg-cream-50 dark:bg-[#0B1B34] border-r border-line dark:border-[#1C3B68] flex flex-col">
            <div className="p-2.5 border-b border-line dark:border-[#1C3B68] flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 dark:text-slate-400 font-mono px-2 py-0.5">
                Admin Console
              </span>
              <Link
                to="/admin"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-bold bg-navy-900 text-cream-50 dark:bg-saffron-500 dark:text-navy-950"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Policy & Rules</span>
              </Link>
              <Link
                to="/admin/ledger"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-ink-700 dark:text-slate-300 hover:bg-cream-100 dark:hover:bg-[#152E54] hover:text-navy-900 transition-colors"
              >
                <Shield className="w-3.5 h-3.5 text-navy-600 dark:text-sky-400" />
                <span>Trust Ledger</span>
              </Link>
              <Link
                to="/admin/security-test"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-ink-700 dark:text-slate-300 hover:bg-cream-100 dark:hover:bg-[#152E54] hover:text-navy-900 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Immutability Proof</span>
              </Link>
              <Link
                to="/tenders"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-ink-700 dark:text-slate-300 hover:bg-cream-100 dark:hover:bg-[#152E54] hover:text-navy-900 transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-ink-500 dark:text-slate-400" />
                <span>All Tenders</span>
              </Link>
            </div>
            <div className="px-3 py-1.5 bg-cream-100/60 dark:bg-[#102649] border-b border-line dark:border-[#1C3B68]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 dark:text-slate-400 font-mono">
                Configuration Sections
              </span>
            </div>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-2.5 px-4 py-3 text-small font-medium transition-colors text-left w-full border-b border-line/60 last:border-0',
                  activeTab === id
                    ? 'bg-navy-900 text-cream-50 font-semibold'
                    : 'text-ink-700 hover:bg-cream-100 hover:text-navy-900'
                )}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', activeTab === id ? 'text-saffron-400' : 'text-ink-500')} />
                <span>{label}</span>
              </button>
            ))}
          </aside>

          {/* Right Content Panel */}
          <div className="flex-1 min-w-0 p-5">
            {activeTab === 'compliance' && <ComplianceTab cfg={cfg} onChange={handleChange} />}
            {activeTab === 'verification' && <VerificationTab cfg={cfg} onChange={handleChange} />}
            {activeTab === 'confidence' && <ConfidenceTab cfg={cfg} onChange={handleChange} />}
            {activeTab === 'collusion' && <CollusionTab cfg={cfg} onChange={handleChange} />}
            {activeTab === 'delivery' && <DeliveryRiskTab cfg={cfg} onChange={handleChange} />}
            {activeTab === 'session' && <SessionTab cfg={cfg} onChange={handleChange} />}
          </div>
        </div>
      )}

      {/* Audit footer */}
      <div className="p-3 bg-cream-50 rounded-lg border border-line flex items-start gap-2 text-micro text-ink-500">
        <Settings className="w-3.5 h-3.5 text-ink-400 flex-shrink-0 mt-0.5" />
        <p>
          Every save commits a{' '}
          <code className="font-mono text-ink-700">config_change</code> event to
          the immutable cryptographic ledger. Changes take effect immediately for
          all subsequent verification runs.
        </p>
      </div>
    </div>
  )
}
