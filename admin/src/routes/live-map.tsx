import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/live-map')({
  component: () => (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight">Live Map</h1>
      <p className="text-muted-foreground mt-2">Real-time bus positions and system monitoring.</p>
    </div>
  ),
});
