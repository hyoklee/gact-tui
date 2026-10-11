import { BookmarkIcon, LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A saved navigation mark; it does not change or submit conversation content. */
export function MessageMarkButton({
  marked,
  pending,
  onMark,
  className,
}: {
  marked: boolean;
  pending?: boolean;
  onMark: (marked: boolean) => void | Promise<void>;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);
  const label = marked ? 'Unmark message' : 'Mark message';
  return (
    <Button
      aria-label={label}
      aria-pressed={marked}
      className={cn(
        'size-6 shrink-0 text-muted-foreground',
        marked && 'text-foreground',
        className,
      )}
      disabled={pending || saving}
      onClick={() => {
        setSaving(true);
        void Promise.resolve()
          .then(() => onMark(!marked))
          .catch(() => {
            // The mutation reports the service error; keep the saved state unchanged.
          })
          .finally(() => setSaving(false));
      }}
      size="icon-xs"
      title={label}
      type="button"
      variant="ghost"
    >
      {saving ? (
        <LoaderCircleIcon aria-hidden="true" className="size-3.5 animate-spin" />
      ) : (
        <BookmarkIcon
          aria-hidden="true"
          className="size-3.5"
          fill={marked ? 'currentColor' : 'none'}
        />
      )}
    </Button>
  );
}
