package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWriteAPIErr_Validation(t *testing.T) {
	apiErr := ErrValidation("validation_failed", "validation.required", "email")

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(WithLocale(req.Context(), "en"))
	rec := httptest.NewRecorder()

	WriteAPIErr(rec, req, apiErr)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var resp ErrorResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&resp))
	assert.Equal(t, "validation_failed", resp.Error.Code)
	assert.Equal(t, "This field is required.", resp.Error.Message)
	assert.Equal(t, "email", resp.Error.Field)
}

func TestWriteAPIErr_NotFound_Sinhala(t *testing.T) {
	apiErr := ErrNotFound("not_found.route")

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(WithLocale(req.Context(), "si"))
	rec := httptest.NewRecorder()

	WriteAPIErr(rec, req, apiErr)

	assert.Equal(t, http.StatusNotFound, rec.Code)

	var resp ErrorResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&resp))
	assert.Equal(t, "not_found", resp.Error.Code)
	assert.Equal(t, "මාර්ගය හමු නොවීය.", resp.Error.Message)
}

func TestWriteAPIErr_Conflict(t *testing.T) {
	apiErr := ErrConflict("route_id_exists", "conflict.route_id", "id")

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(WithLocale(req.Context(), "ta"))
	rec := httptest.NewRecorder()

	WriteAPIErr(rec, req, apiErr)

	assert.Equal(t, http.StatusConflict, rec.Code)

	var resp ErrorResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&resp))
	assert.Equal(t, "route_id_exists", resp.Error.Code)
	assert.Equal(t, "இந்த அடையாள எண் கொண்ட வழி ஏற்கனவே உள்ளது.", resp.Error.Message)
	assert.Equal(t, "id", resp.Error.Field)
}

func TestWriteAPIErr_Internal_HidesDetails(t *testing.T) {
	apiErr := ErrInternal(errors.New("pgx: connection refused"))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(WithLocale(req.Context(), "en"))
	rec := httptest.NewRecorder()

	WriteAPIErr(rec, req, apiErr)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)

	var resp ErrorResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&resp))
	assert.Equal(t, "internal_error", resp.Error.Code)
	assert.Equal(t, "Something went wrong. Please try again.", resp.Error.Message)
	// Internal cause must NOT appear in response
	assert.NotContains(t, rec.Body.String(), "pgx")
	assert.NotContains(t, rec.Body.String(), "connection refused")
}

func TestAPIErr_Error(t *testing.T) {
	err := ErrValidation("test", "test.key", "")
	assert.Equal(t, "test", err.Error())

	errWithCause := ErrInternal(errors.New("db down"))
	assert.Contains(t, errWithCause.Error(), "db down")
}

func TestLocaleFromContext_Default(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	assert.Equal(t, "en", LocaleFromContext(req.Context()))
}

func TestLocaleFromContext_Set(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := WithLocale(req.Context(), "ta")
	assert.Equal(t, "ta", LocaleFromContext(ctx))
}
