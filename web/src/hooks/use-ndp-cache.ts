import { useEffect, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { z } from 'zod';
import { readNdpCache, writeNdpCache } from '@/lib/ndp-cache';

/** Hydrate this metadata query before refreshing, and retain only successful network results. */
export function useNdpCache<T>(
  queryKey: QueryKey,
  schema: z.ZodType<T>,
  persistent = true,
): boolean {
  const client = useQueryClient();
  const key = JSON.stringify(queryKey);
  const [restored, setRestored] = useState('');
  const ready =
    !persistent ||
    typeof indexedDB === 'undefined' ||
    restored === key ||
    client.getQueryData(queryKey) !== undefined;
  useEffect(() => {
    if (!persistent) return;
    let cancelled = false;
    const queryKey: QueryKey = JSON.parse(key);
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (
        event.type !== 'updated' ||
        event.action.type !== 'success' ||
        event.action.manual ||
        JSON.stringify(event.query.queryKey) !== key
      )
        return;
      void writeNdpCache(key, event.query.state.data, event.query.state.dataUpdatedAt);
    });
    if (client.getQueryData(queryKey) !== undefined) return unsubscribe;
    void readNdpCache(key, schema).then((saved) => {
      if (cancelled) return;
      if (saved && client.getQueryData(queryKey) === undefined) {
        client.setQueryData(queryKey, saved.data, { updatedAt: saved.updatedAt });
      }
      setRestored(key);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [client, key, schema, persistent]);
  return ready;
}
