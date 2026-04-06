export const runtime = 'nodejs';

import { type NextRequest } from 'next/server';
import {
  getServerProviders,
  getServerTTSProviders,
  getServerASRProviders,
  getServerPDFProviders,
  getServerImageProviders,
  getServerVideoProviders,
  getServerWebSearchProviders,
} from '@/lib/server/provider-config';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { createLogger } from '@/lib/logger';

const log = createLogger('ServerProviders');

export async function GET(req: NextRequest) {
  try {
    let providers = getServerProviders();

    // Si hi ha sessió activa i l'usuari és 'user' (no admin), filtrar per allowedModels
    try {
      const session = await getSession(req);
      const role = (session?.user as { role?: string } | undefined)?.role;

      if (role === 'user') {
        const config = await prisma.adminConfig.findUnique({ where: { key: 'allowedModels' } });
        if (config) {
          const allowedModels: string[] | null = JSON.parse(config.value);
          // null = tots els models permesos
          if (Array.isArray(allowedModels)) {
            // providers és Record<string, ...>; filtrem les claus (providerIds)
            const allowedProviderIds = new Set(
              allowedModels.map((m) => (m.includes(':') ? m.split(':')[0] : m)),
            );
            providers = Object.fromEntries(
              Object.entries(providers).filter(([id]) => allowedProviderIds.has(id)),
            );
          }
        }
      }
    } catch {
      // Si no hi ha BD o error de sessió, no filtrem
    }

    return apiSuccess({
      providers,
      tts: getServerTTSProviders(),
      asr: getServerASRProviders(),
      pdf: getServerPDFProviders(),
      image: getServerImageProviders(),
      video: getServerVideoProviders(),
      webSearch: getServerWebSearchProviders(),
    });
  } catch (error) {
    log.error('Error fetching server providers:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
