import { useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { RiCircleFill } from '@remixicon/react';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { fetchHealth } from '@/lib/api-functions';

function Breadcrumbs() {
  const routerState = useRouterState();
  const path = routerState.location.pathname;
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) {
    return <span className="text-sm font-medium">Dashboard</span>;
  }

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">Dashboard</span>
      {segments.map((segment, i) => (
        <span key={segment} className="flex items-center gap-1.5">
          <span className="text-muted-foreground">/</span>
          <span
            className={
              i === segments.length - 1
                ? 'font-medium capitalize'
                : 'text-muted-foreground capitalize'
            }
          >
            {segment.replace(/-/g, ' ')}
          </span>
        </span>
      ))}
    </div>
  );
}

function ApiStatus() {
  const { data, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 1,
  });

  const isOnline = !!data && !isError;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <RiCircleFill
        className={`size-2 ${isOnline ? 'text-green-500' : 'text-red-500'}`}
      />
      <span className="hidden sm:inline">
        {isOnline ? 'API Online' : 'API Offline'}
      </span>
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumbs />
        <div className="ml-auto flex items-center gap-2">
          <ApiStatus />
        </div>
      </div>
    </header>
  );
}
