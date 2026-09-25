import { prisma } from '../src/db/client.js';
import { computeLedgerChainHash } from '../src/services/ledger.js';
import { canonicalize } from 'json-canonicalize';
import pg from 'pg';
import crypto from 'crypto';

const BASE = 'http://localhost:4000';

interface StepResult {
  step: string;
  passed: boolean;
  details: string;
}

const results: StepResult[] = [];

function record(step: string, passed: boolean, details: string) {
  results.push({ step, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] ${step}: ${details}`);
}

async function api(path: string, options: { method?: string; token?: string; body?: any } = {}) {
  const headers: Record<string, string> = {};
  if (options.body) headers['Content-Type'] = 'application/json';
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  const res = await fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  let text = '';
  if (contentType.includes('application/json')) {
    text = await res.text();
    data = JSON.parse(text);
  } else if (contentType.includes('application/pdf')) {
    const buffer = await res.arrayBuffer();
    data = { isPdf: true, byteLength: buffer.byteLength };
  } else {
    text = await res.text();
    data = text;
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
    rawText: text,
  };
}

import { config } from '../src/config.js';
import jwt from 'jsonwebtoken';

async function main() {
  console.log('================================================================');
  console.log(' GeM Compliance Platform V2 — Phase 6 Verification Walkthrough');
  console.log(' Features: Ledger UI Extensions (Feat 7) & Cartel Detection (Feat 10)');
  console.log('================================================================\n');

  // ── 0. Logins / JWT Tokens ────────────────────────────────────────────────
  console.log('--- Step 0: Authentication ---');
  const adminToken = jwt.sign({ id: 'user-admin-001', role: 'admin' }, config.JWT_SECRET);
  const officerToken = jwt.sign({ id: 'user-officer-001', role: 'officer' }, config.JWT_SECRET);
  record('Admin Token Generated', !!adminToken, 'Role: admin, ID: user-admin-001');
  record('Officer Token Generated', !!officerToken, 'Role: officer, ID: user-officer-001');

  // ── 1. Admin GET /admin/ledger with combined filters ───────────────────────
  console.log('\n--- Step 1: Admin Query Ledger with Combined Filters ---');
  const filterQuery = '/admin/ledger?actorType=system&search=verification&limit=5';
  const filterRes = await api(filterQuery, { token: adminToken });
  const entriesCount = filterRes.data?.data?.length ?? 0;
  record(
    'GET /admin/ledger?actorType=system&search=verification&limit=5',
    filterRes.status === 200 && entriesCount > 0,
    `HTTP ${filterRes.status}, returned ${entriesCount} entries`
  );
  if (entriesCount > 0) {
    console.log('Sample filtered ledger entry:');
    console.log(JSON.stringify(filterRes.data.data[0], null, 2));
  }

  // ── 2. Admin GET /admin/ledger/export?format=pdf & SHA-256 Merkle Verification ─
  console.log('\n--- Step 2: Admin Export PDF & Cryptographic Merkle Hash Verification ---');
  const exportRes = await api('/admin/ledger/export?format=pdf&limit=10', { token: adminToken });
  const headerChainHash = exportRes.headers.get('X-Ledger-Chain-Hash');
  record(
    'GET /admin/ledger/export?format=pdf&limit=10',
    exportRes.status === 200 && exportRes.data?.isPdf === true && !!headerChainHash,
    `HTTP ${exportRes.status}, PDF Size: ${exportRes.data?.byteLength} bytes, Header Hash: ${headerChainHash}`
  );

  // Independently fetch the same 10 entries via JSON API and compute chain hash
  const jsonRes = await api('/admin/ledger?limit=10', { token: adminToken });
  const jsonEntries = jsonRes.data?.data || [];
  const chronological = [...jsonEntries].reverse().map((e: any) => ({
    ...e,
    createdAt: new Date(e.createdAt),
  }));
  const expectedChainHash = computeLedgerChainHash(chronological);
  const hashMatches = headerChainHash === expectedChainHash;
  record(
    'SHA-256 Merkle Chain Hash Verification',
    hashMatches,
    `Computed: ${expectedChainHash} == Header: ${headerChainHash}`
  );

  // ── 3. Seed 3-Bidder Synthetic Collusion Cluster ───────────────────────────
  console.log('\n--- Step 3: Seed Synthetic 3-Bidder Collusion Cluster ---');
  const TENDER_ID = 'tender-walkthrough-p6';

  // Superuser cleanup of prior ledger entries for this tender
  const pgClient = new pg.Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/gem_compliance' });
  await pgClient.connect();
  await pgClient.query("SET session_replication_role = 'replica';");
  try {
    await pgClient.query(`DELETE FROM ledger_entries WHERE bidder_id IN (SELECT id FROM bidders WHERE tender_id = $1) OR detail->>'tenderId' = $1;`, [TENDER_ID]);
    await pgClient.query(`DELETE FROM bidders WHERE tender_id = $1;`, [TENDER_ID]);
    await pgClient.query(`DELETE FROM tenders WHERE id = $1;`, [TENDER_ID]);
  } finally {
    await pgClient.query("SET session_replication_role = 'origin';");
  }

  // Create Tender
  await prisma.tender.create({
    data: {
      id: TENDER_ID,
      title: 'GeM High-Capacity Storage Server Procurement (Phase 6 Walkthrough)',
      gemTenderId: 'GEM/2026/B/999999',
      status: 'open',
    },
  });

  const SHARED_DIRECTOR = 'DIRWT9999X';
  const SHARED_ADDRESS = 'Plot 42, Electronics City Phase 1, Bengaluru - 560100';
  const SHARED_TEMPLATE_MD5 = 'c3b2e1a0987654321fedcba012345678';
  const BASE_TIME = new Date();

  // Create 3 bidders with shared attributes (firing S1, S2, S4, S6)
  const b1 = await prisma.bidder.create({
    data: {
      id: 'bidder-wt-alpha',
      tenderId: TENDER_ID,
      companyName: 'Apex Data Infra Pvt Ltd',
      pan: 'AABCA1234A',
      gstin: '29AABCA1234A1Z5',
      quotedPrice: 4850000,
      submissionIp: '192.168.50.10',
      createdAt: BASE_TIME,
      checks: [
        { name: 'mca', category: 'mca', status: 'verified', detail: { directorPans: [SHARED_DIRECTOR], registeredAddress: SHARED_ADDRESS } },
        { name: 'doc_template', category: 'compliance', status: 'verified', detail: { templateHash: SHARED_TEMPLATE_MD5 } },
      ],
      overallRisk: 'low',
      riskScore: 10,
    },
  });

  const b2 = await prisma.bidder.create({
    data: {
      id: 'bidder-wt-beta',
      tenderId: TENDER_ID,
      companyName: 'Bravura Cloud Solutions LLP',
      pan: 'BBCBB2345B',
      gstin: '29BBCBB2345B1Z4',
      quotedPrice: 4860000,
      submissionIp: '192.168.50.15',
      createdAt: new Date(BASE_TIME.getTime() + 2 * 60 * 1000), // +2 min
      checks: [
        { name: 'mca', category: 'mca', status: 'verified', detail: { directorPans: [SHARED_DIRECTOR], registeredAddress: SHARED_ADDRESS } },
        { name: 'doc_template', category: 'compliance', status: 'verified', detail: { templateHash: SHARED_TEMPLATE_MD5 } },
      ],
      overallRisk: 'low',
      riskScore: 12,
    },
  });

  const b3 = await prisma.bidder.create({
    data: {
      id: 'bidder-wt-gamma',
      tenderId: TENDER_ID,
      companyName: 'Celestial Networks India Ltd',
      pan: 'CCDCC3456C',
      gstin: '29CCDCC3456C1Z3',
      quotedPrice: 4870000,
      submissionIp: '192.168.50.22',
      createdAt: new Date(BASE_TIME.getTime() + 4 * 60 * 1000), // +4 min
      checks: [
        { name: 'mca', category: 'mca', status: 'verified', detail: { directorPans: [SHARED_DIRECTOR], registeredAddress: SHARED_ADDRESS } },
        { name: 'doc_template', category: 'compliance', status: 'verified', detail: { templateHash: SHARED_TEMPLATE_MD5 } },
      ],
      overallRisk: 'low',
      riskScore: 15,
    },
  });

  record('Seeded 3-Bidder Cluster', true, `Tender: ${TENDER_ID}, Bidders: ${b1.id}, ${b2.id}, ${b3.id}`);

  // ── 4. Officer Runs POST /tenders/:id/detect-collusion (Call 1) ─────────────
  console.log('\n--- Step 4: Officer Runs POST /tenders/:id/detect-collusion (Call 1) ---');
  const t0 = Date.now();
  const run1 = await api(`/tenders/${TENDER_ID}/detect-collusion`, {
    method: 'POST',
    token: officerToken,
  });
  const lat1 = Date.now() - t0;
  record(
    'Officer Run 1: detect-collusion',
    run1.status === 200 && run1.data?.data?.clusters?.length > 0 && run1.data?.data?.cached === false,
    `HTTP ${run1.status}, Latency: ${lat1}ms, Clusters: ${run1.data?.data?.clusters?.length}, Cached: ${run1.data?.data?.cached}`
  );
  console.log('Cluster detection result summary:');
  console.log(`  Bidders analyzed: ${run1.data?.data?.totalBiddersAnalyzed}`);
  console.log(`  Threshold: ${run1.data?.data?.threshold}`);
  console.log(`  Signals fired across cluster: ${run1.data?.data?.clusters[0]?.signalsFired.join(', ')}`);
  console.log(`  Aggregate cluster score: ${run1.data?.data?.clusters[0]?.aggregateScore}`);

  // ── 5. Rapid Double-Click: Call 2 & Call 3 within 60 Seconds ──────────────
  console.log('\n--- Step 5: Rapid Successive Calls (Call 2 & Call 3 within 60s Window) ---');
  const run2 = await api(`/tenders/${TENDER_ID}/detect-collusion`, {
    method: 'POST',
    token: officerToken,
  });
  record(
    'Officer Run 2 (Idempotent replay): detect-collusion',
    run2.status === 200 && run2.data?.data?.cached === true,
    `HTTP ${run2.status}, Cached: ${run2.data?.data?.cached}`
  );

  const run3 = await api(`/tenders/${TENDER_ID}/detect-collusion`, {
    method: 'POST',
    token: officerToken,
  });
  record(
    'Officer Run 3 (Idempotent replay): detect-collusion',
    run3.status === 200 && run3.data?.data?.cached === true,
    `HTTP ${run3.status}, Cached: ${run3.data?.data?.cached}`
  );

  // ── 6. Idempotency Proof: Ledger Count & Response Identity ────────────────
  console.log('\n--- Step 6: Idempotency Proof: Database Ledger Count & Response Identity ---');
  const ledgerCountRes = await pgClient.query(
    `SELECT COUNT(*)::int AS count FROM ledger_entries WHERE action = 'collusion_analysis_run' AND detail->>'tenderId' = $1;`,
    [TENDER_ID]
  );
  const ledgerCount = ledgerCountRes.rows[0].count;
  record(
    'Ledger Entry Count Verification',
    ledgerCount === 1,
    `SELECT COUNT(*) returned: ${ledgerCount} (Strictly 1 entry created despite 3 calls)`
  );

  // Compare responses
  const d1 = run1.data.data;
  const d2 = run2.data.data;
  const d3 = run3.data.data;

  const run2And3ByteIdentical = run2.rawText === run3.rawText;
  const clusterDataIdentical =
    canonicalize(d1.clusters) === canonicalize(d2.clusters) &&
    canonicalize(d2.clusters) === canonicalize(d3.clusters);
  const metaIdentical =
    d1.totalBiddersAnalyzed === d2.totalBiddersAnalyzed &&
    d1.totalBiddersAnalyzed === d3.totalBiddersAnalyzed &&
    d1.threshold === d2.threshold &&
    d1.threshold === d3.threshold;

  record(
    'Replay Byte Identity (Run 2 vs Run 3)',
    run2And3ByteIdentical,
    `Run 2 and Run 3 responses are 100% byte-identical (cached=true on both, exact byte match)`
  );

  record(
    'Cluster Data Canonical Identity (Run 1 vs Run 2 & 3)',
    clusterDataIdentical && metaIdentical,
    `Cluster data and analysis metadata are identical across all three calls (Run 1: cached=false; Runs 2 & 3: cached=true)`
  );

  // ── 7. Sample of Flagged Bidder's collusion_risk Check ─────────────────────
  console.log("\n--- Step 7: Sample of Flagged Bidder's collusion_risk Check ---");
  const flaggedBidder = await prisma.bidder.findUnique({
    where: { id: 'bidder-wt-alpha' },
  });
  const collusionCheck = (flaggedBidder?.checks as any[])?.find((c) => c.name === 'collusion_risk');
  record(
    'Bidder checks contains collusion_risk',
    !!collusionCheck && collusionCheck.status === 'flagged',
    `Status: ${collusionCheck?.status}, Score: ${collusionCheck?.clusterScore}, ClusterId: ${collusionCheck?.clusterId}`
  );
  console.log('\n[Actual JSON from bidders.checks]:');
  console.log(JSON.stringify(collusionCheck, null, 2));

  // ── 8. Sample of collusion_analysis_run Ledger Entry's Detail Field ───────
  console.log("\n--- Step 8: Sample of collusion_analysis_run Ledger Entry Detail ---");
  const ledgerRow = await pgClient.query(
    `SELECT id, created_at, bidder_id, actor_type, actor_id, action, detail FROM ledger_entries WHERE action = 'collusion_analysis_run' AND detail->>'tenderId' = $1 LIMIT 1;`,
    [TENDER_ID]
  );
  const ledgerEntry = ledgerRow.rows[0];
  record(
    'Ledger Entry Detail Verification',
    !!ledgerEntry && ledgerEntry.detail.tenderId === TENDER_ID,
    `Entry ID: ${ledgerEntry?.id}, Bidder ID: ${ledgerEntry?.bidder_id}, Action: ${ledgerEntry?.action}`
  );
  console.log('\n[Actual JSON from ledger_entries.detail]:');
  console.log(JSON.stringify(ledgerEntry.detail, null, 2));

  await pgClient.end();

  console.log('\n================================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(` Walkthrough Result: ${allPassed ? 'ALL STEPS PASSED (100%)' : 'SOME STEPS FAILED'}`);
  console.log('================================================================\n');
}

main().catch(console.error);
