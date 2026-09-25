# ==========================================================================
# Phase 6 Walkthrough — Ledger UI Extensions & Cartel Detection Engine
# Demonstrates:
#   1. Admin runs GET /admin/ledger with combined filters
#   2. Admin exports GET /admin/ledger/export?format=pdf, hash verified
#   3. Officer runs POST /tenders/:id/detect-collusion on 3-bidder cluster
#   4. Officer clicks detect-collusion twice more in quick succession (<60s)
#   5. Idempotency proof: 1 ledger entry, identical clusters
#   6. Flagged bidder collusion_risk check inspection
#   7. collusion_analysis_run ledger detail inspection
# ==========================================================================

$ErrorActionPreference = "Stop"

Write-Host "Running Phase 6 Walkthrough Execution..." -ForegroundColor Cyan

npx tsx scripts/run_walkthrough_phase6.ts
