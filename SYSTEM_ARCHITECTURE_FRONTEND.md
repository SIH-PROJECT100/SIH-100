# System Architecture — Frontend

SIH 2026 · PS 100 · Officer Verification Workspace, Admin Console, Bidder Portal

This is the frontend's self-contained build reference: design system, routes, component
tree, state management, and the exact data shapes the frontend consumes. For backend
services, the full API contract, and integrations, see `SYSTEM_ARCHITECTURE_BACKEND.md` —
the shapes here match it exactly.

---

## Table of Contents

1. [Design System](#1-design-system)
2. [Route Map](#2-route-map)
3. [Component Tree — Tender Triage View](#3-component-tree--tender-triage-view)
4. [Component Tree — Bidder Detail View](#4-component-tree--bidder-detail-view)
5. [State Management](#5-state-management)
6. [API Client Layer](#6-api-client-layer)
7. [Data Types Consumed by the Frontend](#7-data-types-consumed-by-the-frontend)
8. [Build Order](#8-build-order)

---

## 1. Design System

### 1.1 Palette

Government-tech, trustworthy, not flashy. Every color has a semantic meaning — never use
red, amber, or green decoratively.

| Token | Hex | Use |
|---|---|---|
| `navy` | `#12233F` | Headers, primary nav, primary buttons |
| `teal` | `#0E7C7B` | Accent, links, "verified" trust badges, active states |
| `amber` | `#B8860B` | Medium risk, pending states, "AI extracted" trust badges |
| `red` | `#A3372E` | High risk, flagged items, errors |
| `green` | `#2E7D4F` | Low risk, verified/passed states |
| `light-grey` | `#F2F4F7` | Card backgrounds, table stripe |
| `mid-grey` | `#5B6472` | Secondary text, captions |
| `dark-text` | `#1B1F27` | Primary body text |

**Rule:** every risk/status color is paired with an icon or label — never color alone
(accessibility, and it survives a projector or printed handout at the finale).

### 1.2 Typography

- **UI font:** Inter or system-ui stack — clean, highly legible at small sizes, free
- **Headings:** 600–700 weight, navy
- **Body:** 400 weight, dark-text, minimum 14px in officer-facing screens (this audience
  skews older — do not go below 14px anywhere in the Officer Workspace)
- **Monospace:** for IDs, GSTINs, PANs — use `font-mono` so characters like `0`/`O`, `1`/`I`
  are visually distinct

### 1.3 Spacing & Grid

- 8px base unit (Tailwind default scale: `p-2` = 8px, `p-4` = 16px, etc.)
- Cards: 16px internal padding, 12px gap between cards
- Table rows: minimum 48px height (touch-friendly, readable at a glance)

### 1.4 Core Components (build these first — everything else composes from them)

#### `<RiskBadge />`
```tsx
type RiskLevel = "low" | "medium" | "high";

interface RiskBadgeProps {
  level: RiskLevel;
  label?: string; // defaults to "Low Risk" / "Medium Risk" / "High Risk"
}
```
Renders a colored pill **with an icon** (check-circle / alert-triangle / alert-octagon) and
text label. Never renders color-only.

#### `<TrustBadge />`
```tsx
type TrustSource = "digilocker" | "portal_verified" | "ai_extracted" | "simulated";

interface TrustBadgeProps {
  source: TrustSource;
  confidence?: number; // 0–1, required when source === "ai_extracted"
}
```
| source | Label shown | Style |
|---|---|---|
| `digilocker` | "DigiLocker Verified" | solid teal, shield-check icon |
| `portal_verified` | "Portal Verified" | outline teal, check icon |
| `ai_extracted` | "AI Extracted — {n}% confidence" | amber, sparkle icon |
| `simulated` | "Simulated" | grey, info icon |

This component is the single most-reused piece of UI — the entire "trust provenance" USP
lives inside it. Build it once, get it exactly right, use it everywhere.

#### `<ComplianceCard />`
One per verification category (Udyam, GST, PAN/ITR, MCA21, Startup India, NSIC, EPFO/ESIC,
Make in India). Collapsed state shows category name, status icon, and `<TrustBadge>`.
Expands on click to show extracted value, evidence text, and linked source documents.

#### `<DecisionPanel />`
Always visible at the bottom of Bidder Detail View, visually distinct (bordered, slightly
elevated). Three actions: **Qualify**, **Seek Clarification**, **Disqualify (Officer
Decision)** — each opens a mandatory reason textarea before submission. Submitting never
edits or replaces the system's original verification — it appends a new entry to the Trust
Ledger. Consider a small inline note near the submit button reinforcing this ("This adds a
new entry — nothing is overwritten") since it's the product's headline USP (`USP.md`) and
worth surfacing at the exact moment it's true, not just in marketing copy.

#### `<EvidenceCompare />`
Side-by-side view for a flagged inconsistency — e.g. two PAN values from two different
documents, both highlighted at the point of difference.

### 1.5 Microcopy Rules

- Never write "AI says X" → write "Flagged: X" with evidence attached
- Never use "Reject" in officer-facing UI → use "Disqualify (Officer Decision)"
- Every confidence number gets a plain-language anchor: `"87% — high confidence"`
- Every automated verification carries a "Last verified: {timestamp}"
- Never say "audit log" or "history" in officer-facing UI → say "Ledger" consistently — it's
  the product's headline USP (`USP.md`), so the word itself should be visible on screen, not
  just true underneath it
- Never say "update" or "edit" for a decision/override action → say "append" or "add to the
  ledger," since the whole point is that nothing is ever overwritten

---

## 2. Route Map

| Route | Screen | Primary user |
|---|---|---|
| `/` | Tender Triage View (default landing) | Officer |
| `/tenders/:tenderId/bidders/:bidderId` | Bidder Detail View | Officer |
| `/admin/rules` | Rules configuration | Admin |
| `/admin/ledger` | Trust Ledger viewer | Admin |
| `/bidder/upload` | Document upload / DigiLocker connect | Bidder |
| `/bidder/status` | Own compliance status | Bidder |

---

## 3. Component Tree — Tender Triage View

**Build this first.** It is the killer screen — bulk, risk-sorted bidder table.

```
<TenderTriagePage>
 ├─ <TenderHeader tender={...} />              // name, category, closing date, "X of Y need attention"
 ├─ <FilterRail>
 │   ├─ <RiskFilter />
 │   ├─ <StatusFilter />
 │   └─ <CategoryFilter />
 ├─ <BulkActionBar selectedIds={...} />         // appears on row selection
 └─ <BidderTable data={bidders} sortBy="risk">
     └─ <BidderRow>                             // per row
         ├─ companyName
         ├─ <RiskBadge level={bidder.overall_risk} />
         ├─ <TrustSourceIconRow checks={bidder.checks} />  // compact icon strip
         └─ "View" action → navigates to Bidder Detail
```

Use **TanStack Table** for sorting/filtering — don't hand-roll this, it needs to feel fast
with 100+ rows during the demo.

---

## 4. Component Tree — Bidder Detail View

```
<BidderDetailPage>
 ├─ <BidderHeader>
 │   ├─ companyName
 │   ├─ <RiskBadge level={overall_risk} />
 │   └─ plain-language summary line
 ├─ <ComplianceGrid>
 │   └─ <ComplianceCard category="PAN" ... />    // one per category, repeated
 │       └─ (expanded) <EvidenceCompare />
 ├─ <DocumentViewerPanel document={...} highlightField={...} />
 └─ <DecisionPanel bidderId={...} onDecide={...} />
```

---

## 5. State Management

- **Server state:** TanStack Query for every API call (`useQuery` for reads, `useMutation`
  for decision submission and rule updates). Don't build a Redux store for a 36-hour
  project.
- **Local UI state:** React `useState`/`useReducer` for filters, selected rows, expanded
  cards.
- **No sensitive data in browser storage** — never persist bidder PII to `localStorage` or
  `sessionStorage`. Keep it in memory / React Query cache only.

---

## 6. API Client Layer

One typed client module (`src/api/client.ts`) mirroring the backend contract exactly:

```ts
export async function getTenderBidders(tenderId: string): Promise<Bidder[]> { ... }
export async function getBidder(bidderId: string): Promise<Bidder> { ... }
export async function triggerVerification(bidderId: string): Promise<Bidder> { ... }
export async function submitDecision(bidderId: string, decision: OfficerDecision): Promise<void> { ... }
```

This is what lets frontend and backend build in parallel from hour 2: agree the shapes in
Section 7 first, then each side codes against the contract, not against each other.

**Response envelope convention** (matches backend exactly):
```json
{ "data": { ... }, "error": null }
{ "data": null, "error": { "message": "..." } }
```

---

## 7. Data Types Consumed by the Frontend

These match `SYSTEM_ARCHITECTURE_BACKEND.md` field-for-field. If you change one, change both.

```ts
interface Bidder {
  bidder_id: string;
  company_name: string;
  tender_id: string;
  overall_risk: "low" | "medium" | "high";
  last_verified_at: string; // ISO 8601
  checks: ComplianceCheck[];
  officer_decision: OfficerDecision;
}

interface ComplianceCheck {
  category: "PAN" | "udyam" | "gst" | "mca21" | "startup_india" | "nsic" | "epfo_esic" | "make_in_india";
  status: "verified" | "pending" | "flagged";
  trust_source: "digilocker" | "portal_verified" | "ai_extracted" | "simulated";
  confidence: number; // 0–1
  value: string;
  evidence: string;
  documents: string[]; // filenames/refs
}

interface OfficerDecision {
  status: "pending" | "qualified" | "disqualified" | "clarification_requested";
  reason: string | null;
  officer_id: string | null;
  timestamp: string | null; // ISO 8601
}

interface Tender {
  tender_id: string;
  title: string;
  category: string;
  closing_date: string;
  bidder_count: number;
  bidders_needing_attention: number; // derived: count where overall_risk != "low"
}
```

---

## 8. Build Order

1. `<RiskBadge>` and `<TrustBadge>` in isolation, against static mock data.
2. Tender Triage View with a hardcoded mock `Bidder[]` array (don't wait on the backend).
3. Swap mock data for the real `getTenderBidders()` call once the backend endpoint exists.
4. Bidder Detail View, same mock-first approach.
5. Decision Panel + submission flow.
6. Admin Console and Bidder Portal only if time remains — see `SOLUTION.md` §5 for the
   full must-have/should-have/out-of-scope breakdown.
