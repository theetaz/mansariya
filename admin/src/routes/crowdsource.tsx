import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/crowdsource')({
  component: () => (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight">Crowdsource</h1>
      <p className="text-muted-foreground mt-2">Review GPS traces, validate data, and monitor contributors.</p>
    </div>
  ),
});
