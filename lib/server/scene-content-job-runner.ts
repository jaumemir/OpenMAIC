import { createLogger } from '@/lib/logger';
import { generateSceneContentFromInput } from '@/lib/server/scene-content-generation';
import {
  markSceneContentGenerationJobFailed,
  markSceneContentGenerationJobRunning,
  markSceneContentGenerationJobSucceeded,
  readSceneContentGenerationJob,
} from '@/lib/server/scene-content-job-store';

const log = createLogger('SceneContentJob');
const runningJobs = new Map<string, Promise<void>>();

export function runSceneContentGenerationJob(jobId: string): Promise<void> {
  const existing = runningJobs.get(jobId);
  if (existing) {
    return existing;
  }

  const jobPromise = (async () => {
    try {
      const job = await readSceneContentGenerationJob(jobId);
      if (!job) {
        throw new Error(`Scene content generation job not found: ${jobId}`);
      }

      if (job.status === 'running') {
        log.info(`Scene content generation job ${jobId} is already running, skipping duplicate start`);
        return;
      }

      if (job.status === 'succeeded') {
        log.info(`Scene content generation job ${jobId} already succeeded, skipping duplicate start`);
        return;
      }

      await markSceneContentGenerationJobRunning(jobId);
      const result = await generateSceneContentFromInput(job.input);
      await markSceneContentGenerationJobSucceeded(jobId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Scene content generation job ${jobId} failed:`, error);
      try {
        await markSceneContentGenerationJobFailed(jobId, message);
      } catch (markFailedError) {
        log.error(`Failed to persist failed status for scene job ${jobId}:`, markFailedError);
      }
    } finally {
      runningJobs.delete(jobId);
    }
  })();

  runningJobs.set(jobId, jobPromise);
  return jobPromise;
}
