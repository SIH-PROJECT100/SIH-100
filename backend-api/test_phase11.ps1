#!/usr/bin/env pwsh
# Phase 11 Security & Hardening --- Verification Script

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

# Wait for Server
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

# 0. Auth tokens
Section "0. Auth Tokens"

$body1 = [ordered]@{ email = "officer@demo.com"; password = "demo1234!" } | ConvertTo-Json
$body2 = [ordered]@{ email = "admin@demo.com";   password = "demo1234!" } | ConvertTo-Json
$body3 = [ordered]@{ email = "bidder@demo.com";  password = "demo1234!" } | ConvertTo-Json

$officerR = Invoke-RestMethod -Method POST -Uri "$BASE/auth/login" -ContentType "application/json" -Body $body1 -ErrorAction Stop
$adminR   = Invoke-RestMethod -Method POST -Uri "$BASE/auth/login" -ContentType "application/json" -Body $body2 -ErrorAction Stop
$bidderR  = Invoke-RestMethod -Method POST -Uri "$BASE/auth/login" -ContentType "application/json" -Body $body3 -ErrorAction Stop

$OT = $officerR.data.token
$AT = $adminR.data.token
$BT = $bidderR.data.token

$tenders = Invoke-RestMethod -Method GET -Uri "$BASE/tenders" -Headers @{ Authorization = "Bearer $OT" }
$TENDER_ID = $tenders.data[0].id
$bidderList = Invoke-RestMethod -Method GET -Uri "$BASE/tenders/$TENDER_ID/bidders" -Headers @{ Authorization = "Bearer $OT" }
$BIDDER_ID = $bidderList.data[0].id

Write-Host "  Tender ID: $TENDER_ID"
Write-Host "  Bidder ID: $BIDDER_ID"

# --------- 1. PII Masking in GET /bidders/:id ------------------------------------------------------------------------------------------------------------------
Section "1. PII Masking --- GET /bidders/:id"

$detail = Invoke-RestMethod -Method GET -Uri "$BASE/bidders/$BIDDER_ID" -Headers @{ Authorization = "Bearer $OT" }
$pan   = $detail.data.pan
$gstin = $detail.data.gstin

Write-Host "  Masked PAN:   '$pan'"
Write-Host "  Masked GSTIN: '$gstin'"

if ($pan -match [regex]::Escape("****")) {
    Pass "PAN contains **** (arch doc ABCDE****F style)"
} elseif ($null -eq $pan -or $pan -eq "") {
    Pass "PAN is null/empty (no PAN stored for this bidder)"
} else {
    Fail "PAN not masked" "Got: $pan"
}

if ($gstin -match [regex]::Escape("****")) {
    Pass "GSTIN contains **** (arch doc style)"
} elseif ($null -eq $gstin -or $gstin -eq "") {
    Pass "GSTIN is null/empty (no GSTIN stored for this bidder)"
} else {
    Fail "GSTIN not masked" "Got: $gstin"
}

# Check PAN mask shape exactly: first 5 + **** + 1
if ($pan -and $pan.Length -eq 10) {
    $expectedPattern = '^[A-Z]{5}\*{4}[A-Z0-9]$'
    if ($pan -match $expectedPattern) {
        Pass "PAN mask shape is XXXXX****X (arch doc --8 exact format)"
    } else {
        Fail "PAN mask shape does not match XXXXX****X" "Got: $pan"
    }
}

# --------- 2. UUID Param Validation ---------------------------------------------------------------------------------------------------------------------------------------------------
Section "2. UUID Param Validation --- clean 400 on malformed IDs"

try {
    Invoke-RestMethod -Method GET -Uri "$BASE/bidders/not-a-uuid" -Headers @{ Authorization = "Bearer $OT" } -ErrorAction Stop
    Fail "GET /bidders/not-a-uuid" "Expected 400, got 200"
} catch {
    $s = $_.Exception.Response.StatusCode.value__
    if ($s -eq 400) { Pass "GET /bidders/not-a-uuid --- 400" } else { Fail "GET /bidders/not-a-uuid" "Expected 400, got $s" }
}

try {
    Invoke-RestMethod -Method GET -Uri "$BASE/tenders/not-a-uuid" -Headers @{ Authorization = "Bearer $OT" } -ErrorAction Stop
    Fail "GET /tenders/not-a-uuid" "Expected 400, got 200"
} catch {
    $s = $_.Exception.Response.StatusCode.value__
    if ($s -eq 400) { Pass "GET /tenders/not-a-uuid --- 400" } else { Fail "GET /tenders/not-a-uuid" "Expected 400, got $s" }
}

