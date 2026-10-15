import { sanitizeMermaidSvg } from '@/components/clio/mermaid-security';

/** Keep the rendered SVG's text coordinates as a transparent native selection layer over the canvas. */
export function mermaidSelectableText(svg: string): string {
  if (!svg) return '';
  const root = sanitizeMermaidSvg(svg);
  const keep = new Set(['svg', 'g', 'style', 'text', 'tspan', 'textPath']);
  for (const node of [...root.querySelectorAll('*')]) {
    if (!keep.has(node.localName)) node.remove();
  }
  root.setAttribute('width', '100%');
  root.setAttribute('height', '100%');
  root.style.maxWidth = 'none';
  for (const text of root.querySelectorAll<SVGElement>('text, tspan, textPath')) {
    text.style.fill = 'transparent';
    text.style.stroke = 'none';
    text.style.pointerEvents = 'auto';
    text.style.userSelect = 'text';
    text.style.cursor = 'text';
  }
  return new XMLSerializer().serializeToString(root);
}
