import { useCallback, useEffect, useRef, useState } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Minimal data-loading hook: runs `fn` on mount and whenever `deps` change,
 * exposing loading/error state and a `reload` function.
 */
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const requestId = useRef(0);

  const load = useCallback(async (silent = false) => {
    const id = ++requestId.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (id === requestId.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (id === requestId.current) {
        setState((s) => ({ data: s.data, loading: false, error: err instanceof Error ? err.message : 'Something went wrong' }));
      }
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: load, setData: (data: T) => setState({ data, loading: false, error: null }) };
}
