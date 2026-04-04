import { promises as fs } from 'fs';
import path from 'path';
import { writeJsonFileAtomic } from '@/lib/server/classroom-storage';
import type {
  SceneContentGenerationInput,
  SceneContentGenerationResult,
} from '@/lib/server/scene-content-generation';

const SCENE_CONTENT_JOBS_DIR = path.join(process.cwd(), 'data', 'scene-content-jobs');

export type SceneContentJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface SceneContentGenerationJob {
  id: string;
  status: SceneContentJobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  input: SceneContentGenerationInput;
  summary: {
    title: string;
    type: SceneContentGenerationInput['outline']['type'];
    stageId: string;
  };
  message: string;
  result?: SceneContentGenerationResult;
  error?: string;
}

function jobFilePath(jobId: string) {
  return path.join(SCENE_CONTENT_JOBS_DIR, `${jobId}.json`);
}

const jobLocks = new Map<string, Promise<void>>();

async function withJobLock<T>(jobId: string, fn: () => Promise<T>): Promise<T> {
  const prev = jobLocks.get(jobId) ?? Promise.resolve();
  let resolve: () => void;
  const next = new Promise<void>((r) => {
    resolve = r;
  });
  jobLocks.set(jobId, next);
  try {
    await prev;
    return await fn();
  } finally {
    resolve!();
    if (jobLocks.get(jobId) === next) jobLocks.delete(jobId);
  }
}

const STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000;

function markStaleIfNeeded(job: SceneContentGenerationJob): SceneContentGenerationJob {
  if (job.status !== 'running') return job;
  const updatedAt = new Date(job.updatedAt).getTime();
  if (Date.now() - updatedAt > STALE_JOB_TIMEOUT_MS) {
    return {
      ...job,
      status: 'failed',
      message: 'Scene content generation job appears stale',
      error: 'Stale job: process may have restarted during scene generation',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return job;
}

export function isValidSceneContentJobId(jobId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(jobId);
}

export async function createSceneContentGenerationJob(
  jobId: string,
  input: SceneContentGenerationInput,
): Promise<SceneContentGenerationJob> {
  const now = new Date().toISOString();
  const job: SceneContentGenerationJob = {
    id: jobId,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    input,
    summary: {
      title: input.outline.title,
      type: input.outline.type,
      stageId: input.stageId,
    },
    message: 'Scene content generation job queued',
  };

  await writeJsonFileAtomic(jobFilePath(jobId), job);
  return job;
}

export async function readSceneContentGenerationJob(
  jobId: string,
): Promise<SceneContentGenerationJob | null> {
  try {
    const content = await fs.readFile(jobFilePath(jobId), 'utf-8');
    const job = JSON.parse(content) as SceneContentGenerationJob;
    return markStaleIfNeeded(job);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function updateSceneContentGenerationJob(
  jobId: string,
  patch: Partial<SceneContentGenerationJob>,
): Promise<SceneContentGenerationJob> {
  return withJobLock(jobId, async () => {
    const existing = await readSceneContentGenerationJob(jobId);
    if (!existing) {
      throw new Error(`Scene content generation job not found: ${jobId}`);
    }

    const updated: SceneContentGenerationJob = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    await writeJsonFileAtomic(jobFilePath(jobId), updated);
    return updated;
  });
}

export async function markSceneContentGenerationJobRunning(
  jobId: string,
): Promise<SceneContentGenerationJob> {
  return updateSceneContentGenerationJob(jobId, {
    status: 'running',
    startedAt: new Date().toISOString(),
    message: 'Scene content generation started',
  });
}

export async function markSceneContentGenerationJobSucceeded(
  jobId: string,
  result: SceneContentGenerationResult,
): Promise<SceneContentGenerationJob> {
  return updateSceneContentGenerationJob(jobId, {
    status: 'succeeded',
    message: 'Scene content generation completed',
    completedAt: new Date().toISOString(),
    result,
  });
}

export async function markSceneContentGenerationJobFailed(
  jobId: string,
  error: string,
): Promise<SceneContentGenerationJob> {
  return updateSceneContentGenerationJob(jobId, {
    status: 'failed',
    message: 'Scene content generation failed',
    completedAt: new Date().toISOString(),
    error,
  });
}
