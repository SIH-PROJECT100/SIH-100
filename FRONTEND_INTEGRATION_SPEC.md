# Frontend Integration Specification & Contract

**GeM Bid Compliance Verification Platform · SIH 2026 Problem Statement 100**

This document serves as the **complete engineering spec for the Frontend team**. It details the API contract, exact data types, UI screen requirements, trust badge rendering rules, and interaction patterns required to consume the backend API seamlessly.

---

## 🌐 1. Base Configuration & Communication Standards

- **API Base URL:** `http://localhost:4000`
- **Default Headers:**
  ```http
  Content-Type: application/json
  Authorization: Bearer <jwt_token>
  ```
- **Envelope Response Format:** Every single backend response follows this uniform envelope:
  ```json
  // Success Response (HTTP 200 / 201)
  {
    "data": { ... },
    "error": null
  }

  // Error Response (HTTP 400, 401, 403, 404, 409, 429, 500)
  {
    "data": null,
    "error": {
      "message": "Human-readable explanation of error",
      "issues": [ ... ] // Optional Zod validation details
    }
  }
  ```

---

## 🔑 2. Authentication & Token Lifecycle

### Login Request
- **Endpoint:** `POST /auth/login`
- **Payload:**
  ```json
  {
    "email": "officer@demo.com",
    "password": "demo1234!"
  }
  ```
- **Response:**
  ```json
  {
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsIn...",
      "user": {
        "id": "user-officer-001",
        "email": "officer@demo.com",
        "name": "Priya Sharma",
        "role": "officer"
      }
    },
    "error": null
  }
  ```

### Frontend Auth Client Rules
1. **Store Token:** Save `token` in `localStorage` or React Auth Context.
2. **Axios / Fetch Interceptor:** Attach `Authorization: Bearer ${token}` to all outgoing API requests (except `/auth/login` and `/health`).
3. **Handle 401 Unauthorized:** If any request returns `401`, clear token, redirect user to `/login`, and display toast: *"Session expired, please login again."*
4. **Handle 403 Forbidden:** If user attempts an admin route (`/admin/*`) without `admin` role, display toast: *"Access denied: Administrator privileges required."* Do not log user out.
5. **Handle 429 Too Many Requests:** If `/auth/login` triggers rate limiting, show inline banner: *"Too many login attempts. Please wait a few minutes before trying again."*

---

## 📦 3. TypeScript Interfaces

```typescript
export type UserRole = 'officer' | 'admin' | 'bidder';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type TenderStatus = 'draft' | 'open' | 'evaluation' | 'awarded' | 'closed';
export type DecisionStatus = 'qualified' | 'disqualified' | 'clarification_requested' | 'pending';
// Trust Provenance Enum definitions
export type TrustSourceKey = 'digilocker' | 'portal_verified' | 'ai_extracted' | 'simulated';
export type TrustSourceLabel = 'DigiLocker Verified' | 'Portal Verified' | 'AI Extracted' | 'Simulated';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface Tender {
  id: string;
  title: string;
  gemTenderId: string;
  status: TenderStatus;
  createdAt: string;
  _count?: {
    bidders: number;
  };
}

export interface ComplianceCheck {
  category: 'msme' | 'gst' | 'pan_itr' | 'blacklist' | 'make_in_india';
  title: string;
  status: 'passed' | 'flagged' | 'warning';
  /** Machine-readable key (recommended for programmatic checks & switch statements) */
  trust_source: TrustSourceKey;
  /** Human-readable display label (for rendering directly on badge pills) */
  trustSource: TrustSourceLabel;
  simulated?: boolean;
  confidence?: number;
  summary: string;
  evidence?: string;
  verifiedAt: string;
}

export interface OfficerDecision {
  status: DecisionStatus;
  reason: string | null;
  officer_id: string;
  timestamp: string;
}

export interface Bidder {
  id: string;
  tenderId: string;
  companyName: string;
  udyamNumber: string | null;
  gstin: string | null;
  pan: string | null;
  overallRisk: RiskLevel;
  riskScore: number; // 0 (lowest risk) to 100 (highest risk)
  checks: ComplianceCheck[];
  officerDecision: OfficerDecision | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  bidderId: string;
  actorType: 'system' | 'officer' | 'admin';
  actorId: string | null;
  action: 'verification_run' | 'officer_decision' | 'pii_reveal' | 'config_change' | 'admin_action';
  detail: Record<string, any>;
  createdAt: string;
}

export interface RulesConfig {
  id: string;
  config: {
    msme: { weight: number; requiredForTender: boolean };
    gst: { weight: number; flaggedPenalty: number };
    pan_itr: { weight: number; mismatchPenalty: number };
    blacklist: { weight: number; flaggedPenalty: number };
    make_in_india: { weight: number; requiredForTender: boolean };
    local_content: { minPercentage: number; weight: number };
    riskThresholds: { low: number; medium: number; high: number };
  };
  updatedAt: string;
  updatedBy: string;
}
```

