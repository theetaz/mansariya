import { useState, useRef, useEffect, useCallback } from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type FilterFn,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  SearchIcon,
  SlidersHorizontalIcon,
  Columns3Icon,
  SearchXIcon,
  XCircleIcon,
  Loader2Icon,
} from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { DataTableFilterPanel } from "./filter-panel"
import { DataTablePagination } from "./pagination"
import "./types"

const booleanFilter: FilterFn<unknown> = (row, columnId, filterValue) => {
  if (!filterValue || filterValue === "") return true
  const cellValue = row.getValue(columnId)
  const expected = filterValue === "true"
  return cellValue === expected
}

// ── Server-side mode props ───────────────────────────────────────────────

interface ServerSideProps {
  /** Total row count from server (required for page count) */
  rowCount: number
  /** Controlled pagination state */
  pagination: PaginationState
  onPaginationChange: (pagination: PaginationState) => void
  /** Controlled sorting state */
  sorting: SortingState
  onSortingChange: (sorting: SortingState) => void
  /** Controlled global filter */
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
  /** Controlled column filters */
  columnFilters: ColumnFiltersState
  onColumnFiltersChange: (filters: ColumnFiltersState) => void
  /** Show a subtle loading indicator (not full skeleton) */
  isFetching?: boolean
}