try {
    Invoke-RestMethod -Method GET -Uri "$BASE/admin/ledger?bidderId=not-a-uuid" -Headers @{ Authorization = "Bearer $AT" } -ErrorAction Stop
    Fail "GET /admin/ledger?bidderId=not-a-uuid" "Expected 400, got 200"
} catch {
    $s = $_.Exception.Response.StatusCode.value__
    if ($s -eq 400) { Pass "GET /admin/ledger?bidderId=not-a-uuid --- 400" } else { Fail "GET /admin/ledger?bidderId=not-a-uuid" "Expected 400, got $s" }
}

# --------- 3. PII Reveal Role Enforcement ------------------------------------------------------------------------------------------------------------------------------
Section "3. PII Reveal --- Role Enforcement"

try {
    Invoke-RestMethod -Method GET -Uri "$BASE/bidders/$BIDDER_ID/pii" -Headers @{ Authorization = "Bearer $BT" } -ErrorAction Stop
    Fail "Bidder on /pii" "Expected 403, got 200"
} catch {
    $s = $_.Exception.Response.StatusCode.value__
    if ($s -eq 403) { Pass "Bidder role --- 403 on /pii" } else { Fail "Bidder role /pii" "Expected 403, got $s" }
}

try {
    Invoke-RestMethod -Method GET -Uri "$BASE/bidders/$BIDDER_ID/pii" -ErrorAction Stop
    Fail "Unauthenticated on /pii" "Expected 401, got 200"
} catch {
    $s = $_.Exception.Response.StatusCode.value__
    if ($s -eq 401) { Pass "Unauthenticated --- 401 on /pii" } else { Fail "Unauth /pii" "Expected 401, got $s" }
}

# --------- 4. PII Reveal + Ledger Audit Trail ------------------------------------------------------------------------------------------------------------------
Section "4. PII Reveal --- Officer Access + Atomic Ledger Audit"

$lBefore = Invoke-RestMethod -Method GET -Uri "$BASE/admin/ledger?bidderId=$BIDDER_ID" -Headers @{ Authorization = "Bearer $AT" }
$cntBefore = $lBefore.data.Count
Write-Host "  Ledger entries before reveal: $cntBefore"

$piiR = Invoke-RestMethod -Method GET -Uri "$BASE/bidders/$BIDDER_ID/pii" -Headers @{ Authorization = "Bearer $OT" }
Write-Host "  Reveal PAN:    '$($piiR.data.pan)'"
Write-Host "  Reveal GSTIN:  '$($piiR.data.gstin)'"
Write-Host "  _auditId:      $($piiR.data._auditId)"

if ($null -ne $piiR.data.pan -and $piiR.data.pan -notmatch [regex]::Escape("****")) {
    Pass "PAN is unmasked in /pii reveal response"
} elseif ($null -eq $piiR.data.pan -or $piiR.data.pan -eq "") {
    Pass "PAN null/empty (not stored for bidder)"
} else {
    Fail "PAN still masked in /pii response" "Got: $($piiR.data.pan)"
}

$lAfter = Invoke-RestMethod -Method GET -Uri "$BASE/admin/ledger?bidderId=$BIDDER_ID" -Headers @{ Authorization = "Bearer $AT" }
$cntAfter = $lAfter.data.Count
Write-Host "  Ledger entries after reveal: $cntAfter"

if ($cntAfter -eq $cntBefore + 1) {
    Pass "Ledger +1 after reveal (atomic transaction confirmed)"
} else {
    Fail "Ledger count wrong" "Before: $cntBefore  After: $cntAfter"
}

