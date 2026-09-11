# GeM Bid Compliance Verification Platform

**Smart India Hackathon (SIH) 2026 · Problem Statement 100**

> **AI-assisted decision-support platform for Government e-Marketplace (GeM) Procurement Officers to verify bidder eligibility (MSME/Udyam, GST, PAN/ITR, MCA21, Startup India, Make in India, and debarment/blacklisting) in a single pane of glass, backed by an immutable dual-layer Trust Ledger.**

---

## 📑 Table of Contents
- [Executive Overview](#-executive-overview)
- [Key Innovations & USP](#-key-innovations--usp)
- [System Architecture](#-system-architecture)
- [Repository Structure](#-repository-structure)
- [Quick Start: Running the Backend Locally](#-quick-start-running-the-backend-locally)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Database Provisioning & Security Setup](#2-database-provisioning--security-setup)
  - [3. Environment Configuration](#3-environment-configuration)
  - [4. Install Dependencies & Build](#4-install-dependencies--build)
  - [5. Run Migrations & Apply Ledger Lockdown](#5-run-migrations--apply-ledger-lockdown)
  - [6. Seed Demo Data](#6-seed-demo-data)
  - [7. Start the Backend API Server](#7-start-the-backend-api-server)
- [Demo Credentials](#-demo-credentials)
- [Automated Verification & Test Suites](#-automated-verification--test-suites)
- [Judges' 90-Second Immutability Proof Runbook](#-judges-90-second-immutability-proof-runbook)
- [API Route Reference](#-api-route-reference)
- [Documentation Map](#-documentation-map)

---

## 🏛 Executive Overview

Procurement officers evaluating tenders on GeM currently face severe friction:
- **10+ Disconnected Portals:** Officers manually cross-verify Udyam, GSTN, Income Tax PAN, MCA21, and Debarment lists.
- **Bulk Fatigue:** Typical tenders attract 50 to 200+ bidders. Manual verification takes 2–4 hours per tender, creating procurement bottlenecks.
- **Risk of Overlooked Flags:** Subcontractor blacklists, canceled GST registrations, or turnover discrepancies are easily missed under time pressure.
- **Audit Defensibility:** Officers face personal vigilance liability if disqualifications or qualifications lack a verifiable, tamper-evident audit trail.

**Our Solution:** An AI-orchestrated bulk triage dashboard that extracts compliance indicators across three connector tiers, computes deterministic risk scores, and logs all evaluations, decisions, and PII reveals to a tamper-proof PostgreSQL ledger.

---

## 🌟 Key Innovations & USP

1. **Trust-Provenance Bulk Triage:** Every check badge visibly carries its origin tier:
   - `DigiLocker Verified` (Cryptographic verification via government-approved document repositories)
   - `Portal Verified` (Direct API / QR / checksum cross-validation)
   - `AI Extracted` (Gemini-powered entity extraction with strict schema validation)
   - `Simulated` (Explicitly labeled sandbox fallbacks for third-party mock services)
2. **Dual-Layer Append-Only Trust Ledger:** Complete immutability enforced at two independent database layers:
   - **Layer 1 (Postgres Role Grants):** The application database user (`backend_app`) is only granted `SELECT` and `INSERT` on `ledger_entries`. `UPDATE`, `DELETE`, and `TRUNCATE` are never granted.
   - **Layer 2 (Postgres Triggers):** An unconditional `BEFORE UPDATE OR DELETE OR TRUNCATE` trigger raises an uncatchable database exception even if someone accesses the database with superuser privileges.
3. **Atomic PII Reveal Auditing:** Sensitive PAN and GSTIN numbers are masked by default (`AAACS****H`, `06AAA****8`). Officers can reveal unmasked values via an atomic `prisma.$transaction` that logs a `pii_reveal` ledger entry simultaneously. No PII can ever be inspected without leaving an audit record.
4. **Configurable Rules Engine:** Administrative controls allowing dynamic customization of category weights, penalty thresholds, and mandatory requirements without code deployments.

---

## 📐 System Architecture

```
                               ┌────────────────────────────────┐
                               │  Officer Workspace (Frontend)  │
                               └───────────────┬────────────────┘
                                               │ JWT / Bearer Token
                                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Express API Gateway                                    │
│  [Helmet Security] [CORS] [Rate Limiter] [RBAC Auth Middleware] [Zod Validation]       │
└──────────────────────────────────────┬─────────────────────────────────────────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│  Tenders & Bidders   │   │  Dynamic Rules       │   │  Officer Decisions   │
│  Routes (/tenders,   │   │  Engine (/admin/     │   │  Atomic Transactor   │
│  /bidders)           │   │  rules)              │   │  (/decision)         │
└───────────┬──────────┘   └──────────┬───────────┘   └──────────┬───────────┘
            │                          │                          │
            └──────────────────────────┼──────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        Orchestrator & Connector Tiers                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │ Tier 1: DigiLocker   │  │ Tier 2: Portal QR    │  │ Tier 3: AI Document Extract  │  │
│  │ Sandbox Connector    │  │ Checksum Connector   │  │ (Gemini 1.5 + Zod Validator) │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────┬─────────────────────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL 15+ Multi-Role Database                              │
│                                                                                        │
│  Role: app_readwrite (SELECT, INSERT, UPDATE, DELETE on tenders, bidders, users)       │
│  Role: ledger_append_only (SELECT, INSERT ONLY on ledger_entries)                      │
│  Trigger: reject_ledger_mutation() -> BLOCKS ALL MUTATIONS ON ledger_entries           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
.
├── backend-api/                       # Node.js + TypeScript Express Backend
│   ├── prisma/
│   │   ├── migrations/                # Database migrations
│   │   ├── sql/                       # SQL scripts (ledger lockdown triggers & constraints)
│   │   └── schema.prisma              # Prisma ORM schema definition
│   ├── src/
│   │   ├── connectors/                # DigiLocker, VerifyPage, and Simulated connectors
│   │   ├── db/                        # Database client initialization and seed logic
│   │   ├── middleware/                # JWT authentication, RBAC, and error envelopes
│   │   ├── routes/                    # API endpoints (/auth, /tenders, /bidders, /admin, /ledger)
│   │   ├── services/                  # Orchestrator, Rules Engine, AI extraction, Ledger service
│   │   ├── config.ts                  # Environment variable schema
│   │   └── index.ts                   # Application entry point
│   ├── test_phase11.ps1               # Phase 11 Security & Hardening verification suite
│   ├── test_phase12.ps1               # Phase 12 Full Replay automated test runner
│   ├── test_ai_contract.ts            # AI extraction contract test
│   ├── package.json
│   └── tsconfig.json
├── seed-data/
│   └── bidders.json                   # 12 real-world seed bidder profiles with diverse risk profiles
├── BACKEND_BUILD_PLAYBOOK.md          # 12-phase execution protocol & verification gates
├── PITCH.md                           # 5-minute timed demo script and Q&A playbook
├── PROBLEM_STATEMENT.md               # Detailed PS 100 breakdown & government portal constraints
├── SETUP.md                           # Tech stack setup and hour-by-hour development schedule
├── SOLUTION.md                        # Competitive analysis and evaluation rubric alignment
├── SYSTEM_ARCHITECTURE_FRONTEND.md    # Frontend design system, routes, and UI state architecture
└── USP.md                             # Detailed deep-dive on the Officer Trust Ledger USP
```

---

## 🚀 Quick Start: Running the Backend Locally

Follow this step-by-step walkthrough to boot the backend on your machine from scratch.

### 1. Prerequisites
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **PostgreSQL**: `v15.x` or higher running locally (or via Docker / cloud Postgres)
- **PowerShell / Bash**

---

### 2. Database Provisioning & Security Setup

Open your terminal or `psql` as PostgreSQL superuser (`postgres`):

```sql
-- 1. Create database
CREATE DATABASE gem_compliance;

-- 2. Connect to the new database
\c gem_compliance

-- 3. Create least-privilege group roles
CREATE ROLE app_readwrite NOLOGIN;
CREATE ROLE ledger_append_only NOLOGIN;

-- 4. Create the application user (used by the backend at runtime)
CREATE USER backend_app WITH LOGIN PASSWORD 'backend_app_secure_password_2026';
GRANT app_readwrite TO backend_app;
GRANT ledger_append_only TO backend_app;

-- 5. Grant schema connection and usage
GRANT CONNECT ON DATABASE gem_compliance TO backend_app;
GRANT USAGE ON SCHEMA public TO app_readwrite, ledger_append_only;

-- 6. Setup default table privileges for standard tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_readwrite;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO app_readwrite;
```

---

### 3. Environment Configuration

Navigate to the `backend-api` folder and copy the environment template:

```bash
cd backend-api
cp .env.example .env
```

Ensure your `backend-api/.env` has the following variables configured:

```env
PORT=4000
DATABASE_URL="postgresql://backend_app:backend_app_secure_password_2026@localhost:5432/gem_compliance?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/gem_compliance?schema=public"
JWT_SECRET="super_secure_jwt_secret_key_for_gem_compliance_2026"
GEMINI_API_KEY="mock_gemini_api_key_for_preflight"
CORS_ORIGIN="http://localhost:5173"
DIGILOCKER_MODE="mock"
```

> **Note on Credentials:**
> - `DATABASE_URL` uses the restricted `backend_app` user (used by the Express app at runtime).
> - `DIRECT_URL` uses the superuser `postgres` (read **only** by the Prisma CLI for executing migrations and setting up triggers).

---

### 4. Install Dependencies & Build

Install all required npm packages:

```bash
cd backend-api
npm install
```

---

### 5. Run Migrations & Apply Ledger Lockdown

Apply the Prisma migrations, and execute the SQL lockdown to enforce the database triggers and append-only grants:

```bash
# 1. Run migrations against gem_compliance using DIRECT_URL
npx prisma migrate deploy

# 2. Apply ledger lockdown trigger and check constraint
# (Using psql as superuser)
psql "postgresql://postgres:postgres@localhost:5432/gem_compliance" -f prisma/sql/ledger_lockdown.sql
```

---

### 6. Seed Demo Data

Populate the database with the 3 demo user roles, active tenders, 12 realistic bidders, default rules config, and initial verification ledger entries:

```bash
npm run db:seed
```

Expected output:
```text
🌱 Seeding database...
✅ Seeded 3 users
✅ Seeded 2 tenders
✅ Seeded 12 bidders
✅ Seeded 12 initial ledger entries
✅ Seeded default RulesConfig
Seeding complete:
   Users: 3
   Tenders: 2
   Bidders: 12
   Ledger entries: 12
```

---

### 7. Start the Backend API Server

Run the development server with live reload:

```bash
npm run dev
```

The server will boot on `http://localhost:4000`:
```text
Postgres connected
Server running on port 4000
```

Verify the server health endpoint:
```bash
curl http://localhost:4000/health
# Response: {"data":{"status":"ok"},"error":null}
```

---

## 👥 Demo Credentials

The database is seeded with 3 pre-configured demo users representing the platform's RBAC personas:

| Role | Email | Password | Allowed Access |
|---|---|---|---|
| **Procurement Officer** | `officer@demo.com` | `demo1234!` | Tenders, Bidders, PII Reveal, Full Verification Orchestrator, Officer Decisions |
| **System Administrator** | `admin@demo.com` | `demo1234!` | All Officer endpoints + `/admin/rules` (Rule Weights/Thresholds), `/admin/ledger` (Full Audit Trail) |
| **Bidder / Vendor** | `bidder@demo.com` | `demo1234!` | Self-service status views (Blocked from officer actions & admin routes with `403 Forbidden`) |

---

## 🧪 Automated Verification & Test Suites

Two comprehensive, automated PowerShell test suites are included in `backend-api/`:

### 1. Phase 11 Security & Hardening Suite
Verifies PII masking, UUID validation, rate-limiting on auth, clean error mapping, and trigger installation:
```powershell
powershell -ExecutionPolicy Bypass -File .\test_phase11.ps1
```
*Result: 22 PASSES, 0 FAILS.*

### 2. Phase 12 Full Replay Suite
Replays all 12 build phases end-to-end back-to-back, confirming zero regressions across auth, reading, rules, ledger immutability, decision recording, AI extraction, and connector fan-out:
```powershell
powershell -ExecutionPolicy Bypass -File .\test_phase12.ps1
```
*Result: 20 PASSES, 0 FAILS.*

---

## ⚖️ Judges' 90-Second Immutability Proof Runbook

When presenting to evaluators, prove the dual-layer immutability live in your terminal in under 90 seconds:

```powershell
# ─── 1. Prove Role-Grant Layer (Executed as runtime backend_app) ───
psql "postgresql://backend_app:backend_app_secure_password_2026@localhost:5432/gem_compliance" `
  -c "UPDATE ledger_entries SET actor_id='hacked' WHERE false;"
# => Output: ERROR: permission denied for table ledger_entries

# ─── 2. Prove Trigger Layer (Executed as Superuser postgres with UPDATE granted) ───
psql "postgresql://postgres:postgres@localhost:5432/gem_compliance" `
  -c "GRANT UPDATE, DELETE ON ledger_entries TO backend_app;" `
  -c "SET ROLE backend_app; UPDATE ledger_entries SET actor_id='hacked' WHERE id=(SELECT id FROM ledger_entries LIMIT 1);" `
  -c "REVOKE UPDATE, DELETE ON ledger_entries FROM backend_app;"
# => Output: ERROR: ledger_entries is append-only; UPDATE is not permitted
# => CONTEXT: PL/pgSQL function reject_ledger_mutation() line 3 at RAISE

# ─── 3. Confirm Baseline Privileges Restored ───
psql "postgresql://postgres:postgres@localhost:5432/gem_compliance" `
  -c "\dp ledger_entries"
# => Output: ledger_append_only=ar/postgres (ar = SELECT and INSERT only; UPDATE/DELETE missing)
```

---

## 📡 API Route Reference

| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public (Rate-limited) | Authenticates user with email/password; returns JWT token |
| `GET` | `/health` | Public | Live database round-trip check |
| `GET` | `/tenders` | Authenticated | Lists all active tenders with bidder counts |
| `GET` | `/tenders/:id` | Authenticated | Gets tender details and specifications |
| `GET` | `/tenders/:id/bidders` | Authenticated | Lists all bidders submitted for a tender (supports `?risk=` and `?status=` filters) |
| `GET` | `/bidders/:id` | Authenticated | Gets bidder details with masked PAN/GSTIN (`AAACS****H`) |
| `GET` | `/bidders/:id/pii` | Officer / Admin | Unmasks PAN & GSTIN inside an atomic `prisma.$transaction` logging a `pii_reveal` ledger entry |
| `POST` | `/bidders/:id/verify` | Officer / Admin | Executes the Orchestrator (fans out to Tier 1-3 connectors, runs Rules Engine, logs `verification_run` ledger entry) |
| `POST` | `/bidders/:bidderId/decision` | Officer only | Atomically records officer qualify/disqualify decision with mandatory reasoning |
| `GET` | `/admin/rules` | Admin only | Retrieves the active Rules Engine configuration and risk thresholds |
| `PUT` | `/admin/rules` | Admin only | Dynamically updates weights and penalty multipliers |
| `GET` | `/admin/ledger` | Admin only | Inspects the complete, tamper-proof append-only audit trail (supports `?bidderId=` filtering) |

---

## 📚 Documentation Map

Detailed design, pitch, and architecture documents are maintained in the repository root:

- [`PROBLEM_STATEMENT.md`](./PROBLEM_STATEMENT.md): Deep-dive into SIH PS 100 requirements and portal constraints.
- [`SOLUTION.md`](./SOLUTION.md): Technical architecture comparison and scoring rubric alignment.
- [`USP.md`](./USP.md): The core pitch thesis — the Officer Trust Ledger and Trust Provenance.
- [`PITCH.md`](./PITCH.md): Rehearsed 5-minute timed presentation script and evaluator Q&A responses.
- [`BACKEND_BUILD_PLAYBOOK.md`](./BACKEND_BUILD_PLAYBOOK.md): Phase-by-phase execution log and verification gates.
- [`SYSTEM_ARCHITECTURE_FRONTEND.md`](./SYSTEM_ARCHITECTURE_FRONTEND.md): Component tree, design system, and state management specifications.
- [`SETUP.md`](./SETUP.md): Initial project environment breakdown and timeline.
