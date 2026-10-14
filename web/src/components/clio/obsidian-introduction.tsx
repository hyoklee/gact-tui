import { ExternalLink } from '@/components/ui/external-link';
import { vocab } from '@/lib/brand-vocabulary';

/** Explain the knowledge format independently of an installed desktop application. */
export function ObsidianIntroduction() {
  return (
    <p className="text-sm leading-6 text-muted-foreground">
      Obsidian is a notes app that connects Markdown notes with links. A vault is the folder holding
      those notes. {vocab.agent} can create or use a vault as a knowledge source without the
      Obsidian app installed.{' '}
      <ExternalLink href="https://obsidian.md/" className="underline underline-offset-4">
        About Obsidian
      </ExternalLink>
    </p>
  );
}
