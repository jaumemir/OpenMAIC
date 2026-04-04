import { type NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  isValidSceneContentJobId,
  readSceneContentGenerationJob,
} from '@/lib/server/scene-content-job-store';

const log = createLogger('SceneContentJob API');

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  let resolvedJobId: string | undefined;
  try {
    const { jobId } = await context.params;
    resolvedJobId = jobId;

    if (!isValidSceneContentJobId(jobId)) {
      return apiError('INVALID_REQUEST', 400, 'Invalid scene content generation job id');
    }

    const job = await readSceneContentGenerationJob(jobId);
    if (!job) {
      return apiError('INVALID_REQUEST', 404, 'Scene content generation job not found');
    }

    const pollUrl = `/api/generate/scene-content/${jobId}`;

    return apiSuccess({
      jobId: job.id,
      status: job.status,
      message: job.message,
      pollUrl,
      pollIntervalMs: 2000,
      result: job.result ? { success: true, ...job.result } : undefined,
      error: job.error,
      done: job.status === 'succeeded' || job.status === 'failed',
    });
  } catch (error) {
    log.error(`Scene content job retrieval failed [jobId=${resolvedJobId ?? 'unknown'}]:`, error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to retrieve scene content generation job',
      error instanceof Error ? error.message : String(error),
    );
  }
}
