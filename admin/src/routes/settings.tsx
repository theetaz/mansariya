import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { RiSettings3Line, RiPaletteLine, RiServerLine } from '@remixicon/react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useTheme } from '@/components/theme-provider';
import { fetchHealth } from '@/lib/api-functions';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const apiUrl = import.meta.env.VITE_API_URL || '(using proxy)';
  const apiKey = import.meta.env.VITE_API_KEY || '';
  const maskedKey = apiKey ? apiKey.slice(0, 4) + '****' + apiKey.slice(-4) : '(not set)';

  const { data: health, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 1,
  });

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 max-w-3xl">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          API configuration, theme preferences, and system information
        </p>
      </div>

      <div className="flex flex-col gap-4 px-4 lg:px-6">
        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RiSettings3Line className="size-4" />
              API Configuration
            </CardTitle>
            <CardDescription>Backend connection settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label>API URL</Label>
              <Input value={apiUrl} readOnly className="bg-muted" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>API Key</Label>
              <Input value={maskedKey} readOnly className="bg-muted font-mono" />
            </div>
            <div className="flex items-center gap-2">
              <Label>Status</Label>
              {isLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                <Badge variant={health?.status === 'ok' ? 'default' : 'destructive'}>
                  {health?.status === 'ok' ? 'Connected' : 'Unreachable'}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Theme */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RiPaletteLine className="size-4" />
              Appearance
            </CardTitle>
            <CardDescription>Theme and display preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Label>Theme</Label>
              <div className="flex gap-2">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                      theme === t
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:bg-muted'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Press <kbd className="px-1 py-0.5 border rounded text-xs">D</kbd> to toggle dark mode
              </p>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RiServerLine className="size-4" />
              About
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Application" value="Mansariya Admin Dashboard" />
            <InfoRow label="Version" value="2.0.0" />
            <Separator />
            <InfoRow label="Frontend" value="React 19 + Vite + TanStack" />
            <InfoRow label="UI" value="shadcn/ui (radix-maia preset)" />
            <InfoRow label="Backend" value="Go + Chi + PostgreSQL + Redis" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