// ── Props ────────────────────────────────────────────────────────────────

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchPlaceholder?: string
  isLoading?: boolean
  pageSize?: number
  /** Pass this to enable server-side mode. All filtering/sorting/pagination managed externally. */
  serverSide?: ServerSideProps
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder,
  isLoading = false,
  pageSize = 10,
  serverSide,
}: DataTableProps<TData, TValue>) {
  // Local state for client-side mode
  const [localSorting, setLocalSorting] = useState<SortingState>([])
  const [localColumnFilters, setLocalColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [localGlobalFilter, setLocalGlobalFilter] = useState("")
  const [localPagination, setLocalPagination] = useState({ pageIndex: 0, pageSize })
  const [showFilters, setShowFilters] = useState(false)
  const [tableHeight, setTableHeight] = useState(600)
  const tableRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  // Decide which state to use (server-side vs client-side)
  const isServerSide = !!serverSide
  const sorting = isServerSide ? serverSide.sorting : localSorting
  const columnFilters = isServerSide ? serverSide.columnFilters : localColumnFilters
  const globalFilter = isServerSide ? serverSide.globalFilter : localGlobalFilter
  const pagination = isServerSide ? serverSide.pagination : localPagination

  const enhancedColumns = columns.map((col) => {
    if (col.meta?.filterConfig?.type === "boolean" && !("filterFn" in col)) {
      return { ...col, filterFn: booleanFilter as FilterFn<TData> }
    }
    return col
  })

  const table = useReactTable({
    data,
    columns: enhancedColumns,
    ...(isServerSide
      ? {
          // Server-side: manual everything
          pageCount: Math.ceil(serverSide.rowCount / pagination.pageSize),
          manualPagination: true,
          manualSorting: true,
          manualFiltering: true,
          getCoreRowModel: getCoreRowModel(),
        }
      : {
          // Client-side: all computed locally
          getCoreRowModel: getCoreRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
          getSortedRowModel: getSortedRowModel(),
          getFilteredRowModel: getFilteredRowModel(),
          globalFilterFn: "includesString",
        }),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater
      if (isServerSide) {
        serverSide.onSortingChange(next)
        serverSide.onPaginationChange({ ...pagination, pageIndex: 0 })
      } else {
        setLocalSorting(next)
      }
    },
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnFilters) : updater
      if (isServerSide) {
        serverSide.onColumnFiltersChange(next)
        serverSide.onPaginationChange({ ...pagination, pageIndex: 0 })
      } else {
        setLocalColumnFilters(next)
      }
    },
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: (updater) => {
      const next = typeof updater === "function" ? updater(globalFilter) : updater
      if (isServerSide) {
        serverSide.onGlobalFilterChange(next)
        serverSide.onPaginationChange({ ...pagination, pageIndex: 0 })
      } else {
        setLocalGlobalFilter(next)
      }
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater(pagination) : updater
      if (isServerSide) {
        serverSide.onPaginationChange(next)
      } else {
        setLocalPagination(next)
      }
    },
  })

  const hasFilterableColumns = table
    .getAllColumns()
    .some((col) => col.columnDef.meta?.filterConfig)
  const activeFilterCount = table.getState().columnFilters.length

  const measureHeight = useCallback(() => {
    if (tableRef.current) {
      setTableHeight(tableRef.current.offsetHeight)
    }
  }, [])

  useEffect(() => {
    measureHeight()
  }, [data, pagination, columnFilters, globalFilter, measureHeight])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  // Minimum table height: only enforce when client-side (to prevent layout jump during filter)
  // Server-side tables should fit their content naturally
  const displayPageSize = pagination.pageSize
  const minTableHeight = isServerSide ? 0 : 41 + displayPageSize * 49

  return (
    <div className="flex w-full flex-col gap-0">
      {/* Toolbar — single row: search left, buttons right */}
      <div className="flex items-center gap-3 px-4 pb-3 lg:px-6">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder ?? "Search..."}
            value={globalFilter}
            onChange={(e) => {
              if (isServerSide) {
                serverSide.onGlobalFilterChange(e.target.value)
                serverSide.onPaginationChange({ ...pagination, pageIndex: 0 })
              } else {
                setLocalGlobalFilter(e.target.value)
              }
            }}
            className="h-9 rounded-xl bg-card pl-10 shadow-sm"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasFilterableColumns && (
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              className="h-9 rounded-full"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontalIcon className="mr-1 size-3.5" />
              Filters
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
          )}
          {(activeFilterCount > 0 || globalFilter) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-full text-muted-foreground"
              onClick={() => {
                table.resetColumnFilters()
                if (isServerSide) {
                  serverSide.onGlobalFilterChange("")
                  serverSide.onColumnFiltersChange([])
                  serverSide.onPaginationChange({ ...pagination, pageIndex: 0 })
                } else {
                  setLocalGlobalFilter("")
                }
              }}
            >
              <XCircleIcon className="mr-1 size-3.5" />
              Clear
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 rounded-full">
                <Columns3Icon className="mr-1 size-3.5" />
                <span className="hidden sm:inline">Columns</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {table
                .getAllColumns()
                .filter(
                  (col) =>
                    typeof col.accessorFn !== "undefined" && col.getCanHide()
                )
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
          {isServerSide && serverSide.isFetching && (
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Table + filter panel */}
      <div className="mx-4 flex min-w-0 gap-4 lg:mx-6">
        {!isMobile && showFilters && hasFilterableColumns && (
          <ScrollArea
            className="w-64 shrink-0"
            style={{ height: tableHeight > 0 ? tableHeight : minTableHeight }}
          >
            <DataTableFilterPanel table={table} />
          </ScrollArea>
        )}

        <div className="min-w-0 flex-1">
          <div
            ref={tableRef}
            className="overflow-hidden rounded-xl border bg-card shadow-sm"
            style={{ minHeight: minTableHeight }}
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/60">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-full"
                      >
                        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                          <SearchXIcon className="size-10 opacity-30" />
                          <p className="text-sm font-medium">
                            No matching results
                          </p>
                          <p className="text-xs">
                            Try adjusting your search or filter criteria
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DataTablePagination table={table} rowCount={isServerSide ? serverSide.rowCount : undefined} />
        </div>
      </div>

      {/* Mobile filter sheet */}
      {isMobile && hasFilterableColumns && (
        <Sheet open={showFilters} onOpenChange={setShowFilters}>
          <SheetContent side="bottom" className="h-[85svh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Filter rows</SheetTitle>
              <SheetDescription>
                Narrow the dataset without losing the table context.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 min-h-0 overflow-y-auto">
              <DataTableFilterPanel table={table} />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

export { DataTableColumnHeader } from "./column-header"
export type { FilterConfig, FilterOption } from "./types"
