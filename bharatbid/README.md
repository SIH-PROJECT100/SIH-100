# BharatBid — GeM Bid Compliance Verification

Trust Ledger for Government e-Marketplace procurement. Sovereign
cross-checking of GST, MSME, PAN, and DigiLocker documents with
graph-based cartel detection and cryptographic proof generation.

Built for Smart India Hackathon 2026, Problem Statement PS-100
by Team Segmentation Fault.

## Stack
- Frontend: React 19 + TypeScript + Vite + Tailwind + TanStack
- Backend: Node.js + Express + PostgreSQL 15 (see ../backend-api/)
- AI: Gemini 2.5 Flash for document extraction with confidence gating
- Ledger: Append-only PostgreSQL with dual-layer immutability

## Quick Setup (5 min)
1. Prerequisites: Node 20+, Docker, PostgreSQL 15
2. `cp .env.example .env`
3. Backend: `cd ../backend-api && docker-compose up -d && npm install && npm run db:seed`
4. Frontend: `npm install && npm run dev`
5. Open http://localhost:5173

## Testing
- Frontend E2E: `npm run test:e2e` (25 tests)
- Frontend build: `npm run build`
- Banned patterns: `npm run check-patterns`
- i18n audit: `npm run i18n:audit`
- Backend tests: `cd ../backend-api && npm test` (275 tests)

## Demo
See `docs/BHARATBID_DEMO_RUNBOOK.md` for the 90-second walkthrough.
