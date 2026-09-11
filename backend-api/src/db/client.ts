import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.DATABASE_URL,
    },
  },
  log: ['error', 'warn'],
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('Postgres connected');
  } catch (error) {
    console.error('Failed to connect to Postgres:', error);
    process.exit(1);
  }
}

async function shutdownGracefully(signal: string) {
  console.log(`\nReceived ${signal}. Disconnecting database and exiting...`);
  try {
    await prisma.$disconnect();
  } catch (err) {
    console.error('Error during disconnect:', err);
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdownGracefully('SIGINT'));
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));
