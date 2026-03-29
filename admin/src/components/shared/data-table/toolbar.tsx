import type { Table } from '@tanstack/react-table';
import { RiLayoutColumnLine, RiArrowDownSLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTableFilterSheet } from './filter-sheet';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  searchPlaceholder?: string;
}

export function DataTableToolbar<TData>({
  table,
  globalFilter,
  onGlobalFilterChange,
  searchPlaceholder = 'Search...',
}: DataTableToolbarProps<TData>) {
  return (
    <div className="flex items-center gap-3 px-4 lg:px-6">
      <Input
        placeholder={searchPlaceholder}
        value={globalFilter}
        onChange={(e) => onGlobalFilterChange(e.target.value)}
        className="max-w-xs h-9"
      />
      <DataTableFilterSheet table={table} />
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-sm text-muted-foreground lg:inline">
          {table.getFilteredRowModel().rows.length} results
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <RiLayoutColumnLine className="size-4" />
              <span className="hidden lg:inline">Columns</span>
              <RiArrowDownSLine className="size-4" />
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
    </div>
  );
}
