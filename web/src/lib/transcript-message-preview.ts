import type { Message } from '@clio/core/v3';
import { truncate } from './format';
import { TRANSCRIPT_PREVIEW_TRUNCATE_CHARS } from './runtime-limits';

export interface TranscriptMessagePreview {
  title: string;
  body: string;
}

/** Short excerpts of recorded text, without generating a new summary or model call. */
export function transcriptMessagePreviews(
  messages: readonly Message[],
): ReadonlyMap<string, TranscriptMessagePreview> {
  const previews = new Map<string, TranscriptMessagePreview>();
  let reply = '';
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]!;
    const text = readableText(message);
    const firstLine = text.split('\n')[0] ?? '';
    const sentence = firstLine.match(/^.{1,94}?[.!?](?:\s|$)/u)?.[0]?.trim();
    const sourceTitle = sentence || firstLine;
    const boundary =
      sourceTitle.length > 96 ? sourceTitle.lastIndexOf(' ', 95) : sourceTitle.length;
    const consumed = boundary > 0 ? boundary : Math.min(sourceTitle.length, 95);
    const title = sourceTitle
      ? truncate(sourceTitle, Math.min(96, consumed + 1))
      : `${message.role} activity`;
    const remainder = text.slice(consumed).trim();
    // User landmarks preview the answer below their prompt, as a compact turn.
    // Keep one landmark per message so attention evidence still targets exact messages.
    const body = message.role === 'user' && reply ? reply : remainder;
    previews.set(message.id, {
      title,
      body: truncate(body, TRANSCRIPT_PREVIEW_TRUNCATE_CHARS - title.length),
    });
    if (message.role === 'user') reply = '';
    else if (message.role === 'assistant' && !reply && text) reply = text;
  }
  return previews;
}

function readableText(message: Message): string {
  const kind = message.blocks.some((block) => block.type === 'text' && block.text.trim())
    ? 'text'
    : 'reasoning';
  let text = '';
  for (const block of message.blocks) {
    if (block.type !== kind) continue;
    text += `${text ? '\n' : ''}${block.text.slice(0, TRANSCRIPT_PREVIEW_TRUNCATE_CHARS + 1 - text.length)}`;
    if (text.length > TRANSCRIPT_PREVIEW_TRUNCATE_CHARS) break;
  }
  return truncate(text, TRANSCRIPT_PREVIEW_TRUNCATE_CHARS)
    .replaceAll(/!\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replaceAll(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replaceAll(/^\s{0,3}(?:#{1,6}|>|[-*+] |\d+\. )\s*/gmu, '')
    .replaceAll(
      /\*\*([^*]+)\*\*|__([^_]+)__/gu,
      (_, bold: string | undefined, underlined: string | undefined) => bold ?? underlined ?? '',
    )
    .replaceAll(/(?<!\w)[*_]([^*_\n]+)[*_](?!\w)/gu, '$1')
    .replaceAll(/`+/gu, '')
    .replaceAll(/[ \t]+/gu, ' ')
    .trim();
}
