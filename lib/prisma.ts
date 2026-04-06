import { PrismaClient } from '@prisma/client';
import path from 'path';

/**
 * Resolves the DATABASE_URL for PrismaClient.
 *
 * SQLite inconsistency: `prisma migrate` resolves relative paths from the
 * schema file location (prisma/), but Next.js runtime uses process.cwd()
 * (project root). This function normalizes SQLite paths to always resolve
 * from prisma/ so both contexts point to the same file.
 */
function resolveDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Retornem undefined durant el build (no hi ha DB); l'error real es llança en runtime
    return undefined;
  }
  // PostgreSQL or absolute path: use as-is
  if (!url.startsWith('file:./') && !url.startsWith('file:../')) {
    return url;
  }
  // SQLite relative path: anchor to prisma/ directory
  const relativePath = url.slice('file:'.length);
  const prismaDir = path.join(process.cwd(), 'prisma');
  const absolutePath = path.resolve(prismaDir, relativePath);
  return `file:${absolutePath}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const resolvedUrl = resolveDatasourceUrl();
  if (resolvedUrl) {
    // Sobrescriu DATABASE_URL amb la versió normalitzada (camí absolut SQLite)
    process.env.DATABASE_URL = resolvedUrl;
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
