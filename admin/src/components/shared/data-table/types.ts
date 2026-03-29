export type FilterType = 'text' | 'select' | 'boolean';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  type: FilterType;
  label: string;
  placeholder?: string;
  options?: FilterOption[];
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    filterConfig?: FilterConfig;
  }
}
