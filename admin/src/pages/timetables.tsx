import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Clock3Icon,
  PlusIcon,
  SaveIcon,
  TrashIcon,
  Loader2Icon,
} from "lucide-react"

import {
  fetchAdminRoutes,
  setTimetable,
  type TimetableInput,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

// ── Local entry type ────────────────────────────────────────────────────

type TimetableEntry = TimetableInput & { _key: string }

const ALL_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const

const SERVICE_TYPES = ["Normal", "Semi-Luxury", "Express"] as const

function createEmptyEntry(routeId: string): TimetableEntry {
  return {
    _key: crypto.randomUUID(),
    route_id: routeId,
    departure_time: "06:00",
    days: ["MON", "TUE", "WED", "THU", "FRI"],
    service_type: "Normal",
    notes: "",
  }
}

// ── Day toggle badge ────────────────────────────────────────────────────

function DayToggle({
  day,
  active,
  onToggle,
}: {
  day: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button type="button" onClick={onToggle}>
      <Badge
        variant={active ? "default" : "outline"}
        className="cursor-pointer select-none"
      >
        {day}
      </Badge>
    </button>
  )
}

// ── Page ────────────────────────────────────────────────────────────────

export function TimetablesPage() {
  const queryClient = useQueryClient()

  const [selectedRoute, setSelectedRoute] = useState<string>("")
  const [entries, setEntries] = useState<TimetableEntry[]>([])

  // Fetch routes for the dropdown
  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ["admin-routes"],
    queryFn: fetchAdminRoutes,
    staleTime: 60_000,
  })

  const routes = routesData?.routes ?? []

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedRoute) throw new Error("No route selected")
      const payload: TimetableInput[] = entries.map(
        ({ _key: _, ...rest }) => rest
      )
      return setTimetable(selectedRoute, payload)
    },
    onSuccess: () => {
      toast.success("Timetable saved successfully")
      queryClient.invalidateQueries({ queryKey: ["admin-routes"] })
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`)
    },
  })

  // ── Entry handlers ──────────────────────────────────────────────────

  function handleRouteChange(routeId: string) {
    setSelectedRoute(routeId)
    setEntries([createEmptyEntry(routeId)])
  }

  function addEntry() {
    if (!selectedRoute) return
    setEntries((prev) => [...prev, createEmptyEntry(selectedRoute)])
  }

  function removeEntry(key: string) {
    setEntries((prev) => prev.filter((e) => e._key !== key))
  }

  function updateEntry(key: string, patch: Partial<TimetableEntry>) {
    setEntries((prev) =>
      prev.map((e) => (e._key === key ? { ...e, ...patch } : e))
    )
  }

  function toggleDay(key: string, day: string) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e._key !== key) return e
        const days = e.days.includes(day)
          ? e.days.filter((d) => d !== day)
          : [...e.days, day]
        return { ...e, days }
      })
    )
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Header */}
      <div className="flex flex-col gap-1 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Clock3Icon className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Timetables
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage departure schedules for each route
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2 sm:mt-0">
          <Button
            variant="outline"
            onClick={addEntry}
            disabled={!selectedRoute}
          >
            <PlusIcon className="mr-2 size-4" />
            Add Departure
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!selectedRoute || entries.length === 0 || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <SaveIcon className="mr-2 size-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Route selector */}
      <div className="px-4 lg:px-6">
        <div className="max-w-sm">
          <label className="mb-1.5 block text-sm font-medium">
            Select Route
          </label>
          <Select
            value={selectedRoute}
            onValueChange={handleRouteChange}
            disabled={routesLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={routesLoading ? "Loading routes..." : "Choose a route"}
              />
            </SelectTrigger>
            <SelectContent>
              {routes.map((route) => (
                <SelectItem key={route.id} value={route.id}>
                  {route.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Departure entries */}
      {selectedRoute && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle>Departure Schedule</CardTitle>
              <CardDescription>
                {entries.length} departure{entries.length !== 1 ? "s" : ""}{" "}
                configured
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock3Icon className="mb-3 size-10 opacity-40" />
                  <p className="text-sm">No departures yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={addEntry}
                  >
                    <PlusIcon className="mr-1 size-3.5" />
                    Add first departure
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Time</TableHead>
                      <TableHead className="min-w-[280px]">Days</TableHead>
                      <TableHead className="w-36">Service Type</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry._key}>
                        {/* Time */}
                        <TableCell>
                          <Input
                            type="time"
                            value={entry.departure_time}
                            onChange={(e) =>
                              updateEntry(entry._key, {
                                departure_time: e.target.value,
                              })
                            }
                            className="h-9 w-28"
                          />
                        </TableCell>

                        {/* Days */}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {ALL_DAYS.map((day) => (
                              <DayToggle
                                key={day}
                                day={day}
                                active={entry.days.includes(day)}
                                onToggle={() => toggleDay(entry._key, day)}
                              />
                            ))}
                          </div>
                        </TableCell>

                        {/* Service type */}
                        <TableCell>
                          <Select
                            value={entry.service_type}
                            onValueChange={(val) =>
                              updateEntry(entry._key, { service_type: val })
                            }
                          >
                            <SelectTrigger className="h-9 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SERVICE_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Notes */}
                        <TableCell>
                          <Input
                            placeholder="Optional notes..."
                            value={entry.notes ?? ""}
                            onChange={(e) =>
                              updateEntry(entry._key, { notes: e.target.value })
                            }
                            className="h-9"
                          />
                        </TableCell>

                        {/* Delete */}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => removeEntry(entry._key)}
                          >
                            <TrashIcon className="size-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state when no route selected */}
      {!selectedRoute && !routesLoading && (
        <div className="mx-4 flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-muted-foreground lg:mx-6">
          <Clock3Icon className="mb-3 size-12 opacity-30" />
          <p className="text-sm font-medium">Select a route to manage its timetable</p>
        </div>
      )}
    </div>
  )
}
