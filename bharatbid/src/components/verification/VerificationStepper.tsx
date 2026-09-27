import { useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Clock, ChevronDown, ChevronUp, ShieldCheck, Sparkles, Database, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

export interface StageDisplay {
  stage: string;
  status: 'passed' | 'failed' | 'warning' | 'pending' | 'not_applicable';
  completedAt: string | null;
  detail: Record<string, unknown>;
}

export const STAGE_LABELS: Record<string, string> = {
  uploaded: 'Upload',
  ai_extraction: 'AI Extract',
  cross_check: 'Cross-Check',
  portal_verification: 'Portal',
  expiry_check: 'Expiry',
  confidence_gate: 'Confidence',
  officer_review: 'Officer',
};

export function VerificationStepper({ stages }: { stages: StageDisplay[] }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {stages.map((s, i) => (
        <div key={s.stage} className="flex items-center shrink-0">
          <div className="flex flex-col items-center gap-1 min-w-[56px]">
            <StageDot status={s.status} />
            <span className="text-[11px] font-semibold text-navy-800 dark:text-slate-300">
              {STAGE_LABELS[s.stage] ?? s.stage}
            </span>
          </div>
          {i < stages.length - 1 && <div className="h-0.5 w-6 bg-navy-200 dark:bg-slate-700 mx-1" />}
        </div>
      ))}
    </div>
  );
}

export function StageDot({ status }: { status: string }) {
  const base = 'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-300';
  if (status === 'passed') {
    return (
      <div className={`${base} bg-green-500 border-green-600 shadow-xs shadow-green-200`}>
        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className={`${base} bg-red-500 border-red-600 shadow-xs shadow-red-200`}>
        <XCircle className="w-2.5 h-2.5 text-white" />
      </div>
    );
  }
  if (status === 'warning') {
    return (
      <div className={`${base} bg-amber-500 border-amber-600 shadow-xs shadow-amber-200`}>
        <AlertTriangle className="w-2.5 h-2.5 text-white" />
      </div>
    );
  }
  if (status === 'not_applicable') {
    return <div className={`${base} border-navy-300 border-dashed bg-transparent`} />;
  }
  // pending — animated pulse
  return <div className={`${base} border-navy-300 bg-navy-100 animate-pulse`} />;
}

export function StatusPill({
  status,
  onClick,
  isOpen,
}: {
  status: string;
  onClick?: () => void;
  isOpen?: boolean;
}) {
  const getPillData = () => {
    switch (status) {
      case 'verified':
        return { variant: 'success' as const, label: 'Verified', icon: <CheckCircle2 className="w-4 h-4" /> };
      case 'warning':
        return { variant: 'warning' as const, label: 'Warning / Manual Review Required', icon: <AlertTriangle className="w-4 h-4" /> };
      case 'failed':
        return { variant: 'danger' as const, label: 'Failed — Verification Ineligible', icon: <XCircle className="w-4 h-4" /> };
      case 'human_review':
        return { variant: 'warning' as const, label: 'Human Review Required', icon: <AlertTriangle className="w-4 h-4" /> };
      case 'in_progress':
      default:
        return { variant: 'info' as const, label: 'Verification In Progress...', icon: <Clock className="w-4 h-4 animate-spin" /> };
    }
  };

  const { variant, label, icon } = getPillData();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex items-center justify-between w-full px-4 py-3 rounded-xl border text-sm font-semibold transition-all duration-200 text-left mt-3',
        variant === 'success' && 'bg-emerald-50/90 border-emerald-300 text-emerald-950 hover:bg-emerald-100',
        variant === 'warning' && 'bg-amber-50/90 border-amber-300 text-amber-950 hover:bg-amber-100',
        variant === 'danger' && 'bg-rose-50/90 border-rose-300 text-rose-950 hover:bg-rose-100',
        variant === 'info' && 'bg-sky-50/90 border-sky-300 text-sky-950 animate-pulse'
      )}
    >
      <div className="flex items-center gap-2.5">
        {icon}
        <div>
          <span className="font-bold text-base">{label}</span>
          <p className="text-xs text-ink-600 dark:text-slate-400 font-normal mt-0.5">
            {status === 'in_progress' ? 'Multi-tier verification pipeline running...' : 'Click to inspect rule checks, confidence scores & extracted data'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md bg-white/70 border border-black/5">
        <span>{isOpen ? 'Hide Rules' : 'Inspect Rules'}</span>
        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </div>
    </button>
  );
}

