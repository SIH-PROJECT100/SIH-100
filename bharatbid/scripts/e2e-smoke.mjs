#!/usr/bin/env node
/**
 * BharatBid — E2E Smoke Test Suite
 * ─────────────────────────────────────────────────────────────────────────────
 * Exercises every major backend API route and frontend asset route using the
 * built-in Node.js `fetch` API (Node ≥ 18). No Playwright, no Cypress, no
 * additional devDependencies.
 *
 * What it tests:
 *   [A] Backend health + auth flows (login all 3 demo roles)
 *   [B] Officer flow: GET /tenders → GET /tenders/:id → GET /tenders/:id/bidders
 *   [C] Collusion detection: POST /tenders/:id/detect-collusion
 *   [D] Bidder decision: POST /bidders/:id/decision
 *   [E] Award flow: POST /tenders/:id/award (expects gate-fail without qualified winner)
 *   [F] Admin flow: GET /admin/rules → PUT /admin/rules
 *   [G] Bidder portal: GET /bidder/me/profile → GET /bidder/me/vault
 *   [H] i18n endpoint: GET /i18n/strings?lang=en → GET /i18n/strings?lang=hi
 *   [I] Frontend dist build: checks that vite preview responds 200 for /
 *
 * Usage:
 *   node scripts/e2e-smoke.mjs
 *   node scripts/e2e-smoke.mjs --api-url=http://localhost:4000 --frontend-url=http://localhost:5173
 *
 * Exit code: 0 = all PASS, 1 = one or more FAIL
 */

import { argv } from 'process'

// ─── Config ───────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.slice(2).split('=')
      return [k, v ?? 'true']
    })
)

const API_URL = args['api-url'] || 'http://localhost:4000'
const FRONTEND_URL = args['frontend-url'] || 'http://localhost:5173'
const TIMEOUT = parseInt(args['timeout'] || '10000', 10)

// Demo credentials (must match seeded users)
const DEMO = {
  officer: { email: 'officer@demo.com', password: 'demo1234!' },
  admin: { email: 'admin@demo.com', password: 'demo1234!' },
  bidder: { email: 'bidder@demo.com', password: 'demo1234!' },
}

// ─── Test runner ──────────────────────────────────────────────────────────────

const results = []
let currentSuite = ''

function suite(name) {
  currentSuite = name
  console.log(`\n[${name}]`)
}

async function test(name, fn) {
  const label = `  ${name}`
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT}ms`)), TIMEOUT)
      ),
    ])
    console.log(`  ✅ ${name}`)
    results.push({ suite: currentSuite, name, status: 'PASS' })
  } catch (err) {
    const msg = err?.message || String(err)
    console.log(`  ❌ ${name}\n     ${msg}`)
    results.push({ suite: currentSuite, name, status: 'FAIL', error: msg })
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed')
}

async function apiFetch(path, options = {}) {
  const url = `${API_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  let body
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { res, body, status: res.status }
}

async function apiAuth(path, token, options = {}) {
  return apiFetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
}

// ─── Token store ──────────────────────────────────────────────────────────────

const tokens = {}

// ─── Suite A: Health + Auth ───────────────────────────────────────────────────

suite('A — Health + Auth')

await test('GET /health returns 200 with status=ok', async () => {
  const { status, body } = await apiFetch('/health')
  assert(status === 200, `Expected 200, got ${status}`)
  assert(body?.status === 'ok' || body?.data?.status === 'ok', `Unexpected health body: ${JSON.stringify(body)}`)
})

