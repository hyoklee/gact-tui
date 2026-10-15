import { useQuery } from '@tanstack/react-query';
import { ExternalLinkIcon } from 'lucide-react';
import { useRepository } from '@/hooks/use-repository';
import { useConnectionSettings } from '@/providers/connection-provider';
import { registryModelTags } from '@/lib/registry-model-tags';
import { displayedTags } from '@/lib/model-capability-tags';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink } from '@/components/ui/external-link';
import { ModelCapabilityTags } from './model-capability-tags';
import { MessageResponse } from '@/components/ai-elements/message';
import { defaultRemarkPlugins } from 'streamdown';
import { registryCardBody, registryCardLinks } from '@/lib/registry-model-markdown';

/** Model documentation and weight capabilities; loading a runtime remains a separate action. */
export function RegistryModelDetails({
  repository: modelId,
  compact = false,
}: {
  repository: string;
  compact?: boolean;
}) {
  const repository = useRepository();
  const { settings } = useConnectionSettings();
  const details = useQuery({
    queryKey: ['registry-model-details', settings.endpoint, modelId],
    queryFn: ({ signal }) => repository.modelRegistryDetails(modelId, signal),
    staleTime: 30 * 60_000,
    retry: false,
  });
  const model = details.data;
  const reasoningLabels: Record<string, string> = {
    none: 'No reasoning pattern detected in the chat template',
    always_on: 'Always on',
    on_off: 'Can be switched on or off',
    effort_levels: 'Selectable effort',
    token_budget: 'Token budget',
    budget_tokens: 'Token budget',
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {model ? <ModelCapabilityTags tags={displayedTags(registryModelTags(model))} /> : <span />}
        <Button asChild variant="ghost" size="sm">
          <ExternalLink href={model?.card_url ?? `https://huggingface.co/${modelId}`}>
            Hugging Face <ExternalLinkIcon />
          </ExternalLink>
        </Button>
      </div>
      {details.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Reading model details and capabilities...
        </p>
      ) : null}
      {details.error ? (
        <p role="alert" className="text-sm text-destructive">
          Model details could not load: {details.error.message}
        </p>
      ) : null}
      {model ? (
        <>
          <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">Reasoning</dt>
            <dd>
              {model.reasoning
                ? (reasoningLabels[model.reasoning.mechanism] ?? model.reasoning.mechanism)
                : 'Not reported'}
              {model.reasoning?.levels.length ? ` (${model.reasoning.levels.join(', ')})` : ''}
            </dd>
            <dt className="text-muted-foreground">Tool calling</dt>
            <dd>
              {model.native_tool_calling === null
                ? 'Not reported'
                : model.native_tool_calling
                  ? 'Tool-call template provided'
                  : 'No tool-call template detected'}
            </dd>
            <dt className="text-muted-foreground">Context</dt>
            <dd>
              {model.context_window
                ? `${model.context_window.toLocaleString()} tokens`
                : 'Not reported'}
            </dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            These describe the model weights. Available controls depend on the runtime used to serve
            them.
          </p>
          {model.hub_tags.length ? (
            <details>
              <summary className="cursor-pointer text-sm font-medium">All registry tags</summary>
              <div className="mt-3 flex flex-wrap gap-1">
                {model.hub_tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </details>
          ) : null}
          <details className="border-t pt-4" aria-label="Model card" open={!compact}>
            <summary className="mb-3 cursor-pointer text-sm font-semibold">Model card</summary>
            {model.card_markdown ? (
              <div className="pr-2">
                <MessageResponse
                  remarkPlugins={[
                    ...Object.values(defaultRemarkPlugins),
                    registryCardLinks(model.metadata_repository, model.revision),
                  ]}
                  components={{
                    a: ({ href, children }) =>
                      href?.startsWith('#') ? (
                        <a href={href}>{children}</a>
                      ) : href ? (
                        <ExternalLink href={href}>{children}</ExternalLink>
                      ) : (
                        <span>{children}</span>
                      ),
                  }}
                >
                  {registryCardBody(model.card_markdown)}
                </MessageResponse>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No readable model card was returned. Open Hugging Face to view it.
              </p>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Metadata: {model.metadata_repository} at {model.revision.slice(0, 12)}
            </p>
          </details>
        </>
      ) : null}
    </div>
  );
}
