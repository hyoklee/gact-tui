import { sanitizeMermaidSvg } from './mermaid-security';

/** Render Mermaid syntax with the bundled Pele engine; preserve legacy syntax through Mermaid. */
export async function renderPeleDiagram(
  source: string,
  idPrefix: string,
  maxWidth?: number,
): Promise<string | undefined> {
  const { renderAsync, PeleError } = await import('pele/lazy');
  let output: string;
  try {
    output = (
      await renderAsync(source, {
        idPrefix,
        maxWidth,
        links: false,
        images: false,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 15,
      })
    ).svg;
  } catch (error) {
    if (error instanceof PeleError) return undefined;
    throw error;
  }
  const svg = sanitizeMermaidSvg(output);
  const theme = getComputedStyle(document.documentElement);
  const variables: Record<string, string> = {
    bg: 'background',
    fg: 'foreground',
    muted: 'muted-foreground',
    line: 'muted-foreground',
    surface: 'card',
    'surface-alt': 'muted',
    border: 'border',
    accent: 'primary',
  };
  for (const [name, token] of Object.entries(variables)) {
    const value = theme.getPropertyValue(`--${token}`).trim();
    if (value) svg.style.setProperty(`--pele-${name}`, value);
  }
  // Exports and the shared image canvas have their own SVG document. Retain
  // resolved palette values there rather than depending on parent CSS variables.
  svg.style.setProperty('--pele-font', 'system-ui, sans-serif');
  return new XMLSerializer().serializeToString(svg);
}
