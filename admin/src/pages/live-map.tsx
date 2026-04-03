/* eslint-disable react-refresh/only-export-components */
import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type CSSProperties,
} from "react"
import { useQuery } from "@tanstack/react-query"
import {
  BusIcon,
  RadioIcon,
  GaugeIcon,
  SearchIcon,
  XIcon,
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  ClockIcon,
  MapPinIcon,
  NavigationIcon,
  UsersIcon,
  CompassIcon,
  LayoutGridIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Map,
  MapRoute,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  MapControls,
  useMap,
} from "@/components/ui/map"
import { useIsMobile } from "@/hooks/use-mobile"
import { AnimatedBusMarker } from "@/components/animated-bus-marker"
import { DeviceArrowMarker } from "@/components/device-arrow-marker"
import {
  useAdminDevicesWS,
  type DeviceInfo,
  type DeviceCounts,
  type DeviceClassification,
} from "@/hooks/use-admin-devices-ws"
import {
  fetchActiveBusesDetail,
  fetchAdminRoutes,
  fetchAdminRouteDetail,
  type Vehicle,
  type AdminRouteWithStats,
  type AdminEnrichedStop,
} from "@/lib/api"

// ── Constants ──────────────────────────────────────────────────────────────

const ROUTE_COLORS = [
  "#1D9E75",
  "#378ADD",
  "#E24B4A",
  "#BA7517",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
]

const CLASSIFICATION_COLORS: Record<DeviceClassification, string> = {
  noise: "#6B7280",
  potential: "#BA7517",
  cluster: "#378ADD",
  confirmed: "#1D9E75",
}

type SidebarTab = "providers" | "buses"

// ── Main Page ──────────────────────────────────────────────────────────────

