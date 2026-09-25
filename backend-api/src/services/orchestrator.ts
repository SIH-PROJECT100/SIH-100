/**
 * Verification Orchestrator Bridge
 * Routes calls to the V2 Verification Engine in ./verification/orchestrator.js
 */

export { verifyBidder } from './verification/orchestrator.js';
export type { VerifyBidderOptions as VerifyOptions } from './verification/orchestrator.js';
