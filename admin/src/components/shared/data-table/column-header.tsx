import type { Column } from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>
  title: string
  className?: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const isRightAligned = className?.includes("text-right")

  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>
  }

  return (
    <div className={cn(isRightAligned && "flex justify-end")}>
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-8", isRightAligned ? "-mr-3" : "-ml-3", className)}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <span>{title}</span>
        {column.getIsSorted() === "desc" ? (
          <ArrowDownIcon className="ml-1 size-3.5" />
        ) : column.getIsSorted() === "asc" ? (
          <ArrowUpIcon className="ml-1 size-3.5" />
        ) : (
          <ArrowUpDownIcon className="ml-1 size-3.5" />
        )}
      </Button>
    </div>
  )
}