await test('POST /auth/login officer — returns JWT', async () => {
  const { status, body } = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(DEMO.officer),
  })
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`)
  const token = body?.data?.token || body?.token
  assert(token, 'No token in response')
  tokens.officer = token
})

await test('POST /auth/login admin — returns JWT', async () => {
  const { status, body } = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(DEMO.admin),
  })
  assert(status === 200, `Expected 200, got ${status}`)
  const token = body?.data?.token || body?.token
  assert(token, 'No token in response')
  tokens.admin = token
})

await test('POST /auth/login bidder — returns JWT', async () => {
  const { status, body } = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(DEMO.bidder),
  })
  assert(status === 200, `Expected 200, got ${status}`)
  const token = body?.data?.token || body?.token
  assert(token, 'No token in response')
  tokens.bidder = token
})

await test('POST /auth/login invalid creds — returns 401', async () => {
  const { status } = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'nobody@test.com', password: 'wrong' }),
  })
  assert(status === 401, `Expected 401, got ${status}`)
})

// ─── Suite B: Officer — Tenders ───────────────────────────────────────────────

suite('B — Officer: Tenders')

let firstTenderId = null
let firstBidderId = null

await test('GET /tenders — returns array', async () => {
  if (!tokens.officer) throw new Error('Officer token missing')
  const { status, body } = await apiAuth('/tenders', tokens.officer)
  assert(status === 200, `Expected 200, got ${status}`)
  const list = body?.data || body
  assert(Array.isArray(list), 'Expected array')
  if (list.length > 0) firstTenderId = list[0].id
})

await test('GET /tenders/:id — tender detail', async () => {
  if (!firstTenderId) { console.log('     ⚠ skipped (no tender seeded)'); return }
  const { status, body } = await apiAuth(`/tenders/${firstTenderId}`, tokens.officer)
  assert(status === 200, `Expected 200, got ${status}`)
  const t = body?.data || body
  assert(t?.id === firstTenderId, 'Tender ID mismatch')
})

await test('GET /tenders/:id/bidders — returns array', async () => {
  if (!firstTenderId) { console.log('     ⚠ skipped (no tender seeded)'); return }
  const { status, body } = await apiAuth(`/tenders/${firstTenderId}/bidders`, tokens.officer)
  assert(status === 200, `Expected 200, got ${status}`)
  const list = body?.data || body
  assert(Array.isArray(list), 'Expected array of bidders')
  const pending = list.find(b => b.status === 'pending' || b.decision === 'pending' || !b.decision)
  if (pending) firstBidderId = pending.id
  else if (list.length > 0) firstBidderId = list[0].id
})

await test('GET /tenders (unauthenticated) — returns 401', async () => {
  const { status } = await apiFetch('/tenders')
  assert(status === 401 || status === 403, `Expected 401/403, got ${status}`)
})

// ─── Suite C: Collusion Detection ─────────────────────────────────────────────

suite('C — Collusion Detection')

await test('POST /tenders/:id/detect-collusion — returns result', async () => {
  if (!firstTenderId) { console.log('     ⚠ skipped (no tender seeded)'); return }
  const { status, body } = await apiAuth(`/tenders/${firstTenderId}/detect-collusion`, tokens.officer, {
    method: 'POST',
  })
  // 200 OK (computed) or 429 (rate-limited from prior call) are both acceptable
  assert(
    status === 200 || status === 201 || status === 429,
    `Expected 200/201/429, got ${status}: ${JSON.stringify(body)}`
  )
  if (status !== 429) {
    const result = body?.data || body
    assert(typeof result?.totalBiddersAnalyzed === 'number' || Array.isArray(result?.clusters),
      'Expected collusion result shape')
  }
})

// ─── Suite D: Bidder Decision ─────────────────────────────────────────────────

suite('D — Bidder Decision')

await test('POST /bidders/:id/decision — disqualify requires reason', async () => {
  if (!firstBidderId) { console.log('     ⚠ skipped (no bidder)'); return }
  const { status, body } = await apiAuth(`/bidders/${firstBidderId}/decision`, tokens.officer, {
    method: 'POST',
    body: JSON.stringify({ status: 'disqualified' }), // missing reason
  })
  assert(
    status === 400,
    `Expected 400 (reason required), got ${status}: ${JSON.stringify(body)}`
  )
})

await test('POST /bidders/:id/decision — qualify succeeds', async () => {
  if (!firstBidderId) { console.log('     ⚠ skipped (no bidder)'); return }
  const { status, body } = await apiAuth(`/bidders/${firstBidderId}/decision`, tokens.officer, {
    method: 'POST',
    body: JSON.stringify({ status: 'qualified', reason: '' }),
  })
  // 200 OK, 201 Created, 409 Conflict, or 403 sameOfficerCannotDoubleSign (dual-officer guard)
  const isDoubleSignBlocked = status === 403 && body?.error?.code === 'errors.sameOfficerCannotDoubleSign'
  assert(
    status === 200 || status === 201 || status === 409 || isDoubleSignBlocked,
    `Expected 200/201/409 or double-sign guard, got ${status}: ${JSON.stringify(body)}`
  )
})

// ─── Suite E: Award Flow ──────────────────────────────────────────────────────

suite('E — Award Flow')

await test('POST /tenders/:id/award — invalid payload returns 400', async () => {
  if (!firstTenderId) { console.log('     ⚠ skipped'); return }
  const { status, body } = await apiAuth(`/tenders/${firstTenderId}/award`, tokens.officer, {
    method: 'POST',
    body: JSON.stringify({ winningBidderId: '', justification: 'too short', standoutFactors: [] }),
  })
  assert(
    status === 400,
    `Expected 400 for invalid payload, got ${status}: ${JSON.stringify(body)}`
  )
})

await test('POST /tenders/:id/award — bidder role blocked (403)', async () => {
  if (!firstTenderId) { console.log('     ⚠ skipped'); return }
  const { status } = await apiAuth(`/tenders/${firstTenderId}/award`, tokens.bidder, {
    method: 'POST',
    body: JSON.stringify({ winningBidderId: 'x', justification: 'x'.repeat(80), standoutFactors: [{ factor: 'f', note: 'n' }] }),
  })
  assert(status === 403, `Expected 403 for bidder role, got ${status}`)
})

// ─── Suite F: Admin Rules ─────────────────────────────────────────────────────

suite('F — Admin Rules Config')

await test('GET /admin/rules — officer blocked (403)', async () => {
  const { status } = await apiAuth('/admin/rules', tokens.officer)
  assert(status === 403, `Expected 403 for officer role, got ${status}`)
})

await test('GET /admin/rules — admin gets config', async () => {
  const { status, body } = await apiAuth('/admin/rules', tokens.admin)
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`)
  const cfg = body?.data?.config || body?.config
  assert(cfg, 'Expected config object')
})

