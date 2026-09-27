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
  const outcome = getDemoOutcomeForFile(filename);

  let stages: any[];
  let overallStatus: string;

  if (outcome) {
    // Known demo-kit file — deterministic, fast, offline-safe. Use as-is.
    stages = outcome.stages;
    overallStatus = outcome.overallStatus ?? 'verified';
  } else if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    // Real file — run ACTUAL Gemini extraction, ACTUAL cross-check, ACTUAL rules.
    // No hardcoded pass. Whatever the real pipeline determines is what displays.
    const realRes = await runRealVerificationPipeline(
      uploadId,
      filename,
      docType,
      fileBuffer || Buffer.from(''),
      bidderId
    );
    stages = realRes.stages;
    overallStatus = realRes.overallStatus;
  } else {
    // No API key configured — do not fake a result. Say so.
    stages = [
      { stage: 'uploaded', status: 'passed', detail: {} },
      {
        stage: 'ai_extraction',
        status: 'failed',
        detail: {
          note: 'GEMINI_API_KEY not configured — document cannot be verified. This is not a pass or a fail; verification did not run.',
        },
      },
    ];
    overallStatus = 'unverified';
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
