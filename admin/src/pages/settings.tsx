import {
  Activity,
  Globe,
  Info,
  KeyRound,
  Link2,
  Monitor,
  Moon,
  Palette,
  Sun,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { useTheme } from "@/components/theme-provider"
import { fetchHealth, type HealthResponse } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

/* ── helpers ─────────────────────────────────────────────────────────── */

const apiUrl = import.meta.env.VITE_API_URL || "(using proxy)"
const apiKey = import.meta.env.VITE_API_KEY || ""

function maskKey(key: string): string {
  if (!key) return "(not set)"
  if (key.length <= 8) return "****"
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}

function deriveWsUrl(url: string): string {
  if (url === "(using proxy)") return "(using proxy)"
  return url.replace(/^http/, "ws")
}

/* ── component ───────────────────────────────────────────────────────── */

export function SettingsPage() {
  const { theme, setTheme } = useTheme()

  const healthQuery = useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 1,
  })

  const backendOnline = healthQuery.data?.status === "ok"

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-4 md:px-6 md:py-6">
      {/* ── page header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Environment, appearance, and workspace information.
          </p>
        </div>

        <Badge
          variant={
            healthQuery.isLoading
              ? "outline"
              : backendOnline
                ? "default"
                : "destructive"
          }
          className="w-fit"
        >
          <Activity className="size-3" />
          {healthQuery.isLoading
            ? "Checking..."
            : backendOnline
              ? "Backend online"
              : "Backend offline"}
        </Badge>
      </div>

      {/* ── two-column grid ──────────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        {/* left: environment connectivity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="size-4 text-muted-foreground" />
              Environment Connectivity
            </CardTitle>
            <CardDescription>
              API endpoints and credentials configured for this workspace.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            {/* API URL */}
            <div className="grid gap-1.5">
              <Label htmlFor="api-url" className="flex items-center gap-1.5">
                <Link2 className="size-3.5 text-muted-foreground" />
                API URL
              </Label>
              <Input id="api-url" value={apiUrl} readOnly />
            </div>

            {/* API Key */}
            <div className="grid gap-1.5">
              <Label htmlFor="api-key" className="flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-muted-foreground" />
                API Key
              </Label>
              <Input
                id="api-key"
                value={maskKey(apiKey)}
                readOnly
                className="font-mono text-muted-foreground"
              />
            </div>

            {/* WebSocket URL */}
            <div className="grid gap-1.5">
              <Label htmlFor="ws-url" className="flex items-center gap-1.5">
                <Activity className="size-3.5 text-muted-foreground" />
                WebSocket URL
              </Label>
              <Input id="ws-url" value={deriveWsUrl(apiUrl)} readOnly />
            </div>

            <Separator />

            {/* Backend status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Backend status</span>
              <Badge
                variant={
                  healthQuery.isLoading
                    ? "outline"
                    : backendOnline
                      ? "default"
                      : "destructive"
                }
              >
                {healthQuery.isLoading
                  ? "Checking..."
                  : backendOnline
                    ? "Connected"
                    : "Unreachable"}
              </Badge>
            </div>

            {/* Theme shortcut */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Theme shortcut</span>
              <span className="rounded-md border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                D
              </span>
            </div>
          </CardContent>
        </Card>

        {/* right: appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-4 text-muted-foreground" />
              Appearance
            </CardTitle>
            <CardDescription>
              Choose between light, dark, or system theme.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            <Label>Theme</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={theme}
              onValueChange={(value) => {
                if (value) setTheme(value as "light" | "dark" | "system")
              }}
              className="w-full"
            >
              <ToggleGroupItem value="light" className="flex-1 gap-1.5">
                <Sun className="size-4" />
                Light
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" className="flex-1 gap-1.5">
                <Moon className="size-4" />
                Dark
              </ToggleGroupItem>
              <ToggleGroupItem value="system" className="flex-1 gap-1.5">
                <Monitor className="size-4" />
                System
              </ToggleGroupItem>
            </ToggleGroup>

            <p className="text-xs text-muted-foreground">
              Press <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">D</kbd> anywhere to
              toggle between light and dark mode.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── about card ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="size-4 text-muted-foreground" />
            About This Workspace
          </CardTitle>
          <CardDescription>
            Application metadata and technology stack.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["Application", "Mansariya Admin Portal"],
                ["Version", "2.0.0"],
                ["UI preset", "shadcn/ui radix-vega"],
                ["Frontend", "React 19 + Vite + TanStack Query"],
                ["Backend", "Go + Chi + PostgreSQL + Redis"],
                ["Live transport", "REST + WebSocket streaming"],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="grid gap-0.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {label}
                </span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
