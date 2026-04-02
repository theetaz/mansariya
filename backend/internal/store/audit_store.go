package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditEntry struct {
	ID         int64           `json:"id"`
	ActorID    string          `json:"actor_id,omitempty"`
	ActorEmail string          `json:"actor_email,omitempty"`
	Action     string          `json:"action"`
	TargetType string          `json:"target_type,omitempty"`
	TargetID   string          `json:"target_id,omitempty"`
	Metadata   json.RawMessage `json:"metadata,omitempty"`
	IPAddress  string          `json:"ip_address,omitempty"`
	UserAgent  string          `json:"user_agent,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
}

type AuditStore struct {
	pool *pgxpool.Pool
}

func NewAuditStore(pool *pgxpool.Pool) *AuditStore {
	return &AuditStore{pool: pool}
}

func (s *AuditStore) Log(ctx context.Context, entry AuditEntry) error {
	meta := entry.Metadata
	if meta == nil {
		meta = json.RawMessage("{}")
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO audit_logs (actor_id, actor_email, action, target_type, target_id, metadata, ip_address, user_agent)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		entry.ActorID, entry.ActorEmail, entry.Action, entry.TargetType, entry.TargetID,
		meta, entry.IPAddress, entry.UserAgent,
	)
	if err != nil {
		return fmt.Errorf("audit log: %w", err)
	}
	return nil
}

// LogAudit satisfies the handler.AuditLogger interface.
func (s *AuditStore) LogAudit(ctx context.Context, actorID, actorEmail, action, targetType, targetID, ipAddress, userAgent string, metadata json.RawMessage) error {
	return s.Log(ctx, AuditEntry{
		ActorID:    actorID,
		ActorEmail: actorEmail,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Metadata:   metadata,
		IPAddress:  ipAddress,
		UserAgent:  userAgent,
	})
}

// ListAuditServer satisfies the handler.AuditLister interface.
func (s *AuditStore) ListAuditServer(ctx context.Context,
	actorID, actorEmail, action, targetType, targetID, search, sortBy, sortDir string,
	limit, offset int,
) (interface{}, int, error) {
	return s.List(ctx, AuditFilter{
		ActorID:    actorID,
		ActorEmail: actorEmail,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Search:     search,
		SortBy:     sortBy,
		SortDir:    sortDir,
		Limit:      limit,
		Offset:     offset,
	})
}

type AuditFilter struct {
	ActorID    string
	ActorEmail string // partial match (ILIKE)
	Action     string
	TargetType string
	TargetID   string
	Search     string // global search across actor_email, action, target_type, ip_address
	SortBy     string // "created_at", "action", "actor_email"
	SortDir    string // "asc" or "desc"
	Limit      int
	Offset     int
}

// Allowed sort columns to prevent SQL injection
var allowedSortColumns = map[string]string{
	"created_at":  "created_at",
	"action":      "action",
	"actor_email": "actor_email",
	"target_type": "target_type",
	"ip_address":  "ip_address",
}

func (s *AuditStore) List(ctx context.Context, f AuditFilter) ([]AuditEntry, int, error) {
	if f.Limit <= 0 {
		f.Limit = 20
	}
	if f.Limit > 100 {
		f.Limit = 100
	}

	where := "WHERE 1=1"
	args := []interface{}{}
	n := 0

	if f.ActorID != "" {
		n++
		where += fmt.Sprintf(" AND actor_id = $%d", n)
		args = append(args, f.ActorID)
	}
	if f.ActorEmail != "" {
		n++
		where += fmt.Sprintf(" AND actor_email ILIKE $%d", n)
		args = append(args, "%"+f.ActorEmail+"%")
	}
	if f.Action != "" {
		n++
		where += fmt.Sprintf(" AND action = $%d", n)
		args = append(args, f.Action)
	}
	if f.TargetType != "" {
		n++
		where += fmt.Sprintf(" AND target_type = $%d", n)
		args = append(args, f.TargetType)
	}
	if f.TargetID != "" {
		n++
		where += fmt.Sprintf(" AND target_id = $%d", n)
		args = append(args, f.TargetID)
	}
	if f.Search != "" {
		n++
		where += fmt.Sprintf(` AND (
			actor_email ILIKE $%d OR action ILIKE $%d OR
			target_type ILIKE $%d OR ip_address ILIKE $%d OR
			target_id ILIKE $%d
		)`, n, n, n, n, n)
		args = append(args, "%"+f.Search+"%")
	}

	// Count
	var total int
	countQuery := "SELECT COUNT(*) FROM audit_logs " + where
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count audit: %w", err)
	}

	// Sort
	sortCol := "created_at"
	if col, ok := allowedSortColumns[f.SortBy]; ok {
		sortCol = col
	}
	sortDir := "DESC"
	if f.SortDir == "asc" {
		sortDir = "ASC"
	}

	// Fetch
	n++
	limitParam := fmt.Sprintf("$%d", n)
	args = append(args, f.Limit)
	n++
	offsetParam := fmt.Sprintf("$%d", n)
	args = append(args, f.Offset)

	query := fmt.Sprintf(
		`SELECT id, COALESCE(actor_id,''), COALESCE(actor_email,''), action,
		        COALESCE(target_type,''), COALESCE(target_id,''),
		        COALESCE(metadata,'{}'), COALESCE(ip_address,''), COALESCE(user_agent,''),
		        created_at
		 FROM audit_logs %s ORDER BY %s %s LIMIT %s OFFSET %s`,
		where, sortCol, sortDir, limitParam, offsetParam,
	)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list audit: %w", err)
	}
	defer rows.Close()

	var entries []AuditEntry
	for rows.Next() {
		var e AuditEntry
		if err := rows.Scan(&e.ID, &e.ActorID, &e.ActorEmail, &e.Action,
			&e.TargetType, &e.TargetID, &e.Metadata,
			&e.IPAddress, &e.UserAgent, &e.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan audit: %w", err)
		}
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []AuditEntry{}
	}
	return entries, total, rows.Err()
}
