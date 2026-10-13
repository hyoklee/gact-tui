import type { MessageResponseProps } from '@/components/ai-elements/message';
import { Source, Sources, SourcesContent, SourcesTrigger } from '@/components/ai-elements/sources';
import { groundedMessageSegments } from '@/lib/grounded-message-sources';
import { cn } from '@/lib/utils';
import { ContentMarkdown } from './content-markdown';

/** Render explicit source entries as AI Elements source objects in transcript order. */
export function GroundedMessageResponse({ children, className, ...options }: MessageResponseProps) {
  if (typeof children !== 'string') {
    return (
      <ContentMarkdown className={className} {...options}>
        {children}
      </ContentMarkdown>
    );
  }

  const segments = groundedMessageSegments(children);
  if (!segments.some((segment) => segment.kind === 'sources')) {
    return (
      <ContentMarkdown className={className} {...options}>
        {children}
      </ContentMarkdown>
    );
  }

  return (
    <div className={cn('flex size-full flex-col gap-3', className)}>
      {segments.map((segment, index) =>
        segment.kind === 'markdown' ? (
          <ContentMarkdown key={`markdown:${index}`} {...options}>
            {segment.text}
          </ContentMarkdown>
        ) : (
          <Sources className="mb-0" defaultOpen key={`sources:${index}`}>
            <SourcesTrigger count={segment.sources.length} />
            <SourcesContent>
              {segment.sources.map((source) => (
                <Source
                  description={source.description}
                  href={source.href}
                  key={source.href}
                  title={source.title}
                />
              ))}
            </SourcesContent>
          </Sources>
        ),
      )}
    </div>
  );
}
