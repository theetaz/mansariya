package store

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masariya/backend/internal/model"
)

type ContributorStore struct {
	pool *pgxpool.Pool
}

func NewContributorStore(pool *pgxpool.Pool) *ContributorStore {
	return &ContributorStore{pool: pool}
}

// ── Auto-registration ────────────────────────────────────────────────────

func (s *ContributorStore) UpsertContributor(ctx context.Context, contributorID string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO contributors (contributor_id, last_seen_at)
		 VALUES ($1, NOW())
		 ON CONFLICT (contributor_id) DO UPDATE SET last_seen_at = NOW(), updated_at = NOW()`,
		contributorID,
	)
	if err != nil {
		return fmt.Errorf("upsert contributor: %w", err)
	}

	// Ensure contribution_stats row exists
	_, err = s.pool.Exec(ctx,
		`INSERT INTO contribution_stats (contributor_id) VALUES ($1) ON CONFLICT DO NOTHING`,
		contributorID,
	)
	if err != nil {
		return fmt.Errorf("upsert contribution stats: %w", err)
	}
	return nil
}

func (s *ContributorStore) LinkDeviceHash(ctx context.Context, deviceHash, contributorID string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO contributor_device_hashes (device_hash, contributor_id)
		 VALUES ($1, $2)
		 ON CONFLICT (device_hash) DO UPDATE SET last_seen_at = NOW()`,
		deviceHash, contributorID,
	)
	if err != nil {
		return fmt.Errorf("link device hash: %w", err)
	}
	return nil
}

// ── Telemetry tracking (called per GPS batch) ────────────────────────────

func (s *ContributorStore) TrackActivity(ctx context.Context, contributorID string, pingCount int) error {
	today := time.Now().Format("2006-01-02")
	_, err := s.pool.Exec(ctx,
		`INSERT INTO contributor_daily_activity (contributor_id, activity_date, ping_count, trip_count)
		 VALUES ($1, $2, $3, 1)
		 ON CONFLICT (contributor_id, activity_date) DO UPDATE SET
		   ping_count = contributor_daily_activity.ping_count + $3`,
		contributorID, today, pingCount,
	)
	if err != nil {
		return fmt.Errorf("track activity: %w", err)
	}
	return nil
}

