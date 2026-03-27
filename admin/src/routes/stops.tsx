import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/stops')({
  component: () => (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight">Stops</h1>
      <p className="text-muted-foreground mt-2">Manage bus stops, map placement, and discovered stops.</p>
    </div>
  ),
});
