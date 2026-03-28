import { Link, useRouterState } from '@tanstack/react-router';
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
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { title: 'Routes', icon: Route, href: '/routes' },
  { title: 'Stops', icon: MapPin, href: '/stops' },
  { title: 'Timetables', icon: Clock, href: '/timetables' },
  { title: 'Crowdsource', icon: Users, href: '/crowdsource' },
  { title: 'Live Map', icon: Radar, href: '/live-map' },
  { title: 'Import/Export', icon: ArrowDownToLine, href: '/data' },
  { title: 'Settings', icon: Settings, href: '/settings' },
];

export function AppSidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bus className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Mansariya</span>
            <span className="text-xs text-muted-foreground">Admin Dashboard</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === '/'
                    ? currentPath === '/'
                    : currentPath.startsWith(item.href);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link to={item.href} />}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-3 py-2 text-xs text-muted-foreground">
          v1.0.0 — Mansariya
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
