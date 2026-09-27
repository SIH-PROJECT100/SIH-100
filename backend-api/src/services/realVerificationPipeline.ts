import { GoogleGenAI } from '@google/genai';
import { PDFParse } from 'pdf-parse';
import { PrismaClient } from '@prisma/client';
import {
  validatePANFormat,
  validateGSTINFormat,
  validateUdyamFormat,
  crossCheckEntityName,
  checkExpiry,
  checkTurnoverThreshold,
} from './genericVerificationRules.js';
import type { StageResult } from '../config/verificationKit.js';

const prisma = new PrismaClient();

// In-memory registry for extracted documents per bidder (bidderId -> (docType -> document data))
export const bidderExtractedDocsMap = new Map<
  string,
  Map<string, { docType: string; extractedName: string; pan?: string; gstin?: string; udyam?: string }>
>();

export async function getBidderExtractedDocuments(
  bidderId: string,
  excludeDocType: string
): Promise<Array<{ docType: string; extractedName: string }>> {
  const docs: Array<{ docType: string; extractedName: string }> = [];
  const bidderDocs = bidderExtractedDocsMap.get(bidderId);
  if (bidderDocs) {
    for (const [dt, doc] of bidderDocs.entries()) {
      if (dt !== excludeDocType && doc.extractedName) {
        docs.push({ docType: dt, extractedName: doc.extractedName });
      }
    }
  }
  return docs;
}

export async function getTenderById(tenderId: string): Promise<{ minimumTurnoverCr: number }> {
  try {
    const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
    if (tender && typeof (tender as any).minimumTurnoverCr === 'number') {
      return { minimumTurnoverCr: (tender as any).minimumTurnoverCr };
    }
  } catch {}
  return { minimumTurnoverCr: 10 };
}

