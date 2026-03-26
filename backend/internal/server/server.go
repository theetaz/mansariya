package server

import (
	"context"
	"log/slog"
	"net/http"
	"time"
)

type Server struct {
	httpServer *http.Server
}

func New(addr string, router http.Handler) *Server {
	return &Server{
		httpServer: &http.Server{
			Addr:         addr,
			Handler:      router,
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 15 * time.Second,
			IdleTimeout:  60 * time.Second,
		},
	}
}

func (s *Server) Start() error {
	slog.Info("server starting", "addr", s.httpServer.Addr)
	return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	slog.Info("server shutting down")
	return s.httpServer.Shutdown(ctx)
}
