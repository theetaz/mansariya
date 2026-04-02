import type { CSSProperties } from "react"
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom"
import { Loader2Icon } from "lucide-react"

import { useAuth } from "@/lib/auth"
import { Toaster } from "@/components/ui/sonner"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardContent } from "@/components/dashboard-content"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { DataPage } from "@/pages/data"
import { LoginPage } from "@/pages/login"
import { RouteBuilderPage } from "@/pages/route-builder"
import { LiveMapPage } from "@/pages/live-map"
import { RouteDetailPage } from "@/pages/route-detail"
import { RouteEditPage } from "@/pages/route-edit"
import { RouteNewPage } from "@/pages/route-new"
import { RoutesPage } from "@/pages/routes"
import { SettingsPage } from "@/pages/settings"
import { SimulationsPage } from "@/pages/simulations"
import { StopsPage } from "@/pages/stops"
import { TimetablesPage } from "@/pages/timetables"
import { UsersPage } from "@/pages/users"
import { RolesPage } from "@/pages/roles"
import { AuditLogsPage } from "@/pages/audit-logs"

const layoutStyle = {
  "--sidebar-width": "calc(var(--spacing) * 72)",
  "--header-height": "calc(var(--spacing) * 12)",
} as CSSProperties

function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

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

function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
      <Routes>
        {/* Public routes */}
        <Route element={<PublicRoute />}>
          <Route path="login" element={<LoginPage />} />
        </Route>

        {/* Protected routes */}
        <Route element={<ProtectedLayout />}>
          <Route index element={<DashboardContent />} />
          <Route path="routes" element={<RoutesPage />} />
          <Route path="routes/new" element={<RouteNewPage />} />
          <Route path="routes/:routeId" element={<RouteDetailPage />} />
          <Route path="routes/:routeId/edit" element={<RouteEditPage />} />
          <Route path="stops" element={<StopsPage />} />
          <Route path="timetables" element={<TimetablesPage />} />
          <Route path="simulations" element={<SimulationsPage />} />
          <Route path="data" element={<DataPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="live-map" element={<LiveMapPage />} />
          <Route path="route-builder" element={<RouteBuilderPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
