import { useRouterState } from '@tanstack/react-router';
import {
  LayoutDashboard,
  Route,
  MapPin,
  Clock,
  Users,
  Radar,
  ArrowDownToLine,
  Settings,
  Bus,
} from 'lucide-react';
import { NavMain } from '@/components/nav-main';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const mainNavItems = [
  { title: 'Dashboard', icon: <LayoutDashboard />, url: '/' },
  { title: 'Routes', icon: <Route />, url: '/routes' },
  { title: 'Stops', icon: <MapPin />, url: '/stops' },
  { title: 'Timetables', icon: <Clock />, url: '/timetables' },
  { title: 'Crowdsource', icon: <Users />, url: '/crowdsource' },
  { title: 'Live Map', icon: <Radar />, url: '/live-map' },
  { title: 'Import/Export', icon: <ArrowDownToLine />, url: '/data' },
];

const secondaryNavItems = [
  { title: 'Settings', icon: <Settings />, url: '/settings' },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const withActive = (items: typeof mainNavItems) =>
    items.map((item) => ({
      ...item,
      isActive:
        item.url === '/'
          ? currentPath === '/'
          : currentPath.startsWith(item.url),
    }));

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Bus className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Mansariya</span>
                <span className="truncate text-xs text-muted-foreground">
                  Admin Dashboard
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={withActive(mainNavItems)} />
        <NavSecondary
          items={withActive(secondaryNavItems)}
          className="mt-auto"
        />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
