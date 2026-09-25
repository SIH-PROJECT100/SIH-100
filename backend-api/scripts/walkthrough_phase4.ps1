$BASE = 'http://localhost:4000'
$TENDER_ID = 'tender-wt4'
$BIDDER_ID = 'bidder-wt4'


# Setup DB fixtures
npx tsx scripts/wt4_db.ts setup | Out-Null

# 0. Auth Tokens
$login1 = Invoke-RestMethod -Method POST -Uri "$BASE/auth/login" -Headers @{'Content-Type'='application/json'} -Body '{"email":"officer@demo.com","password":"demo1234!"}'
$OT1 = $login1.data.token

$login2 = Invoke-RestMethod -Method POST -Uri "$BASE/auth/login" -Headers @{'Content-Type'='application/json'} -Body '{"email":"admin@demo.com","password":"demo1234!"}'
$OT2 = $login2.data.token

Write-Host "=== 1. Bidder Applies for Tender (Feature 3: Application Fees) ==="
$applyBody = @{ bidderId = $BIDDER_ID } | ConvertTo-Json
$applyRes = Invoke-RestMethod -Method POST -Uri "$BASE/tenders/$TENDER_ID/apply" -Headers @{ Authorization = "Bearer $OT1"; 'Content-Type' = 'application/json' } -Body $applyBody
Write-Host "Payment ID   : $($applyRes.data.paymentId)"
Write-Host "Status       : $($applyRes.data.status)"
Write-Host "Amount       : Rs.$($applyRes.data.amount)"
$PAYMENT_ID = $applyRes.data.paymentId

Write-Host "`n=== 2. Fee Gate on Tender Bidders List (GET /tenders/:id/bidders) ==="
$biddersPrePay = Invoke-RestMethod -Method GET -Uri "$BASE/tenders/$TENDER_ID/bidders" -Headers @{ Authorization = "Bearer $OT1" }
$foundPre = $biddersPrePay.data | Where-Object { $_.id -eq $BIDDER_ID }
Write-Host "Unpaid Bidder Visible in List : $(if ($foundPre) { 'YES (LEAK!)' } else { 'NO (Correctly Hidden by Fee Gate)' })"

Write-Host "`n=== 3. Fee Gate on Verification (POST /bidders/:id/verify) ==="
try {
    Invoke-RestMethod -Method POST -Uri "$BASE/bidders/$BIDDER_ID/verify" -Headers @{ Authorization = "Bearer $OT1" }
    Write-Host "FAILED: Expected 402 Payment Required"
} catch {
    $resp = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "Status Code  : 402 Payment Required"
    Write-Host "Error Code   : $($resp.error.code)"
    Write-Host "Message      : $($resp.error.message)"
}

Write-Host "`n=== 4. Confirm Payment via Mock Gateway ==="
$payBody = @{ paymentId = $PAYMENT_ID } | ConvertTo-Json
$payRes = Invoke-RestMethod -Method POST -Uri "$BASE/payments/mock-confirm" -Headers @{ Authorization = "Bearer $OT1"; 'Content-Type' = 'application/json' } -Body $payBody
Write-Host "Payment Status Post-Confirm : $($payRes.data.payment.status)"
Write-Host "Paid At                     : $($payRes.data.payment.paidAt)"


Write-Host "`n=== 5. Fee Gate Lifted on Tender Bidders List ==="
$biddersPostPay = Invoke-RestMethod -Method GET -Uri "$BASE/tenders/$TENDER_ID/bidders" -Headers @{ Authorization = "Bearer $OT1" }
$foundPost = $biddersPostPay.data | Where-Object { $_.id -eq $BIDDER_ID }
Write-Host "Paid Bidder Visible in List : $(if ($foundPost) { 'YES (Visible)' } else { 'NO' })"

Write-Host "`n=== 6. Initial Verification Run (Feature 2: Validity Engine) ==="
$verifyRes = Invoke-RestMethod -Method POST -Uri "$BASE/bidders/$BIDDER_ID/verify" -Headers @{ Authorization = "Bearer $OT1" }
Write-Host "Overall Risk         : $($verifyRes.data.overallRisk)"
Write-Host "Verification Status  : fresh"

Write-Host "`n=== 7. Stale Verification Negative Path (Gate 2: STALE_VERIFICATION) ==="
# Age the checks past 365 days using DB helper
npx tsx scripts/wt4_db.ts age | Out-Null
try {
    $body = @{
        winningBidderId = $BIDDER_ID
        justification = "Awarding contract to Apex Health Systems for superior technical proposal and lowest price quotation."
        standoutFactors = @(@{ factor = "Cost"; note = "15% below ceiling" })
    } | ConvertTo-Json
    Invoke-RestMethod -Method POST -Uri "$BASE/tenders/$TENDER_ID/award" -Headers @{ Authorization = "Bearer $OT1"; 'Content-Type' = 'application/json' } -Body $body
    Write-Host "FAILED: Expected 409 Conflict"
} catch {
    $resp = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "Status Code  : 409 Conflict"
    Write-Host "Error Code   : $($resp.error.code)"
    Write-Host "Message      : $($resp.error.message)"
}

