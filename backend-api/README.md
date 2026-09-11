# GeM Compliance Verification Platform — Backend API

Node.js, TypeScript, Express, and PostgreSQL 15+ backend implementing the dual-layer immutable **Officer Trust Ledger**, dynamic **Rules Engine**, and multi-tier **Verification Orchestrator** for SIH 2026 Problem Statement 100.

---

## 🛠 Tech Stack

- **Runtime**: Node.js 20+ / TypeScript 5.6
- **Framework**: Express 4.21
- **Database**: PostgreSQL 15+ (with group roles & triggers)
- **ORM**: Prisma 5.22
- **Validation**: Zod 3.23 (strict schema enforcement on all routes and AI payloads)
- **Security**: Helmet, CORS, Express-Rate-Limit, BCrypt, JWT
- **AI Service**: Google Generative AI (`@google/generative-ai` / Gemini 1.5 Flash) with deterministic offline sandbox fallback

---

## 🚀 Getting Started

### 1. Database Setup
Ensure PostgreSQL is running, then create the database and roles as superuser:

```sql
CREATE DATABASE gem_compliance;
\c gem_compliance

CREATE ROLE app_readwrite NOLOGIN;
CREATE ROLE ledger_append_only NOLOGIN;

CREATE USER backend_app WITH LOGIN PASSWORD 'backend_app_secure_password_2026';
GRANT app_readwrite TO backend_app;
GRANT ledger_append_only TO backend_app;

GRANT CONNECT ON DATABASE gem_compliance TO backend_app;
GRANT USAGE ON SCHEMA public TO app_readwrite, ledger_append_only;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_readwrite;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO app_readwrite;
```

### 2. Configure `.env`
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

```env
PORT=4000
DATABASE_URL="postgresql://backend_app:backend_app_secure_password_2026@localhost:5432/gem_compliance?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/gem_compliance?schema=public"
JWT_SECRET="super_secure_jwt_secret_key_for_gem_compliance_2026"
GEMINI_API_KEY="mock_gemini_api_key_for_preflight"
CORS_ORIGIN="http://localhost:5173"
DIGILOCKER_MODE="mock"
```

### 3. Install, Migrate & Seed
```bash
npm install
npx prisma migrate deploy
psql "postgresql://postgres:postgres@localhost:5432/gem_compliance" -f prisma/sql/ledger_lockdown.sql
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
# Server boots at http://localhost:4000
```

---

## 🧪 Testing

Run the automated verification test suites:

```powershell
# Phase 11 Security & Hardening verification
powershell -ExecutionPolicy Bypass -File .\test_phase11.ps1

# Phase 12 Full Replay verification
powershell -ExecutionPolicy Bypass -File .\test_phase12.ps1
```

---

## 👥 Seed Demo Users

| Email | Password | Role |
|---|---|---|
| `officer@demo.com` | `demo1234!` | `officer` |
| `admin@demo.com` | `demo1234!` | `admin` |
| `bidder@demo.com` | `demo1234!` | `bidder` |
