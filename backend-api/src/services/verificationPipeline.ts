import { getDemoOutcomeForFile } from '../config/verificationKit.js';
import { runRealVerificationPipeline } from './realVerificationPipeline.js';

export const STAGE_DELAY_MS = Number(process.env.DEMO_PIPELINE_DELAY_MS ?? 1200);

// In-memory store for demo purposes.
export const pipelineState = new Map<string, {
  uploadId: string;
  filename: string;
  docType: string;
  stages: Array<{ stage: string; status: string; detail: Record<string, unknown>; completedAt: string | null }>;
  overallStatus: string;
  startedAt: string;
}>();

export async function startVerificationPipeline(
  uploadId: string,
  filename: string,
  docType: string,
  bidderId: string,
  fileBuffer?: Buffer
) {
  let stages: any[];
  let overallStatus: string;

  if (fileBuffer && fileBuffer.length > 0) {
    // ALWAYS run actual statutory extraction, tamper detection, cross-check, and rules on uploaded content!
    const realRes = await runRealVerificationPipeline(
      uploadId,
      filename,
      docType,
      fileBuffer,
      bidderId
    );
    stages = realRes.stages;
    overallStatus = realRes.overallStatus;
  } else {
    // Only if fileBuffer is missing/empty, check if it's a known demo fixture
    const outcome = getDemoOutcomeForFile(filename);
    if (outcome) {
      stages = outcome.stages;
      overallStatus = outcome.overallStatus ?? 'verified';
    } else {
      stages = [
        { stage: 'uploaded', status: 'failed', detail: { error: 'Empty file buffer received' } },
        { stage: 'ai_extraction', status: 'failed', detail: { error: 'No content to analyze' } },
        { stage: 'cross_check', status: 'failed', detail: { error: 'Document verification failed' } },
        { stage: 'portal_verification', status: 'failed', detail: { error: 'Missing document' } },
      ];
      overallStatus = 'failed';
    }
  }

  // Initialize state — ONLY first stage marked complete
  pipelineState.set(uploadId, {
    uploadId,
    filename,
    docType,
    stages: stages.map((s, i) => ({
      ...s,
      status: i === 0 ? s.status : 'pending',
      completedAt: i === 0 ? new Date().toISOString() : null,
    })),
    overallStatus: 'in_progress',
    startedAt: new Date().toISOString(),
  });

  // Progressively complete each subsequent stage on a timer.
  // THIS RUNS IN THE BACKGROUND. Do not await this in the upload route handler.
  (async () => {
    const delay = Number(process.env.DEMO_PIPELINE_DELAY_MS ?? 1200);
    for (let i = 1; i < stages.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      const current = pipelineState.get(uploadId);
      if (!current) return; // upload was cleaned up / server restarted
      current.stages[i] = {
        ...stages[i],
        completedAt: new Date().toISOString(),
      };
    }
    const final = pipelineState.get(uploadId);
    if (final) {
      final.overallStatus = overallStatus;
    }

    try {
      const { verificationRegistry, uploadRegistry, saveRegistry } = await import('../routes/uploads.js');
      if (final) {
        verificationRegistry.set(uploadId, {
          uploadId,
          docType,
          stages: final.stages as any,
          overallStatus: (overallStatus as any) || 'in_progress',
          verifiedAt: overallStatus === 'verified' ? new Date().toISOString() : null,
        });
      }
      const stored = uploadRegistry.get(uploadId);
      if (stored) {
        (stored as any).overallStatus = overallStatus;
        (stored as any).stages = final?.stages;
        saveRegistry();
      }
    } catch {}

    // CRITICAL: also write this to the ledger so Fix 20/21/23 ledger tabs show it.
    await emitLedgerEntriesForPipeline(uploadId, bidderId, stages);
  })();

  return { uploadId, initialState: pipelineState.get(uploadId) };
}

export function getVerificationStatus(uploadId: string) {
  return pipelineState.get(uploadId) ?? null;
}

async function emitLedgerEntriesForPipeline(uploadId: string, bidderId: string, stages: any[]) {
  try {
    const { appendLedgerEntry } = await import('./ledger.js');
    const validActions: Record<string, string> = {
      uploaded: 'document_uploaded',
      ai_extraction: 'ai_extraction_run',
      cross_check: 'cross_check_run',
      portal_verification: 'verification_run',
      officer_review: 'officer_decision',
    };
    for (const stage of stages) {
      try {
        const action = validActions[stage.stage] || 'verification_run';
        await appendLedgerEntry({
          bidderId: bidderId || 'user-bidder-001',
          actorType: 'system',
          actorId: 'verification_engine',
          action: action as any,
          detail: { uploadId, ...stage.detail },
        });
      } catch (err: any) {
        // Safe catch - foreign key or DB error should not crash server
        console.warn(`[Ledger] Notice: Could not append ledger entry for ${stage.stage}:`, err?.message || err);
      }
    }
  } catch (importErr) {
    console.warn('[Ledger] Could not import appendLedgerEntry:', importErr);
  }
}
