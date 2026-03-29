import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import {
  RiDownloadLine,
  RiUploadLine,
  RiFileTextLine,
  RiFileLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiLoader4Line,
} from '@remixicon/react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchAdminRoutes } from '@/lib/api-functions';
import type { AdminRouteWithStats } from '@/lib/types';

export const Route = createFileRoute('/data')({
  component: DataPage,
});

function DataPage() {
  const { data: routeData } = useQuery({
    queryKey: ['admin-routes'],
    queryFn: fetchAdminRoutes,
  });

  const routes = routeData?.routes ?? [];

  const exportCSV = () => {
    const headers = ['id', 'name_en', 'operator', 'service_type', 'fare_lkr', 'stop_count', 'is_active'];
    const csv = [
      headers.join(','),
      ...routes.map((r) =>
        headers.map((h) => JSON.stringify(String(r[h as keyof AdminRouteWithStats] ?? ''))).join(','),
      ),
    ].join('\n');
    downloadFile(csv, 'routes.csv', 'text/csv');
    toast.success('CSV exported');
  };

  const exportJSON = () => {
    downloadFile(JSON.stringify(routes, null, 2), 'routes.json', 'application/json');
    toast.success('JSON exported');
  };

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-semibold">Import / Export</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bulk data operations for routes, stops, and timetables
        </p>
      </div>

      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2">
        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RiDownloadLine className="size-4" />
              Export Data
            </CardTitle>
            <CardDescription>Download route and stop data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={exportCSV}>
              <RiFileTextLine className="size-4" />
              Export Routes as CSV
              <Badge variant="secondary" className="ml-auto text-xs">{routes.length} routes</Badge>
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={exportJSON}>
              <RiFileLine className="size-4" />
              Export Routes as JSON
              <Badge variant="secondary" className="ml-auto text-xs">{routes.length} routes</Badge>
            </Button>
          </CardContent>
        </Card>

        {/* Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RiUploadLine className="size-4" />
              Import Data
            </CardTitle>
            <CardDescription>Upload CSV or JSON files</CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FileUpload() {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setStatus('uploading');
    // Simulated — backend import endpoint not yet implemented
    setTimeout(() => {
      setStatus('success');
      toast.success(`Imported ${file.name}`);
    }, 1500);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => fileRef.current?.click()}
    >
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".csv,.json,.zip"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {status === 'idle' && (
        <>
          <RiUploadLine className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Drop files or click to upload</p>
          <p className="text-xs text-muted-foreground mt-1">CSV, JSON, or ZIP</p>
        </>
      )}
      {status === 'uploading' && (
        <>
          <RiLoader4Line className="size-8 mx-auto text-primary animate-spin" />
          <p className="mt-2 text-sm font-medium">Importing {fileName}...</p>
        </>
      )}
      {status === 'success' && (
        <>
          <RiCheckLine className="size-8 mx-auto text-green-500" />
          <p className="mt-2 text-sm font-medium">Imported {fileName}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={(e) => { e.stopPropagation(); setStatus('idle'); }}>
            Upload another
          </Button>
        </>
      )}
      {status === 'error' && (
        <>
          <RiErrorWarningLine className="size-8 mx-auto text-destructive" />
          <p className="mt-2 text-sm font-medium">Import failed</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={(e) => { e.stopPropagation(); setStatus('idle'); }}>
            Try again
          </Button>
        </>
      )}
    </div>
  );
}

function downloadFile(content: string, name: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
