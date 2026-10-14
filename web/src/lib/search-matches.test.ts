import { describe, expect, it } from 'vitest';
import { messageSearchHash, searchMatchRanges } from './search-matches';
import { parseMarkdownContentReference } from './markdown-content-reference';

describe('search destinations and matching', () => {
  it('prefers a whole phrase over common words and tolerates rendered whitespace', () => {
    const text = 'a note, then share a\nplant with the reviewer';
    expect(searchMatchRanges(text, 'share a plant')).toEqual([[13, 26]]);
    expect(searchMatchRanges('a+b (plant)', 'a+b')).toEqual([[0, 3]]);
  });
  it('retains actual part identity and query through a citation URI', () => {
    const hash = messageSearchHash('msg_1', 'part_1', 'share a plant?');
    expect(parseMarkdownContentReference(`session://ws_a/sess_a${hash}`)).toEqual({
      kind: 'session',
      workspaceId: 'ws_a',
      sessionId: 'sess_a',
      messageId: 'msg_1',
      partId: 'part_1',
      find: 'share a plant?',
    });
  });
  it('keeps a foreign file bound to its own workspace and exact source line', () => {
    expect(
      parseMarkdownContentReference(
        'workspace-file://ws_archive/notes%20and%20sources.txt?line=12&find=plant',
      ),
    ).toEqual({
      kind: 'file',
      workspaceId: 'ws_archive',
      path: 'notes and sources.txt',
      line: 12,
      find: 'plant',
    });
  });
  it.each([
    'workspace-file://ws_a/%2e%2e/private?line=2',
    'workspace-file://ws_a/file?line=-1',
    'workspace-file://ws_a/file?line=1.2',
    'session://ws/sess#message-msg?part=../bad',
    'session://ws/sess#message-msg?unknown=1',
  ])('leaves malformed destination unavailable: %s', (uri) => {
    expect(parseMarkdownContentReference(uri)).toBeUndefined();
  });
});
