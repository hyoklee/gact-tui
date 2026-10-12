import type { PendingInteraction } from '@clio/core/v3';
import { MessageCircleQuestionIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuestionAnswer } from './question-answer-context';
import { isVariantPickInteraction } from '@/lib/variant-runs';
import { followTranscriptLink } from '@/lib/inline-question';

export function OpenQuestionsTracker({
  interactions,
  bottomInset,
}: {
  interactions: readonly PendingInteraction[];
  bottomInset: number;
}) {
  const answer = useQuestionAnswer();
  const [open, setOpen] = useState(false);
  const focusDestination = useRef(false);
  const questions = interactions.filter(
    (row) =>
      row.kind === 'question' &&
      row.status === 'pending' &&
      row.requires_human_response !== false &&
      !row.payload?.plan_exit &&
      !isVariantPickInteraction(row),
  );
  if (!questions.length || !answer?.openQuestion) return null;
  return (
    <aside
      aria-label="Open questions tracker"
      className="pointer-events-auto absolute right-3 z-30"
      style={{ bottom: bottomInset + 12 }}
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) focusDestination.current = false;
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            aria-label={`${questions.length} open question${questions.length === 1 ? '' : 's'}`}
            size="sm"
            variant="outline"
            className="rounded-full bg-background"
          >
            <MessageCircleQuestionIcon aria-hidden="true" />
            {questions.length} {questions.length === 1 ? 'question' : 'questions'}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          aria-label="Open questions"
          side="top"
          align="end"
          onCloseAutoFocus={(event) => {
            if (focusDestination.current) event.preventDefault();
          }}
          className="max-h-[min(24rem,var(--radix-popover-content-available-height))] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto p-3"
        >
          <p className="text-sm font-medium">Open questions</p>
          {questions.map((row) => {
            const link = answer.questionLink?.(row);
            return (
              <article key={row.id} className="space-y-3 border-t pt-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {row.payload?.response_mode === 'async'
                      ? 'Answer when ready'
                      : 'Answer needed to continue'}
                  </p>
                  <p className="break-words text-sm leading-relaxed">{row.prompt ?? row.title}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      focusDestination.current = true;
                      setOpen(false);
                      answer.openQuestion?.(row);
                    }}
                  >
                    Read and answer
                  </Button>
                  {link ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        focusDestination.current = true;
                        setOpen(false);
                        followTranscriptLink(link);
                      }}
                    >
                      Go to question
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </PopoverContent>
      </Popover>
    </aside>
  );
}
