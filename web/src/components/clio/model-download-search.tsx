import { useState } from 'react';
import { SearchIcon, CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, FieldLabel } from '@/components/ui/field';
import { buildModelFacets, hubTaskLabel, type FacetEntry } from '@/lib/model-facets';
import {
  matchesFilterTokens,
  modelFilterTokens,
  providerFilterToken,
} from '@/lib/model-filter-tokens';
import type { ModelCapabilityTag } from '@/lib/model-capability-tags';
import { ModelPickerSearch } from './model-picker-search';

interface RepositoryModel {
  repository: string;
  revision: string | null;
  task: string | null;
  gated: boolean | string;
  downloads: number | null;
}

/** Use the model picker's token field and facets with facts reported by the Hub. */
export function ModelDownloadSearch({
  query,
  onQuery,
  onSearch,
  models,
  selected,
  onSelect,
  searching,
  error,
}: {
  query: string;
  onQuery: (query: string) => void;
  onSearch: () => void;
  models?: RepositoryModel[];
  selected: string;
  onSelect: (model: RepositoryModel) => void;
  searching: boolean;
  error?: Error | null;
}) {
  const [tokens, setTokens] = useState<string[]>([]);
  const [facetsOpen, setFacetsOpen] = useState(false);
  const entries = (models ?? []).map((model): FacetEntry => {
    const organization = model.repository.split('/')[0];
    const tags: ModelCapabilityTag[] = model.task
      ? [
          {
            axis: 'task',
            value: model.task,
            hubTasks: [model.task],
            evidence: [{ source: 'hf_repo' }],
          },
        ]
      : [];
    const carried = modelFilterTokens(tags);
    carried.add(providerFilterToken(organization));
    return {
      providerId: organization,
      providerName: organization,
      tags,
      tokens: carried,
      facts: {},
      matchesText: true,
    };
  });
  const visible = (models ?? []).filter((_, index) =>
    matchesFilterTokens(entries[index].tokens, tokens),
  );
  const facets = buildModelFacets(entries, tokens)
    .filter((tab) => tab.chipCount > 0)
    .map((tab) => (tab.id === 'providers' ? { ...tab, label: 'Organizations' } : tab));
  return (
    <div
      className="space-y-3"
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape' && facetsOpen) {
          event.preventDefault();
          event.stopPropagation();
          setFacetsOpen(false);
        }
      }}
    >
      <Field>
        <FieldLabel htmlFor="model-search">Find on Hugging Face</FieldLabel>
        <div className="flex items-start gap-2">
          <ModelPickerSearch
            inputId="model-search"
            label="Find on Hugging Face"
            query={query}
            onQueryChange={onQuery}
            onSearch={onSearch}
            tokens={tokens}
            onTokensChange={setTokens}
            availableTokens={new Set(entries.flatMap((entry) => [...entry.tokens]))}
            shown={visible.length}
            total={models?.length ?? 0}
            facetTabs={facets}
            facetsOpen={facetsOpen}
            onFacetsOpenChange={setFacetsOpen}
          />
          <Button
            type="button"
            variant="outline"
            aria-label="Search models"
            disabled={!query.trim() || searching}
            onClick={() => {
              setFacetsOpen(false);
              onSearch();
            }}
          >
            <SearchIcon />
          </Button>
        </div>
      </Field>
      {searching ? (
        <p role="status" className="text-sm text-muted-foreground">
          Searching models…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
      {models ? (
        <div
          className="max-h-64 overflow-y-auto divide-y border-y"
          aria-label="Model search results"
        >
          {!visible.length ? (
            <p className="py-3 text-sm text-muted-foreground">
              No matching repositories. Adjust filters or enter an exact repository below.
            </p>
          ) : (
            visible.map((model) => (
              <button
                key={model.repository}
                type="button"
                aria-pressed={selected === model.repository}
                className="flex w-full items-center gap-3 px-2 py-3 text-left text-sm hover:bg-muted focus-visible:outline-ring"
                onClick={() => {
                  setFacetsOpen(false);
                  onSelect(model);
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{model.repository}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {model.task ? (
                      <Badge variant="secondary">{hubTaskLabel(model.task)}</Badge>
                    ) : null}
                    {model.gated ? <Badge variant="outline">Requires access</Badge> : null}
                    {model.downloads != null ? (
                      <span>{model.downloads.toLocaleString()} downloads</span>
                    ) : null}
                  </div>
                </div>
                {selected === model.repository ? (
                  <CheckIcon className="size-4 text-primary" aria-label="Selected" />
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
