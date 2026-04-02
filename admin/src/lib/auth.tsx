import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "")

// ── Types ────────────────────────────────────────────────────────────────

export type AuthUser = {
  id: string
  email: string
  display_name: string
  status: string
  roles: { id: string; slug: string; name: string }[]
}

type TokenState = {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

type AuthState = {
  user: AuthUser | null
  permissions: string[]
  tokens: TokenState | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (perm: string) => boolean
}

// ── Storage ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "mansariya_auth"

function loadStoredAuth(): TokenState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as TokenState
    // Check if token is expired
    if (new Date(data.expiresAt) < new Date()) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return data
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function storeAuth(tokens: TokenState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY)
}

// ── API calls ────────────────────────────────────────────────────────────

async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: "Login failed" } }))
    throw new Error(body.error?.message || "Login failed")
  }
  return res.json()
}

async function apiLogout(refreshToken: string) {
  await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  }).catch(() => {})
}

async function apiMe(accessToken: string) {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error("Session expired")
  return res.json()
}

async function apiRefresh(refreshToken: string) {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error("Refresh failed")
  return res.json()
}

// ── Context ──────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [tokens, setTokens] = useState<TokenState | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session on mount
  useEffect(() => {
    const stored = loadStoredAuth()
    if (!stored) {
      setIsLoading(false)
      return
    }

    // Try to load user with existing access token
    apiMe(stored.accessToken)
      .then((data) => {
        setUser(data.user)
        setPermissions(data.permissions || [])
        setTokens(stored)
      })
      .catch(async () => {
        // Access token expired — try refresh
        try {
          const refreshed = await apiRefresh(stored.refreshToken)
          const newTokens: TokenState = {
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token,
            expiresAt: refreshed.expires_at,
          }
          storeAuth(newTokens)
          setTokens(newTokens)

          const meData = await apiMe(newTokens.accessToken)
          setUser(meData.user)
          setPermissions(meData.permissions || [])
        } catch {
          clearStoredAuth()
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    const newTokens: TokenState = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
    }
    storeAuth(newTokens)
    setTokens(newTokens)
    setUser(data.user)

    // Load permissions
    const meData = await apiMe(newTokens.accessToken)
    setPermissions(meData.permissions || [])
  }, [])

  const logout = useCallback(async () => {
    if (tokens?.refreshToken) {
      await apiLogout(tokens.refreshToken)
    }
    clearStoredAuth()
    setUser(null)
    setPermissions([])
    setTokens(null)
  }, [tokens])

  const hasPermission = useCallback(
    (perm: string) => permissions.includes(perm),
    [permissions]
  )

  const value = useMemo<AuthState>(
    () => ({
      user,
      permissions,
      tokens,
      isLoading,
      isAuthenticated: !!user && !!tokens,
      login,
      logout,
      hasPermission,
    }),
    [user, permissions, tokens, isLoading, login, logout, hasPermission]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

// ── Helper: get current access token (for API calls) ─────────────────────

export function getAccessToken(): string | null {
  const stored = loadStoredAuth()
  return stored?.accessToken ?? null
}
