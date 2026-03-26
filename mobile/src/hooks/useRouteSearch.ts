import {useState, useCallback, useRef} from 'react';
import {searchRoutes, Route} from '../services/api';

/**
 * Debounced route search hook.
 */
export function useRouteSearch(debounceMs = 300) {
  const [results, setResults] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(
    (query: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      if (!query.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      timerRef.current = setTimeout(async () => {
        try {
          const data = await searchRoutes(query);
          setResults(data.results);
        } catch (e) {
          setError('Search failed');
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, debounceMs);
    },
    [debounceMs],
  );

  return {results, loading, error, search};
}
