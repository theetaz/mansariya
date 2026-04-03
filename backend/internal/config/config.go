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

	// OSRM
	OSRMURL string

	// Admin
	AdminAPIKey string

	// Auth / JWT
	JWTSecret          string
	AccessTokenExpiry  int // minutes
	RefreshTokenExpiry int // hours
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:               getEnv("PORT", "9900"),
		Host:               getEnv("HOST", "0.0.0.0"),
		DatabaseURL:        getEnv("DATABASE_URL", ""),
		RedisAddr:          getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:      getEnv("REDIS_PASSWORD", ""),
		RedisDB:            getEnvInt("REDIS_DB", 0),
		ValhallaURL:        getEnv("VALHALLA_URL", "http://127.0.0.1:9992"),
		NominatimURL:       getEnv("NOMINATIM_URL", "http://127.0.0.1:9990"),
		OSRMURL:            getEnv("OSRM_URL", "https://router.project-osrm.org"),
		AdminAPIKey:        getEnv("ADMIN_API_KEY", ""),
		JWTSecret:          getEnv("JWT_SECRET", ""),
		AccessTokenExpiry:  getEnvInt("ACCESS_TOKEN_EXPIRY_MIN", 15),
		RefreshTokenExpiry: getEnvInt("REFRESH_TOKEN_EXPIRY_HR", 168), // 7 days
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required (set via environment variable)")
	}
	if cfg.AdminAPIKey == "" {
		return nil, fmt.Errorf("ADMIN_API_KEY is required (set via environment variable)")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required (set via environment variable)")
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
