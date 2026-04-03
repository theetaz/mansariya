package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/masariya/backend/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockIngester implements GPSIngester for testing.
type mockIngester struct {
	batches []model.GPSBatch
	err     error
}

func (m *mockIngester) Ingest(_ context.Context, batch model.GPSBatch) error {
	if m.err != nil {
		return m.err
	}
	m.batches = append(m.batches, batch)
	return nil
}

func TestGPSHandler_ValidBatch(t *testing.T) {
	ing := &mockIngester{}
	h := NewGPSHandler(ing, nil, nil)

	batch := model.GPSBatch{
		DeviceHash: "abc123",
		SessionID:  "sess_1",
		Pings: []model.GPSPing{
			{Lat: 6.9271, Lng: 79.8612, Timestamp: 1000, Accuracy: 10, Speed: 12, Bearing: 45},
			{Lat: 6.9285, Lng: 79.8620, Timestamp: 1005, Accuracy: 8, Speed: 13, Bearing: 46},
		},
	}
	body, _ := json.Marshal(batch)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/gps/batch", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.HandleBatch(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "ok", resp["status"])
	assert.Equal(t, float64(2), resp["processed"])

	require.Len(t, ing.batches, 1)
	assert.Equal(t, "abc123", ing.batches[0].DeviceHash)
	assert.Len(t, ing.batches[0].Pings, 2)
}

func TestGPSHandler_EmptyBody(t *testing.T) {
	h := NewGPSHandler(&mockIngester{}, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/gps/batch", bytes.NewReader([]byte("")))
	w := httptest.NewRecorder()

	h.HandleBatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGPSHandler_InvalidJSON(t *testing.T) {
	h := NewGPSHandler(&mockIngester{}, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/gps/batch", bytes.NewReader([]byte("{invalid")))
	w := httptest.NewRecorder()

	h.HandleBatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGPSHandler_MissingDeviceHash(t *testing.T) {
	h := NewGPSHandler(&mockIngester{}, nil, nil)

	batch := model.GPSBatch{
		SessionID: "sess_1",
		Pings:     []model.GPSPing{{Lat: 6.9, Lng: 79.8}},
	}
	body, _ := json.Marshal(batch)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/gps/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.HandleBatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGPSHandler_MissingSessionID(t *testing.T) {
	h := NewGPSHandler(&mockIngester{}, nil, nil)

	batch := model.GPSBatch{
		DeviceHash: "abc123",
		Pings:      []model.GPSPing{{Lat: 6.9, Lng: 79.8}},
	}
	body, _ := json.Marshal(batch)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/gps/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.HandleBatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGPSHandler_EmptyPings(t *testing.T) {
	h := NewGPSHandler(&mockIngester{}, nil, nil)

	batch := model.GPSBatch{
		DeviceHash: "abc123",
		SessionID:  "sess_1",
		Pings:      []model.GPSPing{},
	}
	body, _ := json.Marshal(batch)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/gps/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.HandleBatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGPSHandler_StoppedEventAllowsEmptyPings(t *testing.T) {
	ing := &mockIngester{}
	h := NewGPSHandler(ing, nil, nil)

	batch := model.GPSBatch{
		DeviceHash: "abc123",
		SessionID:  "sess_1",
		EventType:  model.GPSEventStopped,
	}
	body, _ := json.Marshal(batch)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/gps/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.HandleBatch(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	require.Len(t, ing.batches, 1)
	assert.Equal(t, model.GPSEventStopped, ing.batches[0].EventType)
	assert.Len(t, ing.batches[0].Pings, 0)
}

func TestGPSHandler_InvalidCoordinates(t *testing.T) {
	h := NewGPSHandler(&mockIngester{}, nil, nil)

	batch := model.GPSBatch{
		DeviceHash: "abc123",
		SessionID:  "sess_1",
		Pings:      []model.GPSPing{{Lat: 120, Lng: 79.8, Timestamp: 1000, Accuracy: 10, Speed: 12, Bearing: 45}},
	}
	body, _ := json.Marshal(batch)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/gps/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.HandleBatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGPSHandler_IngesterError(t *testing.T) {
	ing := &mockIngester{err: fmt.Errorf("redis connection failed")}
	h := NewGPSHandler(ing, nil, nil)

	batch := model.GPSBatch{
		DeviceHash: "abc123",
		SessionID:  "sess_1",
		Pings:      []model.GPSPing{{Lat: 6.9, Lng: 79.8, Timestamp: 1000}},
	}
	body, _ := json.Marshal(batch)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/gps/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.HandleBatch(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}
