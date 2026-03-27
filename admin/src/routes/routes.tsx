import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/routes')({
  component: () => (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight">Routes</h1>
      <p className="text-muted-foreground mt-2">Manage bus routes, polylines, and stop assignments.</p>
    </div>
  ),
});
