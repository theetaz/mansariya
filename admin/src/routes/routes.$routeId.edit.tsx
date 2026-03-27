import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Switch will be used for is_active toggle in future
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchRoute, updateRoute, createRoute } from '@/lib/api';

const routeSchema = z.object({
  id: z.string().min(1, 'Route ID is required'),
  name_en: z.string().min(1, 'English name is required'),
  name_si: z.string().optional(),
  name_ta: z.string().optional(),
  operator: z.string().optional(),
  service_type: z.string().optional(),
  fare_lkr: z.number().min(0).optional(),
  frequency_minutes: z.number().min(0).optional(),
  operating_hours: z.string().optional(),
});

type RouteFormData = z.infer<typeof routeSchema>;

export const Route = createFileRoute('/routes/$routeId/edit')({
  component: RouteEditPage,
});

function RouteEditPage() {
  const { routeId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = routeId === 'new';

  const { data, isLoading } = useQuery({
    queryKey: ['route', routeId],
    queryFn: () => fetchRoute(routeId),
    enabled: !isNew,
  });

  const mutation = useMutation({
    mutationFn: (values: RouteFormData) =>
      isNew ? createRoute(values) : updateRoute(routeId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success(isNew ? 'Route created' : 'Route updated');
      navigate({ to: '/routes' });
    },
    onError: (err: Error) => {
      toast.error(`Failed: ${err.message}`);
    },
  });

  const form = useForm<RouteFormData>({
    resolver: zodResolver(routeSchema),
    values: isNew
      ? { id: '', name_en: '', name_si: '', name_ta: '', operator: '', service_type: 'Normal', fare_lkr: 0, frequency_minutes: 0, operating_hours: '' }
      : data?.route
        ? {
            id: data.route.id,
            name_en: data.route.name_en,
            name_si: data.route.name_si || '',
            name_ta: data.route.name_ta || '',
            operator: data.route.operator || '',
            service_type: data.route.service_type || 'Normal',
            fare_lkr: data.route.fare_lkr || 0,
            frequency_minutes: data.route.frequency_minutes || 0,
            operating_hours: data.route.operating_hours || '',
          }
        : undefined,
  });

  const onSubmit = (values: Record<string, unknown>) => {
    mutation.mutate(values as RouteFormData);
  };

  if (!isNew && isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/routes' })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? 'Create Route' : `Edit Route ${routeId}`}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isNew ? 'Add a new bus route' : 'Update route details'}
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="id">Route ID</Label>
                <Input
                  id="id"
                  {...form.register('id')}
                  placeholder="e.g., 138"
                  disabled={!isNew}
                />
                {form.formState.errors.id && (
                  <p className="text-xs text-destructive">{form.formState.errors.id.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="operating_hours">Operating Hours</Label>
                <Input
                  id="operating_hours"
                  {...form.register('operating_hours')}
                  placeholder="05:00-22:00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trilingual Names */}
        <Card>
          <CardHeader>
            <CardTitle>Route Names</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name_en">English Name</Label>
              <Input
                id="name_en"
                {...form.register('name_en')}
                placeholder="Colombo - Kandy"
              />
              {form.formState.errors.name_en && (
                <p className="text-xs text-destructive">{form.formState.errors.name_en.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name_si">Sinhala Name</Label>
                <Input
                  id="name_si"
                  {...form.register('name_si')}
                  placeholder="කොළඹ - මහනුවර"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name_ta">Tamil Name</Label>
                <Input
                  id="name_ta"
                  {...form.register('name_ta')}
                  placeholder="கொழும்பு - கண்டி"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Details */}
        <Card>
          <CardHeader>
            <CardTitle>Service Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Operator</Label>
                <Select
                  value={form.watch('operator') ?? ''}
                  onValueChange={(v) => form.setValue('operator', v ?? '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SLTB">SLTB</SelectItem>
                    <SelectItem value="Private">Private</SelectItem>
                    <SelectItem value="NTC">NTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select
                  value={form.watch('service_type') ?? 'Normal'}
                  onValueChange={(v) => form.setValue('service_type', v ?? 'Normal')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Semi-Luxury">Semi-Luxury</SelectItem>
                    <SelectItem value="Luxury">Luxury</SelectItem>
                    <SelectItem value="AC Luxury">AC Luxury</SelectItem>
                    <SelectItem value="Express">Express</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fare_lkr">Fare (LKR)</Label>
                <Input
                  id="fare_lkr"
                  type="number"
                  {...form.register('fare_lkr')}
                  placeholder="350"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency_minutes">Frequency (minutes)</Label>
                <Input
                  id="frequency_minutes"
                  type="number"
                  {...form.register('frequency_minutes')}
                  placeholder="15"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/routes' })}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {mutation.isPending ? 'Saving...' : isNew ? 'Create Route' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
