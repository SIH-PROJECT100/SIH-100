#!/usr/bin/env pwsh
# Phase 12 Final Sign-Off --- Full Replay Verification Script

$env:PATH = "C:\Program Files\PostgreSQL\18\bin;$env:PATH"
$BASE = "http://localhost:4000"
$PASS = 0
$FAIL = 0

function Pass([string]$label) {
    Write-Host "  [PASS] $label" -ForegroundColor Green
    $script:PASS++
}
function Fail([string]$label, [string]$detail) {
    Write-Host "  [FAIL] $label" -ForegroundColor Red
    if ($detail) { Write-Host "         $detail" -ForegroundColor DarkRed }
    $script:FAIL++
}
function Section([string]$label) {
    Write-Host "`n=== $label ===" -ForegroundColor Cyan
}

# --------- Ensure Server is Healthy ------------------------------------------------------------------------------------------------------------------------------------------------
Write-Host "Checking backend server on $BASE..."
$up = $false
for ($i = 0; $i -lt 15; $i++) {
    try {
        $h = Invoke-RestMethod -Uri "$BASE/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($h.data.status -eq "ok") { $up = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 500
}
if (-not $up) {
    Write-Host "Backend server is not responding on $BASE/health!" -ForegroundColor Red
    exit 1
}
Write-Host "Backend server is healthy." -ForegroundColor Green

# --------- Load DB Connection URLs ---------------------------------------------------------------------------------------------------------------------------------------------------
$rawDbUrl = ((Get-Content ".env" | Where-Object { $_ -match "^DATABASE_URL=" }) -replace "^DATABASE_URL=", "").Trim('"')
$rawDirectUrl = ((Get-Content ".env" | Where-Object { $_ -match "^DIRECT_URL=" }) -replace "^DIRECT_URL=", "").Trim('"')
$dbUrl = $rawDbUrl -replace '\?.*$', ''
$directUrl = $rawDirectUrl -replace '\?.*$', ''

# --------- Phase 1: Boot, /health, and current_user ------------------------------------------------------------------------------------------------
Section "Phase 1: Boot, /health, and current_user"
$health = Invoke-RestMethod -Uri "$BASE/health"
if ($health.data.status -eq "ok") {
    Pass "/health responded with { status: 'ok' }"
} else {
    Fail "/health responded with unexpected payload" ($health | ConvertTo-Json)
}

$currentUser = ((& psql $dbUrl --tuples-only --command "SELECT current_user;" 2>&1) | Out-String).Trim()
Write-Host "  SELECT current_user: '$currentUser'"
if ($currentUser -eq "backend_app") {
    Pass "SELECT current_user = 'backend_app' (least-privilege connection verified)"
} else {
    Fail "current_user mismatch" "Expected 'backend_app', got '$currentUser'"
}

# --------- Phase 2: Seed data & schema integrity ---------------------------------------------------------------------------------------------------------
Section "Phase 2: Seed data & schema integrity"
$userCount = ((& psql $directUrl --tuples-only --command "SELECT count(*) FROM users;" 2>&1) | Out-String).Trim()
$tenderCount = ((& psql $directUrl --tuples-only --command "SELECT count(*) FROM tenders;" 2>&1) | Out-String).Trim()
$bidderCount = ((& psql $directUrl --tuples-only --command "SELECT count(*) FROM bidders;" 2>&1) | Out-String).Trim()
$ledgerCount = ((& psql $directUrl --tuples-only --command "SELECT count(*) FROM ledger_entries;" 2>&1) | Out-String).Trim()

Write-Host "  Users: $userCount | Tenders: $tenderCount | Bidders: $bidderCount | Ledger: $ledgerCount"
if ([int]$userCount -ge 3 -and [int]$tenderCount -ge 2 -and [int]$bidderCount -ge 10) {
    Pass "Seed data present (Users: $userCount, Tenders: $tenderCount, Bidders: $bidderCount)"
} else {
    Fail "Seed data incomplete" "Users: $userCount, Tenders: $tenderCount, Bidders: $bidderCount"
}

# --------- Phase 3: Auth & RBAC (3 demo roles, 401 & 403 paths) ---------------------------------------------------------------
Section "Phase 3: Auth & RBAC"
$bodyOfficer = [ordered]@{ email = "officer@demo.com"; password = "demo1234!" } | ConvertTo-Json
$bodyAdmin   = [ordered]@{ email = "admin@demo.com";   password = "demo1234!" } | ConvertTo-Json
$bodyBidder  = [ordered]@{ email = "bidder@demo.com";  password = "demo1234!" } | ConvertTo-Json

$officerR = Invoke-RestMethod -Method POST -Uri "$BASE/auth/login" -ContentType "application/json" -Body $bodyOfficer
$adminR   = Invoke-RestMethod -Method POST -Uri "$BASE/auth/login" -ContentType "application/json" -Body $bodyAdmin
$bidderR  = Invoke-RestMethod -Method POST -Uri "$BASE/auth/login" -ContentType "application/json" -Body $bodyBidder

$OT = $officerR.data.token
$AT = $adminR.data.token
$BT = $bidderR.data.token

if ($OT -and $AT -and $BT) {
    Pass "Login works for all 3 demo roles (officer, admin, bidder)"
} else {
    Fail "Login failed for one or more roles"
}

# 401 unauthenticated check
try {
    Invoke-RestMethod -Method GET -Uri "$BASE/tenders" -ErrorAction Stop
    Fail "Unauthenticated GET /tenders" "Expected 401, got 200"
} catch {
    $s = $_.Exception.Response.StatusCode.value__
    if ($s -eq 401) { Pass "Unauthenticated request -> 401 Unauthorized" } else { Fail "Unauthenticated request" "Expected 401, got $s" }
}

# 403 role-gated check (bidder hitting admin route)
try {
    Invoke-RestMethod -Method GET -Uri "$BASE/admin/rules" -Headers @{ Authorization = "Bearer $BT" } -ErrorAction Stop
    Fail "Bidder hitting /admin/rules" "Expected 403, got 200"
} catch {
    $s = $_.Exception.Response.StatusCode.value__
    if ($s -eq 403) { Pass "Bidder token hitting /admin/rules -> 403 Forbidden" } else { Fail "Bidder on admin route" "Expected 403, got $s" }
}

# --------- Phase 4: Read Slice (Tenders & Bidders) ------------------------------------------------------------------------------------------------------
Section "Phase 4: Read Slice (Tenders & Bidders)"
$tenders = Invoke-RestMethod -Method GET -Uri "$BASE/tenders" -Headers @{ Authorization = "Bearer $OT" }
$TENDER_ID = $tenders.data[0].id
$bidderList = Invoke-RestMethod -Method GET -Uri "$BASE/tenders/$TENDER_ID/bidders" -Headers @{ Authorization = "Bearer $OT" }
$BIDDER_ID = $bidderList.data[0].id
$bidderDetail = Invoke-RestMethod -Method GET -Uri "$BASE/bidders/$BIDDER_ID" -Headers @{ Authorization = "Bearer $OT" }

Write-Host "  Tender: $TENDER_ID ($($tenders.data[0].title))"
Write-Host "  Bidder: $BIDDER_ID ($($bidderDetail.data.companyName))"

if ($tenders.data.Count -gt 0 -and $bidderList.data.Count -gt 0 -and $bidderDetail.data.companyName) {
    Pass "All read endpoints return real relational data"
} else {
    Fail "Read endpoints failed or returned empty data"
}

# --------- Phase 5: Rules Engine & Config Update ------------------------------------------------------------------------------------------------------------
Section "Phase 5: Rules Engine & Dynamic Config"
$currentRules = Invoke-RestMethod -Method GET -Uri "$BASE/admin/rules" -Headers @{ Authorization = "Bearer $AT" }
$putBody = [ordered]@{
    config = [ordered]@{
        msme = @{ weight = 15; requiredForTender = $false };
        gst = @{ weight = 25; flaggedPenalty = 30 };
        pan_itr = @{ weight = 20; mismatchPenalty = 25 };
        blacklist = @{ weight = 30; flaggedPenalty = 50 };
        make_in_india = @{ weight = 10; requiredForTender = $false };
        local_content = @{ minPercentage = 50; weight = 10 };
        riskThresholds = @{ low = 25; medium = 55; high = 80 };
    }
} | ConvertTo-Json -Depth 5

$updatedRules = Invoke-RestMethod -Method PUT -Uri "$BASE/admin/rules" -Headers @{ Authorization = "Bearer $AT"; "Content-Type" = "application/json" } -Body $putBody
if ($updatedRules.data.config.msme.weight -eq 15) {
    Pass "Rules configuration successfully updated via PUT /admin/rules"
} else {
    Fail "Rules update did not persist correctly"
}

# --------- Phase 6: Trust Ledger Critical Immutability Tests ------------------------------------------------------------------------
Section "Phase 6: Trust Ledger Immutability Tests (RE-RUN FRESH)"
$firstLedgerRow = ((& psql $directUrl --tuples-only --command "SELECT id FROM ledger_entries LIMIT 1;" 2>&1) | Out-String).Trim()
Write-Host "  Target Ledger Row: '$firstLedgerRow'"

# (a) Role-grant layer: UPDATE & DELETE rejected for backend_app
$errUpdateRole = (& psql $dbUrl --command "SET ROLE backend_app; UPDATE ledger_entries SET actor_id='hack' WHERE false;" 2>&1) | Out-String
$errDeleteRole = (& psql $dbUrl --command "SET ROLE backend_app; DELETE FROM ledger_entries WHERE false;" 2>&1) | Out-String

Write-Host "  [a1] Role UPDATE error: $($errUpdateRole.Trim())" -ForegroundColor DarkCyan
Write-Host "  [a2] Role DELETE error: $($errDeleteRole.Trim())" -ForegroundColor DarkCyan

if ($errUpdateRole -match "permission denied" -and $errDeleteRole -match "permission denied") {
    Pass "Critical Test (a): Role-grant layer blocks both UPDATE and DELETE for backend_app"
} else {
    Fail "Critical Test (a): Role-grant did not block mutation"
}

# (b) Trigger layer: with temporary grant, trigger STILL blocks both
& psql $directUrl --command "GRANT UPDATE, DELETE ON ledger_entries TO backend_app;" | Out-Null

$errUpdateTrig = (& psql $directUrl --command "SET ROLE backend_app; UPDATE ledger_entries SET actor_id='hack' WHERE id='$firstLedgerRow';" 2>&1) | Out-String
$errDeleteTrig = (& psql $directUrl --command "SET ROLE backend_app; DELETE FROM ledger_entries WHERE id='$firstLedgerRow';" 2>&1) | Out-String

# Immediately restore baseline grants
& psql $directUrl --command "REVOKE UPDATE, DELETE ON ledger_entries FROM backend_app;" | Out-Null

Write-Host "  [b1] Trigger UPDATE error: $($errUpdateTrig.Trim())" -ForegroundColor DarkCyan
Write-Host "  [b2] Trigger DELETE error: $($errDeleteTrig.Trim())" -ForegroundColor DarkCyan

if ($errUpdateTrig -match "ledger_entries is append-only" -and $errDeleteTrig -match "ledger_entries is append-only") {
    Pass "Critical Test (b): Database trigger blocks both UPDATE and DELETE even with explicit privileges"
} else {
    Fail "Critical Test (b): Trigger failed to block mutation"
}

$dpRestored = (& psql $directUrl --command "\dp ledger_entries" 2>&1) | Out-String
Write-Host "  Restored privileges:`n$dpRestored"
if ($dpRestored -match "ledger_append_only=ar/postgres") {
    Pass "Baseline permissions confirmed restored (ledger_append_only = ar/postgres)"
} else {
    Fail "Baseline permissions not properly restored"
}

# --------- Phase 7: Officer Decisions Flow ------------------------------------------------------------------------------------------------------------------------------
Section "Phase 7: Officer Decisions Flow"
# Rejection on empty reason for clarification_requested
$badDecBody = [ordered]@{ status = "clarification_requested"; reason = "   " } | ConvertTo-Json
try {
    Invoke-RestMethod -Method POST -Uri "$BASE/bidders/$BIDDER_ID/decision" -Headers @{ Authorization = "Bearer $OT"; "Content-Type" = "application/json" } -Body $badDecBody -ErrorAction Stop
    Fail "Empty reason on clarification_requested" "Expected 400, got 200"
} catch {
    $s = $_.Exception.Response.StatusCode.value__
    if ($s -eq 400) { Pass "Decision with missing reason correctly rejected with 400" } else { Fail "Decision rejection" "Expected 400, got $s" }
}

# Valid decision
$goodDecBody = [ordered]@{ status = "qualified"; reason = "All mandatory checks satisfied" } | ConvertTo-Json
$decRes = Invoke-RestMethod -Method POST -Uri "$BASE/bidders/$BIDDER_ID/decision" -Headers @{ Authorization = "Bearer $OT"; "Content-Type" = "application/json" } -Body $goodDecBody
if ($decRes.data.bidder.officerDecision.status -eq "qualified" -or $decRes.data.officerDecision.status -eq "qualified") {
    Pass "Valid officer decision processed and recorded (bidder.officerDecision.status = qualified, ledgerId = $($decRes.data.ledgerId))"
} else {
    Fail "Officer decision failed" ($decRes | ConvertTo-Json -Depth 3)
}

# --------- Phase 8: AI Extraction Contract ------------------------------------------------------------------------------------------------------------------------------
Section "Phase 8: AI Extraction Contract & Error Handling"
$aiOutput = (npx tsx test_ai_contract.ts 2>&1) | Out-String

if ($aiOutput -match "AI_SUCCESS:(\{.*?\})") {
    $aiParsed = $Matches[1] | ConvertFrom-Json
    Pass "AI extraction schema valid: docType=$($aiParsed.documentType), confidence=$($aiParsed.confidence)"
} else {
    Fail "AI extraction schema validation failed" "$aiOutput"
}

if ($aiOutput -match "AI_CORRUPT_HANDLED:ExtractionError") {
    Pass "Corrupted document input produces clean handled extraction error (ExtractionError)"
} else {
    Fail "Corrupt document was not handled cleanly" "$aiOutput"
}

# --------- Phase 9: Connectors & Full Verification Orchestrator ---------------------------------------------------------------
Section "Phase 9: Full Verification Flow (POST /bidders/:id/verify)"
$ledgerBefore = ((& psql $directUrl --tuples-only --command "SELECT count(*) FROM ledger_entries;" 2>&1) | Out-String).Trim()
$verifyRes = Invoke-RestMethod -Method POST -Uri "$BASE/bidders/$BIDDER_ID/verify" -Headers @{ Authorization = "Bearer $OT" }
$ledgerAfter = ((& psql $directUrl --tuples-only --command "SELECT count(*) FROM ledger_entries;" 2>&1) | Out-String).Trim()

Write-Host "  Overall Risk: $($verifyRes.data.overallRisk)"
Write-Host "  Risk Score:   $($verifyRes.data.riskScore)"
Write-Host "  Checks count: $($verifyRes.data.checks.Count)"

$hasSimulated = $false
foreach ($c in $verifyRes.data.checks) {
    if ($c.simulated -eq $true) { $hasSimulated = $true; break }
}

if ($verifyRes.data.overallRisk -and [int]$ledgerAfter -gt [int]$ledgerBefore) {
    Pass "Full verification flow succeeded, risk evaluated, ledger incremented ($ledgerBefore -> $ledgerAfter)"
} else {
    Fail "Verification flow did not update bidder or increment ledger"
}
if ($hasSimulated) {
    Pass "Simulated tier checks correctly flag simulated: true"
} else {
    Fail "Simulated checks missing simulated flag"
}

# --------- Phase 10: Admin Routes ---------------------------------------------------------------------------------------------------------------------------------------------------------
Section "Phase 10: Admin Routes"
$adminRules = Invoke-RestMethod -Method GET -Uri "$BASE/admin/rules" -Headers @{ Authorization = "Bearer $AT" }
$adminLedger = Invoke-RestMethod -Method GET -Uri "$BASE/admin/ledger" -Headers @{ Authorization = "Bearer $AT" }

if ($adminRules.data -and $adminLedger.data.Count -gt 0) {
    Pass "Admin routes (/admin/rules, /admin/ledger) functional and return data"
} else {
    Fail "Admin routes failed"
}

# --------- Phase 11: Security & Triggers Check ------------------------------------------------------------------------------------------------------------------
Section "Phase 11: Security & Triggers Final Check"
$malformed = Invoke-RestMethod -Method GET -Uri "$BASE/bidders/$BIDDER_ID" -Headers @{ Authorization = "Bearer $OT" }
if ($malformed.data.pan -match "\*{4}") {
    Pass "PII masking still active on detail view (PAN: $($malformed.data.pan))"
} else {
    Fail "PII masking missing"
}

$trigCount = ((& psql $directUrl --tuples-only --command "SELECT count(*) FROM pg_trigger WHERE tgrelid='ledger_entries'::regclass AND tgname LIKE 'ledger_no_%';" 2>&1) | Out-String).Trim()
if ([int]$trigCount -eq 3) {
    Pass "All 3 ledger_no_* triggers confirmed in place"
} else {
    Fail "Triggers missing from ledger_entries" "Count: $trigCount"
}

# --------- Final Summary ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
Section "PHASE 12 FINAL VERIFICATION SUMMARY"
Write-Host "  PASS: $PASS" -ForegroundColor Green
if ($FAIL -eq 0) {
    Write-Host "  FAIL: 0  (ALL 12 PHASES CONFIRMED CLEAN)" -ForegroundColor Green
} else {
    Write-Host "  FAIL: $FAIL" -ForegroundColor Red
}


