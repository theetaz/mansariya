import { useState, useRef, useEffect } from 'react';
import { RiMapPinLine, RiLoader4Line } from '@remixicon/react';
import { Input } from '@/components/ui/input';
import { geocodeSearch, type NominatimResult } from '@/lib/geo';

interface LocationAutocompleteProps {
  placeholder?: string;
  value?: NominatimResult | null;
  onSelect: (result: NominatimResult) => void;
  onClear?: () => void;
}

export function LocationAutocomplete({
  placeholder = 'Search location...',
  value,
  onSelect,
  onClear,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setSelectedDisplay(value.display_name);
      setQuery('');
    } else {
      setSelectedDisplay('');
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    setSelectedDisplay('');
    if (onClear) onClear();

    clearTimeout(debounceRef.current);
    if (val.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      const data = await geocodeSearch(val);
      setResults(data);
      setIsOpen(data.length > 0);
      setIsLoading(false);
    }, 300);
  };

  const handleSelect = (result: NominatimResult) => {
    setSelectedDisplay(result.display_name);
    setQuery('');
    setIsOpen(false);
    setResults([]);
    onSelect(result);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <RiMapPinLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={selectedDisplay || query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          className="pl-9 pr-8"
        />
        {isLoading && (
          <RiLoader4Line className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-64 overflow-auto">
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-start gap-2"
              onClick={() => handleSelect(r)}
            >
              <RiMapPinLine className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {r.display_name.split(',')[0]}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.display_name}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {parseFloat(r.lat).toFixed(5)}, {parseFloat(r.lon).toFixed(5)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
