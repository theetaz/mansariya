package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	// Server
	Port string
	Host string

	// Database
	DatabaseURL string

	// Redis
	RedisAddr     string
	RedisPassword string
	RedisDB       int

	// Valhalla
	ValhallaURL string

	// Nominatim
	NominatimURL string

	// Admin
	AdminAPIKey string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:         getEnv("PORT", "8000"),
		Host:         getEnv("HOST", "0.0.0.0"),
		DatabaseURL:  getEnv("DATABASE_URL", "postgres://masariya:masariya@localhost:5433/masariya?sslmode=disable"),
		RedisAddr:    getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:      getEnvInt("REDIS_DB", 0),
		ValhallaURL:  getEnv("VALHALLA_URL", "http://localhost:8002"),
		NominatimURL: getEnv("NOMINATIM_URL", "http://localhost:8080"),
		AdminAPIKey:  getEnv("ADMIN_API_KEY", "mansariya-dev-key"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	return cfg, nil
}

func (c *Config) Addr() string {
	return c.Host + ":" + c.Port
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return fallback
}
