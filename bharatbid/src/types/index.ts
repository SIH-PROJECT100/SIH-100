// BharatBid — Shared TypeScript types
// Matches FRONTEND_INTEGRATION_SPEC.md §3 and SYSTEM_ARCHITECTURE_FRONTEND.md §7

export type UserRole = 'officer' | 'admin' | 'bidder'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type TenderStatus =
  | 'draft'
  | 'open'
  | 'evaluation'
  | 'evaluation_awarded_pending_2nd'
  | 'awarded'
  | 'closed'
export type DecisionStatus =
  | 'qualified'
  | 'disqualified'
  | 'clarification_requested'
  | 'pending'

export type TrustSourceKey = 'digilocker' | 'portal_verified' | 'ai_extracted' | 'simulated'
export type TrustSourceLabel =
  | 'DigiLocker Verified'
  | 'Portal Verified'
  | 'AI Extracted'
  | 'Simulated'

export type CheckCategory =
  | 'msme'
  | 'gst'
  | 'pan_itr'
  | 'blacklist'
  | 'make_in_india'

export type LedgerAction =
  | 'verification_run'
  | 'officer_decision'
  | 'primary_decision'
  | 'secondary_decision'
  | 'pii_reveal'
  | 'config_change'
  | 'admin_action'
  | 'award_created'
  | 'award_approved'
  | 'award_decision_primary'
  | 'award_closed'
  | 'collusion_detected'
  | 'collusion_analysis_run'
  | 'fee_paid'
  | 'milestone_updated'
  | 'delivery_milestone'
  | 'badge_awarded'
  | 'document_uploaded'
  | 'document_upload_rejected'
  | 'ai_extraction_run'
  | 'cross_check_run'
  | (string & {})

export type ActorType = 'system' | 'officer' | 'admin' | 'bidder'

// ─────────────────────────────────────────────
// Core entities
// ─────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  companyPan?: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface Tender {
  id: string
  title: string
  gemTenderId: string
  status: TenderStatus
  applicationFee: number
  createdAt: string
  closingDate?: string
  _count?: {
    bidders: number
  }
}

export interface ComplianceCheck {
  category: CheckCategory
  title: string
  status: 'passed' | 'flagged' | 'warning'
  trust_source: TrustSourceKey
  trustSource: TrustSourceLabel
  simulated?: boolean
  confidence?: number
  summary: string
  evidence?: string
  verifiedAt: string
  verificationExpiresAt?: string
  uploadId?: string
  fileUrl?: string
  originalName?: string
}

export interface OfficerDecision {
  status: DecisionStatus
  reason: string | null
  officer_id: string
  timestamp: string
}

export interface Bidder {
  id: string
  tenderId: string
  companyName: string
  udyamNumber: string | null
  gstin: string | null
  pan: string | null
  overallRisk: RiskLevel
  riskScore: number
  checks: ComplianceCheck[]
  officerDecision: OfficerDecision | null
  secondaryDecision?: OfficerDecision | null
  verifiedAt: string | null
  verificationExpiresAt?: string | null
  createdAt: string
  feePaid?: boolean
  trustScore?: number
  collusionRisk?: boolean
  collusionCluster?: string | null
}

export interface BidderPII {
  pan: string
  gstin: string
  _auditId: string
}

export interface LedgerEntry {
  id: string
  bidderId?: string
  tenderId?: string
  actorType: ActorType
  actorId: string | null
  action: LedgerAction
  detail: Record<string, unknown>
  createdAt: string
  chainHash?: string
}

