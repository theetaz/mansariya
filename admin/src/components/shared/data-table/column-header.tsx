import type { Column } from '@tanstack/react-table';
import { RiArrowUpLine, RiArrowDownLine, RiArrowUpDownLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('-ml-3 h-8', className)}
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      <span>{title}</span>
      {column.getIsSorted() === 'desc' ? (
        <RiArrowDownLine className="ml-1 size-3.5" />
      ) : column.getIsSorted() === 'asc' ? (
        <RiArrowUpLine className="ml-1 size-3.5" />
      ) : (
        <RiArrowUpDownLine className="ml-1 size-3.5" />
      )}
    </Button>
  );
}
