import { describe, expect, it } from 'vitest';
import {
  CONTENT_REFERENCE_PATH,
  parseMarkdownContentReference,
  remarkContentReferences,
} from './markdown-content-reference';

describe('Markdown content references', () => {
  it('retains resource identity and an explicit workspace binding', () => {
    expect(parseMarkdownContentReference('resource://w/res_doc')).toEqual({
      kind: 'resource',
      id: 'res_doc',
      workspaceId: 'w',
    });
    expect(parseMarkdownContentReference('resource:res_doc')).toEqual({
      kind: 'resource',
      id: 'res_doc',
    });
  });
  it.each([
    ['workspace-file:/data/Signal%20values.csv', '/data/Signal values.csv'],
    ['workspace-file:D%3A%5CWorkspace%5CREADME.md', 'D:\\Workspace\\README.md'],
    ['workspace-file:data/%CE%BC.csv', 'data/μ.csv'],
    ['workspace-file:data/a%23b%3Fc.txt', 'data/a#b?c.txt'],
  ])('decodes the exact service-side path in %s', (uri, path) => {
    expect(parseMarkdownContentReference(uri)).toEqual({ kind: 'file', path });
  });

  it.each([
    'workspace-file:',
    'workspace-file:%ZZ',
    'workspace-file:%00private',
    'workspace-file:../private',
    'workspace-file:data/%2e%2e/private',
    'workspace-file:D%3A%5Cdata%5C..%5Cprivate',
    'workspace-file:data.csv#rows',
    'workspace-file:data.csv?download=1',
    'resource://other/not-a-resource',
    'resource://other/res_a/extra',
    'https://example.com/readme.md',
  ])('rejects malformed or unsupported reference %s', (uri) => {
    expect(parseMarkdownContentReference(uri)).toBeUndefined();
  });

  it('does not reinterpret code, images or ordinary links as file citations', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'link', url: 'workspace-file:/data/README.md' },
        { type: 'link', url: 'https://example.com/README.md' },
        { type: 'inlineCode', url: 'workspace-file:/data/README.md' },
        { type: 'image', url: 'workspace-file:/data/image.png' },
      ],
    };
    remarkContentReferences()(tree);
    expect(tree.children[0].url).toBe(
      `${CONTENT_REFERENCE_PATH}${encodeURIComponent('workspace-file:/data/README.md')}`,
    );
    expect(tree.children.slice(1).map((node) => node.url)).toEqual([
      'https://example.com/README.md',
      'workspace-file:/data/README.md',
      'workspace-file:/data/image.png',
    ]);
  });
});
