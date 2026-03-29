import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { RiAlertLine } from '@remixicon/react';
import { fetchSimulationActiveStats } from '@/lib/api-functions';

export function SimulationBanner() {
  const { data } = useQuery({
    queryKey: ['simulation-active'],
    queryFn: fetchSimulationActiveStats,
    refetchInterval: 5000,
  });

  if (!data || data.running_jobs === 0) return null;

  return (
    <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm dark:bg-amber-950/30 dark:border-amber-900">
      <RiAlertLine className="size-4 text-amber-600" />
      <span className="font-medium text-amber-800 dark:text-amber-200">
        Simulation Active
      </span>
      <span className="text-amber-700 dark:text-amber-300">
        — {data.running_jobs} job{data.running_jobs > 1 ? 's' : ''} running ({data.total_buses} buses, {data.total_devices} devices)
      </span>
      <Link
        to="/simulations"
        className="ml-auto text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        Manage →
      </Link>
    </div>
  );
}
