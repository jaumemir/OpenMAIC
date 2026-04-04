'use client';

import type { AgentInfo } from '@/lib/generation/generation-pipeline';
import type { ImageMapping, PdfImage, SceneOutline } from '@/lib/types/generation';

export interface SceneContentRequestParams {
  outline: SceneOutline;
  allOutlines: SceneOutline[];
  stageId: string;
  pdfImages?: PdfImage[];
  imageMapping?: ImageMapping;
  stageInfo: {
    name: string;
    description?: string;
    language?: string;
    style?: string;
  };
  agents?: AgentInfo[];
}

export interface SceneContentResult {
  success: boolean;
  content?: unknown;
  effectiveOutline?: SceneOutline;
  error?: string;
}

interface SceneContentJobAcceptedResponse {
  success: true;
  jobId: string;
  status: 'queued' | 'running';
  pollUrl: string;
  pollIntervalMs?: number;
}

interface SceneContentJobPollResponse {
  success: true;
  jobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  pollUrl: string;
  pollIntervalMs?: number;
  done: boolean;
  result?: SceneContentResult;
  error?: string;
}

function createAbortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);

    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function pollSceneContentJob(
  pollUrl: string,
  pollIntervalMs: number,
  signal?: AbortSignal,
): Promise<SceneContentResult> {
  while (true) {
    throwIfAborted(signal);

    const response = await fetch(pollUrl, {
      method: 'GET',
      cache: 'no-store',
      signal,
    });

    const data = (await response.json().catch(() => ({
      success: false,
      error: 'Request failed',
    }))) as SceneContentJobPollResponse & { success?: boolean; error?: string };

    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    if (data.done) {
      if (data.status === 'succeeded' && data.result) {
        return data.result;
      }
      return { success: false, error: data.error || 'Scene content generation failed' };
    }

    await wait(data.pollIntervalMs || pollIntervalMs, signal);
  }
}

export async function requestSceneContent(
  params: SceneContentRequestParams,
  headers: HeadersInit,
  signal?: AbortSignal,
): Promise<SceneContentResult> {
  const response = await fetch('/api/generate/scene-content', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
    signal,
  });

  const data = (await response.json().catch(() => ({
    success: false,
    error: 'Request failed',
  }))) as
    | SceneContentResult
    | (SceneContentJobAcceptedResponse & { error?: string })
    | { success?: boolean; error?: string };

  if (!response.ok) {
    return { success: false, error: data.error || `HTTP ${response.status}` };
  }

  if (response.status === 202 && 'pollUrl' in data) {
    return pollSceneContentJob(data.pollUrl, data.pollIntervalMs || 2000, signal);
  }

  return data as SceneContentResult;
}
