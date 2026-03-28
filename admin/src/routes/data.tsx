import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState, useCallback } from 'react';
import {
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import api, { fetchRoutes, type Route as RouteType, type Stop } from '@/lib/api';

export const Route = createFileRoute('/data')({
  component: DataPage,
});

function DataPage() {
  const { data: routeData, isLoading: routesLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: () => fetchRoutes(),
    staleTime: 60_000,
  });

  const routes = routeData?.routes ?? [];
  const routeCount = routeData?.count ?? 0;

  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadBlob = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = async () => {
    setIsExporting('csv');
    try {
      const headers = [
        'ID', 'Name EN', 'Name SI', 'Name TA', 'Operator',
        'Service Type', 'Fare LKR', 'Active',
      ];
      const rows = routes.map((r: RouteType) => [
        r.id, r.name_en, r.name_si, r.name_ta, r.operator,
        r.service_type, String(r.fare_lkr), String(r.is_active),
      ]);
      const csv = [headers, ...rows]
        .map((row) => row.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
      downloadBlob(csv, 'mansariya-routes.csv', 'text/csv');
      toast.success(`Exported ${routes.length} routes as CSV`);
    } catch {
      toast.error('Failed to export CSV');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportJSON = async () => {
    setIsExporting('json');
    try {
      const json = JSON.stringify({ routes, count: routeCount }, null, 2);
      downloadBlob(json, 'mansariya-routes.json', 'application/json');
      toast.success(`Exported ${routes.length} routes as JSON`);
    } catch {
      toast.error('Failed to export JSON');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportGTFS = async () => {
    setIsExporting('gtfs');
    try {
      // Build a minimal GTFS-like export
      // agency.txt
      const agencyTxt = 'agency_id,agency_name,agency_url,agency_timezone\nmansariya,Mansariya,"https://mansariya.lk",Asia/Colombo\n';

      // routes.txt
      const routesHeader = 'route_id,agency_id,route_short_name,route_long_name,route_type\n';
      const routesRows = routes
        .map((r: RouteType) => `${r.id},mansariya,"${r.id}","${r.name_en ?? ''}",3`)
        .join('\n');

      // stops.txt (fetch stops for each route)
      const allStops: Stop[] = [];
      try {
        const stopsRes = await api.get<{ stops: Stop[]; count: number }>(
          '/api/v1/stops/nearby?lat=7.0&lng=80.0&radius_km=500'
        );
        allStops.push(...(stopsRes.data.stops ?? []));
      } catch {
        // Continue without stops
      }

      const stopsHeader = 'stop_id,stop_name,stop_lat,stop_lon\n';
      const stopsRows = allStops
        .map((s) => `${s.id},"${s.name_en ?? ''}",${s.location[0]},${s.location[1]}`)
        .join('\n');

      const gtfsContent = [
        '=== agency.txt ===',
        agencyTxt,
        '=== routes.txt ===',
        routesHeader + routesRows,
        '=== stops.txt ===',
        stopsHeader + stopsRows,
      ].join('\n\n');

      downloadBlob(gtfsContent, 'mansariya-gtfs.txt', 'text/plain');
      toast.success('Exported GTFS data');
    } catch {
      toast.error('Failed to export GTFS');
    } finally {
      setIsExporting(null);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadStatus('uploading');
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/api/v1/admin/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStatus('success');
      toast.success(`Imported "${file.name}" successfully`);
    } catch {
      setUploadStatus('error');
      toast.error(`Failed to import "${file.name}"`);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import / Export</h1>
        <p className="text-muted-foreground mt-1">
          Bulk data operations for routes, stops, and timetables
        </p>
      </div>

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Data
          </CardTitle>
          <CardDescription>
            Download route and stop data in various formats.
            {!routesLoading && (
              <Badge variant="secondary" className="ml-2">
                {routeCount} routes available
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {/* CSV Export */}
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">CSV</p>
                    <p className="text-xs text-muted-foreground">
                      Spreadsheet-compatible format
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    disabled={isExporting === 'csv' || routesLoading}
                    className="w-full"
                  >
                    {isExporting === 'csv' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Export CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* JSON Export */}
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <FileJson className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">JSON</p>
                    <p className="text-xs text-muted-foreground">
                      Structured data with all fields
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportJSON}
                    disabled={isExporting === 'json' || routesLoading}
                    className="w-full"
                  >
                    {isExporting === 'json' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Export JSON
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* GTFS Export */}
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">GTFS</p>
                    <p className="text-xs text-muted-foreground">
                      Transit feed specification
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportGTFS}
                    disabled={isExporting === 'gtfs' || routesLoading}
                    className="w-full"
                  >
                    {isExporting === 'gtfs' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Export GTFS
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import Data
          </CardTitle>
          <CardDescription>
            Upload CSV, JSON, or GTFS files to bulk-import routes and stops.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {uploadStatus === 'uploading' ? (
              <div className="space-y-3">
                <Loader2 className="mx-auto h-10 w-10 text-primary animate-spin" />
                <p className="text-sm font-medium">Uploading...</p>
              </div>
            ) : uploadStatus === 'success' ? (
              <div className="space-y-3">
                <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
                <p className="text-sm font-medium text-green-600">Import successful</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadStatus('idle')}
                >
                  Upload Another
                </Button>
              </div>
            ) : uploadStatus === 'error' ? (
              <div className="space-y-3">
                <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
                <p className="text-sm font-medium text-destructive">Import failed</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadStatus('idle')}
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    Drag and drop a file here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports CSV, JSON, and GTFS formats
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv,.json,.txt,.zip"
                  onChange={handleFileInputChange}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
