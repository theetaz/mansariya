import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { SaveIcon } from "lucide-react"
import { toast } from "sonner"

import { fetchAdminRouteDetail, ADMIN_API_KEY } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

// ── Types ───────────────────────────────────────────────────────────────

type RouteFormData = {
  name_en: string
  name_si: string
  name_ta: string
  operator: string
  service_type: string
  fare_lkr: number | null
  frequency_minutes: number | null
  operating_hours: string
}

// ── API ─────────────────────────────────────────────────────────────────

async function updateRoute(id: string, data: Partial<RouteFormData>) {
  const res = await fetch(`/api/v1/admin/routes/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": ADMIN_API_KEY,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return res.json()
}

// ── Loading skeleton ────────────────────────────────────────────────────

function FormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-1.5 h-4 w-64" />
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
        <Separator />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
        <Separator />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-3 border-t pt-6">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-32" />
      </CardFooter>
    </Card>
  )
}

// ── Page ────────────────────────────────────────────────────────────────

export function RouteEditPage() {
  const { routeId } = useParams<{ routeId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-route-detail", routeId],
    queryFn: () => fetchAdminRouteDetail(routeId!),
    enabled: !!routeId,
  })

  const [nameEn, setNameEn] = useState("")
  const [nameSi, setNameSi] = useState("")
  const [nameTa, setNameTa] = useState("")
  const [operator, setOperator] = useState("SLTB")
  const [serviceType, setServiceType] = useState("Normal")
  const [fareLkr, setFareLkr] = useState("")
  const [frequencyMinutes, setFrequencyMinutes] = useState("")
  const [operatingHours, setOperatingHours] = useState("")

  // Pre-populate form when data loads
  useEffect(() => {
    if (!data?.route) return
    const r = data.route
    setNameEn(r.name_en || "")
    setNameSi(r.name_si || "")
    setNameTa(r.name_ta || "")
    setOperator(r.operator || "SLTB")
    setServiceType(r.service_type || "Normal")
    setFareLkr(r.fare_lkr ? String(r.fare_lkr) : "")
    setFrequencyMinutes(r.frequency_minutes ? String(r.frequency_minutes) : "")
    setOperatingHours(r.operating_hours || "")
  }, [data])

  const mutation = useMutation({
    mutationFn: (formData: Partial<RouteFormData>) =>
      updateRoute(routeId!, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-routes"] })
      queryClient.invalidateQueries({
        queryKey: ["admin-route-detail", routeId],
      })
      toast.success("Route updated successfully")
      navigate(`/routes/${routeId}`)
    },
    onError: (err: Error) => {
      toast.error(`Failed to update route: ${err.message}`)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!nameEn.trim()) {
      toast.error("English name is required")
      return
    }

    mutation.mutate({
      name_en: nameEn.trim(),
      name_si: nameSi.trim(),
      name_ta: nameTa.trim(),
      operator,
      service_type: serviceType,
      fare_lkr: fareLkr ? Number(fareLkr) : null,
      frequency_minutes: frequencyMinutes ? Number(frequencyMinutes) : null,
      operating_hours: operatingHours.trim(),
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-4 md:px-6 md:py-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit Route {routeId}
        </h1>
        <p className="text-sm text-muted-foreground">
          Update the route information below.
        </p>
      </div>

      {/* Form or skeleton */}
      {isLoading ? (
        <FormSkeleton />
      ) : (
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Route Details</CardTitle>
              <CardDescription>
                Modify the route information. Fields marked with * are required.
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-6">
              {/* Identification — route ID is read-only on edit */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="route-id">Route ID</Label>
                  <Input
                    id="route-id"
                    value={routeId || ""}
                    disabled
                    className="font-mono"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="name-en">Name (English) *</Label>
                  <Input
                    id="name-en"
                    placeholder="e.g. Colombo - Kandy"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Trilingual names */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="name-si">Name (Sinhala)</Label>
                  <Input
                    id="name-si"
                    placeholder="සිංහල නම"
                    value={nameSi}
                    onChange={(e) => setNameSi(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="name-ta">Name (Tamil)</Label>
                  <Input
                    id="name-ta"
                    placeholder="தமிழ் பெயர்"
                    value={nameTa}
                    onChange={(e) => setNameTa(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* Service details */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="operator">Operator</Label>
                  <Select value={operator} onValueChange={setOperator}>
                    <SelectTrigger id="operator" className="w-full">
                      <SelectValue placeholder="Select operator" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SLTB">SLTB</SelectItem>
                      <SelectItem value="Private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="service-type">Service Type</Label>
                  <Select value={serviceType} onValueChange={setServiceType}>
                    <SelectTrigger id="service-type" className="w-full">
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="Semi-Luxury">Semi-Luxury</SelectItem>
                      <SelectItem value="Luxury">Luxury</SelectItem>
                      <SelectItem value="Express">Express</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Operational details */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="fare">Fare (LKR)</Label>
                  <Input
                    id="fare"
                    type="number"
                    min={0}
                    placeholder="e.g. 350"
                    value={fareLkr}
                    onChange={(e) => setFareLkr(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="frequency">Frequency (minutes)</Label>
                  <Input
                    id="frequency"
                    type="number"
                    min={1}
                    placeholder="e.g. 30"
                    value={frequencyMinutes}
                    onChange={(e) => setFrequencyMinutes(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="operating-hours">Operating Hours</Label>
                  <Input
                    id="operating-hours"
                    placeholder="e.g. 05:00-22:00"
                    value={operatingHours}
                    onChange={(e) => setOperatingHours(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex justify-end gap-3 border-t pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/routes/${routeId}`)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                <SaveIcon className="mr-1.5 size-4" />
                {mutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  )
}
