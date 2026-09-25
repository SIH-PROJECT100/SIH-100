# ==========================================================================
# Phase 8 Walkthrough — i18n Backend Adjustments + Security Hardening
# Demonstrates:
#   1. Login rate-limit trigger (20 rapid requests -> 429 with Retry-After)
#   2. Verify rate-limit trigger (5 rapid requests -> 429 with Retry-After)
#   3. Detect-collusion rate-limit trigger (3 rapid requests -> 429 with Retry-After)
#   4. Vault report rate-limit trigger (10 rapid requests -> 429 with Retry-After)
#   5. Refresh success (fresh token returned)
#   6. Refresh-after-max-lifetime failure (401 with session.maxLifetimeExceeded)
#   7. Fetch a Hindi error response (Accept-Language: hi)
#   8. Oversized payload rejection (413)
#   9. CORS non-whitelisted origin (missing ACAO in response)
# ==========================================================================

$ErrorActionPreference = "Stop"

Write-Host "Running Phase 8 Walkthrough Execution..." -ForegroundColor Cyan

npx tsx scripts/run_walkthrough_phase8.ts
