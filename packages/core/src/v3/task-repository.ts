import { z } from 'zod';
import { ResponseFeedbackRepository } from './response-feedback-repository.js';

const cancellationReply = z.object({
  results: z.array(
    z.object({ handle: z.string(), cancellation_requested: z.boolean(), status: z.string() }),
  ),
  errors: z.array(z.object({ handle: z.string(), error: z.string() })),
});

const coordinationGrant = z.object({
  id: z.string(), granting_human: z.string(), recipient_session: z.string(),
  target_session: z.string(), target_handle: z.string().nullish(),
  target_scope: z.enum(['session', 'tree']),
  rights: z.array(z.enum(['read', 'observe', 'message', 'control'])),
  created_at: z.string(), revoked_at: z.string().nullish(),
});

export type SessionCoordinationGrant = z.infer<typeof coordinationGrant>;
export type SessionCoordinationRight = SessionCoordinationGrant['rights'][number];

/** Shared task controls use their original owner and report per-handle failures. */
export class TaskRepository extends ResponseFeedbackRepository {
  /** Human-only relationship controls use the authenticated service channel. */
  public async coordinationGrants(sessionId: string, signal?: AbortSignal): Promise<SessionCoordinationGrant[]> {
    const result = await this.transport.request({method: 'GET',
      path: `/v1/sessions/${encodeURIComponent(sessionId)}/coordination-grants`,
      decode: (value) => z.object({grants: z.array(coordinationGrant)}).parse(value), signal});
    return result.grants;
  }

  public async grantSessionAccess(sessionId: string, targetSession: string,
    rights: SessionCoordinationRight[], includeDescendants = false, signal?: AbortSignal): Promise<SessionCoordinationGrant> {
    return this.transport.request({method: 'POST',
      path: `/v1/sessions/${encodeURIComponent(sessionId)}/coordination-grants`,
      body: {recipient_session: sessionId, target_session: targetSession, rights,
        target_scope: includeDescendants ? 'tree' : 'session'},
      decode: (value) => coordinationGrant.parse(value), signal});
  }

  public async revokeSessionAccess(sessionId: string, grantId: string, signal?: AbortSignal): Promise<void> {
    await this.transport.request({method: 'DELETE',
      path: `/v1/sessions/${encodeURIComponent(sessionId)}/coordination-grants/${encodeURIComponent(grantId)}`,
      decode: (value) => coordinationGrant.parse(value), signal});
  }

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
