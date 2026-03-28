import * as React from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import {
  RiDashboardLine,
  RiRouteLine,
  RiMapPinLine,
  RiTimeLine,
  RiLiveLine,
  RiDownloadLine,
  RiSettingsLine,
  RiBusLine,
} from '@remixicon/react';
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
  { title: 'Dashboard', icon: <RiDashboardLine />, url: '/' },
  { title: 'Routes', icon: <RiRouteLine />, url: '/routes' },
  { title: 'Stops', icon: <RiMapPinLine />, url: '/stops' },
  { title: 'Timetables', icon: <RiTimeLine />, url: '/timetables' },
  { title: 'Live Map', icon: <RiLiveLine />, url: '/live-map' },
  { title: 'Import/Export', icon: <RiDownloadLine />, url: '/data' },
];

const secondaryNavItems = [
  { title: 'Settings', icon: <RiSettingsLine />, url: '/settings' },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const withActive = <T extends { url: string }>(items: T[]) =>
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
              asChild
            >
              <Link to="/">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <RiBusLine className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Mansariya</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Admin Dashboard
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={withActive(mainNavItems)} />
        <NavSecondary items={withActive(secondaryNavItems)} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
