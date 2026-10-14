import type { Message } from './domain.js';

/** Recover controller authorship in transcripts saved before typed wake injections. */
export function projectAutomaticMessage<T extends Message>(message: T): T {
  const metadata = message.metadata;
  const source = metadata?.goal_redrive ? 'goal_judgment'
    : metadata?.scheduled ? metadata.loop_id ? 'loop_wake' : 'scheduled_wake'
      : metadata?.task_completion_wake ? 'task_completion' : undefined;
  if (!source || message.role === 'assistant') return message;
  return {
    ...message,
    role: 'system',
    blocks: message.blocks.map((block) => block.type === 'text'
      ? { id: block.id, type: 'injection', source, text: block.text }
      : block),
  };
}
