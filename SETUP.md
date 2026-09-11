# Setup — Stack, Install, Build Plan & Risk Register

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fast dev loop, hackathon-proven |
| Styling / UI | Tailwind CSS + shadcn/ui | Fast to build polished, accessible components without a design system from scratch |
| Frontend state | TanStack Query (server state) + React local state | Avoids overbuilding a global store for a 36-hour project |
| Tables | TanStack Table | Sortable/filterable bulk bidder table is the core screen — don't hand-roll this |
| Backend (orchestrator/API) | Node.js + Express + TypeScript | Fast to scaffold, same language as frontend, easy to share types |
| Backend (OCR/ML pipeline) | Python + FastAPI, called by the Node orchestrator | OCR/NLP libraries (Tesseract, spaCy, rapidfuzz) are Python-native |
| Database | SQLite (file-based) for the hackathon; PostgreSQL noted as the production target | Zero setup time; swap-ready later |
| OCR | Tesseract (pytesseract) + pdf2image | Free, offline, good enough for a demo with hand-picked sample docs |
| Fuzzy matching | rapidfuzz | Company-name matching across documents |
| Auth | Simple JWT with 3 hardcoded demo roles (Officer / Admin / Bidder) | Don't build real auth infra in 36 hours — simulate convincingly |
| Real integration | DigiLocker Partner/Sandbox API | The one genuinely real, demoable integration |

---

## 2. Install & Run

### Frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

### Backend API
```bash
cd backend-api
npm install
npm run db:seed      # loads seed-data/bidders.json into SQLite
npm run dev           # http://localhost:4000
```

### ML Service
```bash
cd ml-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Environment Variables (`backend-api/.env`)
```
PORT=4000
DATABASE_URL=./db/dev.sqlite
ML_SERVICE_URL=http://localhost:8000
DIGILOCKER_CLIENT_ID=<from sandbox partner application>
DIGILOCKER_CLIENT_SECRET=<from sandbox partner application>
DIGILOCKER_SANDBOX_BASE_URL=<sandbox base url from partner docs>
JWT_SECRET=<any random string for the demo>
```

---

## 3. Mock Bidder Data Schema

Build 10–15 mock bidder records against this shape early so the whole team — frontend,
backend, ML, and pitch deck — works off one shared, consistent dataset.

```json
{
  "bidder_id": "BDR-0007",
  "company_name": "Sharma Enterprises Pvt. Ltd.",
  "tender_id": "GEM-2026-HLT-00231",
  "overall_risk": "high",
  "last_verified_at": "2026-09-04T11:20:00+05:30",
  "checks": [
    {
      "category": "PAN",
      "status": "flagged",
      "trust_source": "ai_extracted",
      "confidence": 0.87,
      "value": "ABCDE1234F",
      "evidence": "PAN mismatch: GST cert (ABCDE1234F) vs ITR filing (ABCDF1234F)",
      "documents": ["gst_cert.pdf", "itr_2025.pdf"]
    },
    {
      "category": "udyam",
      "status": "verified",
      "trust_source": "portal_verified",
      "confidence": 1.0,
      "value": "UDYAM-TS-03-0004521",
      "evidence": "Matched against Udyam public verification page",
      "documents": ["udyam_cert.pdf"]
    }
  ],
  "officer_decision": {
    "status": "pending",
    "reason": null,
    "officer_id": null,
    "timestamp": null
  }
}
```
Vary `overall_risk`, `trust_source`, and `status` across your bidders so the triage table
demo actually looks like triage — a mix of green, amber, and red rows, not fifteen identical
"high risk" entries.

---

## 4. 36-Hour Build Execution Plan

### Suggested role split

| Role | Owns |
|---|---|
| Frontend lead | Officer Verification Workspace — triage table, bidder detail, trust badges, decision panel |
| Backend / API dev | Verification Orchestrator, Rules Engine, mock data seeding, API contracts |
| ML / OCR dev | Document pipeline — OCR, entity extraction, confidence scoring, fuzzy name matching |
| Integration dev | DigiLocker sandbox connector, verify-page/QR connectors |
| Pitch / research | Deck, Q&A prep, demo script rehearsal, one-pager, backup video |

### Hour-by-hour

| Window | Phase | Focus |
|---|---|---|
| Hr 0–2 | Kickoff | Lock the API contract (Section 3 schema + `SYSTEM_ARCHITECTURE_BACKEND.md` §6) as a team so frontend and backend build in parallel immediately |
| Hr 2–6 | Skeleton build | Frontend: static triage table + bidder detail with mock JSON. Backend: orchestrator skeleton + rules engine v1. Integration dev: submit DigiLocker sandbox application if not already done |
| Hr 6–12 | Core features | Frontend: trust badges, filters, sort, decision panel. ML dev: OCR on 2–3 real sample documents. Backend: wire rules engine to connectors |
| Hr 12–18 | Integration | Connect frontend to real backend endpoints. Get one DigiLocker signature check working end-to-end, even if ugly |
| Hr 18–24 | Feature freeze approaching | Stop adding features. Polish the killer-feature screen. Build the seed dataset of 10–15 varied bidders |
| Hr 24–28 | Polish & explainability pass | Evidence/confidence detail on every flagged item. Fix visual bugs. Real microcopy, no placeholders |
| Hr 28–32 | Demo rehearsal | Run the full live walkthrough at least three times, timed. Record the 90-second backup video now, while stable |
| Hr 32–35 | Deck & one-pager | Finalize the PPT and printed one-pager. Rehearse Q&A out loud |
| Hr 35–36 | Buffer | Deliberately unscheduled — something will break. Do not plan features into this window |

---

## 5. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| DigiLocker sandbox approval delayed or denied | Medium | High — loses the strongest differentiator | Apply on day one, before any other work. Have a clearly-labelled simulated fallback ready regardless |
| Live network failure during judging | Medium-High | High — breaks demo flow entirely | Rehearsed 90-second backup video ready to cut to instantly; cached "last verified" states designed into the UI itself |
| OCR accuracy too low on real sample documents | Medium | Medium — undermines a core claim if it fails live | Hand-pick 2–3 known-good sample documents for the live demo; low-confidence-routes-to-review as the honest fallback |
| Team over-scopes and nothing is finished/polished | High — the single most common hackathon failure mode | High | Lock the "Must have" list (`SOLUTION.md` §5) by hour 6 and refuse new scope after hour 18 |
| Judges perceive "AI" claims as inflated | Medium | High — damages credibility across the whole pitch | Be precise about ML vs. rules everywhere in your language; never say "AI" when you mean "if/else" |
| Officer-side UX reads as complex/technical to non-technical judges | Medium | Medium | Follow the microcopy rules in `SYSTEM_ARCHITECTURE_FRONTEND.md` §1.5 strictly; have a teammate outside the build team sanity-check the UI in plain language |

---

## 6. Materials Checklist Before the Finale

- Working prototype covering the "Must have" scope (`SOLUTION.md` §5)
- 10–15 realistic mock bidder profiles with varied outcomes (clean pass, flagged issues, one
  deliberately high-risk case)
- Architecture diagram, printed or as a standalone slide
- 10–12 slide deck
- A 90-second screen-recorded backup video of the full walkthrough
- One printed one-pager summarizing the USP and architecture for judges to keep