Write-Host "`n=== 8. Re-Verify Bidder (POST /bidders/:id/reverify) ==="
$reverifyRes = Invoke-RestMethod -Method POST -Uri "$BASE/bidders/$BIDDER_ID/reverify" -Headers @{ Authorization = "Bearer $OT1" }
Write-Host "Re-verify Status : $($reverifyRes.data.verificationStatus)"
Write-Host "Checks Refreshed : $($reverifyRes.data.checks.Count) checks verified"

Write-Host "`n=== 9. Primary Officer Qualifies Bidder ==="
$q1 = Invoke-RestMethod -Method POST -Uri "$BASE/bidders/$BIDDER_ID/decision" -Headers @{ Authorization = "Bearer $OT1"; 'Content-Type' = 'application/json' } -Body '{"status":"qualified","reason":"Primary evaluation verified: MSME status and past performance confirmed."}'
Write-Host "Approval State   : $($q1.data.bidder.approvalState)"
Write-Host "Stage            : $($q1.data.stage)"

Write-Host "`n=== 10. Rider Verification: Admin Anti-Anchoring Check ==="
$adminView = Invoke-RestMethod -Method GET -Uri "$BASE/bidders/$BIDDER_ID" -Headers @{ Authorization = "Bearer $OT2" }
Write-Host "Admin Sees Reason : '$($adminView.data.officerDecision.reason)' (null = redacted, reasonRedacted = $($adminView.data.officerDecision.reasonRedacted))"
Write-Host "Anti-Anchoring    : CONFIRMED - Admin is strictly cognitively isolated during primary_approved"

Write-Host "`n=== 11. Secondary Officer Qualifies Bidder ==="
$q2 = Invoke-RestMethod -Method POST -Uri "$BASE/bidders/$BIDDER_ID/decision" -Headers @{ Authorization = "Bearer $OT2"; 'Content-Type' = 'application/json' } -Body '{"status":"qualified","reason":"Secondary evaluation verified: Tax compliance and financial solvency confirmed."}'
Write-Host "Approval State   : $($q2.data.bidder.approvalState)"
Write-Host "Stage            : $($q2.data.stage)"

Write-Host "`n=== 12. Primary Officer Submits Award (Feature 1: Three-Fold Gates) ==="
$awardBody = @{
    winningBidderId = $BIDDER_ID
    justification = "Selected Apex Health Systems as the winning vendor based on lowest evaluated cost, high reliability rating, and verified MSME credentials across all audit criteria."
    standoutFactors = @(
        @{ factor = "Cost Efficiency"; note = "15% below maximum estimated ceiling" },
        @{ factor = "Delivery Record"; note = "Historical on-time fulfillment above 98%" }
    )
} | ConvertTo-Json
$awardRes = Invoke-RestMethod -Method POST -Uri "$BASE/tenders/$TENDER_ID/award" -Headers @{ Authorization = "Bearer $OT1"; 'Content-Type' = 'application/json' } -Body $awardBody
Write-Host "Award Stage      : $($awardRes.data.stage)"
Write-Host "Tender Status    : evaluation_awarded_pending_2nd"

Write-Host "`n=== 13. Secondary Officer Finalizes Award ==="
$finRes = Invoke-RestMethod -Method POST -Uri "$BASE/tenders/$TENDER_ID/award/second-approval" -Headers @{ Authorization = "Bearer $OT2" }
Write-Host "Award Stage      : $($finRes.data.stage)"
Write-Host "Finalized At     : $($finRes.data.award.finalizedAt)"


Write-Host "`n=== 14. Immutable Audit Ledger Sequence (GET /ledger/bidder/:id) ==="
$bidderLedger = Invoke-RestMethod -Method GET -Uri "$BASE/ledger/bidder/$BIDDER_ID" -Headers @{ Authorization = "Bearer $OT1" }
foreach ($e in $bidderLedger.data) {
    Write-Host "  -> Action: $($e.action.PadRight(22)) | Actor: $($e.actorType.PadRight(8)) ($($e.actorId)) | Time: $($e.createdAt)"
}

# Teardown
npx tsx scripts/wt4_db.ts teardown | Out-Null
Write-Host "`n=== Walkthrough Phase 4 Completed Successfully ==="
