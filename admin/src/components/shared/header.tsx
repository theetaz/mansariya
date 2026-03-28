import { useRouterState } from '@tanstack/react-router';
import { Moon, Sun, Monitor, Circle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useThemeStore } from '@/stores/useThemeStore';
import { fetchHealth } from '@/lib/api';

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
          <span className={i === segments.length - 1 ? 'font-medium capitalize' : 'text-muted-foreground capitalize'}>
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
      <Circle
        className={`h-2 w-2 fill-current ${isOnline ? 'text-green-500' : 'text-red-500'}`}
      />
      <span className="hidden sm:inline">{isOnline ? 'API Online' : 'API Offline'}</span>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  const icons = { light: Sun, dark: Moon, system: Monitor };
  const Icon = icons[theme];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
      >
        <Icon className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4" />
        <Breadcrumbs />
        <div className="ml-auto flex items-center gap-2">
          <ApiStatus />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
