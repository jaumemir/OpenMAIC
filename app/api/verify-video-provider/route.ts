/**
 * Verify Video Provider API
 *
 * POST /api/verify-video-provider
 * Headers: x-video-provider, x-video-model
 */

import { NextRequest } from 'next/server';
import { testVideoConnectivity } from '@/lib/media/video-providers';
import { resolveVideoApiKey, resolveVideoBaseUrl } from '@/lib/server/provider-config';
import type { VideoProviderId } from '@/lib/media/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('VerifyVideoProvider');

export async function POST(request: NextRequest) {
  try {
    const providerId = (request.headers.get('x-video-provider') || 'seedance') as VideoProviderId;
    const model = request.headers.get('x-video-model') || undefined;

    const apiKey = await resolveVideoApiKey(providerId);
    const baseUrl = await resolveVideoBaseUrl(providerId);

    if (!apiKey) {
      return apiError('MISSING_API_KEY', 400, 'No API key configured');
    }

    const result = await testVideoConnectivity({
      providerId,
      apiKey,
      baseUrl,
      model,
    });

    if (!result.success) {
      return apiError('UPSTREAM_ERROR', 500, result.message);
    }

    return apiSuccess({ message: result.message });
  } catch (err) {
    log.error(
      `Video provider verification failed [provider=${request.headers.get('x-video-provider') ?? 'seedance'}]:`,
      err,
    );
    return apiError('INTERNAL_ERROR', 500, `Connectivity test error: ${err}`);
  }
}
