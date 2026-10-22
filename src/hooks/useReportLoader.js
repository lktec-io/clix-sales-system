import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Runs an async report loader whenever `deps` (date range, filters) change,
// and on demand via `reload`. Loading is derived from whether the latest
// request has answered yet, so stale responses from a previous range are
// ignored and no state is set synchronously inside the effect.
export function useReportLoader(loader, deps) {
  const loaderRef = useRef(loader);
  useLayoutEffect(() => {
    loaderRef.current = loader;
  });

  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: false });
  const requestKey = `${deps.join('|')}#${nonce}`;

  useEffect(() => {
    let cancelled = false;
    loaderRef.current()
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, data, error: false });
      })
      .catch(() => {
        if (!cancelled) setResult((prev) => ({ key: requestKey, data: prev.data, error: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const loading = result.key !== requestKey;

  return { data: result.data, loading, error: !loading && result.error, reload };
}

export default useReportLoader;
