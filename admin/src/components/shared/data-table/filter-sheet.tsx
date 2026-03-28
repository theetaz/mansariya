import type { Table } from '@tanstack/react-table';
import { RiFilterLine, RiCloseLine } from '@remixicon/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { FilterConfig } from './types';

interface DataTableFilterSheetProps<TData> {
  table: Table<TData>;
}

export function DataTableFilterSheet<TData>({ table }: DataTableFilterSheetProps<TData>) {
  const filterableColumns = table
    .getAllColumns()
    .filter((col) => col.columnDef.meta?.filterConfig);

  const activeFilterCount = filterableColumns.filter(
    (col) => col.getFilterValue() !== undefined && col.getFilterValue() !== '',
  ).length;

  const clearAllFilters = () => {
    filterableColumns.forEach((col) => col.setFilterValue(undefined));
  };

  if (filterableColumns.length === 0) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <RiFilterLine className="size-4" />
          <span className="hidden lg:inline">Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="size-5 rounded-full px-0 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 py-4">
          {filterableColumns.map((column) => {
            const config = column.columnDef.meta!.filterConfig!;
            return (
              <FilterControl
                key={column.id}
                config={config}
                value={column.getFilterValue() as string | undefined}
                onChange={(value) => column.setFilterValue(value || undefined)}
              />
            );
          })}
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="mt-2">
              <RiCloseLine className="size-4 mr-1" />
              Clear all filters
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FilterControl({
  config,
  value,
  onChange,
}: {
  config: FilterConfig;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  switch (config.type) {
    case 'text':
      return (
        <div className="flex flex-col gap-2">
          <Label className="text-sm">{config.label}</Label>
          <Input
            placeholder={config.placeholder ?? `Filter ${config.label.toLowerCase()}...`}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="h-9"
          />
        </div>
      );
    case 'select':
      return (
        <div className="flex flex-col gap-2">
          <Label className="text-sm">{config.label}</Label>
          <Select value={value ?? ''} onValueChange={(v) => onChange(v === '_all' ? '' : v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={`All ${config.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="_all">All</SelectItem>
                {config.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      );
    case 'boolean':
      return (
        <div className="flex flex-col gap-2">
          <Label className="text-sm">{config.label}</Label>
          <Select value={value ?? ''} onValueChange={(v) => onChange(v === '_all' ? '' : v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="_all">All</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      );
    default:
      return null;
  }
}
