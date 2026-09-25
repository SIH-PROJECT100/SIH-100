import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  GEMINI_MODEL_FAST: z.string().default('gemini-2.5-flash'),
  GEMINI_MODEL_REASONING: z.string().default('gemini-2.5-pro'),
  OCR_FALLBACK_MODE: z.enum(['tesseract', 'paddle']).default('tesseract'),
  PADDLE_OCR_URL: z.string().default('http://localhost:8001'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DIGILOCKER_MODE: z.enum(['mock', 'sandbox', 'production']).default('mock'),
  DIGILOCKER_MOCK_ROOT_CERT_PATH: z.string().default('./demo/mock-cca-root.pem'),
  VERIFICATION_TIMEOUT_MS: z.coerce.number().default(10000),
  VERIFICATION_MAX_RETRIES: z.coerce.number().default(3),
  CONFIDENCE_AUTO_FLAG_BELOW: z.coerce.number().default(0.6),
  CONFIDENCE_HUMAN_REVIEW_BELOW: z.coerce.number().default(0.8),
  DEMO_MODE: z.coerce.boolean().default(false),
  MAX_SESSION_LIFETIME_SEC: z.coerce.number().default(43200),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n========================================');
  console.error('CRITICAL: Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - [${issue.path.join('.')}] ${issue.message}`);
  }
  console.error('========================================\n');
  process.exit(1);
}

export const config = parsed.data;
