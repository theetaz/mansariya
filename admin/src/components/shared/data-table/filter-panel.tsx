import { useState } from 'react';
import type { Table } from '@tanstack/react-table';
import { RiArrowUpSLine, RiSearchLine } from '@remixicon/react';
import { Input } from '@/components/ui/input';
import type { FilterConfig } from './types';

interface DataTableFilterPanelProps<TData> {
  table: Table<TData>;
}

export function DataTableFilterPanel<TData>({ table }: DataTableFilterPanelProps<TData>) {
  const filterableColumns = table
    .getAllColumns()
    .filter((col) => col.columnDef.meta?.filterConfig);

  if (filterableColumns.length === 0) return null;

  return (
    <div className="w-52 shrink-0 border rounded-lg mr-3 overflow-auto max-h-[600px]">
      <div className="px-3 py-2 border-b">
        <span className="text-sm font-semibold">Filters</span>
      </div>
      <div className="divide-y">
        {filterableColumns.map((column) => {
          const config = column.columnDef.meta!.filterConfig!;
          return (
            <FilterSection
              key={column.id}
              config={config}
              value={column.getFilterValue() as string | undefined}
              onChange={(value) => column.setFilterValue(value || undefined)}
            />
          );
        })}
      </div>
    </div>
  );
}

function FilterSection({
  config,
  value,
  onChange,
}: {
  config: FilterConfig;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      {/* Section header — collapsible */}
      <button
        type="button"
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        {config.label}
        <RiArrowUpSLine
          className={`size-4 text-muted-foreground transition-transform ${collapsed ? 'rotate-180' : ''}`}
        />
      </button>

      {!collapsed && (
        <div className="px-3 pb-3">
          {config.type === 'select' && config.options && (
            <RadioFilterList
              options={[{ label: 'All', value: '' }, ...config.options]}
              value={value ?? ''}
              onChange={onChange}
            />
          )}
          {config.type === 'boolean' && (
            <RadioFilterList
              options={[
                { label: 'All', value: '' },
                { label: 'Yes', value: 'true' },
                { label: 'No', value: 'false' },
              ]}
              value={value ?? ''}
              onChange={onChange}
            />
          )}
          {config.type === 'text' && (
            <div className="relative">
              <RiSearchLine className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder={config.placeholder ?? `Search ${config.label.toLowerCase()}...`}
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RadioFilterList({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors text-left ${
              isActive
                ? 'text-primary font-medium bg-primary/5'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
            onClick={() => onChange(opt.value)}
          >
            <span
              className={`size-3 rounded-full border-2 shrink-0 ${
                isActive ? 'border-primary bg-primary' : 'border-muted-foreground/40'
              }`}
            />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