export function LiveMapPage() {
  const isMobile = useIsMobile()
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([])
  const [hiddenBuses, setHiddenBuses] = useState<Set<string>>(new Set())
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null)
  const [routeSearchOpen, setRouteSearchOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SidebarTab>("providers")
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [visibleClassifications, setVisibleClassifications] = useState<
    Set<DeviceClassification>
  >(new Set(["noise", "potential", "cluster", "confirmed"]))

  const { data: busData, isLoading } = useQuery({
    queryKey: ["active-buses-detail"],
    queryFn: fetchActiveBusesDetail,
    refetchInterval: 3_000,
  })

  const { data: routesData } = useQuery({
    queryKey: ["admin-routes"],
    queryFn: () => fetchAdminRoutes(),
  })

  const { devices, counts, isConnected: wsConnected } = useAdminDevicesWS()

  const buses: Vehicle[] = busData?.buses ?? []
  const busCount = busData?.count ?? 0
  const allRoutes: AdminRouteWithStats[] = routesData?.routes ?? []

  const busesByRoute: Record<string, Vehicle[]> = {}
  buses.forEach((bus) => {
    if (!busesByRoute[bus.route_id]) busesByRoute[bus.route_id] = []
    busesByRoute[bus.route_id].push(bus)
  })

  const sortedRoutes = Object.entries(busesByRoute).sort(
    (a, b) => b[1].length - a[1].length
  )

  const visibleDevices = useMemo(
    () => devices.filter((d) => visibleClassifications.has(d.classification)),
    [devices, visibleClassifications]
  )

  const selectedDevice = selectedDeviceId
    ? devices.find((d) => d.contributor_id === selectedDeviceId)
    : null
  const selectedBus = selectedBusId
    ? buses.find((b) => b.virtual_id === selectedBusId)
    : null

  const toggleBusVisibility = useCallback((busId: string) => {
    setHiddenBuses((prev) => {
      const next = new Set(prev)
      if (next.has(busId)) next.delete(busId)
      else next.add(busId)
      return next
    })
  }, [])

  const handleBusClick = useCallback((busId: string) => {
    setSelectedBusId((prev) => (prev === busId ? null : busId))
  }, [])

  const handleDeviceClick = useCallback((deviceHash: string) => {
    setSelectedDeviceId((prev) => (prev === deviceHash ? null : deviceHash))
  }, [])

  const addRoute = useCallback((routeId: string) => {
    setSelectedRoutes((prev) =>
      prev.includes(routeId) ? prev : [...prev, routeId]
    )
    setRouteSearchOpen(false)
  }, [])

  const removeRoute = useCallback((routeId: string) => {
    setSelectedRoutes((prev) => prev.filter((r) => r !== routeId))
  }, [])

  const getRouteColor = (routeId: string) => {
    const idx = selectedRoutes.indexOf(routeId)
    return ROUTE_COLORS[idx % ROUTE_COLORS.length]
  }

  const panelContent = (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SidebarTab)}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="border-b px-3 py-3">
          <TabsList
            variant="line"
            className="grid w-full grid-cols-2 gap-1 bg-transparent p-0"
          >
            <TabsTrigger value="providers">Data Providers</TabsTrigger>
            <TabsTrigger value="buses">Active Buses</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {activeTab === "providers" ? (
            <DataProvidersTab
              counts={counts}
              devices={devices}
              visibleClassifications={visibleClassifications}
              onToggleClassification={(cls) => {
                setVisibleClassifications((prev) => {
                  const next = new Set(prev)
                  if (next.has(cls)) next.delete(cls)
                  else next.add(cls)
                  return next
                })
              }}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={handleDeviceClick}
            />
          ) : (
            <ActiveBusesTab
              isLoading={isLoading}
              sortedRoutes={sortedRoutes}
              selectedBusId={selectedBusId}
              hiddenBuses={hiddenBuses}
              allRoutes={allRoutes}
              selectedRoutes={selectedRoutes}
              routeSearchOpen={routeSearchOpen}
              onRouteSearchOpenChange={setRouteSearchOpen}
              onBusClick={handleBusClick}
              onToggleBusVisibility={toggleBusVisibility}
              onAddRoute={addRoute}
              onRemoveRoute={removeRoute}
              getRouteColor={getRouteColor}
              busCount={busCount}
            />
          )}
        </div>
      </Tabs>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 md:px-6 md:pb-6">
      <div className="flex min-h-[calc(100svh-var(--header-height)-1.5rem)] flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm md:min-h-[calc(100svh-var(--header-height)-3rem)]">
        <div className="relative min-w-0 flex-1 overflow-hidden bg-background">
          <Map center={[79.8612, 6.9271]} zoom={10}>
            <MapControls showZoom showLocate showFullscreen />

            {/* Route polylines + stops */}
            {selectedRoutes.map((routeId) => (
              <RouteOverlay
                key={routeId}
                routeId={routeId}
                color={getRouteColor(routeId)}
              />
            ))}

            {/* Selected bus route overlay (if not already shown) */}
            {selectedBus &&
              !selectedRoutes.includes(selectedBus.route_id) && (
                <RouteOverlay routeId={selectedBus.route_id} color="#1D9E75" />
              )}

            {/* Bus markers */}
            {buses.map((b) => (
              <AnimatedBusMarker
                key={b.virtual_id}
                id={b.virtual_id}
                lat={b.lat}
                lng={b.lng}
                bearing={b.bearing}
                confidence={b.confidence}
                visible={!hiddenBuses.has(b.virtual_id)}
                selected={selectedBusId === b.virtual_id}
                onClick={() => handleBusClick(b.virtual_id)}
                tooltip={`Route ${b.route_id} · ${b.speed_kmh.toFixed(0)} km/h · ${b.contributor_count} device${b.contributor_count > 1 ? "s" : ""}`}
              />
            ))}

            {/* Device arrow markers */}
            {visibleDevices.map((d) => (
              <DeviceArrowMarker
                key={d.contributor_id}
                id={d.contributor_id}
                lat={d.lat}
                lng={d.lng}
                bearing={d.bearing}
                speedKmh={d.speed_kmh}
                classification={d.classification}
                visible={true}
                selected={selectedDeviceId === d.contributor_id}
                onClick={() => handleDeviceClick(d.contributor_id)}
                tooltip={`${d.contributor_id} · ${d.classification} · ${d.speed_kmh.toFixed(0)} km/h`}
              />
            ))}

            {/* Pan to selected bus or device */}
            {selectedBus && (
              <PanTo lat={selectedBus.lat} lng={selectedBus.lng} />
            )}
            {selectedDevice && (
              <PanTo lat={selectedDevice.lat} lng={selectedDevice.lng} />
            )}
          </Map>

          <div className="absolute left-3 top-3 z-10 md:left-4 md:top-4">
            <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/90 px-3 py-1.5 shadow-lg backdrop-blur-md">
              <span className="relative flex size-2">
                {wsConnected && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                )}
                <span
                  className={`relative inline-flex size-2 rounded-full ${wsConnected ? "bg-emerald-500" : "bg-red-500"}`}
                />
              </span>
              <span className="text-xs text-muted-foreground">
                {wsConnected ? "Live" : "Offline"}
              </span>
              <Separator orientation="vertical" className="mx-0.5 h-3" />
              <RadioIcon className="size-3 text-muted-foreground" />
              <span className="text-xs font-medium tabular-nums">
                {counts.total}
              </span>
              <Separator orientation="vertical" className="mx-0.5 h-3" />
              <BusIcon className="size-3 text-muted-foreground" />
              <span className="text-xs font-medium tabular-nums">
                {busCount}
              </span>
            </div>
          </div>

          {isMobile ? (
            <div className="absolute bottom-3 right-3 z-10">
              <Button
                onClick={() => setPanelOpen(true)}
                className="rounded-full shadow-lg"
              >
                <LayoutGridIcon data-icon="inline-start" />
                Activity
              </Button>
            </div>
          ) : null}

          {selectedBus && (
            <BusDetailOverlay
              bus={selectedBus}
              isMobile={isMobile}
              onClose={() => setSelectedBusId(null)}
            />
          )}

          {selectedDevice && (
            <DeviceTooltipOverlay
              device={selectedDevice}
              isMobile={isMobile}
              onClose={() => setSelectedDeviceId(null)}
            />
          )}
        </div>

        {!isMobile ? (
          <aside className="hidden h-full w-[360px] shrink-0 border-l border-border/70 bg-card md:flex xl:w-[400px]">
            {panelContent}
          </aside>
        ) : null}
      </div>

      {isMobile ? (
        <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
          <SheetContent side="bottom" className="h-[82svh] rounded-t-2xl p-0">
            <SheetHeader className="px-4 pb-2 pt-4">
              <SheetTitle>Live activity</SheetTitle>
              <SheetDescription>
                Inspect contributors, active buses, and route overlays without
                losing the map.
              </SheetDescription>
            </SheetHeader>
            {panelContent}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  )
}

