/**
 * GET /api/user/preferences  — Llegeix les preferències de l'usuari autenticat
 * PUT /api/user/preferences  — Actualitza les preferències de l'usuari autenticat
 */
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/server/api-response';

const DEFAULTS = {
  providerId: 'openai',
  modelId: '',
  ttsEnabled: true,
  asrEnabled: true,
  imageGenerationEnabled: false,
  videoGenerationEnabled: false,
  asrLanguage: 'zh-CN',
  agentMode: 'auto' as const,
  avatar: '/avatars/user.png',
  bio: '',
};

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if ('status' in user && user instanceof Response) return user;

  const userId = (user as { id: string }).id;
  const row = await prisma.userPreferences.findUnique({ where: { userId } });

  const preferences = row
    ? {
        providerId: row.providerId,
        modelId: row.modelId,
        ttsEnabled: row.ttsEnabled,
        asrEnabled: row.asrEnabled,
        imageGenerationEnabled: row.imageGenerationEnabled,
        videoGenerationEnabled: row.videoGenerationEnabled,
        asrLanguage: row.asrLanguage,
        agentMode: row.agentMode as 'preset' | 'auto',
        avatar: row.avatar,
        bio: row.bio,
      }
    : DEFAULTS;

  return apiSuccess({ preferences });
}

export async function PUT(req: NextRequest) {
  const user = await requireAuth(req);
  if ('status' in user && user instanceof Response) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Cos de la petició invàlid.');
  }

  const userId = (user as { id: string }).id;
  const updates = body as Partial<typeof DEFAULTS>;

  // Filtrar només camps vàlids
  const validKeys = Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[];
  const data: Record<string, unknown> = {};
  for (const key of validKeys) {
    if (key in updates) {
      data[key] = updates[key];
    }
  }

  if (Object.keys(data).length === 0) {
    return apiError('INVALID_REQUEST', 400, 'Cap camp vàlid per actualitzar.');
  }

  await prisma.userPreferences.upsert({
    where: { userId },
    update: data,
    create: { userId, ...DEFAULTS, ...data },
  });

  return apiSuccess({ updated: true });
}
