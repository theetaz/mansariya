// Package i18n provides a centralized trilingual message catalog for API responses.
// Messages are keyed by stable string identifiers and resolved per-locale (en, si, ta).
// Missing translations fall back to English; completely unknown keys return a safe generic message.
package i18n

import (
	"log/slog"
	"strings"
	"sync"
)

// Supported locales.
const (
	EN = "en"
	SI = "si"
	TA = "ta"
)

var supportedLocales = map[string]bool{EN: true, SI: true, TA: true}

// Catalog holds translation bundles keyed by locale → message key → translated string.
type Catalog struct {
	mu      sync.RWMutex
	bundles map[string]map[string]string // locale → key → message
}

// defaultCatalog is the package-level singleton loaded at init.
var defaultCatalog *Catalog

func init() {
	defaultCatalog = New()
	defaultCatalog.LoadBundle(EN, enMessages)
	defaultCatalog.LoadBundle(SI, siMessages)
	defaultCatalog.LoadBundle(TA, taMessages)
}

// New creates an empty catalog.
func New() *Catalog {
	return &Catalog{bundles: make(map[string]map[string]string)}
}

// LoadBundle registers all messages for a locale.
func (c *Catalog) LoadBundle(locale string, messages map[string]string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.bundles[locale] = messages
}

// T resolves a message key for the given locale.
// Falls back to English if the key is missing in the requested locale.
// Returns a safe generic message if the key is missing in all locales.
func (c *Catalog) T(locale, key string) string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// Try requested locale
	if bundle, ok := c.bundles[locale]; ok {
		if msg, ok := bundle[key]; ok {
			return msg
		}
	}

	// Fall back to English
	if locale != EN {
		if bundle, ok := c.bundles[EN]; ok {
			if msg, ok := bundle[key]; ok {
				return msg
			}
		}
	}

	// Unknown key — log and return safe fallback
	slog.Warn("missing translation key", "key", key, "locale", locale)
	return "An error occurred. Please try again."
}

// T resolves a message from the default catalog.
func T(locale, key string) string {
	return defaultCatalog.T(locale, key)
}

// NormalizeLocale parses a locale string and returns the best supported locale.
// Accepts "en", "si", "ta", "en-US", "si-LK", etc. Defaults to "en".
func NormalizeLocale(raw string) string {
	raw = strings.TrimSpace(strings.ToLower(raw))
	if raw == "" {
		return EN
	}
	// Take the language part before any dash/underscore
	lang := raw
	if idx := strings.IndexAny(raw, "-_"); idx > 0 {
		lang = raw[:idx]
	}
	if supportedLocales[lang] {
		return lang
	}
	return EN
}
