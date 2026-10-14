import { TaskRepository } from './task-repository.js';
import type { CreateScheduledTurnInput, ScheduledTurn, ScheduledTurns } from './domain.js';
import { scheduledTurnSchema, scheduledTurnsSchema } from './schemas.js';

/** Scheduled work and explicit goal/loop controls. */
export class WorkRepository extends TaskRepository {
  public async scheduledTurns(sessionId: string, signal?: AbortSignal): Promise<ScheduledTurns> {
    const result = await this.transport.request({
      method: 'GET',
      path: `/v1/sessions/${encodeURIComponent(sessionId)}/schedules`,
      decode: (value) => scheduledTurnsSchema.parse(value),
      signal,
    });
    return {
      schedules: result.schedules,
      timezone: result.cron_timezone,
    };
  }

  public createScheduledTurn(
    sessionId: string,
    input: CreateScheduledTurnInput,
    signal?: AbortSignal,
  ): Promise<ScheduledTurn> {
    return this.transport.request({
      method: 'POST',
      path: `/v1/sessions/${encodeURIComponent(sessionId)}/schedules`,
      body: input,
      decode: (value) => scheduledTurnSchema.parse(value),
      signal,
    });
  }

  public deleteScheduledTurn(scheduleId: string, signal?: AbortSignal): Promise<void> {
    return this.transport.request({
      method: 'DELETE',
      path: `/v1/schedules/${encodeURIComponent(scheduleId)}`,
      decode: () => undefined,
      signal,
    });
  }

  public setScheduleEnabled(sessionId: string, scheduleId: string, enabled: boolean) {
    return this.transport.request({
      method: 'PATCH',
      path: `/v1/sessions/${encodeURIComponent(sessionId)}/schedules/${encodeURIComponent(scheduleId)}`,
      body: { enabled },
      decode: (value) => scheduledTurnSchema.parse(value),
    });
  }

  public controlSessionWork(
    sessionId: string,
    kind: 'goal' | 'loop',
    id: string,
    action: 'stop' | 'restart' | 'delete',
  ) {
    return this.transport.request({
      method: 'POST',
      path: `/v1/sessions/${encodeURIComponent(sessionId)}/work/${kind}/${encodeURIComponent(id)}`,
      body: { action },
      decode: () => undefined,
    });
  }
}
