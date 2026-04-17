package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TelemetryAggregator periodically recomputes contribution_stats from raw data.
type TelemetryAggregator struct {
	pool     *pgxpool.Pool
	interval time.Duration
}

func NewTelemetryAggregator(pool *pgxpool.Pool, interval time.Duration) *TelemetryAggregator {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	return &TelemetryAggregator{pool: pool, interval: interval}
}

func (a *TelemetryAggregator) Run(ctx context.Context) error {
	slog.Info("telemetry aggregator started", "interval", a.interval)
	defer slog.Info("telemetry aggregator stopped")

	// Run once immediately on startup
	a.aggregate(ctx)

	ticker := time.NewTicker(a.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			a.aggregate(ctx)
		}
	}
}

func (a *TelemetryAggregator) aggregate(ctx context.Context) {
	start := time.Now()

	// Update total_trips and total_pings from trip_sessions
	if _, err := a.pool.Exec(ctx, `
		UPDATE contribution_stats cs SET
			total_trips = sub.trip_count,
			total_pings = sub.ping_sum,
			first_contribution_at = sub.first_at,
			last_contribution_at = sub.last_at,
			updated_at = NOW()
		FROM (
			SELECT contributor_id,
				COUNT(*) AS trip_count,
				COALESCE(SUM(ping_count), 0) AS ping_sum,
				MIN(started_at) AS first_at,
				MAX(started_at) AS last_at
			FROM trip_sessions
			WHERE contributor_id IS NOT NULL
			GROUP BY contributor_id
		) sub
		WHERE cs.contributor_id = sub.contributor_id
	`); err != nil {
		slog.Error("aggregate trips", "error", err)
	}

	// Update active_days from daily activity
	if _, err := a.pool.Exec(ctx, `
		UPDATE contribution_stats cs SET
			active_days = sub.day_count,
			updated_at = NOW()
		FROM (
			SELECT contributor_id, COUNT(DISTINCT activity_date) AS day_count
			FROM contributor_daily_activity
			GROUP BY contributor_id
		) sub
		WHERE cs.contributor_id = sub.contributor_id
	`); err != nil {
		slog.Error("aggregate active days", "error", err)
	}

	// Update routes_contributed from contributor_routes
	if _, err := a.pool.Exec(ctx, `
		UPDATE contribution_stats cs SET
			routes_contributed = sub.route_count,
			updated_at = NOW()
		FROM (
			SELECT contributor_id, COUNT(*) AS route_count
			FROM contributor_routes
			GROUP BY contributor_id
		) sub
		WHERE cs.contributor_id = sub.contributor_id
	`); err != nil {
		slog.Error("aggregate routes", "error", err)
	}

	// Quality score: based on ping volume and trip count
	// Formula: min(100, (total_trips * 5) + (total_pings / 100))
	if _, err := a.pool.Exec(ctx, `
		UPDATE contribution_stats SET
			quality_score = LEAST(100, (total_trips * 5) + (total_pings / 100)),
			updated_at = NOW()
		WHERE total_trips > 0
	`); err != nil {
		slog.Error("aggregate quality score", "error", err)
	}

	duration := time.Since(start)
	if duration > time.Second {
		slog.Info("telemetry aggregation complete", "duration_ms", duration.Milliseconds())
	}
}

// RunOnce runs a single aggregation cycle (useful for testing).
func (a *TelemetryAggregator) RunOnce(ctx context.Context) error {
	a.aggregate(ctx)
	return nil
}

// AggregateContributor runs aggregation for a single contributor (for real-time updates).
func (a *TelemetryAggregator) AggregateContributor(ctx context.Context, contributorID string) error {
	_, err := a.pool.Exec(ctx, `
		UPDATE contribution_stats cs SET
			total_trips = COALESCE(ts.trip_count, 0),
			total_pings = COALESCE(ts.ping_sum, 0),
			first_contribution_at = ts.first_at,
			last_contribution_at = ts.last_at,
			active_days = COALESCE(da.day_count, 0),
			routes_contributed = COALESCE(rc.route_count, 0),
			quality_score = LEAST(100, COALESCE(ts.trip_count, 0) * 5 + COALESCE(ts.ping_sum, 0) / 100),
			updated_at = NOW()
		FROM
			(SELECT COUNT(*) AS trip_count, COALESCE(SUM(ping_count), 0) AS ping_sum,
			        MIN(started_at) AS first_at, MAX(started_at) AS last_at
			 FROM trip_sessions WHERE contributor_id = $1) ts,
			(SELECT COUNT(DISTINCT activity_date) AS day_count
			 FROM contributor_daily_activity WHERE contributor_id = $1) da,
			(SELECT COUNT(*) AS route_count
			 FROM contributor_routes WHERE contributor_id = $1) rc
		WHERE cs.contributor_id = $1
	`, contributorID)
	if err != nil {
		return fmt.Errorf("aggregate contributor %s: %w", contributorID, err)
	}
	return nil
}
