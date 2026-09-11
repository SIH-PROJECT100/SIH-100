# Backend Build Playbook

SIH 2026 · PS 100 · Phase-gated execution plan — no phase starts until the previous one
is reported back and confirmed clean.

This file is the **execution protocol**. `SYSTEM_ARCHITECTURE_BACKEND.md` is the
**reference spec** — read that first, this file tells you the order to build it in and
exactly how to prove each piece works before moving on. If the two ever disagree, the
architecture doc's data shapes and API contract win; this file only governs sequencing and
verification.

**Database:** PostgreSQL 15+ with Prisma as the ORM. Embedded shapes from the original
Mongo design (`ComplianceCheck[]`, `OfficerDecision`) are stored as `JSONB` columns and
validated at the app layer with Zod. The Ledger's append-only guarantee is enforced at
**two** independent layers: role-level `GRANT`s (no `UPDATE`/`DELETE` privilege) and a
database trigger that raises an exception on any mutation attempt. Both are tested in
Phase 6.

---

## How to use this file

Work through the phases in order. **Do not start a phase until the previous phase's Report
Back has every box checked.** At the end of each phase, produce the Report Back exactly in
the format given — paste real command output, not a summary of what you expect it to say.
If any box can't be checked, stop, fix it, and re-run the phase's verification before
reporting. A phase report with an unchecked box is not a report, it's a flag — and this
build is not supposed to have any.

If you're using an AI coding assistant, paste this file's relevant phase section into the
prompt along with `SYSTEM_ARCHITECTURE_BACKEND.md`, using the exact per-file prompt shape
from that doc's §0. One phase, one prompt, one report — same discipline as one file, one
responsibility.

---

## Phase 0 — Pre-Flight (before writing a single line of application code)

**Goal:** every credential, account, and decision this build depends on exists before code
is written that assumes it does.

### Tasks

- [ ] Read `SYSTEM_ARCHITECTURE_BACKEND.md`, `SOLUTION.md` §5, and `USP.md` in full — not
      skimmed. The Ledger design in particular has to be understood before Phase 6, not
      discovered during it.
- [ ] Provision a PostgreSQL 15+ instance (local `postgres` service, Docker, or Neon /
      Supabase / Railway free tier) and note its host, port, and superuser credential.
- [ ] Create the database itself, as the superuser:

  ```sql
  CREATE DATABASE gem_compliance;
  \c gem_compliance
  ```

- [ ] **Create the database roles and app user now, before any code connects to the
      database with a broader credential out of convenience.** Run this once, in `psql`,
      connected to `gem_compliance` as the superuser. Tables don't exist yet — that's
      fine, we grant on them by name and Postgres will bind the privileges when Prisma
      creates them in Phase 2. Then we re-run the ledger-specific grants after migration
      to lock the final state.

  ```sql
  -- Two group roles, one login user, one connection string.
  -- The app never needs a second Prisma client to get the ledger's append-only
  -- enforcement — UPDATE/DELETE are simply never granted on ledger_entries.

  CREATE ROLE app_readwrite NOLOGIN;
  CREATE ROLE ledger_append_only NOLOGIN;

  CREATE USER backend_app WITH LOGIN PASSWORD '<generate a real secret, store it only in .env>';
  GRANT app_readwrite      TO backend_app;
  GRANT ledger_append_only TO backend_app;

  -- Make sure backend_app can actually reach the schema
  GRANT CONNECT ON DATABASE gem_compliance TO backend_app;
  GRANT USAGE   ON SCHEMA public           TO app_readwrite, ledger_append_only;

  -- Default privileges for tables Prisma will create in Phase 2.
  -- Applies automatically to future tables so we don't have to re-run per table.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_readwrite;

  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO app_readwrite;
  ```

  The ledger's stricter grants and the mutation trigger get applied in Phase 2, right
  after Prisma creates the `ledger_entries` table — see that phase's tasks.

- [ ] Confirm a separate admin/superuser Postgres credential exists for one-time setup
      tasks only (running migrations, creating roles, inspecting data by hand) and **is
      never placed in `backend-api/.env` under `DATABASE_URL`, nor referenced anywhere in
      application code.** The migrator credential lives in `.env` as `DIRECT_URL` and is
      read only by the Prisma CLI, never by runtime code.
- [ ] Get a Gemini API key from Google AI Studio.
- [ ] Submit the DigiLocker sandbox/partner application **today**, regardless of where
      building the connector itself falls in the phase order below — its approval lead
      time (2–4 weeks) is the true bottleneck, not the engineering effort.
