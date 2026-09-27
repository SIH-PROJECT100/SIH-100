export function validatePANFormat(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan?.trim().toUpperCase() ?? '');
}

export function validateGSTINFormat(gstin: string): boolean {
  // 2-digit state code + 10-char PAN + entity code + 'Z' + checksum char
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin?.trim().toUpperCase() ?? '');
}

export function validateUdyamFormat(udyam: string): boolean {
  return /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{5,7}$/.test(udyam?.trim().toUpperCase() ?? '');
}

export function normalizeCompanyName(name: string): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\bprivate limited\b/g, 'pvt ltd')
    .replace(/\bpvt\.?\s*ltd\.?\b/g, 'pvt ltd')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Simple Levenshtein-based similarity, 0.0-1.0.
export function nameSimilarity(a: string, b: string): number {
  const normA = normalizeCompanyName(a);
  const normB = normalizeCompanyName(b);
  if (normA === normB) return 1.0;
  const distance = levenshteinDistance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  return maxLen === 0 ? 1.0 : 1 - distance / maxLen;
}

export function daysBetween(fromDate: Date, toDate: Date): number {
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}

export function checkExpiry(extractedExpiryDateStr: string, bidSubmissionDate: Date) {
  const expiry = new Date(extractedExpiryDateStr);
  if (isNaN(expiry.getTime())) {
    return { valid: false, reason: 'date_unparseable', daysExpired: null };
  }
  const days = daysBetween(bidSubmissionDate, expiry);
  return { valid: days >= 0, daysExpired: days < 0 ? Math.abs(days) : 0 };
}

// Turnover check reads the ACTUAL tender's configured minimum from
// the database — never a hardcoded ₹10 Cr or any other fixed number.
export async function checkTurnoverThreshold(
  extractedTurnoverByYear: Record<string, number>,
  tenderId: string,
  getTenderById: (id: string) => Promise<{ minimumTurnoverCr: number }>
) {
  const tender = await getTenderById(tenderId);
  const values = Object.values(extractedTurnoverByYear).filter((v) => typeof v === 'number' && !isNaN(v));
  const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  return {
    average,
    required: tender.minimumTurnoverCr,
    passes: average >= tender.minimumTurnoverCr,
    shortfall: Math.max(0, tender.minimumTurnoverCr - average),
  };
}

// Cross-checks the newly-extracted entity name against every OTHER
// document this SAME bidder has already had extracted, pulled live
// from the database — not a fixed comparison list.
export async function crossCheckEntityName(
  bidderId: string,
  currentDocType: string,
  extractedName: string,
  getBidderExtractedDocuments: (bidderId: string, excludeDocType: string) => Promise<Array<{ docType: string; extractedName: string }>>
) {
  const otherDocs = await getBidderExtractedDocuments(bidderId, currentDocType);
  const variances: Array<{ comparedAgainst: string; otherName: string; similarity: number }> = [];
  for (const doc of otherDocs) {
    const similarity = nameSimilarity(extractedName, doc.extractedName);
    if (similarity < 0.85) {
      variances.push({ comparedAgainst: doc.docType, otherName: doc.extractedName, similarity });
    }
  }
  return variances;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
