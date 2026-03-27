import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/data')({
  component: () => (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight">Import / Export</h1>
      <p className="text-muted-foreground mt-2">GTFS export, bulk import, and data operations.</p>
    </div>
  ),
});
