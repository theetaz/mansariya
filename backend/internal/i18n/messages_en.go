package i18n

var enMessages = map[string]string{
	// ── Validation ───────────────────────────────────────────────────────
	"validation.required":       "This field is required.",
	"validation.invalid_email":  "Please enter a valid email address.",
	"validation.invalid_body":   "The request body is invalid.",
	"validation.too_short":      "This value is too short.",
	"validation.too_long":       "This value is too long.",
	"validation.invalid_format": "The format is invalid.",

	// ── Auth ─────────────────────────────────────────────────────────────
	"auth.invalid_credentials": "Invalid email or password.",
	"auth.account_disabled":    "This account has been disabled.",
	"auth.account_locked":      "Too many failed attempts. Please try again later.",
	"auth.account_not_active":  "Please accept your invitation first.",
	"auth.unauthorized":        "Authentication is required.",
	"auth.forbidden":           "You do not have permission to perform this action.",
	"auth.invalid_token":       "Invalid or expired token.",
	"auth.session_expired":     "Your session has expired. Please sign in again.",
	"auth.weak_password":       "Password must be at least 8 characters with uppercase, lowercase, and a digit.",

	// ── Not found ────────────────────────────────────────────────────────
	"not_found.route":      "Route not found.",
	"not_found.stop":       "Stop not found.",
	"not_found.user":       "User not found.",
	"not_found.session":    "Session not found.",
	"not_found.simulation": "Simulation not found.",
	"not_found.timetable":  "Timetable not found.",
	"not_found.generic":    "The requested resource was not found.",

	// ── Conflict ─────────────────────────────────────────────────────────
	"conflict.route_id":    "A route with this ID already exists.",
	"conflict.email":       "This email address is already in use.",
	"conflict.duplicate":   "This record already exists.",

	// ── Internal ─────────────────────────────────────────────────────────
	"internal.generic":     "Something went wrong. Please try again.",
	"internal.save_failed": "Could not save the data right now. Please try again.",
	"internal.load_failed": "Could not load the data right now. Please try again.",

	// ── Success ──────────────────────────────────────────────────────────
	"success.created":  "Created successfully.",
	"success.updated":  "Updated successfully.",
	"success.deleted":  "Deleted successfully.",
	"success.saved":    "Saved successfully.",
}