- [ ] Initialize the repo: `backend-api/` with `package.json`, `tsconfig.json`, and the
      folder structure from `SYSTEM_ARCHITECTURE_BACKEND.md` §2, empty files where noted.
- [ ] Install dependencies: `express`, `@prisma/client`, `pg`, `zod`, `jsonwebtoken`,
      `bcryptjs`, `cors`, `helmet`, `dotenv`, `express-rate-limit`, plus TypeScript dev
      dependencies, `prisma` (dev), and `tsx` for the dev script.
- [ ] Run `npx prisma init` to scaffold `prisma/schema.prisma` and the `.env` file.
      Set both connection strings:
      - `DATABASE_URL="postgresql://backend_app:<secret>@<host>:5432/gem_compliance?schema=public"`
      - `DIRECT_URL="postgresql://<migrator_user>:<secret>@<host>:5432/gem_compliance?schema=public"`

### Report Back — Phase 0

```
PHASE 0 COMPLETE

[ ] Architecture doc + SOLUTION.md §5 + USP.md read in full
[ ] PostgreSQL instance running, version >= 15 — confirmed via: SELECT version();
[ ] Database gem_compliance created
[ ] app_readwrite role created — confirmed via: \du app_readwrite
[ ] ledger_append_only role created — confirmed via: \du ledger_append_only
[ ] backend_app user created with both roles granted — confirmed via: \du backend_app
[ ] Default privileges set on schema public for app_readwrite — confirmed via: \ddp
[ ] Migrator/superuser credential exists, confirmed NOT present as DATABASE_URL and
    NOT referenced in backend-api/src/ (grep -r "DIRECT_URL" backend-api/src/ returns nothing)
[ ] Gemini API key obtained
[ ] DigiLocker sandbox application submitted — date: <date>
[ ] Repo scaffolded, folder structure matches SYSTEM_ARCHITECTURE_BACKEND.md §2
[ ] Dependencies installed, npm install completes with 0 errors
[ ] prisma/schema.prisma exists with datasource pointing at DATABASE_URL and directUrl at DIRECT_URL

Blockers / open questions: <none, or list them>
```

**Gate:** do not proceed to Phase 1 until the roles are confirmed and the `DIRECT_URL`
grep comes back empty from `src/`. This is the single most important gate in the whole
playbook — everything downstream assumes it's already true.

---

## Phase 1 — Skeleton

**Goal:** the server boots, connects to Postgres using the scoped `backend_app`
credential, and fails loudly and immediately if any required config is missing. Nothing
else exists yet.

### Tasks

- [ ] `src/config.ts` — Zod-validated env schema (`PORT`, `DATABASE_URL`, `JWT_SECRET`
      min 16 chars, `GEMINI_API_KEY`, `CORS_ORIGIN`, `DIGILOCKER_MODE`). Note:
      `DIRECT_URL` is deliberately **not** in this schema — application code must never
      read it. Exits with a clear message on invalid/missing config; never crashes deep
      inside a request handler instead.
- [ ] `src/db/client.ts` — exports a single `PrismaClient` instance using `DATABASE_URL`
      (which points at the `backend_app` user, not the migrator). Handles graceful
      shutdown on SIGTERM/SIGINT. Logs a clear connection-success or connection-error
      message on startup via `prisma.$connect()`.
- [ ] `src/index.ts` — Express app, `helmet()`, `cors({ origin: config.CORS_ORIGIN })`,
      JSON body parsing, a bare `GET /health` route returning
      `{ data: { status: "ok" }, error: null }`. The health check performs a trivial
      `SELECT 1` via Prisma to confirm the DB connection is live, not just that the
      process is up.
- [ ] `npm run dev` starts cleanly.

### Verification

```bash
npm run dev
# expect: "Postgres connected" and "Server running on port 4000" (or configured port)

curl http://localhost:4000/health
# expect: {"data":{"status":"ok"},"error":null}

# now delete JWT_SECRET from .env and restart — confirm it fails fast:
npm run dev
# expect: a clear "Invalid environment configuration" message and immediate exit, NOT a crash later

# confirm the runtime user is backend_app, not the migrator:
psql "$DATABASE_URL" -c "SELECT current_user;"
# expect: backend_app
```

### Report Back — Phase 1

```
PHASE 1 COMPLETE

[ ] npm run dev boots with no errors
[ ] Postgres connects using the backend_app (non-superuser) credential
[ ] SELECT current_user via the runtime DATABASE_URL returns backend_app (paste output)
[ ] GET /health returns the correct envelope shape and confirms a live DB roundtrip
[ ] Removing a required env var causes an immediate, clear boot failure (paste the exact message here)

Blockers / open questions: <none, or list them>
```

