import { ExternalLink } from '@/components/ui/external-link';
import { vocab } from '@/lib/brand-vocabulary';

/** Explain the knowledge format independently of an installed desktop application. */
export function ObsidianIntroduction() {
  return (
    <p className="text-sm leading-6 text-muted-foreground">
      Build a knowledge graph from Markdown notes and their links. A vault is the folder holding
      those notes. Create a new vault in {vocab.agent} or connect an existing notes folder; no
      Obsidian installation or account is required. Obsidian is a popular knowledge app for opening
      and reviewing the same vault and graph. Its optional paid cross-device Sync service can also
      be managed by {vocab.agent}.{' '}
      <ExternalLink href="https://obsidian.md/" className="underline underline-offset-4">
        About Obsidian
      </ExternalLink>
    </p>
  );
}
