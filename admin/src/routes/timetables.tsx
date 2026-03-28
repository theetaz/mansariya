import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/timetables')({
  component: TimetablesPage,
});

function TimetablesPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-semibold">Timetables</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage departure schedules for bus routes
        </p>
      </div>
    </div>
  );
}
