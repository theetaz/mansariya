import { Link, useLocation } from "react-router-dom"
import { ChevronRightIcon } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { allNavItems } from "@/lib/navigation"

function useBreadcrumbs() {
  const { pathname } = useLocation()
  const segments = pathname.split("/").filter(Boolean)

  // Find the top-level nav item
  const topItem = allNavItems.find((item) => {
    if (item.url === "/") return segments.length === 0
    return pathname === item.url || pathname.startsWith(`${item.url}/`)
  })

  if (!topItem || segments.length <= 1) {
    return [{ label: topItem?.title ?? "Dashboard", href: topItem?.url ?? "/" }]
  }

  const crumbs: { label: string; href: string }[] = [
    { label: topItem.title, href: topItem.url },
  ]

  // Build inner crumbs from remaining segments
  const innerSegments = segments.slice(1)
  for (let i = 0; i < innerSegments.length; i++) {
    const seg = innerSegments[i]
    const href = `/${segments.slice(0, i + 2).join("/")}`

    // Pretty labels
    if (seg === "new") {
      crumbs.push({ label: "New", href })
    } else if (seg === "edit") {
      crumbs.push({ label: "Edit", href })
    } else {
      crumbs.push({ label: seg, href })
    }
  }

  return crumbs
}

export function SiteHeader() {
  const crumbs = useBreadcrumbs()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <nav className="flex items-center gap-1 text-sm">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1
            return (
              <span key={crumb.href} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRightIcon className="size-3 text-muted-foreground" />
                )}
                {isLast ? (
                  <span className="font-medium">{crumb.label}</span>
                ) : (
                  <Link
                    to={crumb.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
