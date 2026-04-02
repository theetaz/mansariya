package server

import (
	"net/http"
	"strings"

	"github.com/masariya/backend/internal/handler"
	"github.com/masariya/backend/internal/i18n"
)

// LocaleMiddleware resolves the request locale from headers and attaches it to context.
//
// Resolution order:
//  1. X-Locale header (explicit override, useful for admin portal)
//  2. Accept-Language header (standard HTTP content negotiation)
//  3. Default: "en"
func LocaleMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		locale := i18n.EN

		// 1. Explicit override header
		if override := r.Header.Get("X-Locale"); override != "" {
			locale = i18n.NormalizeLocale(override)
		} else if al := r.Header.Get("Accept-Language"); al != "" {
			// 2. Parse Accept-Language (take first supported match)
			locale = parseAcceptLanguage(al)
		}

		ctx := handler.WithLocale(r.Context(), locale)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// parseAcceptLanguage extracts the best supported locale from the Accept-Language header.
// Supports formats: "si", "si-LK", "si;q=0.9, en;q=0.8", "ta, en-US;q=0.7".
func parseAcceptLanguage(header string) string {
	// Split by comma, check each entry
	for _, part := range strings.Split(header, ",") {
		lang := strings.TrimSpace(part)
		// Strip quality value (e.g. "si;q=0.9" → "si")
		if idx := strings.Index(lang, ";"); idx > 0 {
			lang = strings.TrimSpace(lang[:idx])
		}
		normalized := i18n.NormalizeLocale(lang)
		if normalized != i18n.EN || strings.HasPrefix(strings.ToLower(lang), "en") {
			// Found a supported locale (or explicitly "en")
			return normalized
		}
	}
	return i18n.EN
}
