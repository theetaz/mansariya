import type { Table } from '@tanstack/react-table';
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({ table }: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;
  const startRow = pageIndex * pageSize + 1;
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRows);
  const pageCount = table.getPageCount();

  return (
    <div className="flex items-center justify-between py-3 text-sm text-muted-foreground">
      {/* Left: results count */}
      <span>
        {totalRows > 0 ? `${startRow}-${endRow} of ${totalRows} results` : '0 results'}
      </span>

      {/* Center: page buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <RiArrowLeftSLine className="size-4" />
          Previous
        </Button>

        {/* Page number buttons */}
        {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
          let pageNum: number;
          if (pageCount <= 5) {
            pageNum = i;
          } else if (pageIndex < 3) {
            pageNum = i;
          } else if (pageIndex > pageCount - 4) {
            pageNum = pageCount - 5 + i;
          } else {
            pageNum = pageIndex - 2 + i;
          }
          return (
            <Button
              key={pageNum}
              variant={pageNum === pageIndex ? 'default' : 'ghost'}
              size="icon"
              className="size-8 text-xs"
              onClick={() => table.setPageIndex(pageNum)}
            >
              {pageNum + 1}
            </Button>
          );
        })}

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
          <RiArrowRightSLine className="size-4" />
        </Button>
      </div>

      {/* Right: page info */}
      <span>
        Page {pageIndex + 1} of {pageCount || 1}
      </span>
    </div>
  );
}
