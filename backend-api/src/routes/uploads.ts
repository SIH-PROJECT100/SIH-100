import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { authenticate } from '../middleware/auth.js';
import { appendLedgerEntry } from '../services/ledger.js';
import { UPLOAD_RULES, checkMagicBytes } from '../config/uploadRules.js';
import { VERIFICATION_MODES } from '../config/verificationModes.js';
import { verifyDocumentSignature } from '../verification/signatureVerify.js';
import { startVerificationPipeline, getVerificationStatus } from '../services/verificationPipeline.js';

const router = Router();

// Base upload directory in backend-api/uploads
const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

export interface StoredUpload {
  uploadId: string;
  bidderId: string;
  docType: string;
  originalName: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
  sha256: string;
  createdAt: string;
}

export interface VerificationStage {
  stage: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'not_applicable';
  completedAt?: string;
  startedAt?: string;
  detail?: Record<string, any>;
}

export interface VerificationStatusRecord {
  uploadId: string;
  docType: string;
  stages: VerificationStage[];
  overallStatus: 'in_progress' | 'awaiting_review' | 'verified' | 'failed';
  verifiedAt: string | null;
  signatureInfo?: Record<string, any>;
}

const uploadsMetadataPath = path.join(UPLOADS_ROOT, 'metadata.json');
export const uploadRegistry: Map<string, StoredUpload> = new Map();
export const verificationRegistry: Map<string, VerificationStatusRecord> = new Map();

