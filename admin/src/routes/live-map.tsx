import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/live-map')({
  component: LiveMapPage,
});

function LiveMapPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-semibold">Live Map</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time bus tracking and monitoring
        </p>
      </div>
    </div>
  );
}
