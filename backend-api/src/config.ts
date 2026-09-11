import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DIGILOCKER_MODE: z.enum(['mock', 'sandbox', 'production']).default('mock'),
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
