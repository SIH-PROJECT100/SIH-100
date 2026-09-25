#!/usr/bin/env node
/**
 * i18n Audit Script — BharatBid
 * ─────────────────────────────────────────────────────────────────────────────
 * Scans all .tsx / .ts files under src/ and flags:
 *
 *   1. HARDCODED_STRING  — JSX text content or attribute values that look like
 *      English user-facing strings not wrapped in t(). Heuristic: sequences
 *      of two or more words containing only Latin characters, spaces, and
 *      common punctuation, appearing as JSX text children or in common props
 *      (placeholder, title, aria-label, description).
 *
 *   2. MISSING_KEY       — Keys present in FALLBACK_EN (from I18nProvider) but
 *      not referenced by any t('...') call in the codebase.
 *
 *   3. ORPHAN_KEY        — t('...') calls that reference keys NOT in FALLBACK_EN.
 *
 * Output:
 *   - Console: grouped summary with counts
 *   - docs/i18n-audit.md: structured Markdown report
 *
 * Usage:
 *   node scripts/i18n-audit.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'src')
const OUT = join(ROOT, 'docs', 'i18n-audit.md')

// ─── FALLBACK_EN keys (sourced from I18nProvider.tsx) ────────────────────────
const FALLBACK_KEYS = new Set([
  'app.name', 'app.tagline',
  'nav.tenders', 'nav.admin', 'nav.ledger', 'nav.bidder', 'nav.profile', 'nav.components',
  'login.title', 'login.subtitle', 'login.email', 'login.password', 'login.submit',
  'login.demo.officer', 'login.demo.admin', 'login.demo.bidder',
  'login.demo.title', 'login.demo.note', 'login.sessionExpired',
  'auth.rateLimited',
  'trust.disclaimer',
  'award.warning.appendedToLedger',
  'secondary.awaitingPrimary',
  'banner.staleVerification',
  'cta.reverifyNow', 'cta.inspectAndDecide', 'cta.openTriage',
  'decision.qualify', 'decision.disqualify', 'decision.clarification',
  'decision.reason.placeholder', 'decision.reason.required', 'decision.submitted',
  'pii.reveal', 'pii.revealed', 'pii.confirm.title', 'pii.confirm.body',
  'collusion.detect', 'collusion.detecting', 'collusion.detected', 'collusion.none',
  'riskLevel.critical', 'riskLevel.high', 'riskLevel.medium', 'riskLevel.low',
  'trustSource.digilocker', 'trustSource.portal_verified', 'trustSource.ai_extracted', 'trustSource.simulated',
  'tenderStatus.draft', 'tenderStatus.open', 'tenderStatus.evaluation', 'tenderStatus.awarded', 'tenderStatus.closed',
  'empty.noBidders', 'empty.noTenders', 'empty.noLedger',
  'tenders.title', 'tenders.subtitle',
  'error.generic', 'error.networkError',
  'common.loading', 'common.retry', 'common.cancel', 'common.confirm',
  'common.save', 'common.close', 'common.copy', 'common.copied',
  'common.download', 'common.export',
])

// ─── File walker ──────────────────────────────────────────────────────────────

function walk(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, results)
    } else if (['.tsx', '.ts'].includes(extname(full))) {
      results.push(full)
    }
  }
  return results
}

// ─── Patterns ─────────────────────────────────────────────────────────────────

// Match t('key') or t("key") — capture key
const T_CALL_RE = /\bt\(\s*['"]([^'"]+)['"]/g

// Match JSX text children that look like user-facing English phrases
// Heuristic: 2+ words starting with capital, letters, spaces, punctuation
const HARDCODED_JSX_TEXT_RE = />([A-Z][a-zA-Z ]{6,}[a-zA-Z])</g

// Match placeholder, title, aria-label, description, alt props with string literals
const HARDCODED_PROP_RE = /(?:placeholder|title|aria-label|description|alt)=["']([A-Z][a-zA-Z ]{6,}[a-zA-Z])["']/g

// Files that are explicitly excluded from the hardcoded string audit
// (they contain intentional hardcoded strings — e.g. FALLBACK_EN itself,
//  or are config/type files with no UI strings)
const EXCLUDED_FROM_HARDCODED = new Set([
  'I18nProvider.tsx',
  'index.ts',
])

// ─── Analysis ─────────────────────────────────────────────────────────────────

const files = walk(SRC)

const usedKeys = new Map()     // key → Set<filePath>
const hardcoded = []           // { file, line, text }
const orphanKeys = new Map()   // key → Set<filePath>

for (const filePath of files) {
  const rel = relative(ROOT, filePath)
  const content = readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const fileName = filePath.split(/[\\/]/).pop()

  // 1. Collect t() key usage
  let m
  T_CALL_RE.lastIndex = 0
  while ((m = T_CALL_RE.exec(content)) !== null) {
    const key = m[1]
    if (!usedKeys.has(key)) usedKeys.set(key, new Set())
    usedKeys.get(key).add(rel)
    if (!FALLBACK_KEYS.has(key)) {
      if (!orphanKeys.has(key)) orphanKeys.set(key, new Set())
      orphanKeys.get(key).add(rel)
    }
  }

  // 2. Scan for hardcoded strings (skip excluded files)
  if (EXCLUDED_FROM_HARDCODED.has(fileName)) continue

  // JSX text children
  HARDCODED_JSX_TEXT_RE.lastIndex = 0
  while ((m = HARDCODED_JSX_TEXT_RE.exec(content)) !== null) {
    const text = m[1].trim()
    if (text.length < 8) continue
    // Get line number
    const before = content.slice(0, m.index)
    const lineNum = before.split('\n').length
    hardcoded.push({ file: rel, line: lineNum, text, type: 'JSX text' })
  }

  // Attribute string literals
  HARDCODED_PROP_RE.lastIndex = 0
  while ((m = HARDCODED_PROP_RE.exec(content)) !== null) {
    const text = m[1].trim()
    if (text.length < 8) continue
    const before = content.slice(0, m.index)
    const lineNum = before.split('\n').length
    hardcoded.push({ file: rel, line: lineNum, text, type: 'prop attr' })
  }
}

// Missing keys: in FALLBACK_EN but never referenced by any t() call
const missingKeys = [...FALLBACK_KEYS].filter((k) => !usedKeys.has(k))

// ─── Deduplicate hardcoded (same file+line can match both patterns) ───────────
const hardcodedDeduped = []
const seen = new Set()
for (const h of hardcoded) {
  const sig = `${h.file}:${h.line}:${h.text}`
  if (!seen.has(sig)) {
    seen.add(sig)
    hardcodedDeduped.push(h)
  }
}

// ─── Console output ───────────────────────────────────────────────────────────

const pass = hardcodedDeduped.length === 0 && orphanKeys.size === 0 && missingKeys.length === 0

console.log('\n🔍 BharatBid i18n Audit\n' + '='.repeat(60))
console.log(`  Files scanned:          ${files.length}`)
console.log(`  Keys in FALLBACK_EN:    ${FALLBACK_KEYS.size}`)
console.log(`  Keys used via t():      ${usedKeys.size}`)
console.log(`  Hardcoded strings:      ${hardcodedDeduped.length}`)
console.log(`  Orphan keys (unknown):  ${orphanKeys.size}`)
console.log(`  Missing keys (unused):  ${missingKeys.length}`)
console.log()

if (hardcodedDeduped.length > 0) {
  console.log('⚠️  HARDCODED STRINGS (sample, max 20):')
  hardcodedDeduped.slice(0, 20).forEach((h) => {
    console.log(`   [${h.type}] ${h.file}:${h.line} → "${h.text}"`)
  })
  if (hardcodedDeduped.length > 20) {
    console.log(`   … and ${hardcodedDeduped.length - 20} more (see docs/i18n-audit.md)`)
  }
  console.log()
}

if (missingKeys.length > 0) {
  console.log('📭 MISSING KEY USAGE (in FALLBACK_EN but no t() call found):')
  missingKeys.slice(0, 15).forEach((k) => console.log(`   ${k}`))
  if (missingKeys.length > 15) console.log(`   … and ${missingKeys.length - 15} more`)
  console.log()
}

if (orphanKeys.size > 0) {
  console.log('🔴 ORPHAN KEYS (t() calls with unknown keys):')
  for (const [k, files] of orphanKeys) {
    console.log(`   "${k}" in ${[...files].join(', ')}`)
  }
  console.log()
}

if (pass) {
  console.log('✅ i18n audit PASSED — no issues found.\n')
} else {
  console.log(
    `⚠️  i18n audit COMPLETE — ${hardcodedDeduped.length} hardcoded strings, ` +
    `${orphanKeys.size} orphan keys, ${missingKeys.length} unused fallback keys.\n` +
    `   See docs/i18n-audit.md for full report.\n`
  )
}

// ─── Write Markdown report ────────────────────────────────────────────────────

const now = new Date().toISOString()

let md = `# BharatBid i18n Audit Report

Generated: \`${now}\`

## Summary

| Metric | Count |
|--------|-------|
| TSX/TS files scanned | ${files.length} |
| Keys in \`FALLBACK_EN\` | ${FALLBACK_KEYS.size} |
| Keys referenced via \`t()\` | ${usedKeys.size} |
| Hardcoded user-facing strings | ${hardcodedDeduped.length} |
| Orphan keys (t() with unknown key) | ${orphanKeys.size} |
| Unused fallback keys | ${missingKeys.length} |

**Status: ${pass ? '✅ PASSED' : '⚠️ ISSUES FOUND'}**

---

## Coverage by File

\`\`\`
`

const fileKeyMap = {}
for (const [key, files] of usedKeys) {
  for (const f of files) {
    if (!fileKeyMap[f]) fileKeyMap[f] = []
    fileKeyMap[f].push(key)
  }
}

for (const [f, keys] of Object.entries(fileKeyMap)) {
  md += `${f}: ${keys.length} key(s) → ${keys.slice(0, 4).join(', ')}${keys.length > 4 ? '…' : ''}\n`
}
md += '```\n\n'

md += `## Files with Zero i18n Usage\n\n`
md += `> These files have no \`t()\` calls. Most are expected (providers, types, util),\n`
md += `> but route-level screens should wire \`useI18n()\` for key labels.\n\n`
const noI18nFiles = files.filter(
  (f) => !fileKeyMap[relative(ROOT, f)] && !f.includes('node_modules')
).map((f) => relative(ROOT, f))

if (noI18nFiles.length > 0) {
  md += `| File | Status |\n|------|--------|\n`
  for (const f of noI18nFiles) {
    const isRoute = f.includes('routes') || f.includes('layouts')
    md += `| \`${f}\` | ${isRoute ? '⚠️ Route (consider adding t())' : 'ℹ️ Non-UI file'} |\n`
  }
} else {
  md += `All route-level files use i18n.\n`
}
md += '\n'

if (hardcodedDeduped.length > 0) {
  md += `## Hardcoded Strings (${hardcodedDeduped.length})\n\n`
  md += `> These are candidate strings to move into FALLBACK_EN and referenced via \`t()\`.\n`
  md += `> Priority: any string visible to end-users on officer / bidder / admin screens.\n\n`
  md += `| File | Line | Type | Text |\n|------|------|------|------|\n`
  for (const h of hardcodedDeduped.slice(0, 100)) {
    md += `| \`${h.file}\` | ${h.line} | ${h.type} | ${h.text.replace(/\|/g, '\\|')} |\n`
  }
  if (hardcodedDeduped.length > 100) {
    md += `\n_… and ${hardcodedDeduped.length - 100} more hardcoded strings not shown._\n`
  }
  md += '\n'
}

if (missingKeys.length > 0) {
  md += `## Unused Fallback Keys (${missingKeys.length})\n\n`
  md += `> Keys defined in FALLBACK_EN but never called via \`t()\`. Consider adding \`t()\` calls\n`
  md += `> in the appropriate screens, or remove if deprecated.\n\n`
  md += `\`\`\`\n${missingKeys.join('\n')}\n\`\`\`\n\n`
}

if (orphanKeys.size > 0) {
  md += `## Orphan Keys (${orphanKeys.size})\n\n`
  md += `> Keys used in \`t()\` calls but not defined in FALLBACK_EN. These will fall back to the key string.\n\n`
  md += `| Key | Used In |\n|-----|----------|\n`
  for (const [k, files] of orphanKeys) {
    md += `| \`${k}\` | ${[...files].join(', ')} |\n`
  }
  md += '\n'
}

md += `## Recommendations\n\n`
md += `1. **Phase priority**: Wire \`t()\` into the three screens added in F3/F4 that currently have\n`
md += `   zero i18n coverage: \`tenders/detail.tsx\`, \`admin/index.tsx\`, \`bidder/index.tsx\`.\n`
md += `2. **Hindi glossary**: Populate \`GET /i18n/strings?lang=hi\` backend endpoint with\n`
md += `   translations for all ${FALLBACK_KEYS.size} FALLBACK_EN keys.\n`
md += `3. **Aria labels**: All \`aria-label\` / \`placeholder\` props should use \`t()\` so screen\n`
md += `   readers in Hindi mode announce correctly.\n`
md += `4. **RTL**: Hindi is not RTL, but ensure Devanagari font is loaded and \`[lang='hi']\`\n`
md += `   selector applies correct line-height (already set in index.css).\n`

writeFileSync(OUT, md, 'utf8')
console.log(`📄 Full report written to: docs/i18n-audit.md\n`)
