import { useState, useRef, useEffect, useCallback } from 'react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTableToolbar } from './toolbar';
import { DataTablePagination } from './pagination';
import { DataTableFilterPanel } from './filter-panel';
import './types';

// Custom filter for boolean columns — handles string "true"/"false" vs actual boolean
const booleanFilter: FilterFn<unknown> = (row, columnId, filterValue) => {
  if (!filterValue || filterValue === '') return true;
  const cellValue = row.getValue(columnId);
  const expected = filterValue === 'true';
  return cellValue === expected;
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  isLoading?: boolean;
  pageSize?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder,
  isLoading = false,
  pageSize = 10,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });
  const [showFilters, setShowFilters] = useState(false);
  const [tableHeight, setTableHeight] = useState(600);
  const tableRef = useRef<HTMLDivElement>(null);

  // Assign boolean filterFn to columns that have boolean filterConfig
  const enhancedColumns = columns.map((col) => {
    if (col.meta?.filterConfig?.type === 'boolean' && !('filterFn' in col)) {
      return { ...col, filterFn: booleanFilter as FilterFn<TData> };
    }
    return col;
  });

  const table = useReactTable({
    data,
    columns: enhancedColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: 'includesString',
    enableRowSelection: true,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination,
    },
  });

  const hasFilterableColumns = table
    .getAllColumns()
    .some((col) => col.columnDef.meta?.filterConfig);

  // Measure table height for filter panel sync
  const measureHeight = useCallback(() => {
    if (tableRef.current) {
      setTableHeight(tableRef.current.offsetHeight);
    }
  }, []);

  useEffect(() => {
    measureHeight();
  }, [data, pagination, columnFilters, globalFilter, measureHeight]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-0">
      <DataTableToolbar
        table={table}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        searchPlaceholder={searchPlaceholder}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        hasFilters={hasFilterableColumns}
      />

      <div className="flex mx-4 lg:mx-6">
        {showFilters && hasFilterableColumns && (
          <div style={{ height: tableHeight > 0 ? tableHeight : undefined }}>
            <DataTableFilterPanel table={table} tableHeight={tableHeight} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div ref={tableRef} className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination table={table} />
        </div>
      </div>
    </div>
  );
}

export { DataTableColumnHeader } from './column-header';
export type { FilterConfig, FilterOption } from './types';
