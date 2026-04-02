import type { ComponentProps } from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  primaryNavItems,
  managementNavItems,
  toolsNavItems,
  secondaryNavItems,
} from "@/lib/navigation"
import { useAuth } from "@/lib/auth"
import { BusFrontIcon } from "lucide-react"
import type { NavItem } from "@/lib/navigation"

// Map nav items to required permissions — items without a mapping are always shown
const navPermissions: Record<string, string> = {
  "Routes": "routes.view",
  "Stops": "stops.view",
  "Timetables": "timetables.view",
  "Route Builder": "map.edit_polyline",
  "Simulations": "simulations.view",
  "Import/Export": "data.export",
}

function filterByPermission(items: NavItem[], hasPermission: (p: string) => boolean): NavItem[] {
  return items.filter((item) => {
    const required = navPermissions[item.title]
    return !required || hasPermission(required)
  })
}

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const { hasPermission } = useAuth()

  const sections = [
    { items: filterByPermission(primaryNavItems, hasPermission) },
    { label: "Management", items: filterByPermission(managementNavItems, hasPermission) },
    { label: "Tools", items: filterByPermission(toolsNavItems, hasPermission) },
  ].filter((s) => s.items.length > 0)

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/">
                <BusFrontIcon className="size-5!" />
                <span className="text-base font-semibold">Mansariya Admin</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain sections={sections} />
        <SidebarSeparator className="mt-auto" />
        <NavSecondary items={secondaryNavItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
