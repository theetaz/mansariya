import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Settings,
  Server,
  Palette,
  Activity,
  Shield,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMetrics, type Metrics } from '@/lib/api';
import { useThemeStore } from '@/stores/useThemeStore';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useThemeStore();

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => fetchMetrics(),
    refetchInterval: 30_000,
    retry: 1,
  });

  const apiUrl = import.meta.env.VITE_API_URL || '(not set)';
  const apiKey = import.meta.env.VITE_API_KEY || '';
  const maskedKey = apiKey
    ? apiKey.slice(0, 4) + '****' + apiKey.slice(-4)
    : '(not set)';

  return (
    <div className="px-4 py-4 lg:px-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          API configuration, theme preferences, and system information
        </p>
      </div>

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            API Configuration
          </CardTitle>
          <CardDescription>
            Connection settings for the Mansariya backend. These are configured
            via environment variables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Base URL</Label>
            <Input
              value={apiUrl}
              readOnly
              className="font-mono text-sm bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Set via <code className="bg-muted px-1 rounded">VITE_API_URL</code> environment variable
            </p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              API Key
            </Label>
            <Input
              value={maskedKey}
              readOnly
              className="font-mono text-sm bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Set via <code className="bg-muted px-1 rounded">VITE_API_KEY</code> environment variable.
              Sent as <code className="bg-muted px-1 rounded">X-API-Key</code> header on admin endpoints.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </CardTitle>
          <CardDescription>
            Choose your preferred color scheme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <ThemeOption
              label="Light"
              icon={<Sun className="h-5 w-5" />}
              active={theme === 'light'}
              onClick={() => setTheme('light')}
            />
            <ThemeOption
              label="Dark"
              icon={<Moon className="h-5 w-5" />}
              active={theme === 'dark'}
              onClick={() => setTheme('dark')}
            />
            <ThemeOption
              label="System"
              icon={<Monitor className="h-5 w-5" />}
              active={theme === 'system'}
              onClick={() => setTheme('system')}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Current theme: <Badge variant="secondary">{theme}</Badge>
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            System Information
          </CardTitle>
          <CardDescription>
            Live backend metrics from <code className="bg-muted px-1 rounded">/api/v1/metrics</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metricsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          ) : metrics ? (
            <MetricsGrid metrics={metrics} />
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Settings className="mx-auto h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Unable to reach backend</p>
              <p className="text-xs mt-1">
                Make sure the API is running at {apiUrl}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* App Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <InfoRow label="Application" value="Mansariya Admin" />
          <InfoRow label="Version" value="0.1.0" />
          <InfoRow label="Frontend" value="React + Vite + TanStack" />
          <InfoRow label="Backend" value="Go + Chi + PostgreSQL + Redis" />
        </CardContent>
      </Card>
    </div>
  );
}

function ThemeOption({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      className="h-auto flex-col gap-2 py-4"
      onClick={onClick}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Button>
  );
}

function MetricsGrid({ metrics }: { metrics: Metrics }) {
  return (
    <div className="space-y-3">
      <InfoRow label="Uptime" value={metrics.uptime_human} />
      <InfoRow
        label="Memory (Alloc)"
        value={`${metrics.memory_alloc_mb.toFixed(1)} MB`}
      />
      <InfoRow
        label="Memory (Sys)"
        value={`${metrics.memory_sys_mb.toFixed(1)} MB`}
      />
      <InfoRow label="Goroutines" value={String(metrics.goroutines)} />
      <InfoRow label="GC Runs" value={String(metrics.gc_runs)} />
      <InfoRow label="Active Buses" value={String(metrics.active_buses)} />
      <InfoRow label="GPS Raw Stream" value={String(metrics.stream_gps_raw)} />
      <InfoRow
        label="GPS Matched Stream"
        value={String(metrics.stream_gps_matched)}
      />
      <InfoRow
        label="Redis"
        value={metrics.redis_connected ? 'Connected' : 'Disconnected'}
        status={metrics.redis_connected ? 'green' : 'red'}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: 'green' | 'red';
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          status === 'green'
            ? 'text-green-500 font-medium'
            : status === 'red'
              ? 'text-red-500 font-medium'
              : 'font-medium'
        }
      >
        {value}
      </span>
    </div>
  );
}
