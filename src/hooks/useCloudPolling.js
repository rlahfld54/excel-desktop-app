import { useEffect, useRef, useState } from 'react';

import { cloudConfig, isSharedApiEnabled } from '../config/cloud';

export default function useCloudPolling(fetcher, {
  enabled = true,
  intervalMs = cloudConfig.pollingIntervalMs,
  immediate = true,
} = {}) {
  const fetcherRef = useRef(fetcher);
  const [state, setState] = useState({
    data: null,
    error: '',
    isLoading: false,
    lastSyncedAt: null,
  });

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    if (!enabled || !isSharedApiEnabled()) return undefined;

    let isMounted = true;
    let controller = null;

    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      setState((current) => ({ ...current, isLoading: true, error: '' }));

      const result = await fetcherRef.current({ signal: controller.signal });
      if (!isMounted) return;

      if (result?.ok === false) {
        setState((current) => ({
          ...current,
          isLoading: false,
          error: result.message ?? 'Shared data sync failed.',
        }));
        return;
      }

      setState({
        data: result?.data ?? result,
        error: '',
        isLoading: false,
        lastSyncedAt: new Date().toISOString(),
      });
    };

    if (immediate) load();
    const timer = window.setInterval(load, intervalMs);

    return () => {
      isMounted = false;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [enabled, immediate, intervalMs]);

  return state;
}
