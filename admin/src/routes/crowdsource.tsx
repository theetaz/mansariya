import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Users, Activity, MapPin, Radio } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchActiveBuses, fetchMetrics } from '@/lib/api';

export const Route = createFileRoute('/crowdsource')({
  component: CrowdsourcePage,
});

function CrowdsourcePage() {
  const { data: busData, isLoading: busesLoading } = useQuery({
    queryKey: ['active-buses'],
    queryFn: fetchActiveBuses,
    refetchInterval: 10_000,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: fetchMetrics,
    refetchInterval: 15_000,
  });

  const buses = busData?.buses ?? [];
  const contributors = new Set(buses.map((b) => b.virtual_id)).size;
  const routesCovered = new Set(buses.map((b) => b.route_id)).size;

  return (
    <div className="px-4 py-4 lg:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Crowdsource Data</h1>
        <p className="text-muted-foreground mt-1">
          Review GPS traces, validate data, and monitor contributors.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Contributors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {busesLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{contributors}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Routes Covered</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {busesLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{routesCovered}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GPS Raw Stream</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{metrics?.stream_gps_raw ?? 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matched Stream</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{metrics?.stream_gps_matched ?? 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="buses">
        <TabsList>
          <TabsTrigger value="buses">Active Buses</TabsTrigger>
          <TabsTrigger value="traces">GPS Traces</TabsTrigger>
          <TabsTrigger value="discovered">Discovered Stops</TabsTrigger>
        </TabsList>

        <TabsContent value="buses" className="space-y-4">
          {busesLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : buses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active buses. Start the GPS simulator:</p>
                <code className="mt-2 text-sm bg-muted px-3 py-1 rounded">make simulate</code>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {buses.map((bus) => (
                <Card key={bus.virtual_id}>
                  <CardContent className="flex items-center justify-between py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono">
                        {bus.route_id}
                      </Badge>
                      <div>
                        <div className="text-sm font-medium">{bus.virtual_id}</div>
                        <div className="text-xs text-muted-foreground">
                          {bus.lat.toFixed(4)}, {bus.lng.toFixed(4)} · {bus.speed_kmh.toFixed(0)} km/h
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          bus.confidence === 'verified' ? 'default' :
                          bus.confidence === 'good' ? 'secondary' : 'outline'
                        }
                      >
                        {bus.confidence} ({bus.contributor_count})
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="traces">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">GPS trace viewer coming soon.</p>
              <p className="text-xs text-muted-foreground mt-1">Will show map-matched traces with route inference results.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discovered">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Discovered stops review queue coming soon.</p>
              <p className="text-xs text-muted-foreground mt-1">Stops found by DBSCAN dwell-point clustering will appear here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
