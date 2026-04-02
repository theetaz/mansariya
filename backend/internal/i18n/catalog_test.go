package i18n

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestT_EnglishKey(t *testing.T) {
	msg := T("en", "auth.invalid_credentials")
	assert.Equal(t, "Invalid email or password.", msg)
}

func TestT_SinhalaKey(t *testing.T) {
	msg := T("si", "auth.invalid_credentials")
	assert.Equal(t, "වලංගු නොවන ඊමේල් හෝ මුරපදය.", msg)
}

func TestT_TamilKey(t *testing.T) {
	msg := T("ta", "auth.invalid_credentials")
	assert.Equal(t, "தவறான மின்னஞ்சல் அல்லது கடவுச்சொல்.", msg)
}

func TestT_FallbackToEnglish(t *testing.T) {
	// Use a catalog with incomplete SI bundle
	c := New()
	c.LoadBundle(EN, map[string]string{"test.key": "English value"})
	c.LoadBundle(SI, map[string]string{}) // no SI translation

	msg := c.T("si", "test.key")
	assert.Equal(t, "English value", msg, "should fall back to English")
}

func TestT_MissingKeyAllLocales(t *testing.T) {
	msg := T("en", "totally.nonexistent.key")
	assert.Equal(t, "An error occurred. Please try again.", msg)
}

func TestT_EmptyLocale(t *testing.T) {
	msg := T("", "auth.unauthorized")
	// Empty locale falls back to EN
	assert.Equal(t, "Authentication is required.", msg)
}

func TestT_DoesNotPanic(t *testing.T) {
	assert.NotPanics(t, func() {
		T("", "")
		T("xx", "yy.zz")
		T("en", "")
	})
}

func TestNormalizeLocale(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"en", "en"},
		{"si", "si"},
		{"ta", "ta"},
		{"en-US", "en"},
		{"si-LK", "si"},
		{"ta_LK", "ta"},
		{"EN", "en"},
		{"SI", "si"},
		{"fr", "en"},     // unsupported → English
		{"", "en"},        // empty → English
		{"  si  ", "si"},  // trimmed
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			assert.Equal(t, tt.expected, NormalizeLocale(tt.input))
		})
	}
}

func TestAllLocalesHaveSameKeys(t *testing.T) {
	// Verify SI and TA have all EN keys (catches missing translations early)
	for key := range enMessages {
		if _, ok := siMessages[key]; !ok {
			t.Errorf("SI bundle missing key: %s", key)
		}
		if _, ok := taMessages[key]; !ok {
			t.Errorf("TA bundle missing key: %s", key)
		}
	}
}
