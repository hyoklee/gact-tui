interface CardNode {
  type: string;
  url?: string;
  children?: CardNode[];
}

/** Resolve model-card files against the metadata revision, never CLIO workspace paths. */
export function registryCardLinks(repository: string, revision: string) {
  const base = `https://huggingface.co/${repository}`;
  return () => (tree: CardNode) => {
    const visit = (node: CardNode) => {
      if (
        node.url &&
        ['link', 'image', 'definition'].includes(node.type) &&
        !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/iu.test(node.url)
      ) {
        node.url = new URL(
          node.url,
          `${base}/${node.type === 'image' ? 'resolve' : 'blob'}/${encodeURIComponent(revision)}/`,
        ).href;
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

/** Hub YAML metadata is shown as capabilities and tags rather than raw frontmatter. */
export function registryCardBody(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u, '');
}
