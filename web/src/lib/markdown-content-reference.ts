export const CONTENT_REFERENCE_PATH = '/__clio_content_reference__/';

export type MarkdownContentReference =
  | { kind: 'file'; path: string }
  | { kind: 'artifact'; uri: string }
  | { kind: 'resource'; id: string; workspaceId?: string };

/** Recognize explicit CLIO references without guessing from filenames or URLs. */
export function isMarkdownContentReference(uri: string): boolean {
  return /^(?:workspace-file|artifact|resource):/iu.test(uri);
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
        node.url = `${CONTENT_REFERENCE_PATH}${encodeURIComponent(node.url)}`;
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
