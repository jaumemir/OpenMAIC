/**
 * GET /api/classroom?id=<stageId>
 *
 * Fallback de lectura per a la pàgina de reproducció quan no hi ha dades a
 * l'IndexedDB del client. Llegeix el stage des del backend de storage del
 * servidor (data/stages/).
 *
 * El POST ha estat eliminat (no tenia cridadors externs; la generació usa
 * /api/generate-classroom + classroom-job-runner directament).
 */
import { type NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { buildRequestOrigin } from '@/lib/server/classroom-storage';
import { getStorageBackend } from '@/lib/server/storage';
import { createLogger } from '@/lib/logger';

const log = createLogger('Classroom API');

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required parameter: id',
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Invalid classroom id');
    }

    const data = await getStorageBackend().loadStage(id);
    if (!data) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, 'Classroom not found');
    }

    const baseUrl = buildRequestOrigin(request);
    return apiSuccess({
      classroom: {
        id,
        stage: data.stage,
        scenes: data.scenes,
        url: `${baseUrl}/classroom/${id}`,
      },
    });
  } catch (error) {
    log.error(
      `Classroom retrieval failed [id=${request.nextUrl.searchParams.get('id') ?? 'unknown'}]:`,
      error,
    );
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'Failed to retrieve classroom',
      error instanceof Error ? error.message : String(error),
    );
  }
}
