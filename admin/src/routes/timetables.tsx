import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/timetables')({
  component: () => (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight">Timetables</h1>
      <p className="text-muted-foreground mt-2">Manage departure schedules and fare rates.</p>
    </div>
  ),
});
