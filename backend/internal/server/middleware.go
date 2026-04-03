package server

import (
	"net/http"
	"time"

	"log/slog"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/masariya/backend/internal/handler"
)

func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

		next.ServeHTTP(ww, r)

		status := ww.Status()
		attrs := []any{
			"method", r.Method,
			"path", r.URL.Path,
			"status", status,
			"duration_ms", time.Since(start).Milliseconds(),
			"bytes", ww.BytesWritten(),
		}

		// Add request ID if present (set by chi middleware.RequestID)
		if reqID := middleware.GetReqID(r.Context()); reqID != "" {
			attrs = append(attrs, "request_id", reqID)
		}

		// Add resolved locale
		if locale := handler.LocaleFromContext(r.Context()); locale != "" {
			attrs = append(attrs, "locale", locale)
		}

		// Add authenticated user ID if present
		if userID := handler.UserIDFromContext(r.Context()); userID != "" {
			attrs = append(attrs, "user_id", userID)
		}

		// Add remote IP
		attrs = append(attrs, "remote_addr", r.RemoteAddr)

		if status >= 500 {
			slog.Error("request", attrs...)
		} else if status >= 400 {
			slog.Warn("request", attrs...)
		} else {
			slog.Info("request", attrs...)
		}
	})
}

func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-Locale, Accept-Language")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
