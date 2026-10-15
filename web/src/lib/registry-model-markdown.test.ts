import { expect, it } from 'vitest';
import { registryCardBody, registryCardLinks } from './registry-model-markdown';

it('resolves relative card links and images to the immutable Hub revision, preserving external links', () => {
  const tree = {
    type: 'root',
    children: [
      { type: 'link', url: './LICENSE' },
      { type: 'image', url: 'images/chart.png' },
      { type: 'link', url: '#details' },
      { type: 'link', url: 'https://example.org/guide' },
    ],
  };
  registryCardLinks('org/model', 'abc')()(tree);
  expect(tree.children.map((node) => node.url)).toEqual([
    'https://huggingface.co/org/model/blob/abc/LICENSE',
    'https://huggingface.co/org/model/resolve/abc/images/chart.png',
    '#details',
    'https://example.org/guide',
  ]);
  expect(registryCardBody('---\nlicense: apache-2.0\n---\n# Model\n\n---\nBody')).toBe(
    '# Model\n\n---\nBody',
  );
});
