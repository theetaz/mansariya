package server

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/masariya/backend/internal/handler"
)

func TestLocaleMiddleware_AcceptLanguage(t *testing.T) {
	tests := []struct {
		name           string
		acceptLanguage string
		xLocale        string
		expected       string
	}{
		{"sinhala", "si", "", "si"},
		{"tamil", "ta", "", "ta"},
		{"english", "en", "", "en"},
		{"sinhala with region", "si-LK", "", "si"},
		{"tamil with quality", "ta;q=0.9, en;q=0.8", "", "ta"},
		{"multiple prefer first", "si, en;q=0.5", "", "si"},
		{"unsupported falls back", "fr, de", "", "en"},
		{"empty header", "", "", "en"},
		{"malformed header", ";;;", "", "en"},
		{"x-locale override", "en", "ta", "ta"},
		{"x-locale takes priority", "si", "ta", "ta"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotLocale string
			inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotLocale = handler.LocaleFromContext(r.Context())
				w.WriteHeader(http.StatusOK)
			})

			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.acceptLanguage != "" {
				req.Header.Set("Accept-Language", tt.acceptLanguage)
			}
			if tt.xLocale != "" {
				req.Header.Set("X-Locale", tt.xLocale)
			}
			rec := httptest.NewRecorder()

			LocaleMiddleware(inner).ServeHTTP(rec, req)
			assert.Equal(t, tt.expected, gotLocale)
		})
	}
}
