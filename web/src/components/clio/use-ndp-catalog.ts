import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClioRepository, NDPDataset } from '@clio/core/v3';
import { useRepository } from '@/hooks/use-repository';
import { useConnectionSettings } from '@/providers/connection-provider';
import { connectionScope } from '@/lib/connection-scope';

type Catalog = Awaited<ReturnType<ClioRepository['searchNdp']>>;

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
  const groups = signedIn && onlyGroups;
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), query.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query]);
  const account = signedIn ? accountName || 'signed-in' : 'signed-out';
  const prefix = ['ndp-catalog', scope, account, groups] as const;
  const results = useQuery({
    queryKey: [...prefix, search],
    queryFn: ({ signal }) => repository.searchNdp({ query: search, only_groups: groups }, signal),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey.slice(0, 4).every((key, index) => key === prefix[index])
        ? previous
        : undefined,
    staleTime: 60_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const loaded = client.getQueryData<Catalog>([...prefix, '']);
  const data = results.data ?? loaded;
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
        text: ndpSearchText(
          [
            dataset.id,
            dataset.name,
            dataset.title,
            dataset.description,
            dataset.endpoint_name,
            ...dataset.resources.flatMap((resource) => [resource.name, resource.format]),
          ].join(' '),
        ),
      })) ?? [],
    [data, loaded],
  );
  const tokens = ndpSearchText(query).split(/\s+/).filter(Boolean);
  const authoritative =
    search === query.trim() && !results.isPlaceholderData && Boolean(results.data);
  const remote = new Set(
    results.data?.datasets.map((dataset) => JSON.stringify([dataset.endpoint_id, dataset.id])),
  );
  const datasets: NDPDataset[] = indexed
    .filter(
      (row) =>
        (authoritative && remote.has(JSON.stringify([row.dataset.endpoint_id, row.dataset.id]))) ||
        tokens.every((token) => row.text.includes(token)),
    )
    .map((row) => row.dataset);
  return {
    query,
    setQuery,
    onlyGroups: groups,
    setOnlyGroups,
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
