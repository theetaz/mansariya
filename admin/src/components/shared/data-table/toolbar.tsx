import type { Table } from '@tanstack/react-table';
import { RiLayoutColumnLine, RiFilterLine, RiSearchLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  searchPlaceholder?: string;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasFilters: boolean;
}

export function DataTableToolbar<TData>({
  table,
  globalFilter,
  onGlobalFilterChange,
  searchPlaceholder = 'Search...',
  showFilters,
  onToggleFilters,
  hasFilters,
}: DataTableToolbarProps<TData>) {
  return (
    <div className="flex items-center gap-2 px-4 lg:px-6 pb-3">
      {/* Full-width search */}
      <div className="relative flex-1">
        <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={(e) => onGlobalFilterChange(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Filters toggle */}
      {hasFilters && (
        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="sm"
          className="h-10 gap-1.5"
          onClick={onToggleFilters}
        >
          <RiFilterLine className="size-4" />
          Filters
        </Button>
      )}

      {/* Column visibility */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-10 gap-1.5">
            <RiLayoutColumnLine className="size-4" />
            Columns
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {table
            .getAllColumns()
            .filter((col) => typeof col.accessorFn !== 'undefined' && col.getCanHide())
            .map((col) => (
              <DropdownMenuCheckboxItem
                key={col.id}
                className="capitalize"
                checked={col.getIsVisible()}
                onCheckedChange={(value) => col.toggleVisibility(!!value)}
              >
                {col.id}
              </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