**Gate:** do not proceed until the env-var failure test above actually produces a clean
exit with a readable message, not a stack trace or a silent hang.

---

## Phase 2 — Data Layer

**Goal:** every Prisma model from `SYSTEM_ARCHITECTURE_BACKEND.md` §5 exists exactly as
specified, the migration lands cleanly under the migrator credential, the append-only
guarantee is wired at the DB level, and the database holds real seeded data you can query
directly.

### Tasks

- [ ] `prisma/schema.prisma` — models for `Tender`, `Bidder`, `LedgerEntry`, `User`,
      `RulesConfig` matching the architecture doc field-for-field. Embedded shapes
      (`ComplianceCheck[]`, `OfficerDecision`) as `Json` (JSONB) columns. Every enum in
      the architecture doc becomes a Postgres `enum` via Prisma's `enum` declaration —
      no free-string columns where the doc specifies an enum. `LedgerEntry` has no
      `updatedAt` field, and its `@@map` sets the table name to `ledger_entries`.
- [ ] Run the migration **as the migrator**, not as `backend_app`:

  ```bash
  npx prisma migrate dev --name init
  ```

  Prisma will use `DIRECT_URL` for schema changes and `DATABASE_URL` for the generated
  client at runtime.

- [ ] **Lock down `ledger_entries` immediately after the migration lands.** Run this
      once, in `psql`, as the superuser, against `gem_compliance`:

  ```sql
  -- 1) Revoke anything default privileges may have granted on this specific table.
  REVOKE ALL ON TABLE ledger_entries FROM app_readwrite;

  -- 2) Explicit, minimal grants for the append-only role.
  GRANT SELECT, INSERT ON TABLE ledger_entries TO ledger_append_only;
  GRANT USAGE, SELECT ON SEQUENCE ledger_entries_id_seq TO ledger_append_only;
  -- Deliberately no UPDATE, no DELETE, no TRUNCATE.

  -- 3) Defense in depth: a trigger that raises even if a future grant slips through
  --    or someone connects with an over-privileged role by mistake.
  CREATE OR REPLACE FUNCTION reject_ledger_mutation() RETURNS trigger AS $$
  BEGIN
    RAISE EXCEPTION 'ledger_entries is append-only; % is not permitted', TG_OP
      USING ERRCODE = 'insufficient_privilege';
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS ledger_no_update ON ledger_entries;
  DROP TRIGGER IF EXISTS ledger_no_delete ON ledger_entries;
  DROP TRIGGER IF EXISTS ledger_no_truncate ON ledger_entries;

  CREATE TRIGGER ledger_no_update
    BEFORE UPDATE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

  CREATE TRIGGER ledger_no_delete
    BEFORE DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

  CREATE TRIGGER ledger_no_truncate
    BEFORE TRUNCATE ON ledger_entries
    FOR EACH STATEMENT EXECUTE FUNCTION reject_ledger_mutation();
  ```

  Save this as `prisma/migrations/<timestamp>_ledger_lockdown/migration.sql` (or a
  hand-managed `prisma/sql/ledger_lockdown.sql` run via `psql` in your seed script) so
  it re-applies on any fresh environment. Never keep it as tribal knowledge.

- [ ] Add lightweight JSONB shape checks as `CHECK` constraints on `bidders` for the
      embedded `officer_decision.status` value, mirroring the enum constraint from the
      Mongo `$jsonSchema` validator (architecture doc §11.1 point 3):

  ```sql
  ALTER TABLE bidders ADD CONSTRAINT officer_decision_status_valid
    CHECK (
      officer_decision IS NULL
      OR officer_decision->>'status' IN ('qualified','disqualified','clarification_requested','pending')
    );
  ```

  Zod validates the full shape at the app layer; this constraint is the belt-and-braces
  copy at the DB layer, matching the original design's philosophy.