---

## 🖥 4. Screen-by-Screen UI Specifications

### Screen 1: Login Page (`/login`)
- **Inputs:** Email, Password, Submit button.
- **Demo Helper Buttons (Crucial for live judging):**
  - Click `[Demo Officer]` -> Auto-fills `officer@demo.com` / `demo1234!`
  - Click `[Demo Admin]` -> Auto-fills `admin@demo.com` / `demo1234!`
  - Click `[Demo Bidder]` -> Auto-fills `bidder@demo.com` / `demo1234!`
- **Redirects:**
  - `officer` -> `/tenders`
  - `admin` -> `/admin`
  - `bidder` -> `/tenders`

---

### Screen 2: Tenders Dashboard (`/tenders`)
- **Endpoint:** `GET /tenders`
- **Display:** Grid of Tender Cards showing:
  - Title (e.g. *Procurement of IT Hardware and Peripherals 2026*)
  - GeM Tender ID badge (`GEM/2026/B/3245678`)
  - Status pill (`Evaluation` - Amber)
  - Total Bidders counter: `12 Bidders Submitted`
  - Action button: *"Open Triage Workspace"* -> navigates to `/tenders/:id`.

---

### Screen 3: Tender Detail & Bulk Triage Table (`/tenders/:id`)
*This is the core USP screen of the pitch.*
- **Endpoints:**
  - `GET /tenders/:id`
  - `GET /tenders/:id/bidders` (supports query params `?risk=critical&status=pending`)
- **Header Summary Bar:**
  - Tender Name & GeM Tender ID
  - Risk Distribution Pill Counter: `2 Critical` (Red), `3 High` (Orange), `4 Medium` (Amber), `3 Low` (Green)
  - Filter Chips: `[All]`, `[Critical Risk]`, `[High Risk]`, `[Medium Risk]`, `[Low Risk]`, `[Simulated Only]`
- **Bulk Triage Table Columns:**
  1. **Company Name:** Title, registration numbers.
  2. **Risk Badge & Score:**
     - `CRITICAL` (Score 80–100): Red badge (`bg-red-100 text-red-800 border-red-300`)
     - `HIGH` (Score 55–79): Orange badge (`bg-orange-100 text-orange-800 border-orange-300`)
     - `MEDIUM` (Score 25–54): Yellow badge (`bg-yellow-100 text-yellow-800 border-yellow-300`)
     - `LOW` (Score 0–24): Green badge (`bg-emerald-100 text-emerald-800 border-emerald-300`)
  3. **Trust Provenance Badges (Rendered dynamically based on checks):**
     - 🛡️ `DigiLocker Verified` (Blue)
     - 🏛️ `Portal Verified` (Indigo)
     - 🤖 `AI Extracted` (Purple)
     - ⚠️ `Simulated Tier` (Gray/Dashed)
  4. **Checks Quick Summary:** Visual icons for MSME, GST, PAN, Debarment (Green Check or Red Alert icon).
  5. **Officer Decision Status:** `Pending` (Gray), `Qualified` (Green), `Disqualified` (Red), `Clarification Requested` (Blue).
  6. **Actions:**
     - `[Inspect & Decide]` -> Opens Bidder Detail Drawer.
     - `[Verify]` -> Calls `POST /bidders/:id/verify`.

---

### Screen 4: Bidder Detail Drawer / Modal (`/bidders/:id`)
*Triggered when selecting a bidder from the triage table.*
- **Endpoint:** `GET /bidders/:id`
- **Component 1: Company Profile & PII Masking Panel**
  - Company Name, Udyam number.
  - **Masked PII Fields:**
    - PAN: `AAACS****H`
    - GSTIN: `06AAA****8`
  - **"Reveal Full PII" Button (Officer / Admin only):**
    - Triggers `GET /bidders/:id/pii`.
    - Returns unmasked PAN & GSTIN plus `_auditId`.
    - Updates fields on screen.
    - Displays Toast notification:
      `✅ PII Unmasked — Audit Trail Entry Logged (#f1c3fce9-...)`