export interface RulesConfig {
  id: string
  config: {
    msme: { weight: number; requiredForTender: boolean }
    gst: { weight: number; flaggedPenalty: number }
    pan_itr: { weight: number; mismatchPenalty: number }
    blacklist: { weight: number; flaggedPenalty: number }
    make_in_india: { weight: number; requiredForTender: boolean }
    local_content: { minPercentage: number; weight: number }
    verificationValidity: {
      msme: number
      gst: number
      pan_itr: number
      blacklist: number
      make_in_india: number
    }
    confidenceThresholds: {
      auto_flag_below: number
      human_review_below: number
    }
    collusionSignalWeights: {
      sequential_pan: number
      address_similarity: number
      ip_prefix: number
      price_cv: number
      common_director: number
      registration_cluster: number
    }
    collusionThreshold: number
    deliveryGraceDays: number
    riskThresholds: { low: number; medium: number; high: number }
    session: { maxLifetimeSeconds: number }
    compliance?: Record<string, { weight?: number; enabled?: boolean }>
  }
  updatedAt: string
  updatedBy: string
}

// ─────────────────────────────────────────────
// Trust profile
// ─────────────────────────────────────────────

export interface TrustBadge {
  id: string
  label: string
  description: string
  earned: boolean
  earnedAt?: string
  criteria: string
}

export interface TrustProfile {
  trustScore: number
  badges: TrustBadge[]
  stats: {
    bidsSubmitted: number
    bidsWon: number
    bidsLost: number
    onTimePct: number
    milestonesFailed: number
  }
  outcomes: Array<{
    tenderId: string
    tenderTitle: string
    outcome: 'won' | 'lost' | 'disqualified' | 'pending'
    date: string
  }>
  nextBadge?: {
    id: string
    label: string
    criteria: string
    currentProgress: number
    requiredProgress: number
  }
}

// ─────────────────────────────────────────────
// Collusion detection
// ─────────────────────────────────────────────

export type CollusionSignal =
  | 'sequential_pan_issuance'
  | 'address_similarity'
  | 'ip_prefix_match'
  | 'price_cv'
  | 'common_director'
  | 'registration_cluster'

export interface CollusionResult {
  detected: boolean
  aggregateScore: number
  signals: CollusionSignal[]
  clusters: Array<{
    bidderIds: string[]
    score: number
    signals: CollusionSignal[]
  }>
  idempotencyKey: string
  computedAt: string
}

// ─────────────────────────────────────────────
// Award flow
// ─────────────────────────────────────────────

export interface Award {
  id: string
  tenderId: string
  winnerId: string
  winnerName: string
  justification: string
  standoutFactors: string[]
  status: 'primary_pending' | 'awarded' | 'closed'
  primaryOfficerId: string
  secondaryOfficerId?: string
  createdAt: string
  milestones?: Milestone[]
}

export interface Milestone {
  id: string
  awardId: string
  label: string
  dueDate: string
  completedAt?: string
  status: 'pending' | 'completed' | 'missed'
  proofUrl?: string
}

// ─────────────────────────────────────────────
// API envelope
// ─────────────────────────────────────────────

export interface ApiEnvelope<T> {
  data: T | null
  error: {
    message: string
    issues?: Array<{ path: string[]; message: string }>
  } | null
}

// ─────────────────────────────────────────────
// i18n
// ─────────────────────────────────────────────

export interface I18nGlossary {
  [key: string]: string
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down'
  version?: string
  demo_mode?: boolean
}

export interface CollusionPair {
  bidderAId: string
  bidderBId: string
  score: number
  signalsFired: string[]
}

export interface CollusionCluster {
  clusterId?: string
  bidderIds: string[]
  signalsFired: string[]
  aggregateScore: number
  pairs: CollusionPair[]
}

export interface CollusionDetectionResult {
  tenderId: string
  totalBiddersAnalyzed: number
  clusters: CollusionCluster[]
  threshold: number
  cached?: boolean
}

export interface BidderTrustProfile {
  companyHash: string
  displayName: string
  trustScore: number
  badges: string[]
  stats: {
    totalBidsSubmitted: number
    totalBidsWon: number
    totalBidsLost: number
    onTimeDeliveries: number
    lateDeliveries: number
    failedDeliveries: number
    disqualifications: number
  }
  nextGoals?: Array<{
    badge: string
    current: number
    target: number
    label: string
  }>
  lastUpdated: string
}