- [ ] `src/db/seed.ts` — reads `seed-data/bidders.json` (12–15 mock bidders per
      `SETUP.md` §3's schema and risk distribution), inserts tenders + bidders via Prisma,
      and writes one initial `system` / `verification_run` ledger entry per bidder so
      the ledger isn't empty on first load.
- [ ] `npm run db:seed` works and is idempotent enough to re-run during development
      without unique-key crashes (use `prisma.$transaction` + `upsert` by natural key,
      or truncate the relevant tables first via the migrator — never via `backend_app`,
      which by design cannot truncate `ledger_entries`).

### Verification

```bash
npm run db:seed
# expect: a clear count of tenders/bidders/ledger entries inserted, 0 errors

# in psql, connected as backend_app (not the migrator):
psql "$DATABASE_URL"

SELECT COUNT(*) FROM bidders;         -- expect 12-15
SELECT COUNT(*) FROM ledger_entries;  -- expect at least one per bidder
SELECT * FROM bidders LIMIT 1;        -- full Bidder shape matching the interface exactly

-- confirm the enum constraint actually rejects bad data:
INSERT INTO bidders (id, overall_risk, ...) VALUES ('test', 'extremely_high', ...);
-- expect: ERROR: invalid input value for enum ... "extremely_high"

-- confirm the JSONB CHECK constraint rejects a bad officer_decision status:
UPDATE bidders SET officer_decision = '{"status":"maybe"}'::jsonb WHERE id = '<some id>';
-- expect: ERROR: new row violates check constraint "officer_decision_status_valid"
```

### Report Back — Phase 2

```
PHASE 2 COMPLETE

[ ] All 5 Prisma models created, field names match SYSTEM_ARCHITECTURE_BACKEND.md §5 exactly
[ ] Migration ran under the migrator credential, NOT backend_app (confirmed by env used)
[ ] Ledger lockdown SQL applied: REVOKE + minimal GRANT + three triggers in place — confirmed via:
    \dp ledger_entries   (paste output)
    \dft+ reject_ledger_mutation   (paste output)
[ ] JSONB CHECK constraint on officer_decision.status active — confirmed via a rejected UPDATE (paste error)
[ ] Seed script run successfully — <N> tenders, <N> bidders, <N> ledger entries inserted
[ ] Direct query confirms a real Bidder row matches the expected shape (paste one example, PII-free)
[ ] Invalid enum value on insert was rejected (paste the error)

Blockers / open questions: <none, or list them>
```

**Gate:** do not proceed until the invalid-enum test and the JSONB CHECK test both
genuinely fail their writes. If either silently succeeds, the schema isn't actually being
enforced and Phase 6's ledger guarantee will be built on a false assumption.

---

## Phase 3 — Auth & RBAC

**Goal:** the three demo roles can log in, receive a JWT, and every subsequent route can
be gated by role — proven by testing the rejection path, not just the success path.

### Tasks

- [ ] `src/middleware/auth.ts` — JWT verify, attaches `req.user = { id, role }`, returns
      401 on missing/invalid token.
- [ ] `requireRole(...roles)` middleware factory — 403 if `req.user.role` isn't in the
      allowed list.
- [ ] `src/routes/auth.ts` — `POST /auth/login` (email + password → bcrypt compare →
      JWT). Seed exactly 3 demo users (one per role) in Phase 2's seed script if not
      already done.
- [ ] Wire `requireRole` onto every route per the RBAC matrix in
      `SYSTEM_ARCHITECTURE_BACKEND.md` §8 — this happens progressively as routes are
      built in later phases, but the middleware itself is ready now.

### Verification

```bash
# login as each of the 3 demo users, confirm a token comes back
curl -X POST http://localhost:4000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"officer@demo.com","password":"<seeded password>"}'
# expect: {"data":{"token":"...","user":{...,"role":"officer"}},"error":null}

# confirm a request with no token is rejected
curl http://localhost:4000/tenders
# expect: 401

# confirm a request with a bidder's token hitting an admin-only route is rejected
curl -H "Authorization: Bearer <bidder_token>" http://localhost:4000/admin/rules
# expect: 403
```

### Report Back — Phase 3

```
PHASE 3 COMPLETE

[ ] All 3 demo users can log in and receive a valid JWT
[ ] A request with no token is rejected with 401 (paste the response)
[ ] A request with the wrong role is rejected with 403 (paste the response)
[ ] Passwords are stored as bcrypt hashes, confirmed via direct query (never plaintext)

Blockers / open questions: <none, or list them>
```

**Gate:** do not proceed until both the 401 and 403 tests are proven with real output —
an RBAC system that's never had its rejection path tested is not verified, it's assumed.

---

## Phase 4 — Tenders & Bidders (read slice)

**Goal:** `GET /tenders` and `GET /tenders/:id/bidders` and `GET /bidders/:id` return real
seeded data — this alone unblocks the entire frontend Tender Triage View and Bidder Detail
View without anything else existing yet.

### Tasks

- [ ] `src/routes/tenders.ts`, `src/routes/bidders.ts` (GET routes only for now).
- [ ] Controllers query Prisma directly, no business logic here yet — that's Phase 5.
- [ ] `?risk=` and `?status=` query filters on the bidders-by-tender route, implemented
      as Prisma `where` clauses.
- [ ] Response envelope convention applied consistently — every success is
      `{ data, error: null }`, every failure is `{ data: null, error: { message } }`.

### Verification

```bash
curl -H "Authorization: Bearer <officer_token>" http://localhost:4000/tenders
curl -H "Authorization: Bearer <officer_token>" "http://localhost:4000/tenders/<id>/bidders?risk=high"
curl -H "Authorization: Bearer <officer_token>" http://localhost:4000/bidders/<id>
# each must return real seeded data matching the documented shape exactly
```

### Report Back — Phase 4

```
PHASE 4 COMPLETE

[ ] GET /tenders returns real data
[ ] GET /tenders/:id/bidders returns real data, ?risk= filter confirmed working
[ ] GET /bidders/:id returns a full Bidder object matching the interface exactly
[ ] All three routes reject an unauthenticated request

Blockers / open questions: <none, or list them>
```

---

## Phase 5 — Rules Engine

**Goal:** compliance checks turn into a risk level and score through pure, testable
functions reading from the config row — never a hardcoded number in business logic.

### Tasks

- [ ] `RulesConfig` seeded with the default config from architecture doc §3 (stored as
      a single row with a `JSONB` `config` column, or as typed columns per the doc's
      preference).
- [ ] `src/services/rulesEngine.ts` — `classifyMsme()`, `classifyLocalContent()`,
      `computeOverallRisk()` per the architecture doc's spec, reading thresholds from the
      DB, never from a constant in the file itself.
- [ ] Manually verify against at least 3 known scenarios before trusting it automatically.

### Verification

```bash
# Write a small throwaway script (or a real test file, if time allows) that:
# 1. Feeds a bidder with all checks "verified" → expect overall_risk: "low"
# 2. Feeds a bidder with a flagged PAN check → expect risk to increase by exactly the configured weight
# 3. Updates the rules_configs row's pan_mismatch weight via direct SQL, re-runs case 2,
#    confirms the score changes accordingly — proving it truly reads from config, not a
#    hardcoded number
```

### Report Back — Phase 5

```
PHASE 5 COMPLETE

[ ] Scenario 1 (all verified) produces "low" risk — confirmed
[ ] Scenario 2 (flagged PAN) produces the expected score increase — confirmed
[ ] Scenario 3 (changed config weight) changes the output accordingly — confirmed
    (this is the proof the engine isn't secretly hardcoded)

Blockers / open questions: <none, or list them>
```

**Gate:** scenario 3 is the important one — if changing the config doesn't change the
output, the engine has a hardcoded value hiding somewhere and that's a direct
contradiction of the architecture doc's core promise.

---

## Phase 6 — Trust Ledger (the load-bearing phase — do not rush this one)

**Goal:** the Ledger is proven append-only at **both** the role grant layer and the
trigger layer — not just by code convention. This phase is the one place a shortcut here
undermines the entire USP.

### Tasks

- [ ] `src/services/ledger.ts` — exports exactly `appendLedgerEntry()` and
      `getLedgerForBidder()` / `getFullLedger()`. No other exported function touches the
      `LedgerEntry` model or the `ledger_entries` table.
- [ ] `src/routes/ledger.ts` — `GET /admin/ledger?bidderId=`, admin-only.
- [ ] Grep the entire `src/` tree for any `ledgerEntry` / `LedgerEntry` / `ledger_entries`
      usage outside `ledger.ts` — there should be none.

### Verification

```bash
# 1) Code discipline: only one file touches the ledger table
grep -rniE "ledger_entries|prisma\.ledgerEntry|LedgerEntry" backend-api/src/ --include="*.ts" \
  | grep -v "src/services/ledger.ts"
# expect: zero results

# 2) Append works end-to-end
curl -X POST ... # (via whatever internal call triggers appendLedgerEntry, or a temporary script)
curl -H "Authorization: Bearer <admin_token>" "http://localhost:4000/admin/ledger?bidderId=<id>"
# expect: the entry appears

# 3) THE CRITICAL TESTS — confirm the database itself refuses mutation, in BOTH layers.
#    Run these in psql, connected as backend_app (NOT the migrator):
psql "$DATABASE_URL"

UPDATE ledger_entries SET detail = 'tampered' WHERE id = (SELECT id FROM ledger_entries LIMIT 1);
-- expect: ERROR: permission denied for table ledger_entries
--         (this is the ROLE-GRANT layer refusing it)

DELETE FROM ledger_entries WHERE id = (SELECT id FROM ledger_entries LIMIT 1);
-- expect: ERROR: permission denied for table ledger_entries

TRUNCATE ledger_entries;
-- expect: ERROR: permission denied for table ledger_entries

# 4) Trigger layer, tested by temporarily granting UPDATE as the superuser to prove the
#    trigger ALSO blocks it independently. In psql as the SUPERUSER (separate session):
GRANT UPDATE, DELETE ON ledger_entries TO app_readwrite;

# Then, back in the backend_app session:
UPDATE ledger_entries SET detail = 'tampered' WHERE id = (SELECT id FROM ledger_entries LIMIT 1);
-- expect: ERROR: ledger_entries is append-only; UPDATE is not permitted
--         (this is the TRIGGER layer refusing it, independent of grants)

DELETE FROM ledger_entries WHERE id = (SELECT id FROM ledger_entries LIMIT 1);
-- expect: ERROR: ledger_entries is append-only; DELETE is not permitted

# 5) IMMEDIATELY revoke again as the superuser — leaving the grant on is a security bug:
REVOKE UPDATE, DELETE ON ledger_entries FROM app_readwrite;

# 6) Re-run step 3 one more time to confirm you're back to the locked-down baseline.
```

### Report Back — Phase 6

```
PHASE 6 COMPLETE

[ ] grep for ledger references outside ledger.ts returns zero results (paste the command + empty output)
[ ] appendLedgerEntry() successfully creates a real entry, confirmed via GET /admin/ledger

[ ] CRITICAL — LAYER 1 (grants): UPDATE against ledger_entries as backend_app was REJECTED
    with "permission denied for table ledger_entries" (paste the exact error)
[ ] CRITICAL — LAYER 1 (grants): DELETE against ledger_entries as backend_app was REJECTED
    (paste the exact error)
[ ] CRITICAL — LAYER 1 (grants): TRUNCATE against ledger_entries as backend_app was REJECTED
    (paste the exact error)

[ ] CRITICAL — LAYER 2 (trigger): after temporarily granting UPDATE/DELETE, the trigger STILL
    rejected UPDATE with "ledger_entries is append-only; UPDATE is not permitted" (paste error)
[ ] CRITICAL — LAYER 2 (trigger): the trigger STILL rejected DELETE
    (paste error)
[ ] Grants revoked immediately after the trigger test — confirmed via \dp ledger_entries

Blockers / open questions: <none, or list them>
```

**Gate: absolute.** Do not proceed past this phase, under any time pressure, until every
one of the CRITICAL lines above shows a real Postgres error. If any one succeeds instead
of failing, Phase 0 or Phase 2's lockdown has a mistake in it — go back and fix it before
writing another line of code. And confirm the temporary GRANT from the trigger test was
revoked — leaving it in place silently downgrades the guarantee to a single layer. This
two-layer proof is the one guarantee the entire pitch depends on, and it must be tested,
not assumed.

---

## Phase 7 — Officer Decisions

**Goal:** an officer's decision is validated server-side and appends to the ledger — never
edits a prior entry, never accepts an empty reason.

### Tasks

- [ ] `src/routes/decisions.ts` — `POST /bidders/:bidderId/decision`, officer-only.
- [ ] Zod schema requiring `reason` to be a non-empty, trimmed string when `status` is
      `"disqualified"` or `"clarification_requested"` — reject with 400 before it reaches
      the database.
- [ ] On success, run both writes in a single `prisma.$transaction`:
      - Update the `Bidder` row's `officer_decision` JSONB column (this is a normal,
        expected update — the Bidder row is not the Ledger).
      - Call `appendLedgerEntry()` with `actor_type: "officer"`.

  Wrapping both in one transaction means an officer decision that succeeds on the
  Bidder update but fails on the ledger append rolls back cleanly — no orphaned state.