func (s *ContributorStore) TrackRouteContribution(ctx context.Context, contributorID, routeID string, pingCount int) error {
	if routeID == "" {
		return nil
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO contributor_routes (contributor_id, route_id, total_pings)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (contributor_id, route_id) DO UPDATE SET
		   trip_count = contributor_routes.trip_count + 1,
		   total_pings = contributor_routes.total_pings + $3,
		   last_contributed_at = NOW()`,
		contributorID, routeID, pingCount,
	)
	if err != nil {
		return fmt.Errorf("track route contribution: %w", err)
	}
	return nil
}

// ── Read operations ──────────────────────────────────────────────────────

func (s *ContributorStore) GetByContributorID(ctx context.Context, contributorID string) (*model.Contributor, error) {
	var c model.Contributor
	err := s.pool.QueryRow(ctx,
		`SELECT id, contributor_id, display_name, COALESCE(password_hash,''), status,
		        claimed_at, last_seen_at, created_at, updated_at
		 FROM contributors WHERE contributor_id = $1`, contributorID,
	).Scan(&c.ID, &c.ContributorID, &c.DisplayName, &c.PasswordHash, &c.Status,
		&c.ClaimedAt, &c.LastSeenAt, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get contributor: %w", err)
	}
	return &c, nil
}

func (s *ContributorStore) GetByDisplayName(ctx context.Context, displayName string) (*model.Contributor, error) {
	var c model.Contributor
	err := s.pool.QueryRow(ctx,
		`SELECT id, contributor_id, display_name, COALESCE(password_hash,''), status,
		        claimed_at, last_seen_at, created_at, updated_at
		 FROM contributors WHERE display_name = $1 AND status = 'claimed'`, displayName,
	).Scan(&c.ID, &c.ContributorID, &c.DisplayName, &c.PasswordHash, &c.Status,
		&c.ClaimedAt, &c.LastSeenAt, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get contributor by display name: %w", err)
	}
	return &c, nil
}

func (s *ContributorStore) GetContributionStats(ctx context.Context, contributorID string) (*model.ContributionStats, error) {
	var cs model.ContributionStats
	err := s.pool.QueryRow(ctx,
		`SELECT contributor_id, total_trips, total_pings, total_distance_km,
		        quality_score, noise_count, potential_count, cluster_count, confirmed_count,
		        routes_contributed, stops_discovered, active_days,
		        first_contribution_at, last_contribution_at
		 FROM contribution_stats WHERE contributor_id = $1`, contributorID,
	).Scan(&cs.ContributorID, &cs.TotalTrips, &cs.TotalPings, &cs.TotalDistanceKM,
		&cs.QualityScore, &cs.NoiseCount, &cs.PotentialCount, &cs.ClusterCount, &cs.ConfirmedCount,
		&cs.RoutesContributed, &cs.StopsDiscovered, &cs.ActiveDays,
		&cs.FirstContributionAt, &cs.LastContributionAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return &model.ContributionStats{ContributorID: contributorID}, nil
		}
		return nil, fmt.Errorf("get contribution stats: %w", err)
	}
	return &cs, nil
}

// ── Claim flow ───────────────────────────────────────────────────────────

func (s *ContributorStore) ClaimContributor(ctx context.Context, contributorID, displayName, passwordHash string) error {
	now := time.Now()
	_, err := s.pool.Exec(ctx,
		`UPDATE contributors SET
			display_name = $2, password_hash = $3, status = 'claimed',
			claimed_at = $4, updated_at = $4
		 WHERE contributor_id = $1 AND status = 'anonymous'`,
		contributorID, displayName, passwordHash, now,
	)
	if err != nil {
		return fmt.Errorf("claim contributor: %w", err)
	}
	return nil
}

// ── Leaderboard ──────────────────────────────────────────────────────────

func (s *ContributorStore) GetLeaderboard(ctx context.Context, sortBy string, limit, offset int) ([]model.LeaderboardEntry, int, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	sortCols := map[string]string{
		"trips":    "cs.total_trips",
		"pings":    "cs.total_pings",
		"distance": "cs.total_distance_km",
		"quality":  "cs.quality_score",
		"days":     "cs.active_days",
	}
	sc := "cs.total_trips"
	if col, ok := sortCols[sortBy]; ok {
		sc = col
	}

	var total int
	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM contribution_stats cs
		 JOIN contributors c ON c.contributor_id = cs.contributor_id
		 WHERE c.status != 'disabled' AND cs.total_trips > 0`,
	).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count leaderboard: %w", err)
	}

	query := fmt.Sprintf(
		`SELECT c.contributor_id, c.display_name,
		        cs.total_trips, cs.total_pings, cs.total_distance_km,
		        cs.quality_score, cs.active_days
		 FROM contribution_stats cs
		 JOIN contributors c ON c.contributor_id = cs.contributor_id
		 WHERE c.status != 'disabled' AND cs.total_trips > 0
		 ORDER BY %s DESC
		 LIMIT $1 OFFSET $2`, sc,
	)

	rows, err := s.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("leaderboard query: %w", err)
	}
	defer rows.Close()

	var entries []model.LeaderboardEntry
	rank := offset + 1
	for rows.Next() {
		var e model.LeaderboardEntry
		if err := rows.Scan(&e.ContributorID, &e.DisplayName,
			&e.TotalTrips, &e.TotalPings, &e.TotalDistanceKM,
			&e.QualityScore, &e.ActiveDays); err != nil {
			return nil, 0, fmt.Errorf("scan leaderboard: %w", err)
		}
		e.Rank = rank
		rank++
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []model.LeaderboardEntry{}
	}
	return entries, total, rows.Err()
}

// ── Sessions ─────────────────────────────────────────────────────────────

func (s *ContributorStore) CreateSession(ctx context.Context, sess *model.ContributorSession) error {
	err := s.pool.QueryRow(ctx,
		`INSERT INTO contributor_sessions (contributor_id, token_hash, ip_address, user_agent, expires_at)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, created_at, last_used_at`,
		sess.ContributorID, sess.TokenHash, sess.IPAddress, sess.UserAgent, sess.ExpiresAt,
	).Scan(&sess.ID, &sess.CreatedAt, &sess.LastUsedAt)
	if err != nil {
		return fmt.Errorf("create contributor session: %w", err)
	}
	return nil
}

