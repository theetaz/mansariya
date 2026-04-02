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

// AuditLister abstracts listing audit logs.
type AuditLister interface {
	ListAudit(ctx context.Context, actorID, action, targetType, targetID string, limit, offset int) (interface{}, int, error)
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

	entries, total, err := h.lister.ListAudit(r.Context(),
		q.Get("actor_id"), q.Get("action"), q.Get("target_type"), q.Get("target_id"),
		limit, offset,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "audit_failed", "Could not load audit logs.", "")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"entries": entries,
		"total":   total,
	})
}