### Verification

```bash
# empty reason must be rejected
curl -X POST -H "Authorization: Bearer <officer_token>" -H "Content-Type: application/json" \
  -d '{"status":"disqualified","reason":""}' http://localhost:4000/bidders/<id>/decision
# expect: 400

# valid reason succeeds and appends to the ledger
curl -X POST -H "Authorization: Bearer <officer_token>" -H "Content-Type: application/json" \
  -d '{"status":"qualified","reason":"All checks verified, no discrepancies found"}' \
  http://localhost:4000/bidders/<id>/decision
# expect: 200, then confirm via GET /admin/ledger?bidderId=<id> that a new "officer" entry appears
# AND that the earlier "system" entry for the same bidder is still present, unchanged
```

### Report Back — Phase 7

```
PHASE 7 COMPLETE

[ ] Empty-reason request rejected with 400 (paste response)
[ ] Valid decision succeeds and Bidder.officer_decision updates correctly
[ ] A new ledger entry appears with actor_type "officer"
[ ] The original system verification_run entry is still present and unchanged after the
    officer decision — proving append, not overwrite
[ ] The Bidder update + ledger append are wrapped in a single prisma.$transaction (confirmed by code review)

Blockers / open questions: <none, or list them>
```

---

## Phase 8 — AI Extraction Service

