import type { CSSProperties } from "react"
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom"

import { AppSidebar } from "@/components/app-sidebar"
import { DashboardContent } from "@/components/dashboard-content"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { DataPage } from "@/pages/data"
import { LiveMapPage } from "@/pages/live-map"
import { RouteDetailPage } from "@/pages/route-detail"
import { RouteEditPage } from "@/pages/route-edit"
import { RouteNewPage } from "@/pages/route-new"
import { RoutesPage } from "@/pages/routes"
import { SettingsPage } from "@/pages/settings"
import { SimulationsPage } from "@/pages/simulations"
import { StopsPage } from "@/pages/stops"
import { TimetablesPage } from "@/pages/timetables"

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
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="@container/main flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function EmptyPage() {
  return <div className="flex-1" />
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<DashboardContent />} />
          <Route path="routes" element={<RoutesPage />} />
          <Route path="routes/new" element={<RouteNewPage />} />
          <Route path="routes/:routeId" element={<RouteDetailPage />} />
          <Route path="routes/:routeId/edit" element={<RouteEditPage />} />
          <Route path="stops" element={<StopsPage />} />
          <Route path="timetables" element={<TimetablesPage />} />
          <Route path="simulations" element={<SimulationsPage />} />
          <Route path="data" element={<DataPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="live-map" element={<LiveMapPage />} />
          <Route path="route-builder" element={<EmptyPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
