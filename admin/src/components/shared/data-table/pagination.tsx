import type { Table } from "@tanstack/react-table"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

interface DataTablePaginationProps<TData> {
  table: Table<TData>
  /** For server-side mode: total row count from server */
  rowCount?: number
}

export function DataTablePagination<TData>({
  table,
  rowCount,
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination
  const totalRows = rowCount ?? table.getFilteredRowModel().rows.length
  const startRow = totalRows > 0 ? pageIndex * pageSize + 1 : 0
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRows)
  const pageCount = table.getPageCount()

  return (
    <div className="flex flex-col gap-3 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        {totalRows > 0
          ? `${startRow}-${endRow} of ${totalRows} results`
          : "0 results"}
      </span>

      <div className="flex flex-wrap items-center gap-1.5 sm:justify-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 rounded-full text-xs"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeftIcon className="size-4" />
          Previous
        </Button>

        <div className="hidden items-center gap-1 sm:flex">
          {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
            let pageNum: number
            if (pageCount <= 5) {
              pageNum = i
            } else if (pageIndex < 3) {
              pageNum = i
            } else if (pageIndex > pageCount - 4) {
              pageNum = pageCount - 5 + i
            } else {
              pageNum = pageIndex - 2 + i
            }
            return (
              <Button
                key={pageNum}
                variant={pageNum === pageIndex ? "default" : "ghost"}
                size="icon"
                className="size-8 rounded-full text-xs"
                onClick={() => table.setPageIndex(pageNum)}
              >
                {pageNum + 1}
              </Button>
            )
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 rounded-full text-xs"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      <span>
        Page {pageIndex + 1} of {pageCount || 1}
      </span>
    </div>
  )
}
