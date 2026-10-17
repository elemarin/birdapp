import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export function useHistoryQuery<T>(query: (offset: number) => Promise<T[]>, pageSize: number) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const count = useRef(0);
  const generation = useRef(0);
  const locked = useRef(false);
  const load = useCallback(async (reset: boolean) => {
    if (locked.current && !reset) return;
    const token = reset ? ++generation.current : generation.current;
    locked.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await query(reset ? 0 : count.current);
      if (token !== generation.current) return;
      count.current = (reset ? 0 : count.current) + result.length;
      setRows(old => reset ? result : [...old, ...result]);
      setHasMore(result.length === pageSize);
    } catch (e) {
      if (token === generation.current) {
        console.warn('History query failed', e);
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (token === generation.current) { locked.current = false; setLoading(false); }
    }
  }, [pageSize, query]);
  useFocusEffect(useCallback(() => {
    void load(true);
    return () => { generation.current++; locked.current = false; };
  }, [load]));
  return { rows, error, loading, hasMore, retry: () => { void load(true); }, more: () => { void load(false); } };
}
