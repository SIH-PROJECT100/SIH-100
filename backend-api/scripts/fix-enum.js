import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/gem_compliance?schema=public'
});

const values = [
  'verification_run',
  'officer_decision',
  'pii_reveal',
  'config_change',
  'admin_action',
  'award_decision_primary',
  'award_decision_secondary',
  'verification_expiry_notice',
  'fee_transition',
  'fee_paid',
  'primary_decision',
  'secondary_decision',
  'badge_awarded',
  'collusion_analysis_run',
  'delivery_milestone',
  'award_closed',
  'document_uploaded',
  'document_upload_rejected',
  'ai_extraction_run',
  'cross_check_run',
  'signature_verification_run',
  'document_deleted'
];

async function run() {
  await client.connect();
  for (const val of values) {
    try {
      await client.query(`ALTER TYPE "LedgerActionType" ADD VALUE IF NOT EXISTS '${val}';`);
      console.log(`Added or confirmed: ${val}`);
    } catch (e) {
      console.error(`Error adding ${val}:`, e.message);
    }
  }
  // Ensure user-bidder-001 exists in bidders table to satisfy FK
  try {
    await client.query(`
      INSERT INTO bidders (id, tender_id, company_name, udyam_number, gstin, pan, overall_risk, risk_score, checks, created_at, updated_at)
      VALUES ('user-bidder-001', 'tender-001', 'Ananya Enterprises Pvt Ltd', 'UDYAM-MH-01-00892', '27AAWBS9999P1Z5', 'AAWBS9999P', 'low', 12.0, '[]'::jsonb, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Ensured user-bidder-001 in bidders table');
  } catch (e) {
    console.error('Error inserting user-bidder-001:', e.message);
  }

  await client.end();
}

run();

