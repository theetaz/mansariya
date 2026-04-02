package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
)

// AuditLogger abstracts writing audit entries.
type AuditLogger interface {
	LogAudit(ctx context.Context, actorID, actorEmail, action, targetType, targetID, ipAddress, userAgent string, metadata json.RawMessage) error
}

// AuditLister abstracts listing audit logs with server-side filtering.
type AuditLister interface {
	ListAuditServer(ctx context.Context,
		actorID, actorEmail, action, targetType, targetID, search, sortBy, sortDir string,
		limit, offset int,
	) (interface{}, int, error)
}

type AuditHandler struct {
	lister AuditLister
}

func NewAuditHandler(lister AuditLister) *AuditHandler {
	return &AuditHandler{lister: lister}
}

func (h *AuditHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	if limit <= 0 {
		limit = 20
	}

	entries, total, err := h.lister.ListAuditServer(r.Context(),
		q.Get("actor_id"), q.Get("actor_email"),
		q.Get("action"), q.Get("target_type"), q.Get("target_id"),
		q.Get("search"), q.Get("sort_by"), q.Get("sort_dir"),
		limit, offset,
	)
	if err != nil {
		WriteAPIErr(w, r, ErrInternal(err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"entries":  entries,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
		"has_more": offset+limit < total,
	})
}
