/**
 * Scene Content Generation API
 *
 * Generates scene content (slides/quiz/interactive/pbl) from an outline.
 * Uses an async submit -> poll job pattern so long-running generations
 * survive CDN/proxy response timeouts.
 */

import { after, NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  createSceneContentGenerationJob,
  type SceneContentGenerationJob,
} from '@/lib/server/scene-content-job-store';
import { runSceneContentGenerationJob } from '@/lib/server/scene-content-job-runner';
import type { SceneContentGenerationInput } from '@/lib/server/scene-content-generation';

const log = createLogger('Scene Content API');

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let outlineTitle: string | undefined;
  let resolvedModelString: string | undefined;
  try {
    const body = (await req.json()) as Omit<SceneContentGenerationInput, 'modelConfig'>;
    outlineTitle = body.outline?.title;
    resolvedModelString = req.headers.get('x-model') || process.env.DEFAULT_MODEL || 'gpt-4o-mini';

    if (!body.outline) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'outline is required');
    }
    if (!body.allOutlines || body.allOutlines.length === 0) {
      return apiError(
        'MISSING_REQUIRED_FIELD',
        400,
        'allOutlines is required and must not be empty',
      );
    }
    if (!body.stageId) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'stageId is required');
    }

    const input: SceneContentGenerationInput = {
      ...body,
      modelConfig: {
        modelString: req.headers.get('x-model') || undefined,
        apiKey: req.headers.get('x-api-key') || undefined,
        baseUrl: req.headers.get('x-base-url') || undefined,
        providerType: req.headers.get('x-provider-type') || undefined,
        requiresApiKey: req.headers.get('x-requires-api-key') === 'true' ? true : undefined,
      },
    };

    const jobId = nanoid(10);
    const job: SceneContentGenerationJob = await createSceneContentGenerationJob(jobId, input);
    const pollUrl = `/api/generate/scene-content/${jobId}`;

    after(() => runSceneContentGenerationJob(jobId));

    return apiSuccess(
      {
        jobId,
        status: job.status,
        message: job.message,
        pollUrl,
        pollIntervalMs: 2000,
      },
      202,
    );
  } catch (error) {
    log.error(
      `Scene content generation failed [scene="${outlineTitle ?? 'unknown'}", model=${resolvedModelString ?? 'unknown'}]:`,
      error,
    );
    return apiError('INTERNAL_ERROR', 500, error instanceof Error ? error.message : String(error));
  }
}
