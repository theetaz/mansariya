package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/masariya/backend/internal/i18n"
)

// ── Typed API error ──────────────────────────────────────────────────────

// APIErr is a typed, locale-aware API error.
// Code is a stable machine-readable identifier (e.g. "validation.required").
// MessageKey maps to the i18n catalog for the localized user message.
// Field is optional — used for field-level validation errors.
type APIErr struct {
	Status     int    // HTTP status code
	Code       string // stable error code (e.g. "validation.required")
	MessageKey string // i18n catalog key
	Field      string // optional field name
	Internal   error  // internal cause (never exposed to client)
}

func (e *APIErr) Error() string {
	if e.Internal != nil {
		return fmt.Sprintf("%s: %v", e.Code, e.Internal)
	}
	return e.Code
}

func (e *APIErr) Unwrap() error {
	return e.Internal
}

// ── Common error constructors ────────────────────────────────────────────

func ErrValidation(code, messageKey, field string) *APIErr {
	return &APIErr{Status: http.StatusBadRequest, Code: code, MessageKey: messageKey, Field: field}
}

func ErrNotFound(messageKey string) *APIErr {
	return &APIErr{Status: http.StatusNotFound, Code: "not_found", MessageKey: messageKey}
}

func ErrConflict(code, messageKey, field string) *APIErr {
	return &APIErr{Status: http.StatusConflict, Code: code, MessageKey: messageKey, Field: field}
}

func ErrUnauthorized(messageKey string) *APIErr {
	return &APIErr{Status: http.StatusUnauthorized, Code: "unauthorized", MessageKey: messageKey}
}

func ErrForbidden() *APIErr {
	return &APIErr{Status: http.StatusForbidden, Code: "forbidden", MessageKey: "auth.forbidden"}
}

func ErrInternal(cause error) *APIErr {
	return &APIErr{Status: http.StatusInternalServerError, Code: "internal_error", MessageKey: "internal.generic", Internal: cause}
}

func ErrTooManyRequests(messageKey string) *APIErr {
	return &APIErr{Status: http.StatusTooManyRequests, Code: "rate_limited", MessageKey: messageKey}
}

// ── Locale context ───────────────────────────────────────────────────────

const localeKey contextKey = "locale"

// LocaleFromContext returns the request locale, defaulting to "en".
func LocaleFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(localeKey).(string); ok && v != "" {
		return v
	}
	return i18n.EN
}

// WithLocale returns a context with the locale set.
func WithLocale(ctx context.Context, locale string) context.Context {
	return context.WithValue(ctx, localeKey, locale)
}

// ── Localized error renderer ─────────────────────────────────────────────

// WriteAPIErr renders a typed API error with a localized message.
func WriteAPIErr(w http.ResponseWriter, r *http.Request, apiErr *APIErr) {
	locale := LocaleFromContext(r.Context())
	message := i18n.T(locale, apiErr.MessageKey)

	// Log internal errors for operators but don't expose to clients
	if apiErr.Internal != nil {
		slog.Error("api error",
			"code", apiErr.Code,
			"status", apiErr.Status,
			"error", apiErr.Internal.Error(),
		)
	}

	resp := ErrorResponse{
		Error: APIError{
			Code:    apiErr.Code,
			Message: message,
			Field:   apiErr.Field,
		},
	}

	writeJSON(w, apiErr.Status, resp)
}
