import { useContext } from 'react';
import { FileTextIcon } from 'lucide-react';
import type { ToolPresentationBlock } from '@clio/core/v3';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PresentationNavigation } from './presentation-navigation';

/**
 * Saved-file metadata and its open action, attached to the single output section.
 * Excerpts belong to that section's shared preview, not another result segment.
 */
export function SavedTerminalOutput({ block }: { block: ToolPresentationBlock }) {
  const navigation = useContext(PresentationNavigation);
  const uri = block.uri ?? '';
  const onOpenFile = navigation?.onOpenFile;
  const canOpen = Boolean(uri && onOpenFile);
  const action = block.action_label ? (
    <Button
      className="shrink-0 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-60"
      disabled={!canOpen}
      onClick={canOpen ? () => onOpenFile?.(uri) : undefined}
      size="sm"
      title={canOpen ? uri : undefined}
      variant="ghost"
    >
      <FileTextIcon data-icon="inline-start" />
      {block.action_label}
    </Button>
  ) : null;
  return (
    <section
      aria-label={block.label}
      className="border-t border-zinc-800 pt-2"
      data-slot="terminal-saved-output"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-3">
        <p className="min-w-0 text-sm text-zinc-300">{block.label}</p>
        {action && !canOpen ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>{action}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm text-sm">
                Open this session in its workspace to view the saved file.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          action
        )}
      </div>
    </section>
  );
}