func (s *ContributorStore) GetSessionByTokenHash(ctx context.Context, tokenHash string) (*model.ContributorSession, error) {
	var sess model.ContributorSession
	err := s.pool.QueryRow(ctx,
		`SELECT id, contributor_id, token_hash, ip_address, user_agent, expires_at, created_at, last_used_at
		 FROM contributor_sessions WHERE token_hash = $1 AND expires_at > NOW()`, tokenHash,
	).Scan(&sess.ID, &sess.ContributorID, &sess.TokenHash, &sess.IPAddress, &sess.UserAgent,
		&sess.ExpiresAt, &sess.CreatedAt, &sess.LastUsedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get contributor session: %w", err)
	}
	return &sess, nil
}

func (s *ContributorStore) DeleteSession(ctx context.Context, sessionID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM contributor_sessions WHERE id = $1`, sessionID)
	if err != nil {
		return fmt.Errorf("delete contributor session: %w", err)
	}
	return nil
}

// ── Server-side listing for admin ────────────────────────────────────────

func (s *ContributorStore) ListContributorsFiltered(ctx context.Context, search, status, sortBy, sortDir string, limit, offset int) ([]model.Contributor, []model.ContributionStats, int, error) {
	if limit <= 0 {
		limit = 15
	}

	where := "WHERE 1=1"
	args := []interface{}{}
	n := 0

	if search != "" {
		n++
		where += fmt.Sprintf(" AND (c.contributor_id ILIKE $%d OR COALESCE(c.display_name,'') ILIKE $%d)", n, n)
		args = append(args, "%"+search+"%")
	}
	if status != "" {
		n++
		where += fmt.Sprintf(" AND c.status = $%d", n)
		args = append(args, status)
	}

	var total int
	if err := s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM contributors c "+where, args...).Scan(&total); err != nil {
		return nil, nil, 0, fmt.Errorf("count contributors: %w", err)
	}

	sortCols := map[string]string{
		"created_at": "c.created_at", "last_seen_at": "c.last_seen_at",
		"display_name": "c.display_name", "status": "c.status",
		"total_trips": "COALESCE(cs.total_trips, 0)", "quality_score": "COALESCE(cs.quality_score, 0)",
	}
	sc := "c.last_seen_at"
	if col, ok := sortCols[sortBy]; ok {
		sc = col
	}
	sd := "DESC"
	if sortDir == "asc" {
		sd = "ASC"
	}

	n++
	args = append(args, limit)
	n++
	args = append(args, offset)

	query := fmt.Sprintf(
		`SELECT c.id, c.contributor_id, c.display_name, c.status, c.claimed_at, c.last_seen_at, c.created_at, c.updated_at,
		        COALESCE(cs.total_trips, 0), COALESCE(cs.total_pings, 0), COALESCE(cs.total_distance_km, 0),
		        COALESCE(cs.quality_score, 0), COALESCE(cs.active_days, 0)
		 FROM contributors c
		 LEFT JOIN contribution_stats cs ON cs.contributor_id = c.contributor_id
		 %s ORDER BY %s %s NULLS LAST LIMIT $%d OFFSET $%d`,
		where, sc, sd, n-1, n,
	)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("list contributors: %w", err)
	}
	defer rows.Close()

	var contributors []model.Contributor
	var stats []model.ContributionStats
	for rows.Next() {
		var c model.Contributor
		var cs model.ContributionStats
		if err := rows.Scan(&c.ID, &c.ContributorID, &c.DisplayName, &c.Status, &c.ClaimedAt, &c.LastSeenAt, &c.CreatedAt, &c.UpdatedAt,
			&cs.TotalTrips, &cs.TotalPings, &cs.TotalDistanceKM, &cs.QualityScore, &cs.ActiveDays); err != nil {
			return nil, nil, 0, fmt.Errorf("scan contributor: %w", err)
		}
		cs.ContributorID = c.ContributorID
		contributors = append(contributors, c)
		stats = append(stats, cs)
	}
	if contributors == nil {
		contributors = []model.Contributor{}
		stats = []model.ContributionStats{}
	}
	return contributors, stats, total, rows.Err()
}