**Goal:** exactly one AI call per explicit verification trigger, returning validated
structured JSON — never a compliance judgment, never called on a page load.

### Tasks

- [ ] `src/services/aiExtraction.ts` — the only file in the codebase that calls the
      Gemini API.
- [ ] Prompt asks for the exact named fields in architecture doc §4's contract — nothing
      open-ended.
- [ ] Response validated against a Zod schema before it's trusted anywhere downstream —
      if Gemini returns something malformed, this fails loudly, not silently.
- [ ] Confirm this function is called from exactly one place: the Orchestrator's
      `/bidders/:id/verify` path — grep to prove it.

### Verification

```bash
grep -rn "aiExtraction\." backend-api/src/ --include="*.ts"
# expect: exactly one call site, inside the Orchestrator

# run extraction against 2-3 real hand-picked sample documents
# confirm the returned JSON matches the exact contract shape, every time
# confirm a deliberately bad/corrupt file produces a clean validation error, not a crash
```

### Report Back — Phase 8

```
PHASE 8 COMPLETE

[ ] grep confirms aiExtraction is called from exactly one place
[ ] 3 real sample documents extracted correctly, JSON shape matches contract exactly (paste one example)
[ ] A malformed/corrupt input produces a clean, handled error — not a crash or an unvalidated pass-through

Blockers / open questions: <none, or list them>
```

