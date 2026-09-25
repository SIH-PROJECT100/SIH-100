$BASE = 'http://localhost:4000'

# Login as primary officer
$login1 = Invoke-RestMethod -Method POST -Uri "$BASE/auth/login" -Headers @{'Content-Type'='application/json'} -Body '{"email":"officer@demo.com","password":"demo1234!"}'
$OT1 = $login1.data.token

# Login as secondary officer (admin role has officer privilege in backend)
$login2 = Invoke-RestMethod -Method POST -Uri "$BASE/auth/login" -Headers @{'Content-Type'='application/json'} -Body '{"email":"admin@demo.com","password":"demo1234!"}'
$OT2 = $login2.data.token

$targetBidder = 'bidder-004'

Write-Host "=== 1. Primary Officer Submits Decision ==="
$p1 = Invoke-RestMethod -Method POST -Uri "$BASE/bidders/$targetBidder/decision" -Headers @{ Authorization = "Bearer $OT1"; "Content-Type" = "application/json" } -Body '{"status":"qualified","reason":"Primary review complete - all MSME records verified"}'
Write-Host "Primary approvalState : $($p1.data.bidder.approvalState)"
Write-Host "Stage                 : $($p1.data.stage)"
Write-Host "Ledger ID             : $($p1.data.ledgerId)"

Write-Host "`n=== 2. Secondary Officer Views Bidder (Anti-Anchoring Redaction) ==="
$viewSec = Invoke-RestMethod -Method GET -Uri "$BASE/bidders/$targetBidder" -Headers @{ Authorization = "Bearer $OT2" }
Write-Host "Secondary sees reason : '$($viewSec.data.officerDecision.reason)' (null = redacted)"

Write-Host "`n=== 3. Primary Officer Attempts Double-Sign (Should Fail 403) ==="
try {
    Invoke-RestMethod -Method POST -Uri "$BASE/bidders/$targetBidder/decision" -Headers @{ Authorization = "Bearer $OT1"; "Content-Type" = "application/json" } -Body '{"status":"qualified","reason":"Self-approving second stage"}'
    Write-Host "FAILED: Expected 403 Forbidden"
} catch {
    Write-Host "403 Blocked as expected: $($_.Exception.Message)"
}

Write-Host "`n=== 4. Secondary Officer Submits Final Approval ==="
$p2 = Invoke-RestMethod -Method POST -Uri "$BASE/bidders/$targetBidder/decision" -Headers @{ Authorization = "Bearer $OT2"; "Content-Type" = "application/json" } -Body '{"status":"qualified","reason":"Secondary review verified - financial health confirmed"}'
Write-Host "Final approvalState   : $($p2.data.bidder.approvalState)"
Write-Host "Stage                 : $($p2.data.stage)"
Write-Host "Ledger ID             : $($p2.data.ledgerId)"

Write-Host "`n=== 5. Both Decisions Revealed Post-Secondary ==="
$viewFinal = Invoke-RestMethod -Method GET -Uri "$BASE/bidders/$targetBidder" -Headers @{ Authorization = "Bearer $OT2" }
Write-Host "Primary reason        : '$($viewFinal.data.officerDecision.reason)'"
Write-Host "Secondary reason      : '$($viewFinal.data.officerDecision.secondaryDecision.reason)'"

Write-Host "`n=== 6. Audit Ledger Verification for Bidder (GET /ledger/bidder/:id) ==="
$bidderLedger = Invoke-RestMethod -Method GET -Uri "$BASE/ledger/bidder/$targetBidder" -Headers @{ Authorization = "Bearer $OT1" }
$bidderEntries = $bidderLedger.data | Where-Object { $_.action -eq 'primary_decision' -or $_.action -eq 'secondary_decision' }
foreach ($e in $bidderEntries) {
    Write-Host "  -> Action: $($e.action) | Actor: $($e.actorId) | Time: $($e.createdAt)"
}
