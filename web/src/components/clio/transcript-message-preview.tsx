import type { TranscriptMessagePreview as Preview } from '@/lib/transcript-message-preview';
import { MessageMarkButton } from './message-mark-button';

/** A quiet title and a few lines of context, shared by the rail and outline. */
export function TranscriptMessagePreview({
  preview,
  marked,
  pending,
  onMark,
}: {
  preview: Preview;
  marked: boolean;
  pending?: boolean;
  onMark?: (marked: boolean) => void | Promise<void>;
}) {
  return (
    <>
      <div className="flex items-start gap-2">
        <p
          className="min-w-0 flex-1 line-clamp-1 text-xs font-semibold leading-5"
          title={preview.title}
        >
          {preview.title}
        </p>
        {onMark ? (
          <MessageMarkButton
            className="-mr-1 -mt-0.5"
            marked={marked}
            pending={pending}
            onMark={onMark}
          />
        ) : null}
      </div>
      {preview.body ? (
        <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-5 text-muted-foreground">
          {preview.body}
        </p>
      ) : null}
    </>
  );
}