---

## Phase 9 — Connectors & Full Orchestrator

**Goal:** `POST /bidders/:id/verify` genuinely fans out to all three connector tiers, runs
the Rules Engine, and appends one clean ledger entry — the full verification flow, wired
end to end for the first time.

### Tasks

- [ ] `src/connectors/digilocker.ts` — real sandbox call if credentials exist yet,
      otherwise a labelled mock implementing the same interface (architecture doc §7.1).
- [ ] `src/connectors/verifyPage.ts`, `src/connectors/simulated.ts` per architecture doc
      §7.2 and §7.3 — simulated connector must always return `simulated: true`.
- [ ] `src/services/orchestrator.ts` — `Promise.all` fan-out, cache check before
      re-running, calls Rules Engine, appends the ledger entry, returns the full `Bidder`.
      The Bidder update + ledger append at the end run inside a single
      `prisma.$transaction`, same discipline as Phase 7.

### Verification

```bash
curl -X POST -H "Authorization: Bearer <officer_token>" http://localhost:4000/bidders/<id>/verify
# expect: a full Bidder response with checks from all tiers, correct trust_source per check,
# overall_risk computed by the Rules Engine (not hardcoded), and a new ledger entry appended

# confirm caching works — calling GET /bidders/:id again immediately after should NOT
# trigger another AI call (check your Gemini usage dashboard or add a temporary log line)
```

### Report Back — Phase 9

```
PHASE 9 COMPLETE

[ ] Full verification run returns a complete Bidder object with all trust_source values correct
[ ] Simulated checks all carry simulated: true
[ ] A new ledger entry appears after the run
[ ] Re-reading the bidder immediately after does NOT trigger a second AI call — confirmed via <method used>
[ ] Orchestrator's final Bidder update + ledger append happen in a single prisma.$transaction (code review)

Blockers / open questions: <none, or list them>
```

---

## Phase 10 — Admin Routes

**Goal:** rules config is editable without a redeploy, admin-gated correctly.

### Tasks

- [ ] `GET /admin/rules`, `PUT /admin/rules` — Zod-validated against the config shape,
      admin-only.