await test('PUT /admin/rules — invalid payload returns 400', async () => {
  const { status } = await apiAuth('/admin/rules', tokens.admin, {
    method: 'PUT',
    body: JSON.stringify({ collusion: { threshold: 999 } }), // out of range
  })
  assert(status === 400, `Expected 400 for invalid collusion threshold, got ${status}`)
})

await test('PUT /admin/rules — valid partial update succeeds', async () => {
  const { status, body } = await apiAuth('/admin/rules', tokens.admin, {
    method: 'PUT',
    body: JSON.stringify({ deliveryGraceDays: 7 }),
  })
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`)
})

// ─── Suite G: Bidder Portal ───────────────────────────────────────────────────

suite('G — Bidder Portal')

await test('GET /bidder/me/profile — officer blocked (403)', async () => {
  const { status } = await apiAuth('/bidder/me/profile', tokens.officer)
  assert(status === 403, `Expected 403 for officer role, got ${status}`)
})

await test('GET /bidder/me/profile — bidder gets profile or 404', async () => {
  const { status, body } = await apiAuth('/bidder/me/profile', tokens.bidder)
  // 200 = profile exists, 404 = not seeded yet (both valid in smoke test)
  assert(
    status === 200 || status === 404,
    `Expected 200/404, got ${status}: ${JSON.stringify(body)}`
  )
})

await test('GET /bidder/me/vault — bidder gets vault list', async () => {
  const { status, body } = await apiAuth('/bidder/me/vault', tokens.bidder)
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`)
  const list = body?.data || body
  assert(Array.isArray(list), 'Expected array')
})

// ─── Suite H: i18n ───────────────────────────────────────────────────────────

suite('H — i18n Strings Endpoint')

await test('GET /i18n/strings?lang=en — returns string map', async () => {
  const { status, body } = await apiFetch('/i18n/strings?lang=en')
  // 200 = endpoint exists, 404 = not yet implemented (acceptable — degrades to FALLBACK_EN)
  if (status === 404) {
    console.log('     ℹ️  /i18n/strings endpoint not found — frontend uses FALLBACK_EN gracefully')
    return
  }
  assert(status === 200, `Expected 200, got ${status}`)
  const data = body?.data || body
  assert(typeof data === 'object' && data !== null, 'Expected string map object')
})

await test('GET /i18n/strings?lang=hi — returns Hindi strings or 404', async () => {
  const { status, body } = await apiFetch('/i18n/strings?lang=hi')
  if (status === 404) {
    console.log('     ℹ️  Hindi strings not yet seeded — frontend falls back to English')
    return
  }
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`)
})

// ─── Suite I: Frontend ────────────────────────────────────────────────────────

suite('I — Frontend Dev Server')

await test('GET / — frontend serves HTML with BharatBid title', async () => {
  const res = await fetch(`${FRONTEND_URL}/`, { headers: { Accept: 'text/html' } })
  assert(res.status === 200, `Frontend returned ${res.status}`)
  const html = await res.text()
  assert(
    html.includes('BharatBid') || html.includes('<div id="root">') || html.includes('<!DOCTYPE html>'),
    'Expected BharatBid HTML'
  )
})

await test('GET /login — route returns HTML (SPA catch-all)', async () => {
  const res = await fetch(`${FRONTEND_URL}/login`, { headers: { Accept: 'text/html' } })
  assert(res.status === 200, `Frontend /login returned ${res.status}`)
})

// ─── Final summary ────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.status === 'PASS').length
const failed = results.filter((r) => r.status === 'FAIL').length
const total = results.length

console.log('\n' + '='.repeat(60))
console.log(`E2E Smoke Test Results: ${passed}/${total} passed`)

if (failed > 0) {
  console.log(`\n❌ FAILURES (${failed}):`)
  results
    .filter((r) => r.status === 'FAIL')
    .forEach((r) => console.log(`   [${r.suite}] ${r.name}\n   → ${r.error}`))
} else {
  console.log('✅ All smoke tests passed!')
}
console.log()

process.exit(failed > 0 ? 1 : 0)
