package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/masariya/backend/internal/config"
	"github.com/masariya/backend/internal/handler"
	"github.com/masariya/backend/internal/pipeline"
	redisclient "github.com/masariya/backend/internal/redis"
	"github.com/masariya/backend/internal/server"
	"github.com/masariya/backend/internal/service"
	"github.com/masariya/backend/internal/simulation"
	"github.com/masariya/backend/internal/spatial"
	"github.com/masariya/backend/internal/store"
	"github.com/masariya/backend/internal/valhalla"
	"github.com/masariya/backend/internal/ws"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	if err := run(); err != nil {
		slog.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Load config
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	// Connect to PostgreSQL
	pool, err := store.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	slog.Info("connected to postgres")

	// Connect to Redis
	rdb, err := redisclient.NewClient(ctx, cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB)
	if err != nil {
		return err
	}
	defer rdb.Close()
	slog.Info("connected to redis")

	// Initialize stores
	routeStore := store.NewRouteStore(pool)
	stopStore := store.NewStopStore(pool)
	journeyStore := store.NewJourneyStore(pool)
	adminStore := store.NewAdminStore(pool)
	simStore := store.NewSimulationStore(pool)
	_ = store.NewTripStore(pool) // used later for ETA

	// Load route spatial index
	routeIndex := spatial.NewRouteIndex()
	routePolylines, err := routeStore.GetAll(ctx)
	if err != nil {
		slog.Warn("failed to load route polylines — index will be empty", "error", err)
	} else {
		routeIndex.Load(routePolylines)
		slog.Info("loaded route spatial index", "routes", routeIndex.Count())
	}

	// Initialize Valhalla client
	vc := valhalla.NewClient(cfg.ValhallaURL)

	// Initialize pipeline components
	ingester := pipeline.NewIngester(rdb)
	mapMatcher := pipeline.NewMapMatcher(rdb, vc)
	broadcaster := pipeline.NewBroadcaster(rdb)
	inferenceEngine := pipeline.NewInferenceEngine(routeIndex)
	processor := pipeline.NewProcessor(rdb, inferenceEngine, broadcaster)

	// Create consumer groups
	if err := mapMatcher.EnsureConsumerGroup(ctx); err != nil {
		slog.Warn("consumer group setup", "error", err)
	}

	// Start pipeline workers
	go func() {
		if err := mapMatcher.Run(ctx); err != nil && ctx.Err() == nil {
			slog.Error("mapmatcher died", "error", err)
		}
	}()
	go func() {
		if err := processor.Run(ctx); err != nil && ctx.Err() == nil {
			slog.Error("processor died", "error", err)
		}
	}()

	// Start Redis Pub/Sub listener that forwards to WebSocket hub
	wsHub := ws.NewHub()
	go runPubSubBridge(ctx, rdb, wsHub)

	// Reset any simulations that were running when server last stopped
	if err := simStore.ResetRunningToStopped(ctx); err != nil {
		slog.Warn("failed to reset running simulations", "error", err)
	}

	// Initialize simulation engine
	routeProvider := simulation.NewDBRouteProvider(pool)
	apiBaseURL := "http://localhost:" + cfg.Port
	simManager := simulation.NewManager(ctx, simStore, routeProvider, apiBaseURL)

	// Wire up HTTP handlers
	deps := &server.Deps{
		GPS:        handler.NewGPSHandler(ingester),
		Routes:     handler.NewRoutesHandler(routeStore, stopStore),
		Search:     handler.NewSearchHandler(routeStore),
		Stops:      handler.NewStopsHandler(stopStore),
		ETA:        handler.NewETAHandler(service.NewETAService(rdb, routeIndex)),
		WS:         handler.NewWSHandler(wsHub),
		Sync:       handler.NewSyncHandler(routeStore),
		Journey:    handler.NewJourneyHandler(journeyStore),
		Admin:      handler.NewAdminHandler(adminStore, cfg.AdminAPIKey),
		Buses:      handler.NewBusesHandler(rdb),
		Simulation: handler.NewSimulationHandler(simStore, simManager),
	}

	router := server.NewRouter(deps)
	srv := server.New(cfg.Addr(), router)

	// Graceful shutdown
	errCh := make(chan error, 1)
	go func() {
		if err := srv.Start(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case <-quit:
		slog.Info("received shutdown signal")
	case err := <-errCh:
		return err
	}

	cancel() // stop pipeline workers

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	return srv.Shutdown(shutdownCtx)
}

// runPubSubBridge subscribes to Redis Pub/Sub route channels and forwards messages to the WS hub.
func runPubSubBridge(ctx context.Context, rdb *goredis.Client, hub *ws.Hub) {
	pubsub := rdb.PSubscribe(ctx, "route:*")
	defer pubsub.Close()

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			// Extract route ID from channel name "route:{id}"
			if len(msg.Channel) > 6 {
				routeID := msg.Channel[6:] // strip "route:"
				hub.Broadcast(routeID, json.RawMessage(msg.Payload))
			}
		}
	}
}
