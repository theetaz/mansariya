import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRoutes, deleteRoute, type Route } from '@/lib/api';

export function useRoutes() {
  return useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const data = await fetchRoutes();
      return data.routes as Route[];
    },
    staleTime: 60_000,
  });
}

export function useDeleteRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteRoute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });
}