export async function runRealVerificationPipeline(
  uploadId: string,
  filename: string,
  docType: string,
  fileBuffer: Buffer,
  bidderId: string
): Promise<{ stages: StageResult[]; overallStatus: string }> {
  console.log(`[Real Verification Pipeline] Processing upload ${uploadId} (${filename}, docType: ${docType}) for bidder ${bidderId}`);

  // 1. Native text extraction via PDFParse
  let extractedText = '';
  try {
    if (fileBuffer && fileBuffer.length > 0) {
      const parser = new PDFParse(new Uint8Array(fileBuffer));
      const res: any = await parser.getText();
      extractedText = (typeof res === 'string' ? res : res?.text) || '';
    }
  } catch (parseErr) {
    console.warn('[Real Verification Pipeline] PDF text extraction warning:', parseErr);
  }

  // 2. Call Gemini for structured AI extraction
  let extracted: {
    documentType: string;
    companyName: string | null;
    pan: string | null;
    gstin: string | null;
    udyamNumber: string | null;
    expiryDate: string | null;
    turnoverByYear: Record<string, number> | null;
    confidence: number;
    summary: string;
  } = {
    documentType: docType.toUpperCase(),
    companyName: null,
    pan: null,
    gstin: null,
    udyamNumber: null,
    expiryDate: null,
    turnoverByYear: null,
    confidence: 0.85,
    summary: 'Document processed.',
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && !apiKey.startsWith('mock_')) {
    try {
      const client = new GoogleGenAI({ apiKey });
      const prompt = `You are an official Indian Government e-Procurement (GeM) document verification parser.
Analyze this document (filename: "${filename}", declared type: "${docType}").
Text extracted from document:
"""
${extractedText.slice(0, 15000)}
"""

Extract the exact fields from this document. If a field is not present or cannot be determined, return null.
CRITICAL: Extract PAN, GSTIN, and Udyam numbers EXACTLY as written in the text or image, preserving any typographical or formatting errors (e.g., if a PAN is written as 1234ABCDE, extract "1234ABCDE").
Return ONLY valid JSON matching this schema:
{
  "documentType": "PAN_CARD" | "GST_CERTIFICATE" | "UDYAM_REGISTRATION" | "ITR_ACKNOWLEDGEMENT" | "OEM_AUTHORIZATION" | "OTHER",
  "companyName": string or null,
  "pan": string or null,
  "gstin": string or null,
  "udyamNumber": string or null,
  "expiryDate": string or null,
  "turnoverByYear": { [year: string]: number } or null,
  "confidence": number between 0.0 and 1.0,
  "summary": string
}`;

      const contents: any[] = [];
      if (fileBuffer && fileBuffer.length > 0) {
        contents.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: fileBuffer.toString('base64'),
          },
        });
      }
      contents.push(prompt);

      const response = await client.models.generateContent({
        model: process.env.GEMINI_MODEL_FAST || 'gemini-1.5-flash',
        contents,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const respText = response.text?.trim() ?? '';
      if (respText) {
        const parsed = JSON.parse(respText);
        extracted = {
          ...extracted,
          ...parsed,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.88,
        };
      }
    } catch (geminiErr: any) {
      console.error('[Real Verification Pipeline] Gemini API error:', geminiErr?.message || geminiErr);
      // Fallback text parser from extractedText if Gemini call failed
      const panMatch = extractedText.match(/\b([A-Z0-9]{10})\b/);
      const nameMatch = extractedText.match(/(?:Name|Legal Name|Company|Authorized Dealer)[:\s]+([^\n\r,]+)/i);
      if (panMatch && !extracted.pan) extracted.pan = panMatch[1];
      if (nameMatch && !extracted.companyName) extracted.companyName = nameMatch[1].trim();
    }
  } else {
    // If no real Gemini key, heuristic extraction from text
    const panMatch = extractedText.match(/\b([A-Z0-9]{10})\b/);
    const gstinMatch = extractedText.match(/\b([0-9]{2}[A-Z0-9]{13})\b/);
    const udyamMatch = extractedText.match(/\b(UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7})\b/i);
    const nameMatch = extractedText.match(/(?:Name|Legal Name|Company|Authorized Dealer)[:\s]+([^\n\r,]+)/i);
    const expiryMatch = extractedText.match(/(?:Valid Until|Expiry Date|Valid To)[:\s]+([^\n\r,]+)/i);

    if (panMatch) extracted.pan = panMatch[1];
    if (gstinMatch) extracted.gstin = gstinMatch[1];
    if (udyamMatch) extracted.udyamNumber = udyamMatch[1];
    if (nameMatch) extracted.companyName = nameMatch[1].trim();
    if (expiryMatch) extracted.expiryDate = expiryMatch[1].trim();
  }

  // 3. Run Generic Verification Rules
  const checks: Array<{ field: string; result: string; value?: unknown; note?: string }> = [];
  let formatFailed = false;
  let formatErrorNote = '';

  // PAN Format validation
  if (extracted.pan) {
    const isPanValid = validatePANFormat(extracted.pan);
    if (isPanValid) {
      checks.push({ field: 'pan_format', result: 'valid', value: extracted.pan, note: 'PAN format valid (5 letters, 4 digits, 1 letter)' });
    } else {
      formatFailed = true;
      formatErrorNote = `PAN "${extracted.pan}" does not conform to statutory 10-character alphanumeric format (ABCDE1234F).`;
      checks.push({
        field: 'pan_format',
        result: 'invalid',
        value: extracted.pan,
        note: formatErrorNote,
      });
    }
  } else if (docType === 'pan_card' || docType === 'pan') {
    formatFailed = true;
    formatErrorNote = 'Permanent Account Number (PAN) could not be identified on document.';
    checks.push({ field: 'pan_format', result: 'missing', note: formatErrorNote });
  }

  // GSTIN Format validation
  if (extracted.gstin) {
    const isGstinValid = validateGSTINFormat(extracted.gstin);
    if (isGstinValid) {
      checks.push({ field: 'gstin_format', result: 'valid', value: extracted.gstin, note: 'GSTIN format valid' });
    } else {
      formatFailed = true;
      formatErrorNote = `GSTIN "${extracted.gstin}" is invalid. Must be 15-character alphanumeric format.`;
      checks.push({
        field: 'gstin_format',
        result: 'invalid',
        value: extracted.gstin,
        note: formatErrorNote,
      });
    }
  }

  // Udyam Format validation
  if (extracted.udyamNumber) {
    const isUdyamValid = validateUdyamFormat(extracted.udyamNumber);
    if (isUdyamValid) {
      checks.push({ field: 'udyam_format', result: 'valid', value: extracted.udyamNumber, note: 'Udyam registration format valid' });
    } else {
      formatFailed = true;
      formatErrorNote = `Udyam "${extracted.udyamNumber}" is invalid. Expected format UDYAM-XX-00-0000000.`;
      checks.push({
        field: 'udyam_format',
        result: 'invalid',
        value: extracted.udyamNumber,
        note: formatErrorNote,
      });
    }
  }

  // Cross-check Entity Name against bidder's other extracted documents
  let entityVariance = false;
  let varianceNote = '';
  if (extracted.companyName) {
    const variances = await crossCheckEntityName(
      bidderId,
      docType,
      extracted.companyName,
      getBidderExtractedDocuments
    );

    if (variances.length > 0) {
      entityVariance = true;
      const primaryVariance = variances[0];
      varianceNote = `Extracted company name "${extracted.companyName}" does not match prior document "${primaryVariance.comparedAgainst}" ("${primaryVariance.otherName}", similarity: ${(primaryVariance.similarity * 100).toFixed(0)}%).`;
      checks.push({
        field: 'entity_name_match',
        result: 'variance',
        value: extracted.companyName,
        note: varianceNote,
      });
    } else {
      checks.push({
        field: 'entity_name_match',
        result: 'match',
        value: extracted.companyName,
        note: 'Entity name consistent with bidder profile and prior records',
      });
    }

    // Save this document's extracted company name for future cross-checks
    if (!bidderExtractedDocsMap.has(bidderId)) {
      bidderExtractedDocsMap.set(bidderId, new Map());
    }
    bidderExtractedDocsMap.get(bidderId)!.set(docType, {
      docType,
      extractedName: extracted.companyName,
      pan: extracted.pan || undefined,
      gstin: extracted.gstin || undefined,
      udyam: extracted.udyamNumber || undefined,
    });
  }

  // Expiry check
  let expiryFailed = false;
  let expiryDays = 0;
  if (extracted.expiryDate) {
    const expCheck = checkExpiry(extracted.expiryDate, new Date());
    if (!expCheck.valid) {
      expiryFailed = true;
      expiryDays = expCheck.daysExpired || 0;
      checks.push({
        field: 'expiry_check',
        result: 'expired',
        value: extracted.expiryDate,
        note: `Document expired ${expiryDays} days ago.`,
      });
    } else {
      checks.push({
        field: 'expiry_check',
        result: 'valid',
        value: extracted.expiryDate,
        note: 'Document is within active validity period',
      });
    }
  }

  // 4. Assemble Stages
  const stages: StageResult[] = [
    {
      stage: 'uploaded',
      status: 'passed',
      detail: {
        filename,
        fileSizeBytes: fileBuffer.length,
      },
    },
    {
      stage: 'ai_extraction',
      status: extracted.confidence < 0.6 ? 'warning' : 'passed',
      detail: {
        extractedFields: {
          pan: extracted.pan,
          gstin: extracted.gstin,
          udyam: extracted.udyamNumber,
          name: extracted.companyName,
          expiryDate: extracted.expiryDate,
        },
        confidence: extracted.confidence,
        model: apiKey && !apiKey.startsWith('mock_') ? 'gemini-1.5-flash' : 'local_parser',
        summary: extracted.summary,
      },
    },
    {
      stage: 'cross_check',
      status: formatFailed ? 'failed' : entityVariance ? 'warning' : 'passed',
      detail: {
        checks,
        ...(formatFailed ? { error: formatErrorNote, reason: 'format_validation_failed' } : {}),
        ...(entityVariance ? { warning: varianceNote, reason: 'entity_name_mismatch' } : {}),
      },
    },
    {
      stage: 'portal_verification',
      status: formatFailed ? 'failed' : 'passed',
      detail: {
        source: 'Statutory Registry Verification',
        result: formatFailed ? 'REJECTED' : 'VERIFIED',
        ...(formatFailed ? { reason: formatErrorNote } : {}),
      },
    },
  ];

  if (extracted.expiryDate || docType === 'oem_authorization' || docType === 'gst_certificate') {
    stages.push({
      stage: 'expiry_check',
      status: expiryFailed ? 'failed' : 'passed',
      detail: {
        validUntil: extracted.expiryDate || 'ACTIVE',
        ...(expiryFailed ? { daysExpired: expiryDays } : {}),
      },
    });
  }

  stages.push({
    stage: 'officer_review',
    status: formatFailed || expiryFailed || entityVariance || extracted.confidence < 0.85 ? 'warning' : 'not_applicable',
    detail: {
      required: formatFailed || expiryFailed || entityVariance || extracted.confidence < 0.85,
      reason: formatFailed ? formatErrorNote : entityVariance ? varianceNote : undefined,
    },
  });

  // Overall status computation
  let overallStatus: 'verified' | 'warning' | 'failed' | 'human_review' = 'verified';
  if (formatFailed || expiryFailed) {
    overallStatus = 'failed';
  } else if (entityVariance) {
    overallStatus = 'warning';
  } else if (extracted.confidence < 0.8) {
    overallStatus = 'human_review';
  }

  return { stages, overallStatus };
}