- **Component 2: Compliance Verification Accordion**
  - Lists all checks from `bidder.checks`:
    - Category name & check description.
    - Trust Source badge (`DigiLocker` / `Portal` / `AI Extracted` / `Simulated`).
    - Confidence meter (e.g. `95% Confidence`).
    - Evidence string (e.g. *"Matched against Ministry of MSME Udyam database structure"*).
- **Component 3: Re-Verify Action**
  - Button: `[⚡ Re-Run Full Verification]`
  - Calls: `POST /bidders/:id/verify`
  - Triggers loading spinner across the drawer while multi-tier checks re-evaluate.
  - Refreshes bidder checks, risk score, and appends a `verification_run` ledger entry.
- **Component 4: Officer Decision Card**
  - Radio/Button Group:
    - `[✅ Qualify]`
    - `[❌ Disqualify]`
    - `[❓ Request Clarification]`
  - **Reason Input (Textarea):**
    - **MANDATORY** if `Disqualify` or `Request Clarification` is selected.
    - If user attempts to submit with empty reason, show validation error: *"Reason is mandatory when disqualifying or requesting clarification."*
  - **Submit Decision Button:**
    - Calls: `POST /bidders/:bidderId/decision` with:
      ```json
      {
        "status": "disqualified",
        "reason": "GST registration was permanently canceled on 2025-11-12"
      }
      ```
    - Shows Toast: `Decision recorded and appended to Trust Ledger`.
    - Updates bidder status in triage table immediately.

---

### Screen 5: Admin Console (`/admin`)
*Accessible only to users with role `admin`.*
- **Tabs:**
  1. **Dynamic Rules Configurator (`/admin/rules`)**
     - Endpoint: `GET /admin/rules` & `PUT /admin/rules`
     - Sliders / number inputs for:
       - MSME Category Weight (e.g. `15%`)
       - GST Penalty Multiplier (e.g. `25%`)
       - Debarment Penalty Multiplier (e.g. `30%`)
       - Make in India Weight (e.g. `10%`)
       - Risk Thresholds (Low < 25, Medium < 55, High < 80)
     - `[Save Changes]` button -> sends `PUT /admin/rules`.
  2. **Officer Trust Ledger Explorer (`/admin/ledger`)**
     - Endpoint: `GET /admin/ledger?bidderId=<optional>`
     - Displays chronological append-only audit trail table:
       - Timestamp (`2026-09-12 00:57:12`)
       - Action Badge:
         - `verification_run` (Blue)
         - `officer_decision` (Green)
         - `pii_reveal` (Orange)
         - `config_change` (Purple)
       - Actor Type (`officer`, `admin`, `system`) & Actor ID
       - Target Bidder ID
       - Details Expandable JSON view.
     - Search bar to filter ledger by `bidderId`.

---

## 🎨 5. Design Tokens & Styling Guide

| Element | Color Code | Tailwind Class Equivalent | Purpose |
|---|---|---|---|
| **Primary Navy** | `#0F2942` | `bg-[#0F2942]` / `text-[#0F2942]` | Government / GeM Brand Header, Navigation |
| **Accent Orange** | `#F37021` | `bg-[#F37021]` / `text-[#F37021]` | GeM Primary Accent, Action Buttons |
| **Critical Risk** | `#DC2626` | `bg-red-600` / `text-red-600` | Severe compliance violations, debarment |
| **High Risk** | `#EA580C` | `bg-orange-600` / `text-orange-600` | Turnover mismatch, GST irregularities |
| **Medium Risk** | `#D97706` | `bg-amber-600` / `text-amber-600` | Expired certifications, secondary warnings |
| **Low Risk** | `#059669` | `bg-emerald-600` / `text-emerald-600` | 100% verified compliance, clean records |
| **DigiLocker Badge**| `#2563EB` | `bg-blue-100 text-blue-800` | Cryptographic Tier 1 validation |
| **Portal Badge** | `#4F46E5` | `bg-indigo-100 text-indigo-800` | Government Portal checksum validation |
| **AI Badge** | `#7C3AED` | `bg-purple-100 text-purple-800` | Document extraction via Gemini |
| **Simulated Badge** | `#64748B` | `bg-slate-100 text-slate-700 border-dashed` | Explicit mock indicators |

---

## 🚀 6. Next Steps for Frontend Devs

1. Clone repo: `git clone https://github.com/SIH-PROJECT100/SIH-100.git`
2. Create frontend folder: `npm create vite@latest frontend -- --template react-ts`
3. Install dependencies:
   ```bash
   npm install lucide-react clsx tailwindcss axios @tanstack/react-query
   ```
4. Configure Axios base URL to `http://localhost:4000`.
5. Build the 5 screens outlined in Section 4 above.
