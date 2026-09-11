-- Phase 2: Ledger lockdown — run as superuser (postgres) against gem_compliance

-- 1) Revoke anything default privileges may have granted on this specific table.
REVOKE ALL ON TABLE ledger_entries FROM app_readwrite;

-- 2) Explicit, minimal grants for the append-only role.
GRANT SELECT, INSERT ON TABLE ledger_entries TO ledger_append_only;
-- (No sequence grant needed — id is a UUID, not a serial/bigserial)
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

-- 4) JSONB CHECK constraint on bidders.officer_decision.status
ALTER TABLE bidders ADD CONSTRAINT officer_decision_status_valid
  CHECK (
    officer_decision IS NULL
    OR officer_decision->>'status' IN ('qualified','disqualified','clarification_requested','pending')
  );
