import { promises as fs } from 'fs';
import path from 'path';
import type { NextRequest } from 'next/server';
import type { Scene, Stage } from '@/lib/types/stage';
import { getStorageBackend } from '@/lib/server/storage';

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeJsonFileAtomic(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  const tempFilePath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tempFilePath, content, 'utf-8');
  await fs.rename(tempFilePath, filePath);
}

export function buildRequestOrigin(req: NextRequest): string {
  return req.headers.get('x-forwarded-host')
    ? `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('x-forwarded-host')}`
    : req.nextUrl.origin;
}

export interface PersistedClassroomData {
  id: string;
  stage: Stage;
  scenes: Scene[];
  createdAt: string;
}

export async function persistClassroom(
  data: {
    id: string;
    stage: Stage;
    scenes: Scene[];
  },
  baseUrl: string,
): Promise<PersistedClassroomData & { url: string }> {
  const createdAt = new Date().toISOString();

  await getStorageBackend().saveStage(data.id, {
    stage: data.stage,
    scenes: data.scenes,
    currentSceneId: data.scenes[0]?.id ?? null,
    chats: [],
  });

  return {
    id: data.id,
    stage: data.stage,
    scenes: data.scenes,
    createdAt,
    url: `${baseUrl}/classroom/${data.id}`,
  };
}
