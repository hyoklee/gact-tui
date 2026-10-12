import type { MessageBlock } from '@clio/core/v3';
import { ChevronRightIcon, SyringeIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { vocab } from '@/lib/brand-vocabulary';
import { cn } from '@/lib/utils';
import { humanizeProtocolValue } from './presentation-labels';
import { useTranscriptDisclosure } from './transcript-disclosure-context';

type InjectionBlock = Extract<MessageBlock, { type: 'injection' }>;

const INJECTION_LABELS: Record<string, string> = {
  goal_judgment: 'Goal judgment',
  loop_wake: 'Loop wake',
  scheduled_wake: 'Scheduled wake',
  task_completion: 'Background task completion',
  earlier_turns: 'Recovered conversation context',
  todos: 'Todo list reminder',
  plan_mode: 'Plan reminder',
  replan: 'Replanning suggestion',
  memory_search: 'Memory search results',
  task_results: 'Results from background tasks',
  path_hint: 'Path suggestion',
  circuit_breaker: 'Repeated-failure warning',
  result_spilled: 'Large result saved to a file',
  hook: 'Hook',
  summarization: 'Summarization',
  variant_drafting: 'Drafting alternatives',
  variant_advice: 'Advice for this draft',
};

/** Show a recorded harness addition, retaining the exact text the agent received. */
export function HarnessInjection({
  block,
  compact = false,
}: {
  block: InjectionBlock;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useTranscriptDisclosure(`injection:${block.id}`);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const label = INJECTION_LABELS[block.source] ?? humanizeProtocolValue(block.source);
  return (
    <section
      className="min-w-0 max-w-full"
      data-slot="harness-injection"
      data-source={block.source}
    >
      <Button
        variant="ghost"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        type="button"
        className={cn(
          'h-auto min-h-7 w-full min-w-0 justify-start gap-2 rounded-sm px-1 py-1 text-left text-muted-foreground',
          compact ? 'pr-7 text-xs' : 'text-sm font-medium',
        )}
      >
        <SyringeIcon
          aria-hidden="true"
          className={compact ? 'size-3.5 shrink-0' : 'size-4 shrink-0'}
        />
        <span className="shrink-0 text-xs font-normal">Injection</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronRightIcon
          aria-hidden="true"
          className={cn('size-3 shrink-0 transition-transform', expanded && 'rotate-90')}
        />
      </Button>
      {expanded ? (
        <div>
          <pre className="mt-2 min-w-0 max-w-full whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-xs leading-5">
            {block.text}
          </pre>
          <button
            className="mt-1 text-xs text-primary hover:underline"
            onClick={() => setDetailsOpen(true)}
            type="button"
          >
            Open exact details
          </button>
        </div>
      ) : null}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="flex max-h-[88dvh] flex-col sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              The recorded content {vocab.agent} gave the agent.
            </DialogDescription>
          </DialogHeader>
          <pre className="min-h-0 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-4 text-xs leading-5">
            {block.text}
          </pre>
        </DialogContent>
      </Dialog>
    </section>
  );
}
