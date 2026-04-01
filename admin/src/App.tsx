import type { CSSProperties } from "react"
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom"

import { AppSidebar } from "@/components/app-sidebar"
import { DashboardContent } from "@/components/dashboard-content"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { allNavItems } from "@/lib/navigation"

const layoutStyle = {
  "--sidebar-width": "calc(var(--spacing) * 72)",
  "--header-height": "calc(var(--spacing) * 12)",
} as CSSProperties

function RootLayout() {
  return (
    <SidebarProvider style={layoutStyle}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function DashboardPage() {
  return <DashboardContent />
}

function EmptyPage() {
  return <div className="flex-1" />
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<DashboardPage />} />
          {allNavItems
            .filter((item) => item.url !== "/")
            .map((item) => (
              <Route
                key={item.url}
                path={item.url.slice(1)}
                element={<EmptyPage />}
              />
            ))}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