- [ ] Confirm a rules change actually affects the next verification run's risk score
      (same test as Phase 5's scenario 3, now through the real route).

### Report Back — Phase 10

```
PHASE 10 COMPLETE

[ ] GET/PUT /admin/rules work and are admin-gated (non-admin request rejected — paste it)
[ ] A rules change via PUT is reflected in the next /verify call's risk score

Blockers / open questions: <none, or list them>
```

---

## Phase 11 — Security & Hardening Pass

**Goal:** everything in `SYSTEM_ARCHITECTURE_BACKEND.md` §8's baseline rules is actually
true, not just documented.

### Tasks

- [ ] Every route has Zod input validation — no route trusts raw `req.body`/`req.query`
      unchecked.
- [ ] `errorHandler.ts` never leaks a stack trace or raw error message to the client in
      production mode. In particular, Prisma errors (`PrismaClientKnownRequestError`,
      constraint violation codes like `P2002`) are mapped to clean envelope errors —
      never passed through raw.
- [ ] PII masking on any endpoint returning PAN/financial data by default, with an
      explicit reveal action that appends a ledger entry.
- [ ] Rate limiting (`express-rate-limit`) applied at least to `/auth/login`.
- [ ] Full re-grep of the ledger discipline (Phase 6's grep) — re-run it now that all
      routes exist, since a later phase could have introduced a violation.
- [ ] Re-confirm the trigger + grants on `ledger_entries` are still in place. Someone
      running `prisma migrate reset` mid-build could have silently blown them away — the
      lockdown SQL should re-apply automatically if it lives in `prisma/migrations/`,
      but verify:

  ```sql
  \dp ledger_entries              -- should show INSERT, SELECT only for backend_app's roles
  SELECT tgname FROM pg_trigger WHERE tgrelid = 'ledger_entries'::regclass;
  -- expect: ledger_no_update, ledger_no_delete, ledger_no_truncate all present
  ```

### Report Back — Phase 11

```
PHASE 11 COMPLETE

[ ] Every route confirmed to have input validation (list any that don't, if any)
[ ] Error handler tested with a deliberately broken request — confirmed no stack trace leaks
[ ] Prisma errors mapped to clean envelope errors, tested with a duplicate-key attempt (paste response)
[ ] PII masking confirmed on the relevant endpoint(s)
[ ] Rate limiting active on /auth/login
[ ] Re-run of Phase 6's ledger grep still returns zero results
[ ] \dp ledger_entries confirms backend_app roles have only INSERT/SELECT (paste output)
[ ] All three ledger_no_* triggers still present (paste pg_trigger query output)

Blockers / open questions: <none, or list them>
```

---

## Phase 12 — Final Sign-Off

**Goal:** the backend is demo-ready. This is not a new build phase — it's a full replay
of every critical test above, back to back, to catch anything that broke while later
phases were being built.

### Full Re-Verification Checklist

```
[ ] Phase 1: npm run dev boots clean, /health responds, SELECT current_user = backend_app
[ ] Phase 2: seed data present and correct shape, enum + JSONB CHECK still enforced
[ ] Phase 3: login works for all 3 roles; 401 and 403 paths both confirmed again
[ ] Phase 4: all GET routes return real data
[ ] Phase 5: rules engine responds correctly to a live config change
[ ] Phase 6 — RE-RUN BOTH CRITICAL TESTS:
    (a) UPDATE and DELETE against ledger_entries as backend_app are STILL rejected by
        the role-grant layer (paste both errors, fresh, right before the demo)
    (b) With UPDATE/DELETE temporarily granted, the trigger STILL rejects both
        (paste both errors, fresh) — then REVOKE and confirm baseline restored
[ ] Phase 7: decision flow rejects empty reasons, appends correctly, transaction intact
[ ] Phase 8: AI extraction contract still holds on the actual demo sample documents
[ ] Phase 9: full verification flow works end to end, one clean curl to prove it
[ ] Phase 10: admin routes gated and functional
[ ] Phase 11: security checklist still holds, triggers still present
```

### Final Report Back

```
BACKEND BUILD COMPLETE — READY FOR DEMO

All 12 phases reported clean. Phase 6's critical ledger-immutability tests re-confirmed
at final sign-off, both layers:
- Role-grant layer errors: <paste fresh error output, timestamped>
- Trigger layer errors:    <paste fresh error output, timestamped>
- Baseline grants restored after trigger test: <paste \dp ledger_entries output>

Known, documented limitations (from SYSTEM_ARCHITECTURE_BACKEND.md §11):
- <list anything intentionally out of scope, e.g. real GSTN integration>

Everything else: no known gaps, no unresolved flags.
```

If this final report can be produced honestly, with real pasted output at every checkbox
and not a single unchecked item, the backend is genuinely ready — not because this
document says so, but because every claim in it was independently tested against the
running system.
