import { describe, expect, it } from 'vitest';
import { ClioRepository } from './repository.js';
import type { ClioTransport, StreamScope, TransportFrame, TransportRequest } from './transport.js';

class RecordingTransport implements ClioTransport {
  public readonly requests: TransportRequest<unknown>[] = [];
  public constructor(private readonly response: unknown) {}
  public request<T>(request: TransportRequest<T>): Promise<T> {
    this.requests.push(request as TransportRequest<unknown>);
    return Promise.resolve(request.decode(this.response));
  }
  public async *stream(
    _scope: StreamScope,
    _cursor?: string,
    _signal?: AbortSignal,
  ): AsyncIterable<TransportFrame> {
    return;
  }
}

describe('knowledge overview contract', () => {
  it('accepts a source-wide graph beyond file-page limits and forwards scope, filters and cancellation', async () => {
    const notes = Array.from({ length: 601 }, (_, i) => ({
      path: `${i}.md`,
      title: `Note ${i}`,
      revision: '1',
    }));
    const transport = new RecordingTransport({
      source_id: 'source/one',
      revision: 'r1',
      notes,
      links: [],
      total: 601,
    });
    const repository = new ClioRepository(transport);
    const signal = new AbortController().signal;
    await expect(
      repository.knowledgeGraph(
        'workspace/one',
        'source/one',
        { query: '#science', focus: 'Plan & methods.md', attachments: true },
        signal,
      ),
    ).resolves.toMatchObject({ total: 601, notes });
    const request = transport.requests[0]!;
    const url = new URL(request.path, 'https://example.test');
    expect(url.pathname).toBe(
      '/v1/workspaces/workspace%2Fone/sources/source%2Fone/knowledge/graph',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      query: '#science',
      focus: 'Plan & methods.md',
      attachments: 'true',
    });
    expect(request.signal).toBe(signal);
    expect(() => repository.knowledgeSnapshot('workspace/one', 'source/one', {})).toThrow();
  });
});
