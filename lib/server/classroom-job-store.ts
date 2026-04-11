/**
 * classroom-job-store.ts — Persistència de jobs de generació via Prisma.
 *
 * Substitueix la implementació anterior basada en fitxers JSON.
 * Els jobs s'emmagatzemen a la taula `classroom_jobs` de la BD,
 * associats al userId que els ha creat.
 */

import { prisma } from '@/lib/prisma';
import { toDbJson, fromDbJson } from '@/lib/db-compat';
import type {
  ClassroomGenerationProgress,
  ClassroomGenerationStep,
  GenerateClassroomInput,
  GenerateClassroomResult,
} from '@/lib/server/classroom-generation';

export type ClassroomGenerationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface ClassroomGenerationJob {
  id: string;
  userId: string;
  status: ClassroomGenerationJobStatus;
  step: ClassroomGenerationStep | 'queued' | 'failed' | 'completed';
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  inputSummary: {
    requirementPreview: string;
    language: string;
    hasPdf: boolean;
    pdfTextLength: number;
    pdfImageCount: number;
  };
  scenesGenerated: number;
  totalScenes?: number;
  result?: {
    classroomId: string;
    url: string;
    scenesCount: number;
  };
  error?: string;
}

/** Max age (ms) before a "running" job is considered stale (procés reiniciat). */
const STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000; // 30 minuts

function markStaleIfNeeded(job: ClassroomGenerationJob): ClassroomGenerationJob {
  if (job.status !== 'running') return job;
  const updatedAt = new Date(job.updatedAt).getTime();
  if (Date.now() - updatedAt > STALE_JOB_TIMEOUT_MS) {
    return {
      ...job,
      status: 'failed',
      step: 'failed',
      message: 'Job appears stale (no progress update for 30 minutes)',
      error: 'Stale job: process may have restarted during generation',
    };
  }
  return job;
}

function buildInputSummary(input: GenerateClassroomInput): ClassroomGenerationJob['inputSummary'] {
  return {
    requirementPreview:
      input.requirement.length > 200 ? `${input.requirement.slice(0, 197)}...` : input.requirement,
    language: input.language || 'zh-CN',
    hasPdf: !!input.pdfContent,
    pdfTextLength: input.pdfContent?.text.length || 0,
    pdfImageCount: input.pdfContent?.images.length || 0,
  };
}

type PrismaClassroomJob = {
  id: string;
  userId: string;
  status: string;
  step: string;
  progress: number;
  message: string;
  inputSummary: string;
  scenesGenerated: number;
  totalScenes: number | null;
  result: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

function dbRowToJob(row: PrismaClassroomJob): ClassroomGenerationJob {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status as ClassroomGenerationJobStatus,
    step: row.step as ClassroomGenerationJob['step'],
    progress: row.progress,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    inputSummary: fromDbJson<ClassroomGenerationJob['inputSummary']>(row.inputSummary) ?? {
      requirementPreview: '',
      language: 'zh-CN',
      hasPdf: false,
      pdfTextLength: 0,
      pdfImageCount: 0,
    },
    scenesGenerated: row.scenesGenerated,
    totalScenes: row.totalScenes ?? undefined,
    result: row.result
      ? (fromDbJson<ClassroomGenerationJob['result']>(row.result) ?? undefined)
      : undefined,
    error: row.error ?? undefined,
  };
}

export function isValidClassroomJobId(jobId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(jobId);
}

export async function createClassroomGenerationJob(
  jobId: string,
  input: GenerateClassroomInput,
  userId: string,
): Promise<ClassroomGenerationJob> {
  const row = await prisma.classroomJob.create({
    data: {
      id: jobId,
      userId,
      status: 'queued',
      step: 'queued',
      progress: 0,
      message: 'Classroom generation job queued',
      inputSummary: toDbJson(buildInputSummary(input)),
      scenesGenerated: 0,
    },
  });
  return dbRowToJob(row);
}

export async function readClassroomGenerationJob(
  jobId: string,
): Promise<ClassroomGenerationJob | null> {
  const row = await prisma.classroomJob.findUnique({ where: { id: jobId } });
  if (!row) return null;
  return markStaleIfNeeded(dbRowToJob(row));
}

export async function updateClassroomGenerationJobProgress(
  jobId: string,
  progress: ClassroomGenerationProgress,
): Promise<void> {
  await prisma.classroomJob.update({
    where: { id: jobId },
    data: {
      status: 'running',
      step: progress.step,
      progress: progress.progress,
      message: progress.message,
      scenesGenerated: progress.scenesGenerated,
      ...(progress.totalScenes !== undefined ? { totalScenes: progress.totalScenes } : {}),
    },
  });
}

export async function markClassroomGenerationJobRunning(jobId: string): Promise<void> {
  await prisma.classroomJob.update({
    where: { id: jobId },
    data: {
      status: 'running',
      startedAt: new Date(),
      message: 'Classroom generation started',
    },
  });
}

export async function markClassroomGenerationJobSucceeded(
  jobId: string,
  result: GenerateClassroomResult,
): Promise<void> {
  await prisma.classroomJob.update({
    where: { id: jobId },
    data: {
      status: 'succeeded',
      step: 'completed',
      progress: 100,
      message: 'Classroom generation completed',
      completedAt: new Date(),
      scenesGenerated: result.scenesCount,
      result: toDbJson({
        classroomId: result.id,
        url: result.url,
        scenesCount: result.scenesCount,
      }),
    },
  });
}

export async function markClassroomGenerationJobFailed(
  jobId: string,
  error: string,
): Promise<void> {
  await prisma.classroomJob.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      step: 'failed',
      message: 'Classroom generation failed',
      completedAt: new Date(),
      error,
    },
  });
}