// ── Data Providers Tab ─────────────────────────────────────────────────────

interface DataProvidersTabProps {
  counts: DeviceCounts
  devices: DeviceInfo[]
  visibleClassifications: Set<DeviceClassification>
  onToggleClassification: (cls: DeviceClassification) => void
  selectedDeviceId: string | null
  onSelectDevice: (contributorId: string) => void
}

function DataProvidersTab({
  counts,
  devices,
  visibleClassifications,
  onToggleClassification,
  selectedDeviceId,
  onSelectDevice,
}: DataProvidersTabProps) {
  const classifications: { key: DeviceClassification; label: string }[] = [
    { key: "confirmed", label: "Confirmed" },
    { key: "cluster", label: "Cluster" },
    { key: "potential", label: "Potential" },
    { key: "noise", label: "Noise" },
  ]

  const visibleDevices = devices.filter((d) =>
    visibleClassifications.has(d.classification)
  )

  return (
    <>
      <div className="grid grid-cols-2 gap-2 border-b p-4">
        <MiniStat icon={RadioIcon} label="Total" value={counts.total} />
        <MiniStat icon={CheckIcon} label="Active" value={counts.active} />
        <MiniStat icon={ClockIcon} label="Suspect" value={counts.suspect} />
        <MiniStat
          icon={XIcon}
          label="Disconnected"
          value={counts.disconnected}
        />
      </div>

      <div className="border-b p-4">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Classification filter
        </span>
        <ToggleGroup
          type="multiple"
          value={Array.from(visibleClassifications)}
          onValueChange={(values) => {
            const next = new Set(values as DeviceClassification[])
            if (next.size === 0) {
              classifications.forEach(({ key }) => next.add(key))
            }
            classifications.forEach(({ key }) => {
              const shouldBeVisible = next.has(key)
              const isVisible = visibleClassifications.has(key)
              if (shouldBeVisible !== isVisible) {
                onToggleClassification(key)
              }
            })
          }}
          className="mt-3 flex flex-wrap justify-start gap-2"
        >
          {classifications.map(({ key, label }) => {
            const color = CLASSIFICATION_COLORS[key]
            return (
              <ToggleGroupItem
                key={key}
                value={key}
                style={
                  { "--classification-color": color } as CSSProperties
                }
                className="rounded-full border px-3 text-xs data-[state=on]:border-transparent data-[state=on]:bg-[var(--classification-color)] data-[state=on]:text-white"
              >
                <span className="size-1.5 rounded-full bg-current opacity-80" />
                {label}
                <span className="opacity-75">{counts[key]}</span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
        <p className="mt-3 text-xs text-muted-foreground">
          Noise is visible by default so unmatched and out-of-service-region
          devices stay debuggable.
        </p>
      </div>

      <ScrollArea className="flex-1">
        {visibleDevices.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No devices visible
          </div>
        ) : (
          visibleDevices.map((device) => {
            const isSelected =
              selectedDeviceId === device.contributor_id
            const color = CLASSIFICATION_COLORS[device.classification]
            return (
              <div
                key={device.contributor_id}
                className={`cursor-pointer border-b px-4 py-2.5 transition-colors last:border-b-0 ${
                  isSelected
                    ? "border-l-2 border-l-primary bg-primary/10"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => onSelectDevice(device.contributor_id)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">
                    {device.contributor_id}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-xs"
                    style={{ borderColor: color, color }}
                  >
                    {device.classification}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <GaugeIcon className="size-3" />
                    {device.speed_kmh.toFixed(0)} km/h
                  </span>
                  <span>{device.freshness_status}</span>
                  <span>{device.quality_status.replaceAll("_", " ")}</span>
                  {device.route_id && <span>Route {device.route_id}</span>}
                </div>
              </div>
            )
          })
        )}
      </ScrollArea>
    </>
  )
}

// ── Active Buses Tab ───────────────────────────────────────────────────────

interface ActiveBusesTabProps {
  isLoading: boolean
  sortedRoutes: [string, Vehicle[]][]
  selectedBusId: string | null
  hiddenBuses: Set<string>
  allRoutes: AdminRouteWithStats[]
  selectedRoutes: string[]
  routeSearchOpen: boolean
  onRouteSearchOpenChange: (open: boolean) => void
  onBusClick: (busId: string) => void
  onToggleBusVisibility: (busId: string) => void
  onAddRoute: (routeId: string) => void
  onRemoveRoute: (routeId: string) => void
  getRouteColor: (routeId: string) => string
  busCount: number
}

function ActiveBusesTab({
  isLoading,
  sortedRoutes,
  selectedBusId,
  hiddenBuses,
  allRoutes,
  selectedRoutes,
  routeSearchOpen,
  onRouteSearchOpenChange,
  onBusClick,
  onToggleBusVisibility,
  onAddRoute,
  onRemoveRoute,
  getRouteColor,
  busCount,
}: ActiveBusesTabProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 border-b p-4">
        <MiniStat
          icon={BusIcon}
          label="Buses"
          value={busCount}
          loading={isLoading}
        />
        <MiniStat
          icon={BusIcon}
          label="Routes"
          value={sortedRoutes.length}
          loading={isLoading}
        />
      </div>

      <div className="space-y-3 border-b p-4">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Route overlays
        </span>
        <Popover open={routeSearchOpen} onOpenChange={onRouteSearchOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start font-normal text-muted-foreground"
            >
              <SearchIcon data-icon="inline-start" />
              Add route overlay...
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search routes..." />
              <CommandList>
                <CommandEmpty>No routes found.</CommandEmpty>
                <CommandGroup>
                  {allRoutes.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`${r.id} ${r.name_en}`}
                      onSelect={() => onAddRoute(r.id)}
                      disabled={selectedRoutes.includes(r.id)}
                    >
                      <CheckIcon
                        className={`mr-2 size-4 ${selectedRoutes.includes(r.id) ? "opacity-100" : "opacity-0"}`}
                      />
                      <span className="font-medium">{r.id}</span>
                      <span className="ml-1 truncate text-muted-foreground">
                        — {r.name_en}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedRoutes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedRoutes.map((routeId) => (
              <Badge key={routeId} variant="secondary" className="gap-1 pr-1">
                <div
                  className="size-2 rounded-full"
                  style={{ background: getRouteColor(routeId) }}
                />
                {routeId}
                <button
                  onClick={() => onRemoveRoute(routeId)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : sortedRoutes.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No active buses
          </div>
        ) : (
          sortedRoutes.map(([routeId, routeBuses]) => (
            <div key={routeId}>
              <div className="sticky top-0 z-10 flex items-center justify-between bg-muted/50 px-4 py-2">
                <span className="text-sm font-medium">Route {routeId}</span>
                <Badge variant="secondary" className="text-xs">
                  {routeBuses.length} bus{routeBuses.length > 1 ? "es" : ""}
                </Badge>
              </div>
              {routeBuses.map((bus) => {
                const isSelected = selectedBusId === bus.virtual_id
                const isHidden = hiddenBuses.has(bus.virtual_id)
                return (
                  <div
                    key={bus.virtual_id}
                    className={`cursor-pointer border-b px-4 py-2.5 transition-colors last:border-b-0 ${isSelected ? "border-l-2 border-l-primary bg-primary/10" : "hover:bg-muted/50"}`}
                    onClick={() => onBusClick(bus.virtual_id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">
                        {bus.virtual_id}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleBusVisibility(bus.virtual_id)
                          }}
                          title={isHidden ? "Show on map" : "Hide from map"}
                        >
                          {isHidden ? (
                            <EyeOffIcon className="size-3.5 text-muted-foreground" />
                          ) : (
                            <EyeIcon className="size-3.5 text-muted-foreground" />
                          )}
                        </Button>
                        <Badge
                          variant={
                            bus.confidence === "verified"
                              ? "default"
                              : bus.confidence === "good"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {bus.confidence}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <GaugeIcon className="size-3" />
                        {bus.speed_kmh.toFixed(0)} km/h
                      </span>
                      <span>
                        {bus.contributor_count} contributor
                        {bus.contributor_count > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                )
              })}
              <Separator />
            </div>
          ))
        )}
      </ScrollArea>
    </>
  )
}

// ── Device Tooltip Overlay ─────────────────────────────────────────────────

function DeviceTooltipOverlay({
  device,
  isMobile,
  onClose,
}: {
  device: DeviceInfo
  isMobile: boolean
  onClose: () => void
}) {
  const color = CLASSIFICATION_COLORS[device.classification]

  return (
    <div
      className={`absolute z-10 overflow-hidden rounded-xl border bg-card/95 shadow-lg backdrop-blur ${
        isMobile
          ? "bottom-20 left-3 right-3"
          : "bottom-4 left-4 min-w-[280px]"
      }`}
    >
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <RadioIcon className="size-5" style={{ color }} />
          <span className="font-mono text-sm">{device.contributor_id}</span>
          <Badge
            variant="outline"
            className="text-xs"
            style={{ borderColor: color, color }}
          >
            {device.classification}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="size-7 p-0"
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="space-y-2 px-4 py-3">
        {device.classification_reason && (
          <p className="text-xs text-muted-foreground">
            {device.classification_reason}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Freshness: {device.freshness_status}
        </p>
        <p className="text-xs text-muted-foreground">
          Quality: {device.quality_status.replaceAll("_", " ")}
        </p>
        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
          <InfoItem
            icon={GaugeIcon}
            label="Speed"
            value={`${device.speed_kmh.toFixed(1)} km/h`}
          />
          <InfoItem
            icon={CompassIcon}
            label="Bearing"
            value={formatBearing(device.bearing, device.speed_kmh)}
          />
          <InfoItem
            icon={NavigationIcon}
            label="Accuracy"
            value={`\u00B1${device.accuracy.toFixed(0)} m`}
          />
          {device.route_id && (
            <InfoItem icon={UsersIcon} label="Route" value={device.route_id} />
          )}
          {device.has_metadata && (
            <InfoItem icon={CheckIcon} label="Metadata" value="Yes" />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Route Overlay: polyline + stop markers ─────────────────────────────────

function RouteOverlay({
  routeId,
  color,
}: {
  routeId: string
  color: string
}) {
  const { data } = useQuery({
    queryKey: ["admin-route-detail", routeId],
    queryFn: () => fetchAdminRouteDetail(routeId),
    staleTime: 5 * 60 * 1000,
  })

  const polyline = data?.polyline ?? []
  const stops = data?.stops ?? []

  return (
    <>
      {polyline.length >= 2 && (
        <MapRoute coordinates={polyline} color={color} width={4} />
      )}
      {stops.map((s, i) => (
        <MapMarker
          key={`${routeId}-${s.stop_id}`}
          longitude={s.lng}
          latitude={s.lat}
        >
          <MarkerContent>
            <div
              className="flex size-5 items-center justify-center rounded-full border-2 border-white text-[8px] font-bold text-white shadow"
              style={{
                background:
                  i === 0
                    ? "#22c55e"
                    : i === stops.length - 1
                      ? "#ef4444"
                      : color,
              }}
            >
              {i + 1}
            </div>
          </MarkerContent>
          <MarkerTooltip>{s.name_en}</MarkerTooltip>
        </MapMarker>
      ))}
    </>
  )
}

// ── Bus Detail Overlay with ETAs ───────────────────────────────────────────

function BusDetailOverlay({
  bus,
  isMobile,
  onClose,
}: {
  bus: Vehicle
  isMobile: boolean
  onClose: () => void
}) {
  const { data: routeData } = useQuery({
    queryKey: ["admin-route-detail", bus.route_id],
    queryFn: () => fetchAdminRouteDetail(bus.route_id),
    staleTime: 5 * 60 * 1000,
  })

  const eta = useMemo(() => {
    if (!routeData?.stops?.length || !routeData?.polyline?.length) return null
    return computeETAs(bus, routeData.stops)
  }, [bus, routeData])

  return (
    <div
      className={`absolute z-10 overflow-hidden rounded-xl border bg-card/95 shadow-lg backdrop-blur ${
        isMobile
          ? "bottom-20 left-3 right-3 max-h-[45svh] overflow-y-auto"
          : "bottom-4 left-4 right-[23rem] xl:right-[25.5rem]"
      }`}
    >
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <BusIcon className="size-5 text-primary" />
          <span className="text-sm font-semibold">{bus.virtual_id}</span>
          <Badge
            variant={
              bus.confidence === "verified"
                ? "default"
                : bus.confidence === "good"
                  ? "secondary"
                  : "outline"
            }
            className="text-xs"
          >
            {bus.confidence}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Route {bus.route_id}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="size-7 p-0"
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      {eta && eta.stops.length > 0 && (
        <div className="border-b px-4 py-3">
          <TripProgress
            stops={eta.stops}
            progressPercent={eta.progressPercent}
          />
        </div>
      )}

      <div className="px-4 py-3">
        <div
          className={`grid gap-x-6 gap-y-3 ${isMobile ? "grid-cols-2" : "grid-cols-3"}`}
        >
          <InfoItem
            icon={GaugeIcon}
            label="Speed"
            value={`${bus.speed_kmh.toFixed(1)} km/h`}
          />
          <InfoItem
            icon={CompassIcon}
            label="Bearing"
            value={formatBearing(bus.bearing, bus.speed_kmh)}
          />
          <InfoItem
            icon={UsersIcon}
            label="Devices"
            value={`${bus.contributor_count}`}
          />

          {eta && (
            <>
              <InfoItem
                icon={NavigationIcon}
                label="Next Stop"
                value={eta.nextStopName ?? "N/A"}
              />
              <InfoItem
                icon={MapPinIcon}
                label="Dist to Next"
                value={eta.distToNextStop ?? "N/A"}
              />
              <InfoItem
                icon={ClockIcon}
                label="ETA Next Stop"
                value={eta.etaNextStop ?? "N/A"}
                highlight
              />
              <InfoItem
                icon={MapPinIcon}
                label="Dist to End"
                value={eta.distToEnd ?? "N/A"}
              />
              <InfoItem
                icon={ClockIcon}
                label="ETA Terminal"
                value={eta.etaEnd ?? "N/A"}
                highlight
              />
              <InfoItem
                icon={ClockIcon}
                label="Est. Arrival"
                value={eta.arrivalTime ?? "N/A"}
                highlight
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Trip Progress Bar ──────────────────────────────────────────────────────

function TripProgress({
  stops,
  progressPercent,
}: {
  stops: { name: string; passed: boolean; isCurrent: boolean }[]
  progressPercent: number
}) {
  const passed = stops.filter((s) => s.passed).length
  const currentStop = stops.find((s) => s.isCurrent)
  const firstName = stops[0]?.name ?? ""
  const lastName = stops[stops.length - 1]?.name ?? ""

  return (
    <div className="space-y-2">
      {/* Route endpoints + progress text */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="max-w-[120px] truncate font-medium text-muted-foreground">
          {firstName}
        </span>
        <span className="text-muted-foreground">
          {passed}/{stops.length} stops · {Math.round(progressPercent)}%
        </span>
        <span className="max-w-[120px] truncate text-right font-medium text-muted-foreground">
          {lastName}
        </span>
      </div>

      {/* Progress track */}
      <div className="relative flex h-6 items-center">
        {/* Background track */}
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />

        {/* Filled track */}
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary transition-all duration-1000"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Stop dots */}
        {stops.map((stop, i) => {
          const pct =
            stops.length <= 1 ? 0 : (i / (stops.length - 1)) * 100
          return (
            <div
              key={i}
              className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pct}%` }}
            >
              <div
                className={`rounded-full transition-all ${
                  stop.isCurrent
                    ? "size-3 bg-primary ring-[3px] ring-primary/25"
                    : stop.passed
                      ? "size-2 bg-primary"
                      : "size-2 bg-muted-foreground/30"
                }`}
              />
              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 group-hover:block">
                <div className="whitespace-nowrap rounded bg-foreground px-2 py-1 text-[10px] text-background shadow-lg">
                  {stop.name}
                </div>
              </div>
            </div>
          )
        })}

        {/* Bus indicator */}
        <div
          className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-1000"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="flex size-5 items-center justify-center rounded-full border-[2.5px] border-background bg-primary shadow-lg">
            <BusIcon className="size-2.5 text-white" />
          </div>
        </div>
      </div>

      {/* Current stop label */}
      {currentStop && (
        <div className="flex items-center gap-1.5 text-[10px]">
          <NavigationIcon className="size-3 text-primary" />
          <span className="text-muted-foreground">Next:</span>
          <span className="font-medium text-primary">{currentStop.name}</span>
        </div>
      )}
    </div>
  )
}

// ── InfoItem ───────────────────────────────────────────────────────────────

function InfoItem({
  icon: Icon,
  label,
  value,
  mono,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon
        className={`mt-0.5 size-3.5 shrink-0 ${highlight ? "text-primary" : "text-muted-foreground"}`}
      />
      <div className="min-w-0">
        <p className="mb-0.5 text-[10px] leading-none text-muted-foreground">
          {label}
        </p>
        <p
          className={`truncate text-xs font-medium leading-tight ${mono ? "font-mono" : ""} ${highlight ? "text-primary" : ""}`}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

// ── MiniStat ───────────────────────────────────────────────────────────────

function MiniStat({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  loading?: boolean
}) {
  return (
    <Card className="p-0">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <div>
            {loading ? (
              <Skeleton className="h-5 w-8" />
            ) : (
              <p className="font-semibold tabular-nums">{value}</p>
            )}
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── PanTo (smooth map pan) ─────────────────────────────────────────────────

function PanTo({ lat, lng }: { lat: number; lng: number }) {
  const { map } = useMap()
  const lastPan = useRef({ lat: 0, lng: 0 })

  useEffect(() => {
    if (!map) return
    const dist =
      Math.abs(lat - lastPan.current.lat) +
      Math.abs(lng - lastPan.current.lng)
    if (dist > 0.001) {
      map.panTo([lng, lat], { duration: 500 })
      lastPan.current = { lat, lng }
    }
  }, [map, lat, lng])

  return null
}

// ── ETA Computation ────────────────────────────────────────────────────────

interface ETAResult {
  nextStopName: string
  distToNextStop: string
  etaNextStop: string
  distToEnd: string
  etaEnd: string
  stopsPassed: string
  stopsRemaining: string
  arrivalTime: string
  nextStopIdx: number
  totalStops: number
  progressPercent: number
  stops: { name: string; passed: boolean; isCurrent: boolean }[]
}

function computeETAs(
  bus: Vehicle,
  stops: AdminEnrichedStop[]
): ETAResult | null {
  if (stops.length === 0) return null

  // Find nearest stop to bus current position
  let minDist = Infinity
  let nearestIdx = 0
  for (let i = 0; i < stops.length; i++) {
    const d = haversineKM(bus.lat, bus.lng, stops[i].lat, stops[i].lng)
    if (d < minDist) {
      minDist = d
      nearestIdx = i
    }
  }

  // Determine if bus has passed the nearest stop (check next stop is further ahead)
  let nextStopIdx = nearestIdx
  if (nearestIdx < stops.length - 1) {
    const dToNearest = haversineKM(
      bus.lat,
      bus.lng,
      stops[nearestIdx].lat,
      stops[nearestIdx].lng
    )
    // If we're closer to the nearest than to the gap between nearest and next, we've likely passed it
    const gapDist = haversineKM(
      stops[nearestIdx].lat,
      stops[nearestIdx].lng,
      stops[nearestIdx + 1].lat,
      stops[nearestIdx + 1].lng
    )
    if (dToNearest < gapDist * 0.3) {
      nextStopIdx = nearestIdx + 1
    }
  }

  // Ensure nextStopIdx is valid and ahead
  if (nextStopIdx >= stops.length) nextStopIdx = stops.length - 1

  const nextStop = stops[nextStopIdx]
  const lastStop = stops[stops.length - 1]

  const distToNext = haversineKM(bus.lat, bus.lng, nextStop.lat, nextStop.lng)
  const distToEnd = haversineKM(bus.lat, bus.lng, lastStop.lat, lastStop.lng)

  // Use route distance if available, otherwise haversine
  const routeDistToEnd =
    lastStop.distance_from_start_km -
    (nextStop.distance_from_start_km - distToNext)

  const speedKMH = Math.max(bus.speed_kmh, 5) // min 5 km/h to avoid infinite ETA
  const etaNextMin = (distToNext / speedKMH) * 60
  const etaEndMin =
    ((routeDistToEnd > 0 ? routeDistToEnd : distToEnd) / speedKMH) * 60

  const arrivalDate = new Date(Date.now() + etaEndMin * 60 * 1000)
  const arrivalTime = arrivalDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })

  // Build stop progress list
  const stopProgress = stops.map((s, i) => ({
    name: s.name_en,
    passed: i < nextStopIdx,
    isCurrent: i === nextStopIdx,
  }))

  // Progress percent -- use stop index as primary, distance as fine-tuning
  const totalRouteDist = lastStop.distance_from_start_km
  let progressPercent: number
  if (totalRouteDist > 0) {
    const currentDist = Math.max(
      0,
      nextStop.distance_from_start_km - distToNext
    )
    progressPercent = Math.max(
      0,
      Math.min(100, (currentDist / totalRouteDist) * 100)
    )
  } else {
    // Fallback: use stop index ratio
    progressPercent = Math.max(
      0,
      Math.min(100, (nextStopIdx / Math.max(stops.length - 1, 1)) * 100)
    )
  }

  return {
    nextStopName: nextStop.name_en,
    distToNextStop: formatDist(distToNext),
    etaNextStop: formatETA(etaNextMin),
    distToEnd: formatDist(routeDistToEnd > 0 ? routeDistToEnd : distToEnd),
    etaEnd: formatETA(etaEndMin),
    stopsPassed: `${nextStopIdx} / ${stops.length}`,
    stopsRemaining: `${stops.length - nextStopIdx}`,
    arrivalTime,
    nextStopIdx,
    totalStops: stops.length,
    progressPercent,
    stops: stopProgress,
  }
}

// ── Utility functions ──────────────────────────────────────────────────────

function haversineKM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

function formatETA(minutes: number): string {
  if (minutes < 1) return "< 1 min"
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}h ${m}m`
}

function bearingToCardinal(bearing: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
  return dirs[Math.round(bearing / 45) % 8]
}

function formatBearing(bearing: number, speedKmh: number): string {
  if (!Number.isFinite(bearing) || speedKmh < 3 || bearing <= 0) {
    return "Unknown while stationary"
  }

  return `${bearing.toFixed(0)}\u00B0 ${bearingToCardinal(bearing)}`
}