$revEntry = $lAfter.data | Where-Object { $_.action -eq "pii_reveal" } | Select-Object -First 1
if ($revEntry) {
    Pass "pii_reveal entry exists in ledger"
    Write-Host "  +-- Ledger Entry -----------------------------------------" -ForegroundColor DarkCyan
    Write-Host "  |  id:        $($revEntry.id)" -ForegroundColor DarkCyan
    Write-Host "  |  action:    $($revEntry.action)" -ForegroundColor DarkCyan
    Write-Host "  |  actorType: $($revEntry.actorType)" -ForegroundColor DarkCyan
    Write-Host "  |  actorId:   $($revEntry.actorId)" -ForegroundColor DarkCyan
    $detailJson = $revEntry.detail | ConvertTo-Json -Compress
    Write-Host "  |  detail:    $detailJson" -ForegroundColor DarkCyan
    Write-Host "  |  createdAt: $($revEntry.createdAt)" -ForegroundColor DarkCyan
    Write-Host "  +---------------------------------------------------------" -ForegroundColor DarkCyan

    if ($revEntry.actorType -eq "officer") {
        Pass "actorType = 'officer' (correct)"
    } else {
        Fail "actorType mismatch" "Expected officer, got $($revEntry.actorType)"
    }
    if ($revEntry.actorId -eq $officerR.data.user.id) {
        Pass "actorId matches officer's user id"
    } else {
        Fail "actorId mismatch" "Expected $($officerR.data.user.id), got $($revEntry.actorId)"
    }
    $detail = $revEntry.detail
    if ($detail.fields -contains "pan" -and $detail.fields -contains "gstin") {
        Pass "detail.fields contains ['pan','gstin']"
    } else {
        Fail "detail.fields missing pan/gstin" "Got: $detailJson"
    }
} else {
    Fail "No pii_reveal entry in ledger"
}

# --------- 5. Prisma Error Mapping & Validation ----------------------------------------
Section "5. Prisma Error Mapping & Validation (no stack trace leaks)"

# P2025: update non-existent record
$decBody = [ordered]@{ status = "qualified" } | ConvertTo-Json
try {
    Invoke-RestMethod -Method POST -Uri "$BASE/bidders/00000000-0000-0000-0000-000000000000/decision" -Headers @{ Authorization = "Bearer $OT"; "Content-Type" = "application/json" } -Body $decBody -ErrorAction Stop
    Fail "P2025 test" "Expected 404, got 200"
} catch {
    $s = $_.Exception.Response.StatusCode.value__
    if ($s -eq 404) {
        Pass "P2025 (record not found) --- clean 404"
    } else {
        Fail "P2025 mapping" "Expected 404, got $s"
    }
}

# Zod validation: bad email in login
$badEmail = [ordered]@{ email = "not-an-email"; password = "x" } | ConvertTo-Json
try {
    Invoke-RestMethod -Method POST -Uri "$BASE/auth/login" -ContentType "application/json" -Body $badEmail -ErrorAction Stop
    Fail "Zod 400 test" "Expected 400, got 200"
} catch {
    $s = $_.Exception.Response.StatusCode.value__
    $bodyText = $_.ErrorDetails.Message
    if ($s -eq 400 -and $bodyText -notmatch '"stack"') {
        Pass "Zod validation --- clean 400 (no stack trace in body)"
    } else {
        Fail "Zod validation response" "Status: $s  Stack in body: $($bodyText -match 'stack')"
    }
}

# Malformed JSON --- no stack trace
try {
    $r = Invoke-WebRequest -Method POST -Uri "$BASE/auth/login" -ContentType "application/json" -Body "{ bad json }" -ErrorAction SilentlyContinue
    $bodyText = $r.Content
    if ($bodyText -notmatch '"stack"') {
        Pass "Malformed JSON --- no stack trace in response"
    } else {
        Fail "Stack trace leaked" "Body: $bodyText"
    }
} catch {
    $bodyText = $_.ErrorDetails.Message
    if ($bodyText -notmatch '"stack"') {
        Pass "Malformed JSON --- no stack trace in error response"
    } else {
        Fail "Stack trace leaked" "Body: $bodyText"
    }
}

# --------- 6. Phase 6 Grep Discipline Re-run -------------------------------------------
Section "6. Phase 6 Grep Discipline --- ledger_entries confinement"

$tsFiles = Get-ChildItem -Path "src" -Recurse -Filter "*.ts"
$leaks = $tsFiles | Select-String -Pattern "ledger_entries" | Where-Object { $_.Path -notmatch "ledger\.ts" }
$leaks2 = $tsFiles | Select-String -Pattern "prisma\.ledgerEntry" | Where-Object { $_.Path -notmatch "ledger\.ts" }
$leaks3 = $tsFiles | Select-String -Pattern "LedgerEntry" | Where-Object { $_.Path -notmatch "ledger\.ts" }

$allLeaks = @($leaks) + @($leaks2) + @($leaks3) | Where-Object { $_ }

