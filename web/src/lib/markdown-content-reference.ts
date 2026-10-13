export const CONTENT_REFERENCE_PATH = '/__clio_content_reference__/';

export type MarkdownContentReference =
  | { kind: 'file'; path: string }
  | { kind: 'artifact'; uri: string }
  | { kind: 'resource'; id: string; workspaceId?: string }
  | { kind: 'session'; workspaceId: string; sessionId: string; messageId?: string };

/** Recognize explicit CLIO references without guessing from filenames or URLs. */
export function isMarkdownContentReference(uri: string): boolean {
  return /^(?:workspace-file|artifact|resource|session):/iu.test(uri);
}

/** Decode an explicit reference; filesystem reads retain the connected service's policy. */
export function parseMarkdownContentReference(uri: string): MarkdownContentReference | undefined {
  const separator = uri.indexOf(':');
  const scheme = uri.slice(0, separator).toLowerCase();
  const body = uri.slice(separator + 1);
  if (scheme === 'workspace-file') {
    if (!body || /[?#]/u.test(body)) return undefined;
    let path: string;
    try {
      path = decodeURIComponent(body);
    } catch {
      return undefined;
    }
    const hasControl = Array.from(path).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    });
    if (!path.trim() || hasControl) return undefined;
    if (path.split(/[\\/]/u).some((segment) => segment === '..')) return undefined;
    return { kind: 'file', path };
  }
  if (scheme === 'artifact' && body && body !== '//') return { kind: 'artifact', uri };
  if (scheme === 'resource') {
    const parts = body.replace(/^\/\//u, '').split('/');
    const id = parts.at(-1);
    if (!id || !/^res_[A-Za-z0-9]+$/u.test(id) || parts.length > 2) return undefined;
    const workspaceId = parts.length === 2 ? parts[0] : undefined;
    if (workspaceId === '') return undefined;
    return { kind: 'resource', id, ...(workspaceId ? { workspaceId } : {}) };
  }
  if (scheme === 'session') {
    const [target, fragment, extra] = body.split('#');
    if (extra !== undefined || !target.startsWith('//')) return undefined;
    const parts = target.slice(2).split('/');
    if (parts.length !== 2) return undefined;
    try {
      const [workspaceId, sessionId] = parts.map(decodeURIComponent);
      const invalid = (part: string) =>
        !part ||
        part === '.' ||
        part === '..' ||
        /[\\/?#]/u.test(part) ||
        Array.from(part).some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        );
      if (invalid(workspaceId) || invalid(sessionId)) return undefined;
      if (fragment !== undefined && !fragment.startsWith('message-')) return undefined;
      const messageId = fragment === undefined ? undefined : decodeURIComponent(fragment.slice(8));
      if (messageId !== undefined && invalid(messageId)) return undefined;
      return { kind: 'session', workspaceId, sessionId, ...(messageId ? { messageId } : {}) };
    } catch {
      return undefined;
    }
  }
  return undefined;
}

interface MarkdownNode {
  type: string;
  url?: string;
  children?: MarkdownNode[];
}

/** Preserve supported link schemes before generic Markdown URL sanitization. */
export function remarkContentReferences() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (node.type === 'link' && node.url && isMarkdownContentReference(node.url)) {
        try {
          node.url = `${CONTENT_REFERENCE_PATH}${encodeURIComponent(node.url)}`;
        } catch {
          // Malformed Unicode from untrusted prose must not crash the transcript.
          node.url = CONTENT_REFERENCE_PATH;
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
