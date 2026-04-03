import { NavLink, useLocation } from "react-router-dom"

import type { NavItem } from "@/lib/navigation"
import { isNavItemActive } from "@/lib/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

function NavSection({
  label,
  items,
  pathname,
}: {
  label?: string
  items: NavItem[]
  pathname: string
}) {
  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isNavItemActive(pathname, item.url)}
                  asChild
                >
                  <NavLink to={item.url} end={item.url === "/"}>
                    <Icon />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function NavMain({
  sections,
}: {
  sections: { label?: string; items: NavItem[] }[]
}) {
  const { pathname } = useLocation()

  return (
    <>
      {sections.map((section, i) => (
        <NavSection
          key={section.label ?? i}
          label={section.label}
          items={section.items}
          pathname={pathname}
        />
      ))}
    </>
  )
}