// Load persisted metadata on boot
function loadRegistry() {
  try {
    if (fs.existsSync(uploadsMetadataPath)) {
      const raw = fs.readFileSync(uploadsMetadataPath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        for (const item of data) {
          uploadRegistry.set(item.uploadId, item);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load upload metadata:', err);
  }
}
loadRegistry();

export function saveRegistry() {
  try {
    const list = Array.from(uploadRegistry.values());
    fs.writeFileSync(uploadsMetadataPath, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save upload metadata:', err);
  }
}

// Multer memory storage (up to 15MB to allow ITR 10MB)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

// Helper to run progressive verification steps asynchronously
async function runAsyncVerificationPipeline(
  uploadId: string,
  docType: string,
  buffer: Buffer,
  bidderId: string,
  sha256: string,
  sizeBytes: number
) {
  const mode = VERIFICATION_MODES[docType] || VERIFICATION_MODES.pan_card;
  const stages: VerificationStage[] = mode.stages.map((stg) => {
    if (stg === 'uploaded') {
      return {
        stage: 'uploaded',
        status: 'passed',
        completedAt: new Date().toISOString(),
        detail: { sha256, sizeBytes },
      };
    }
    return {
      stage: stg,
      status: 'pending',
    };
  });

  const record: VerificationStatusRecord = {
    uploadId,
    docType,
    stages,
    overallStatus: 'in_progress',
    verifiedAt: null,
  };
  verificationRegistry.set(uploadId, record);

  // Progressive simulation timers
  const updateStage = (stageName: string, status: VerificationStage['status'], detail?: Record<string, any>) => {
    const target = record.stages.find((s) => s.stage === stageName);
    if (target) {
      target.status = status;
      if (status === 'passed' || status === 'failed') {
        target.completedAt = new Date().toISOString();
      } else if (status === 'in_progress') {
        target.startedAt = new Date().toISOString();
      }
      if (detail) target.detail = detail;
    }
  };

  // Stage: signature_verification (Fix 31)
  if (mode.stages.includes('signature_verification')) {
    updateStage('signature_verification', 'in_progress');
    const sigResult = await verifyDocumentSignature(buffer, docType);
    record.signatureInfo = sigResult;

    try {
      await appendLedgerEntry({
        bidderId,
        actorType: 'system',
        actorId: 'sovereign_ca_verifier',
        action: 'signature_verification_run',
        detail: {
          docType,
          hasSignature: sigResult.hasSignature,
          verified: sigResult.verified,
          trustedCA: sigResult.trustedCA,
          signerName: sigResult.signerName,
          signedAt: sigResult.signedAt,
          message: sigResult.message,
        },
      });
    } catch (ledgerErr: any) {
      console.warn('[Uploads] Warning: Signature verification ledger append failed:', ledgerErr?.message || ledgerErr);
    }

    updateStage(
      'signature_verification',
      sigResult.verified ? 'passed' : sigResult.hasSignature ? 'failed' : 'not_applicable',
      sigResult
    );
  }

  // Stage: ai_extraction (runs ~1.2s later)
  setTimeout(async () => {
    if (mode.stages.includes('ai_extraction')) {
      updateStage('ai_extraction', 'in_progress');

      let extractedFields: Record<string, any> = {};
      if (docType === 'pan_card') {
        extractedFields = { pan: 'AAWBS9999P', name: 'Ananya Enterprises Pvt Ltd', father_name: 'Rajesh Verma', dob: '1984-06-15' };
      } else if (docType === 'gst_certificate') {
        extractedFields = { gstin: '27AAWBS9999P1Z5', legal_name: 'Ananya Enterprises Pvt Ltd', trade_name: 'Ananya Tech', registration_date: '2021-08-20' };
      } else if (docType === 'udyam_certificate') {
        extractedFields = { udyam_number: 'UDYAM-MH-01-00892', enterprise_name: 'Ananya Enterprises Pvt Ltd', enterprise_type: 'Micro', msme_category: 'Manufacturing' };
      } else if (docType === 'itr_document') {
        extractedFields = { pan: 'AAWBS9999P', assessment_year: '2024-25', gross_income: 4500000, tax_paid: 680000, form_type: 'ITR-4' };
      }

      const confidence = 0.92;
      updateStage('ai_extraction', 'passed', {
        extractedFields,
        confidence,
        model: 'gemini-2.5-flash',
      });

      try {
        await appendLedgerEntry({
          bidderId,
          actorType: 'system',
          actorId: 'gemini-2.5-flash',
          action: 'ai_extraction_run',
          detail: {
            docType,
            extractedFields,
            confidence,
            model: 'gemini-2.5-flash',
          },
        });
      } catch (ledgerErr: any) {
        console.warn('[Uploads] Warning: AI extraction ledger append failed:', ledgerErr?.message || ledgerErr);
      }

      // Stage: cross_check
      if (mode.stages.includes('cross_check')) {
        updateStage('cross_check', 'in_progress');
        setTimeout(async () => {
          const checks = [
            { field: 'format_regex', result: 'valid', summary: `${docType.toUpperCase()} format matches statutory pattern` },
            { field: 'pan_cross_match', result: 'match', summary: 'Matches corporate registration PAN' },
          ];
          updateStage('cross_check', 'passed', { checks });

          try {
            await appendLedgerEntry({
              bidderId,
              actorType: 'system',
              actorId: 'regulatory_engine',
              action: 'cross_check_run',
              detail: { docType, checks, verdict: 'passed' },
            });
          } catch (ledgerErr: any) {
            console.warn('[Uploads] Warning: Cross check ledger append failed:', ledgerErr?.message || ledgerErr);
          }

          // Stage: portal_verification
          if (mode.stages.includes('portal_verification')) {
            updateStage('portal_verification', 'in_progress');
            setTimeout(async () => {
              updateStage('portal_verification', 'passed', {
                portal: docType === 'pan_card' ? 'CBDT Income Tax e-Filing' : docType === 'gst_certificate' ? 'GSTN Common Portal' : 'Udyam Registration Portal',
                status: 'ACTIVE_VERIFIED',
                verifiedAt: new Date().toISOString(),
              });

              // Expiry check (GST)
              if (mode.stages.includes('expiry_check')) {
                updateStage('expiry_check', 'passed', {
                  expiresInDays: 30,
                  expiryDate: '2026-10-24T00:00:00Z',
                  warning: 'GST certificate requires annual renewal in 30 days',
                });
              }

              // Ready for officer review & statutory auto-verification (AI score >= 0.90)
              if (mode.stages.includes('officer_review')) {
                updateStage('officer_review', 'passed', {
                  decision: 'auto_verified',
                  reviewedAt: new Date().toISOString(),
                });
              }
              record.overallStatus = 'verified';
              record.verifiedAt = new Date().toISOString();
            }, 1200);
          } else {
            if (mode.stages.includes('officer_review')) {
              updateStage('officer_review', 'passed', {
                decision: 'auto_verified',
                reviewedAt: new Date().toISOString(),
              });
            }
            record.overallStatus = 'verified';
            record.verifiedAt = new Date().toISOString();
          }
        }, 1000);
      }
    }
  }, 800);
}

const optionalAuthenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    authenticate(req, res, next);
  } else {
    next();
  }
};

// POST /uploads — multipart upload with docType validation and progressive verification
router.post(
  '/',
  optionalAuthenticate,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bidderId = req.user?.id || req.body.bidderId || 'bidder';
      const rawDocType = req.body.docType || 'pan_card';
      const docType = String(rawDocType).toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');

      if (!req.file) {
        res.status(400).json({
          data: null,
          error: {
            code: 'UPLOAD_NO_FILE',
            message: 'No file received in multipart request payload.',
          },
        });
        return;
      }

      const rule = UPLOAD_RULES[docType] || {
        allowedMimeTypes: ['application/pdf'],
        maxSizeBytes: 5 * 1024 * 1024,
        magicBytes: [0x25, 0x50, 0x44, 0x46],
        description: 'Official PDF document',
      };

      // 1. MIME type validation (Fix 29)
      if (!rule.allowedMimeTypes.includes(req.file.mimetype)) {
        await appendLedgerEntry({
          bidderId,
          actorType: 'bidder',
          actorId: bidderId,
          action: 'document_upload_rejected',
          detail: {
            docType,
            reason: 'invalid_mime_type',
            attempted: req.file.mimetype,
            expected: rule.allowedMimeTypes.join(', '),
            bidderId,
            fileSizeBytes: req.file.size,
          },
        });

        res.status(400).json({
          data: null,
          error: {
            code: 'UPLOAD_INVALID_TYPE',
            message: `${docType.replace(/_/g, ' ').toUpperCase()} must be a PDF file. Received ${req.file.mimetype}.`,
            expected: rule.allowedMimeTypes.join(', '),
            received: req.file.mimetype,
          },
        });
        return;
      }

      // 2. Max size validation (Fix 29)
      if (req.file.size > rule.maxSizeBytes) {
        await appendLedgerEntry({
          bidderId,
          actorType: 'bidder',
          actorId: bidderId,
          action: 'document_upload_rejected',
          detail: {
            docType,
            reason: 'file_too_large',
            attemptedSize: req.file.size,
            maxSizeBytes: rule.maxSizeBytes,
            bidderId,
          },
        });

        res.status(400).json({
          data: null,
          error: {
            code: 'UPLOAD_TOO_LARGE',
            message: `File exceeds maximum allowed size (${(rule.maxSizeBytes / 1024 / 1024).toFixed(0)} MB).`,
            expected: rule.maxSizeBytes,
            received: req.file.size,
          },
        });
        return;
      }

      // 3. Magic bytes validation (Fix 29)
      const isValidMagic = checkMagicBytes(req.file.buffer, docType, req.file.mimetype);
      if (!isValidMagic) {
        await appendLedgerEntry({
          bidderId,
          actorType: 'bidder',
          actorId: bidderId,
          action: 'document_upload_rejected',
          detail: {
            docType,
            reason: 'magic_bytes_mismatch',
            bidderId,
            attemptedMime: req.file.mimetype,
          },
        });

        res.status(400).json({
          data: null,
          error: {
            code: 'UPLOAD_INVALID_TYPE',
            message: 'This file appears corrupted or is not a real PDF. Please re-download from source.',
            expected: 'valid magic bytes',
            received: 'corrupted/mismatched magic bytes',
          },
        });
        return;
      }

      // Success — store file
      const uploadId = 'upload_' + crypto.randomBytes(6).toString('hex');
      const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      const ext = path.extname(req.file.originalname) || '.pdf';
      const timestamp = Date.now();
      const bidderDir = path.join(UPLOADS_ROOT, bidderId);
      if (!fs.existsSync(bidderDir)) {
        fs.mkdirSync(bidderDir, { recursive: true });
      }

      const fileName = `${docType}_${timestamp}${ext}`;
      const filePath = path.join(bidderDir, fileName);
      fs.writeFileSync(filePath, req.file.buffer);

      const record: StoredUpload = {
        uploadId,
        bidderId,
        docType,
        originalName: req.file.originalname,
        fileName,
        filePath,
        mimeType: req.file.mimetype,
        size: req.file.size,
        sha256,
        createdAt: new Date().toISOString(),
      };

      uploadRegistry.set(uploadId, record);
      saveRegistry();

      // Emit document_uploaded ledger event
      try {
        await appendLedgerEntry({
          bidderId: bidderId === 'bidder' ? 'user-bidder-001' : bidderId,
          actorType: 'bidder',
          actorId: bidderId,
          action: 'document_uploaded',
          detail: {
            docType,
            uploadId,
            fileName: req.file.originalname,
            sizeBytes: req.file.size,
            sha256,
          },
        });
      } catch (ledgerErr: any) {
        console.warn('[Uploads] Warning: Ledger entry append failed:', ledgerErr?.message || ledgerErr);
      }

      // Start verification pipeline (Fix 39)
      const { initialState } = await startVerificationPipeline(
        uploadId,
        req.file.originalname,
        docType,
        bidderId,
        req.file.buffer
      );

      // Mirror initial state in verificationRegistry
      if (initialState) {
        verificationRegistry.set(uploadId, {
          uploadId,
          docType,
          stages: initialState.stages as any,
          overallStatus: 'in_progress',
          verifiedAt: null,
        });
      }

      res.status(201).json({
        data: {
          uploadId,
          url: `/uploads/${uploadId}`,
          filename: req.file.originalname,
          sha256,
          docType,
          originalName: req.file.originalname,
          sizeBytes: req.file.size,
          pipeline: initialState,
          overallStatus: 'in_progress',
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /uploads/:uploadId/verification-status — polling endpoint for progressive stepper (Fix 26 & Fix 39)
router.get(
  '/:uploadId/verification-status',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uploadId } = req.params;
      const pipelineRecord = getVerificationStatus(uploadId);
      if (pipelineRecord) {
        res.status(200).json({
          data: pipelineRecord,
          error: null,
        });
        return;
      }

      const statusRecord = verificationRegistry.get(uploadId);
      if (statusRecord) {
        res.status(200).json({
          data: statusRecord,
          error: null,
        });
        return;
      }

      // Fallback: check stored upload metadata and return completed status
      const stored = uploadRegistry.get(uploadId);
      if (stored) {
        const mode = VERIFICATION_MODES[stored.docType] || VERIFICATION_MODES.pan_card;
        const stages: VerificationStage[] = mode.stages.map((s) => ({
          stage: s,
          status: 'passed',
          completedAt: stored.createdAt,
        }));

        const status = (stored as any).overallStatus || 'in_progress';
        res.status(200).json({
          data: {
            uploadId,
            filename: stored.originalName,
            docType: stored.docType,
            stages: (stored as any).stages || stages,
            overallStatus: status,
            verifiedAt: status === 'verified' ? stored.createdAt : null,
          },
          error: null,
        });
        return;
      }

      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Upload not found' },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /uploads/:uploadId — serves file for review
router.get(
  '/:uploadId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const upload = uploadRegistry.get(req.params.uploadId);
      if (!upload || !fs.existsSync(upload.filePath)) {
        res.status(404).json({
          data: null,
          error: { message: 'Uploaded file not found' },
        });
        return;
      }

      // Authorization check: officers & admins can view any; bidder can only view own
      const user = req.user!;
      if (user.role === 'bidder' && upload.bidderId !== user.id) {
        res.status(403).json({
          data: null,
          error: { message: 'Access denied: You may only view documents uploaded by your account' },
        });
        return;
      }

      res.setHeader('Content-Type', upload.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${upload.originalName}"`);
      res.sendFile(upload.filePath);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
