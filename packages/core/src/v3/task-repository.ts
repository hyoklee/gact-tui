import { z } from 'zod';
import { ResponseFeedbackRepository } from './response-feedback-repository.js';

const cancellationReply = z.object({
  results: z.array(
    z.object({ handle: z.string(), cancellation_requested: z.boolean(), status: z.string() }),
  ),
  errors: z.array(z.object({ handle: z.string(), error: z.string() })),
});

/** Shared task controls use their original owner and report per-handle failures. */
export class TaskRepository extends ResponseFeedbackRepository {
  public async controlSubagent(
    sessionId: string,
    target: string,
    action: 'pause' | 'resume' | 'restart',
    signal?: AbortSignal,
  ): Promise<void> {
    await this.transport.request({
      method: 'POST',
      path: `/v1/sessions/${encodeURIComponent(sessionId)}/agent-controls/${encodeURIComponent(target)}/${action}`,
      body: { fresh: false },
      decode: (value) =>
        z.object({ handle: z.string(), session_id: z.string(), status: z.string() }).parse(value),
      signal,
    });
  }

  public async cancelTasks(
    sessionId: string,
    tasks: string[],
    signal?: AbortSignal,
  ): Promise<void> {
    const result = await this.transport.request({
      method: 'POST',
      path: `/v1/sessions/${encodeURIComponent(sessionId)}/async-tasks/cancel`,
      body: { tasks },
      decode: (value) => cancellationReply.parse(value),
      signal,
    });
    if (result.errors.length)
      throw new Error(result.errors.map((error) => `${error.handle}: ${error.error}`).join('; '));
  }
}
