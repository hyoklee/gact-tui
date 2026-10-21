import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { ndpSearchSchema, type ClioRepository, type NDPDataset } from '@clio/core/v3';
import { z } from 'zod';
import { useRepository } from '@/hooks/use-repository';
import { useNdpCache } from '@/hooks/use-ndp-cache';
import { useConnectionSettings } from '@/providers/connection-provider';
import { connectionScope } from '@/lib/connection-scope';
import type { NDPOrganizationChoice } from './ndp-organization-filter';

type Catalog = Awaited<ReturnType<ClioRepository['searchNdp']>>;
type Pages = InfiniteData<Catalog, number>;
const pagesSchema = z
  .object({
    pages: z.array(ndpSearchSchema).min(1),
    pageParams: z.array(z.number().int().nonnegative()),
  })
  .refine((data) => data.pages.length === data.pageParams.length);

function flatten(pages: Pages | undefined): Catalog | undefined {
  if (!pages) return undefined;
  return {
    datasets: pages.pages.flatMap((page) => page.datasets),
    warnings: [...new Set(pages.pages.flatMap((page) => page.warnings))],
    total: pages.pages[0]?.total,
    next_offset: pages.pages.at(-1)?.next_offset,
  };
}

/** Match fragments across human names, technical identifiers, descriptions and file metadata. */
export function ndpSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ');
}

/** Keep filtering immediate while a debounced catalog search discovers more matches. */
export function useNdpCatalog(signedIn: boolean, accountName = '') {
  const repository = useRepository();
  const { settings } = useConnectionSettings();
  const client = useQueryClient();
  const scope = connectionScope(settings);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [onlyGroups, setOnlyGroups] = useState(false);
  const [organization, setOrganization] = useState<NDPOrganizationChoice | null>(null);
  const groups = signedIn && onlyGroups;
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), query.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query]);
  const account = signedIn ? accountName || 'signed-in' : 'signed-out';
  const prefix = [
    'ndp-catalog',
    scope,
    'pages-v1',
    account,
    groups,
    organization?.endpoint_id ?? '',
    organization?.id ?? '',
  ] as const;
  const queryKey = [...prefix, search];
  const cacheEnabled = !signedIn || Boolean(accountName);
  const cacheReady = useNdpCache(queryKey, pagesSchema, cacheEnabled);
  const results = useInfiniteQuery<Catalog, Error, Pages, readonly unknown[], number>({
    queryKey,
    enabled: cacheReady,
    initialPageParam: 0,
    getNextPageParam: (last) => last.next_offset ?? undefined,
    queryFn: ({ signal, pageParam }) =>
      repository.searchNdp(
        {
          query: search,
          only_groups: groups,
          ...(pageParam ? { offset: pageParam } : {}),
          ...(organization
            ? { organization: organization.id, endpoint_id: organization.endpoint_id }
            : {}),
        },
        signal,
      ),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey.slice(0, prefix.length).every((key, index) => key === prefix[index])
        ? previous
        : undefined,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const loadedPages = client.getQueryData<Pages>([...prefix, '']);
  const loaded = useMemo(() => flatten(loadedPages), [loadedPages]);
  const remoteData = useMemo(() => flatten(results.data), [results.data]);
  const data = remoteData ?? loaded;
  const hasQuery = Boolean(query.trim());
  const indexed = useMemo(
    () =>
      [
        ...new Map(
          [...(loaded?.datasets ?? []), ...(data?.datasets ?? [])].map((dataset) => [
            JSON.stringify([dataset.endpoint_id, dataset.id]),
            dataset,
          ]),
        ).values(),
      ].map((dataset) => ({
        dataset,
        text: hasQuery
          ? ndpSearchText(
              [
                dataset.id,
                dataset.name,
                dataset.title,
                dataset.description,
                dataset.endpoint_name,
                dataset.organization,
                ...dataset.resources.flatMap((resource) => [resource.name, resource.format]),
              ].join(' '),
            )
          : '',
      })) ?? [],
    [data, loaded, hasQuery],
  );
  const tokens = ndpSearchText(query).split(/\s+/).filter(Boolean);
  const authoritative =
    search === query.trim() && !results.isPlaceholderData && Boolean(results.data);
  const remote = new Set(
    remoteData?.datasets.map((dataset) => JSON.stringify([dataset.endpoint_id, dataset.id])),
  );
  const datasets: NDPDataset[] = indexed
    .filter(
      (row) =>
        (authoritative && remote.has(JSON.stringify([row.dataset.endpoint_id, row.dataset.id]))) ||
        tokens.every((token) => row.text.includes(token)),
    )
    .map((row) => row.dataset);
  return {
    account,
    cacheEnabled,
    query,
    setQuery,
    onlyGroups: groups,
    setOnlyGroups,
    organization,
    setOrganization,
    datasets,
    results,
    data,
    searching: results.isFetching || search !== query.trim(),
    submit: () => {
      setSearch(query.trim());
      if (search === query.trim()) void results.refetch();
    },
  };
}