export function StageDetailRow({ stage }: { stage: StageDisplay }) {
  const [expanded, setExpanded] = useState(true);
  const detail = (stage.detail || {}) as Record<string, any>;

  const getStageHeader = () => {
    switch (stage.stage) {
      case 'uploaded':
        return { title: 'Document Ingestion & Cryptographic Checksum', icon: <FileText className="w-4 h-4 text-navy-700" /> };
      case 'ai_extraction':
        return { title: `AI Multi-Modal Extraction (${detail.model || 'gemini-2.5-flash'})`, icon: <Sparkles className="w-4 h-4 text-purple-600" /> };
      case 'cross_check':
        return { title: 'Statutory Cross-Check & Consistency Engine', icon: <ShieldCheck className="w-4 h-4 text-blue-600" /> };
      case 'portal_verification':
        return { title: `Portal Verification (${detail.source || 'Official Database'})`, icon: <Database className="w-4 h-4 text-emerald-600" /> };
      case 'expiry_check':
        return { title: 'Validity & Expiry Gate', icon: <Clock className="w-4 h-4 text-amber-600" /> };
      case 'confidence_gate':
        return { title: 'Confidence Scoring & Governance Gate', icon: <AlertTriangle className="w-4 h-4 text-amber-600" /> };
      case 'officer_review':
        return { title: 'Statutory Audit & Review Determination', icon: <ShieldCheck className="w-4 h-4 text-navy-800" /> };
      default:
        return { title: STAGE_LABELS[stage.stage] ?? stage.stage, icon: <ShieldCheck className="w-4 h-4 text-navy-700" /> };
    }
  };

  const { title, icon } = getStageHeader();

  return (
    <div className="p-3.5 rounded-lg border border-line bg-paper dark:bg-slate-900 flex flex-col gap-2 transition-all">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-ink-900 dark:text-slate-100">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              stage?.status === 'passed'
                ? 'success'
                : stage?.status === 'failed'
                ? 'danger'
                : stage?.status === 'warning'
                ? 'warning'
                : 'default'
            }
          >
            {(stage?.status || 'PENDING').toUpperCase()}
          </Badge>
          {expanded ? <ChevronUp className="w-4 h-4 text-ink-400" /> : <ChevronDown className="w-4 h-4 text-ink-400" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-1 pt-2 border-t border-line/60 flex flex-col gap-2 text-xs text-ink-700 dark:text-slate-300">
          {/* AI Extraction Data */}
          {detail.extractedFields ? (
            <div className="bg-cream-50/70 dark:bg-slate-800/60 p-2.5 rounded-md border border-line flex flex-col gap-1.5">
              <span className="font-semibold text-ink-800 dark:text-slate-200">Extracted Fields:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                {Object.entries(detail.extractedFields as Record<string, any>).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between bg-white dark:bg-slate-900 px-2 py-1 rounded border border-line">
                    <span className="text-ink-500 uppercase">{key.replace(/_/g, ' ')}:</span>
                    <strong className="text-navy-950 dark:text-slate-100">{String(val)}</strong>
                  </div>
                ))}
              </div>
              {detail.confidence !== undefined && (
                <div className="flex items-center justify-between mt-1 text-ink-800">
                  <span>Confidence Score:</span>
                  <span className={cn('font-bold font-mono px-2 py-0.5 rounded text-xs', Number(detail.confidence) >= 0.85 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                    {(Number(detail.confidence) * 100).toFixed(0)}% (Score: {String(detail.confidence)})
                  </span>
                </div>
              )}
            </div>
          ) : null}

          {/* Cross Checks */}
          {Array.isArray(detail.checks) && (
            <div className="flex flex-col gap-1.5">
              <span className="font-semibold text-ink-800 dark:text-slate-200">Cross-Verification Checks:</span>
              {detail.checks.map((chk: any, idx: number) => (
                <div key={idx} className="flex items-start justify-between p-2 rounded bg-cream-50/50 dark:bg-slate-800/40 border border-line">
                  <div className="flex flex-col">
                    <span className="font-semibold text-ink-900 dark:text-slate-100">
                      Rule: {chk.field?.replace(/_/g, ' ')}
                    </span>
                    {chk.note && (
                      <span className={cn('text-xs mt-0.5', chk.result === 'variance' ? 'text-amber-700 font-semibold' : 'text-ink-600 dark:text-slate-400')}>
                        {chk.note}
                      </span>
                    )}
                  </div>
                  <Badge variant={chk.result === 'match' || chk.result === 'valid' ? 'success' : 'warning'}>
                    {chk.result}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Expiry Details */}
          {detail.daysExpired !== undefined && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-900 font-medium">
              <p className="font-bold">❌ Critical Expiry Failure:</p>
              <p className="mt-0.5">{String(detail.note)}</p>
              <div className="flex items-center gap-4 mt-1 font-mono text-[11px]">
                <span>Bid Date: {String(detail.bidDate)}</span>
                <span>Valid Until: {String(detail.validUntil)}</span>
                <span className="font-bold text-rose-700">Days Expired: {String(detail.daysExpired)}</span>
              </div>
            </div>
          )}

          {/* Confidence Gate Details */}
          {detail.extractionConfidence !== undefined && (
            <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900">
              <p className="font-bold">⚠ Statutory Threshold Alert:</p>
              <p className="mt-0.5">{String(detail.note)}</p>
              <div className="flex items-center gap-4 mt-1 font-mono text-[11px]">
                <span>AI Confidence: {String(detail.extractionConfidence)}</span>
                <span>Review Threshold: {String(detail.humanReviewThreshold)}</span>
                <span>Auto-Approve: {String(detail.autoApproveThreshold)}</span>
              </div>
            </div>
          )}

          {/* Note or reason */}
          {detail.note && detail.daysExpired === undefined && detail.extractionConfidence === undefined && (
            <div className="text-xs text-ink-600 bg-cream-50 p-2 rounded border border-line">
              <strong>Observation: </strong>{String(detail.note)}
            </div>
          )}
          {detail.reason && (
            <div className={cn('text-xs p-2 rounded border font-medium', stage.status === 'failed' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800')}>
              <strong>Review Directive: </strong>{String(detail.reason)}
            </div>
          )}
          {detail.source && (
            <div className="text-[11px] text-ink-500 font-mono">
              Source: {String(detail.source)} · Result: {String(detail.result || 'ACTIVE')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
