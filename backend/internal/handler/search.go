package handler

import (
	"net/http"
	"strconv"
)

type SearchHandler struct {
	routeStore RouteQuerier
}

func NewSearchHandler(routeStore RouteQuerier) *SearchHandler {
	return &SearchHandler{routeStore: routeStore}
}

// Handle performs trilingual search on routes.
func (h *SearchHandler) Handle(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "q parameter required"})
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	routes, err := h.routeStore.Search(r.Context(), query, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "search failed"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"query":   query,
		"results": routes,
		"count":   len(routes),
	})
}
