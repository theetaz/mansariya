import type { LucideIcon } from "lucide-react"
import {
  BusFrontIcon,
  CompassIcon,
  Clock3Icon,
  DownloadIcon,
  LayoutDashboardIcon,
  MapIcon,
  MapPinIcon,
  RouteIcon,
  Settings2Icon,
  PlayCircleIcon,
  UsersIcon,
  ShieldCheckIcon,
  ScrollTextIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
}

export type NavSection = {
  label: string
  items: NavItem[]
}

export const workspace = {
  name: "Mansariya",
  subtitle: "Admin Portal",
  icon: BusFrontIcon,
}

export const primaryNavItems: NavItem[] = [
  { title: "Dashboard", icon: LayoutDashboardIcon, url: "/" },
  { title: "Live Map", icon: MapIcon, url: "/live-map" },
]

export const managementNavItems: NavItem[] = [
  { title: "Routes", icon: RouteIcon, url: "/routes" },
  { title: "Stops", icon: MapPinIcon, url: "/stops" },
  { title: "Timetables", icon: Clock3Icon, url: "/timetables" },
]

export const toolsNavItems: NavItem[] = [
  { title: "Route Builder", icon: CompassIcon, url: "/route-builder" },
  { title: "Simulations", icon: PlayCircleIcon, url: "/simulations" },
  { title: "Import/Export", icon: DownloadIcon, url: "/data" },
]

export const adminNavItems: NavItem[] = [
  { title: "Users", icon: UsersIcon, url: "/users" },
  { title: "Roles", icon: ShieldCheckIcon, url: "/roles" },
  { title: "Audit Logs", icon: ScrollTextIcon, url: "/audit-logs" },
]

export const secondaryNavItems: NavItem[] = [
  { title: "Settings", icon: Settings2Icon, url: "/settings" },
]

export const allNavItems = [
  ...primaryNavItems,
  ...managementNavItems,
  ...toolsNavItems,
  ...adminNavItems,
  ...secondaryNavItems,
]

export function isNavItemActive(pathname: string, url: string) {
  if (url === "/") {
    return pathname === "/"
  }

  return pathname === url || pathname.startsWith(`${url}/`)
}

export function getPageTitle(pathname: string) {
  const matchedItem = [...allNavItems]
    .sort((left, right) => right.url.length - left.url.length)
    .find((item) => isNavItemActive(pathname, item.url))

  return matchedItem?.title ?? "Dashboard"
}
