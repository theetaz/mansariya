package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Contract tests verify the localization system behaves consistently
// across locales and error types — stable codes, localized messages,
// consistent envelope shape.

func TestContract_ErrorEnvelope_AlwaysHasCodeAndMessage(t *testing.T) {
	errors := []*APIErr{
		ErrValidation("validation_failed", "validation.required", "email"),
		ErrNotFound("not_found.route"),
		ErrConflict("duplicate", "conflict.route_id", "id"),
		ErrUnauthorized("auth.unauthorized"),
		ErrForbidden(),
		ErrInternal(nil),
		ErrTooManyRequests("auth.account_locked"),
	}

	for _, apiErr := range errors {
		t.Run(apiErr.Code, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req = req.WithContext(WithLocale(req.Context(), "en"))
			rec := httptest.NewRecorder()

			WriteAPIErr(rec, req, apiErr)

			var resp ErrorResponse
			require.NoError(t, json.NewDecoder(rec.Body).Decode(&resp))
			assert.NotEmpty(t, resp.Error.Code, "code must not be empty")
			assert.NotEmpty(t, resp.Error.Message, "message must not be empty")
			assert.Equal(t, apiErr.Status, rec.Code, "HTTP status must match")
		})
	}
}

func TestContract_StableCodeAcrossLocales(t *testing.T) {
	locales := []string{"en", "si", "ta"}
	apiErr := ErrNotFound("not_found.route")

	var codes []string
	for _, locale := range locales {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req = req.WithContext(WithLocale(req.Context(), locale))
		rec := httptest.NewRecorder()

		WriteAPIErr(rec, req, apiErr)

		var resp ErrorResponse
		require.NoError(t, json.NewDecoder(rec.Body).Decode(&resp))
		codes = append(codes, resp.Error.Code)
	}

	// Code must be the same regardless of locale
	assert.Equal(t, codes[0], codes[1], "EN and SI codes must match")
	assert.Equal(t, codes[0], codes[2], "EN and TA codes must match")
}

func TestContract_MessageDiffersAcrossLocales(t *testing.T) {
	apiErr := ErrNotFound("not_found.route")
	messages := map[string]string{}

	for _, locale := range []string{"en", "si", "ta"} {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req = req.WithContext(WithLocale(req.Context(), locale))
		rec := httptest.NewRecorder()

		WriteAPIErr(rec, req, apiErr)

		var resp ErrorResponse
		require.NoError(t, json.NewDecoder(rec.Body).Decode(&resp))
		messages[locale] = resp.Error.Message
	}

	// Messages should differ between locales (they're translated)
	assert.NotEqual(t, messages["en"], messages["si"], "EN and SI messages should differ")
	assert.NotEqual(t, messages["en"], messages["ta"], "EN and TA messages should differ")
}

func TestContract_FallbackLocaleProducesEnglish(t *testing.T) {
	apiErr := ErrValidation("test", "validation.required", "")

	// Unknown locale falls back to EN
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(WithLocale(req.Context(), "fr"))
	rec := httptest.NewRecorder()

	WriteAPIErr(rec, req, apiErr)

	var resp ErrorResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&resp))
	assert.Equal(t, "This field is required.", resp.Error.Message)
}

func TestContract_InternalErrorNeverLeaksDetails(t *testing.T) {
	apiErr := ErrInternal(fmt.Errorf("SELECT * FROM users: connection refused to postgres:5432"))

	for _, locale := range []string{"en", "si", "ta"} {
		t.Run(locale, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req = req.WithContext(WithLocale(req.Context(), locale))
			rec := httptest.NewRecorder()

			WriteAPIErr(rec, req, apiErr)

			body := rec.Body.String()
			assert.NotContains(t, body, "postgres")
			assert.NotContains(t, body, "SELECT")
			assert.NotContains(t, body, "connection refused")
			assert.NotContains(t, body, "5432")
		})
	}
}
