package handler

import (
	"encoding/json"
	"net/http"
)

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
}

type ErrorResponse struct {
	Error APIError `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code string, message string, field string) {
	writeJSON(w, status, ErrorResponse{
		Error: APIError{
			Code:    code,
			Message: message,
			Field:   field,
		},
	})
}