if ($allLeaks.Count -eq 0) {
    Pass "Zero leaks: ledger_entries/prisma.ledgerEntry/LedgerEntry only in ledger.ts"
} else {
    Fail "Ledger discipline breach: $($allLeaks.Count) hits outside ledger.ts"
    $allLeaks | ForEach-Object { Write-Host "     $($_.Path):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor Red }
}

# --------- 7. Phase 6 Trigger Re-verify ------------------------------------------------
Section "7. Phase 6 DB Trigger Re-verify (role-grant + trigger layers)"

# We use psql via the DATABASE_URL and DIRECT_URL env vars (strip query params for psql)
$rawDbUrl = ((Get-Content ".env" | Where-Object { $_ -match "^DATABASE_URL=" }) -replace "^DATABASE_URL=", "").Trim('"')
$rawDirectUrl = ((Get-Content ".env" | Where-Object { $_ -match "^DIRECT_URL=" }) -replace "^DIRECT_URL=", "").Trim('"')
$dbUrl = $rawDbUrl -replace '\?.*$', ''
$directUrl = $rawDirectUrl -replace '\?.*$', ''
Write-Host "  DB URL loaded from .env"

# Layer 1: role-grant --- SET ROLE backend_app then try UPDATE
$layer1 = (& psql $dbUrl --command "SET ROLE backend_app; UPDATE ledger_entries SET actor_id='hacked' WHERE false;" 2>&1) | Out-String
Write-Host "  Layer 1 output: $layer1"
if ($layer1 -match "permission denied|ERROR") {
    Pass "Layer 1 (role-grant): backend_app UPDATE blocked by Postgres"
} else {
    Fail "Layer 1 (role-grant): UPDATE did not fail" "Output: $layer1"
}

# Layer 2: trigger --- superuser tries UPDATE on an actual row
$firstRowId = ((& psql $directUrl --tuples-only --command "SELECT id FROM ledger_entries LIMIT 1;" 2>&1) | Out-String).Trim()
Write-Host "  First ledger row ID: '$firstRowId'"

if ($firstRowId -and $firstRowId.Length -gt 10) {
    $layer2 = (& psql $directUrl --command "UPDATE ledger_entries SET actor_id='trigger-test' WHERE id='$firstRowId';" 2>&1) | Out-String
    Write-Host "  Layer 2 output: $layer2"
    if ($layer2 -match "ledger_entries is append-only|ERROR") {
        Pass "Layer 2 (trigger): superuser UPDATE blocked by trigger"
    } else {
        Fail "Layer 2 (trigger): UPDATE succeeded --- trigger missing or broken" "Output: $layer2"
    }
} else {
    Write-Host "  No rows in ledger_entries yet --- checking trigger installation directly"
}

$trigMeta = ((& psql $directUrl --tuples-only --command "SELECT tgname FROM pg_trigger WHERE tgrelid='ledger_entries'::regclass;" 2>&1) | Out-String).Trim()
Write-Host "  Triggers on ledger_entries:`n$trigMeta"
if ($trigMeta -match "ledger_no_update" -and $trigMeta -match "ledger_no_delete" -and $trigMeta -match "ledger_no_truncate") {
    Pass "Layer 2: all 3 triggers confirmed on ledger_entries (update, delete, truncate)"
} else {
    Fail "Layer 2: triggers missing from ledger_entries" "pg_trigger: $trigMeta"
}

# --------- 8. Rate Limit Trip ----------------------------------------------------------
Section "8. Rate Limit --- 22 rapid /auth/login requests --- 429"

$got429 = $false
$codes = @()
$badBody = [ordered]@{ email = "flood@test.com"; password = "badpassword" } | ConvertTo-Json

for ($i = 1; $i -le 22; $i++) {
    try {
        $r = Invoke-WebRequest -Method POST -Uri "$BASE/auth/login" -ContentType "application/json" -Body $badBody -ErrorAction SilentlyContinue
        $codes += $r.StatusCode
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $codes += $code
        if ($code -eq 429) { $got429 = $true }
    }
}

$codeStr = ($codes -join ", ")
Write-Host "  Status codes: $codeStr"

if ($got429) {
    Pass "Rate limiter fired --- 429 after $($codes.Count) rapid requests"
} else {
    Fail "Rate limiter did NOT fire 429 after 22 attempts" "Codes: $codeStr"
}

# --------- Summary ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
Write-Host "`n=== PHASE 11 RESULTS ===" -ForegroundColor Cyan
Write-Host "  PASS: $PASS" -ForegroundColor Green
if ($FAIL -eq 0) {
    Write-Host "  FAIL: 0  (All Phase 11 security checks passed)" -ForegroundColor Green
} else {
    Write-Host "  FAIL: $FAIL" -ForegroundColor Red
}

