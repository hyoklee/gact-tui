import { useContext, type ComponentProps } from 'react';
import type { ExtraProps } from 'streamdown';
import { ExternalLink } from '@/components/ui/external-link';
import {
  CONTENT_REFERENCE_PATH,
  parseMarkdownContentReference,
} from '@/lib/markdown-content-reference';
import { cn } from '@/lib/utils';
import { vocab } from '@/lib/brand-vocabulary';
import { PresentationNavigation } from './presentation-navigation';

function decoded(uri: string): string {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

/** Open explicit source citations in the same workbench as tool-result file links. */
export function MarkdownContentLink({
  href,
  className,
  children,
  node: _node,
  ...props
}: ComponentProps<'a'> & ExtraProps) {
  const navigation = useContext(PresentationNavigation);
  const style = cn('wrap-anywhere font-medium text-primary underline', className);
  if (!href) return <a {...props}>{children}</a>;
  if (!href.startsWith(CONTENT_REFERENCE_PATH)) {
    return (
      <ExternalLink {...props} className={style} href={href}>
        {children}
      </ExternalLink>
    );
  }
  const uri = decoded(href.slice(CONTENT_REFERENCE_PATH.length));
  const reference = parseMarkdownContentReference(uri);
  let open: (() => void) | undefined;
  if (reference?.kind === 'file' && navigation?.onOpenFile) {
    open = () => navigation.onOpenFile?.(reference.path);
  } else if (reference?.kind === 'artifact' && navigation?.onOpenArtifact) {
    const artifacts = Object.values(navigation.artifacts);
    const exact = artifacts.find(
      (item) =>
        item.uri === reference.uri ||
        reference.uri === `artifact://${item.id}` ||
        reference.uri === `artifact:${item.id}`,
    );
    const matches = artifacts.filter((item) => decoded(item.uri) === decoded(reference.uri));
    const artifact = exact ?? (matches.length === 1 ? matches[0] : undefined);
    if (artifact) open = () => navigation.onOpenArtifact?.(artifact);
  } else if (reference?.kind === 'resource' && navigation?.onOpenResource) {
    const resource = navigation.resources?.[reference.id];
    if (resource && (!reference.workspaceId || resource.workspace_id === reference.workspaceId)) {
      open = () => navigation.onOpenResource?.(resource);
    }
  }
  if (!open) {
    return (
      <span aria-disabled="true" title="Source unavailable in this conversation">
        {children}
      </span>
    );
  }
  return (
    <a
      {...props}
      className={style}
      href={uri}
      target={undefined}
      onClick={(event) => {
        event.preventDefault();
        open();
      }}
      title={reference?.kind === 'file' ? reference.path : `Open source in ${vocab.product}`}
    >
      {children}
    </a>
  );
}
