import { useCallback, useEffect, useRef, useState } from "react";

import { describeError } from "../api/client";

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Runs an async task and tracks its state, ignoring results from calls that
 * have been superseded so a slow response cannot overwrite a newer one.
 */
export function useAsync<Args extends unknown[], T>(
  task: (...args: Args) => Promise<T>,
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null, error: null, loading: false,
  });

  const requestId = useRef(0);
  const mounted = useRef(true);

  // The body must re-arm the flag: StrictMode mounts, cleans up, then mounts
  // again, and a cleanup-only effect would leave this false forever.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback(
    async (...args: Args): Promise<T | null> => {
      const id = ++requestId.current;
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await task(...args);
        if (!mounted.current || id !== requestId.current) return null;
        setState({ data: result, error: null, loading: false });
        return result;
      } catch (error) {
        if (!mounted.current || id !== requestId.current) return null;
        setState({ data: null, error: describeError(error), loading: false });
        return null;
      }
    },
    [task],
  );

  const reset = useCallback(() => {
    requestId.current += 1;
    setState({ data: null, error: null, loading: false });
  }, []);

  return { ...state, run, reset };
}

/** Fetches once on mount; for the read-only catalog/analytics endpoints. */
export function useFetchOnMount<T>(task: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null, error: null, loading: true,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    task()
      .then((result) => {
        if (active) setState({ data: result, error: null, loading: false });
      })
      .catch((error) => {
        if (active) setState({ data: null, error: describeError(error), loading: false });
      });

    return () => { active = false; };
    // `task` is expected to be a stable module-level function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return { ...state, retry: () => setNonce((n) => n + 1) };
}

/** Debounces a value; used to keep slider drags from flooding the API. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
