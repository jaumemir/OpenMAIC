import { promises as fs } from 'fs';
import path from 'path';
import type { NextRequest } from 'next/server';
import type { Scene, Stage } from '@/lib/types/stage';
import { getStorageBackend } from '@/lib/server/storage';

// Directori de media (imatges, vídeos, àudio) generat per a cada classroom.
// El contingut JSON del stage es guarda a data/stages/ (via StorageBackend).
export const CLASSROOMS_DIR = path.join(process.cwd(), 'data', 'classrooms');

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export function isValidClassroomId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
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
