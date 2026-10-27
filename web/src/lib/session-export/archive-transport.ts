import {
  PLUGIN_VIEW_PARTS_HEADERS,
  TransportError,
  sessionReviewRequestKey,
  type ClioTransport,
  type TransportRequest,
  type SessionReviewSnapshot,
  type ArtifactTableQueryResult,
  type ArtifactTableQueryRequest,
} from '@clio/core/v3';
import { queryArchiveTable } from './archive-table-query';

/**
 * The transcripts an archive already carries, so a read of a session's
 * messages is answered from them instead of from a second captured copy:
 * `views` are the projected transcripts the conversation renders, `ledgers`
 * the recorded parts (for reads that ask for the part ledger).
 */
export interface ArchiveTranscripts {
  views?: Readonly<
    Record<
      string,
      {
        messages: unknown[];
        tools?: unknown[];
        tasks?: unknown[];
        subagents?: unknown[];
        artifacts?: unknown[];
        surfaces?: unknown[];
      }
    >
  >;
  ledgers?: Readonly<Record<string, { messages: unknown[] }>>;
}

const MESSAGES_PATH = /^\/v1\/sessions\/([^/?]+)\/messages$/u;

function asksForPartLedger(request: TransportRequest<unknown>): boolean {
  return Object.entries(PLUGIN_VIEW_PARTS_HEADERS).every(
    ([name, value]) => request.headers?.[name] === value,
  );
}

/** Read captured responses and query captured tables; never contacts a live service. */
export class ArchiveTransport implements ClioTransport {
  public constructor(
    private readonly snapshot: SessionReviewSnapshot,
    private readonly transcripts: ArchiveTranscripts = {},
  ) {}
  public async request<T>(request: TransportRequest<T>): Promise<T> {
    const match = request.path.match(/^\/v1\/artifacts\/([^/]+)\/table-query$/u);
    if (request.method === 'POST' && match && this.snapshot.tables[decodeURIComponent(match[1])]) {
      return request.decode(
        queryArchiveTable(
          this.snapshot.tables[decodeURIComponent(match[1])] as unknown as ArtifactTableQueryResult,
          request.body as ArtifactTableQueryRequest,
        ),
      );
    }
    if (request.method !== 'GET')
      throw new TransportError(
        'This is an offline review. Agent actions need a live session.',
        409,
        'archive_read_only',
      );
    const transcript = this.transcript(request);
    if (transcript !== undefined) return request.decode(transcript);
    let key = sessionReviewRequestKey(request.method, request.path);
    let response = this.snapshot.responses[key];
    // A read stored once for several paths (a study read by each of its branches).
    for (let hops = 0; response?.same_as && hops < 4; hops += 1) {
      key = response.same_as;
      response = this.snapshot.responses[key];
    }
    if (!response || response.same_as)
      throw new TransportError(
        'This content was not captured in the archive. See export coverage.',
        404,
        'archive_content_unavailable',
      );
    if (response.error)
      throw new TransportError(
        response.error.message,
        response.error.status,
        response.error.code,
        response.error.details,
      );
    let value =
      response.bytes === undefined
        ? response.json
        : Uint8Array.from(atob(response.bytes), (c) => c.charCodeAt(0));
    if (request.responseType === 'text' && value instanceof Uint8Array)
      value = new TextDecoder().decode(value);
    return request.decode(value);
  }

  /** A session's messages, answered from the transcript the archive carries. */
  private transcript(request: TransportRequest<unknown>): unknown {
    const match = request.path.match(MESSAGES_PATH);
    if (!match) return undefined;
    const sessionId = decodeURIComponent(match[1]!);
    if (asksForPartLedger(request)) {
      const ledger = this.transcripts.ledgers?.[sessionId];
      return ledger ? { messages: ledger.messages } : undefined;
    }
    const view = this.transcripts.views?.[sessionId];
    if (!view) return undefined;
    return {
      messages: view.messages,
      tools: view.tools ?? [],
      tasks: view.tasks ?? [],
      subagents: view.subagents ?? [],
      artifacts: view.artifacts ?? [],
      surfaces: view.surfaces ?? [],
    };
  }

  public stream(): AsyncIterable<never> {
    return {
      [Symbol.asyncIterator]: () => ({
        next: async () => {
          throw new TransportError(
            'An offline archive has no live activity stream.',
            409,
            'archive_read_only',
          );
        },
      }),
    };
  }
}
