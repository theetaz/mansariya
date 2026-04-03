// bootstrap-admin creates the first super admin user.
//
// Usage:
//
//	go run ./cmd/bootstrap-admin \
//	  -email admin@mansariya.lk \
//	  -password changeme123 \
//	  -name "Super Admin"
//
// The command will only create a user if no users exist in the database.
// Running it again is a no-op (safe to re-run).
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"

	"golang.org/x/crypto/bcrypt"

	"github.com/masariya/backend/internal/config"
	"github.com/masariya/backend/internal/store"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	email := flag.String("email", "", "Super admin email (required)")
	password := flag.String("password", "", "Super admin password (required)")
	name := flag.String("name", "Super Admin", "Display name")
	flag.Parse()

	if *email == "" || *password == "" {
		fmt.Fprintln(os.Stderr, "Usage: bootstrap-admin -email <email> -password <password> [-name <name>]")
		os.Exit(1)
	}

	if err := run(*email, *password, *name); err != nil {
		slog.Error("bootstrap failed", "error", err)
		os.Exit(1)
	}
}

func run(email, password, displayName string) error {
	ctx := context.Background()

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	pool, err := store.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("connect db: %w", err)
	}
	defer pool.Close()

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	authStore := store.NewAuthStore(pool)
	user, err := authStore.BootstrapSuperAdmin(ctx, email, string(hash), displayName)
	if err != nil {
		return fmt.Errorf("bootstrap: %w", err)
	}

	if user == nil {
		slog.Info("users already exist — skipping bootstrap")
		return nil
	}

	slog.Info("super admin created",
		"id", user.ID,
		"email", user.Email,
		"status", user.Status,
	)
	return nil
}
