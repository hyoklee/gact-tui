export interface GroundedMessageSource {
  description?: string;
  href: string;
  title: string;
}

export type GroundedMessageSegment =
  | { kind: 'markdown'; text: string }
  | { kind: 'sources'; sources: GroundedMessageSource[] };

const SOURCE_LINE =
  /^\s*(?:[-*+]\s+|\d+[.)]\s+)(?:\*\*)?Source(?:\*\*)?:\s*\[([^\]]+)\]\(((?:https?:\/\/|workspace-file:|artifact:|resource:|session:|\/workspaces\/)[^\s]+)\)(?:\s*(.*?))?\s*$/u;
const SOURCE_HEADING = /^\s*(?:#{1,6}\s+)?(?:\*\*)?(?:Sources|References)(?:\*\*)?:?\s*$/iu;
const NUMBERED_SOURCE =
  /^\s*(\d+)[.)]\s+\[([^\]]+)\]\(((?:https?:\/\/|workspace-file:|artifact:|resource:|session:|\/workspaces\/)[^\s]+)\)(?:\s*(.*?))?\s*$/u;

function sourceFromLine(line: string, bibliography: boolean): GroundedMessageSource | undefined {
  const numbered = bibliography ? NUMBERED_SOURCE.exec(line) : null;
  if (numbered) {
    const description = numbered[4]?.trim().replace(/^[—–-]\s*/u, '');
    return {
      title: `[${numbered[1]}] ${numbered[2].trim()}`,
      href: numbered[3],
      ...(description ? { description } : {}),
    };
  }
  const match = SOURCE_LINE.exec(line);
  if (!match?.[1] || !match[2]) return undefined;
  const description = match[3]?.trim().replace(/^[—–-]\s*/u, '');
  return {
    title: match[1].trim(),
    href: match[2],
    ...(description ? { description } : {}),
  };
}

/** Extract only explicitly labeled standalone source entries from Markdown. */
export function groundedMessageSegments(text: string): GroundedMessageSegment[] {
  const segments: GroundedMessageSegment[] = [];
  let markdown: string[] = [];
  let sources: GroundedMessageSource[] = [];
  let bibliography = false;
  let fence: { marker: string; length: number } | undefined;

  const flushMarkdown = () => {
    const value = markdown.join('\n');
    if (value.trim()) segments.push({ kind: 'markdown', text: value });
    markdown = [];
  };
  const flushSources = () => {
    if (sources.length) segments.push({ kind: 'sources', sources });
    sources = [];
  };

  const lines = text.split('\n');
  for (const [index, line] of lines.entries()) {
    const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
    if (fence) {
      markdown.push(line);
      if (
        delimiter &&
        delimiter[1][0] === fence.marker &&
        delimiter[1].length >= fence.length &&
        !delimiter[2].trim()
      )
        fence = undefined;
      continue;
    }
    if (delimiter || /^(?: {4}|\t)/u.test(line)) {
      flushSources();
      bibliography = false;
      markdown.push(line);
      if (delimiter) fence = { marker: delimiter[1][0], length: delimiter[1].length };
      continue;
    }
    if (
      SOURCE_HEADING.test(line) &&
      NUMBERED_SOURCE.test(lines.slice(index + 1).find((next) => next.trim()) ?? '')
    ) {
      flushMarkdown();
      flushSources();
      bibliography = true;
      continue;
    }
    if (bibliography && !line.trim()) continue;
    const source = sourceFromLine(line, bibliography);
    if (source) {
      flushMarkdown();
      sources.push(source);
      continue;
    }
    bibliography = false;
    flushSources();
    markdown.push(line);
  }
  flushSources();
  flushMarkdown();
  return segments;
}
