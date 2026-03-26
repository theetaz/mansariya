import {useState, useCallback, useRef} from 'react';
import {searchRoutes, Route} from '../services/api';
import {searchRoutesOffline} from '../services/offlineDb';

/**
 * Debounced route search hook.
 * Tries online API first, falls back to offline op-sqlite search.
 */
export function useRouteSearch(debounceMs = 300) {
  const [results, setResults] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(
    (query: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      if (!query.trim()) {
        setResults([]);
        setLoading(false);
        setIsOffline(false);
        return;
      }

      setLoading(true);
      setError(null);

      timerRef.current = setTimeout(async () => {
        try {
          // Try online API first
          const data = await searchRoutes(query);
          setResults(data.results);
          setIsOffline(false);
        } catch {
          // Fall back to offline search
          try {
            const offlineResults = await searchRoutesOffline(query);
            const mapped: Route[] = offlineResults.map((r: any) => ({
              id: r.id,
              name_en: r.name_en,
              name_si: r.name_si ?? '',
              name_ta: r.name_ta ?? '',
              operator: r.operator,
              service_type: r.service_type,
              fare_lkr: r.fare_lkr,
              frequency_minutes: r.frequency_minutes,
              is_active: true,
            }));
            setResults(mapped);
            setIsOffline(true);
          } catch {
            setResults([]);
            setError('Search failed');
          }
        } finally {
          setLoading(false);
        }
      }, debounceMs);
    },
    [debounceMs],
  );

  return {results, loading, error, isOffline, search};
}
