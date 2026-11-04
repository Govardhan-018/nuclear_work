export type WebUser = {
  id: string
  email?: string
}

export type WebSession = {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: WebUser
}

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "")
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const SESSION_KEY = "maya.web.supabase.session"
const API_RESOURCES: Record<string, string> = {
  habitLogs: "habit-logs", readingSessions: "reading-sessions", focusSessions: "focus-sessions",
  nutritionLogs: "nutrition-logs", aiMessages: "ai-messages",
}
function apiResource(table: string): string { return API_RESOURCES[table] ?? table }

export function isWebCloudConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY)
}

export function loadWebSession(): WebSession | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as WebSession) : null
  } catch {
    return null
  }
}

export function saveWebSession(session: WebSession | null): void {
  if (typeof localStorage === "undefined") return
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
}

function requireConfig(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase is not configured for this web build.")
  }
  return { url: SUPABASE_URL, key: SUPABASE_KEY }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const { url, key } = requireConfig()
  const headers = new Headers(options.headers)
  headers.set("apikey", key)
  headers.set("Accept", "application/json")
  if (options.body) headers.set("Content-Type", "application/json")
  headers.set("Authorization", `Bearer ${accessToken ?? key}`)

  const response = await fetch(`${url}${path}`, { ...options, headers })
  const text = await response.text()
  let payload: unknown = null
  try { payload = text ? JSON.parse(text) : null } catch { payload = text }
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "msg" in payload
        ? String((payload as { msg: unknown }).msg)
        : typeof payload === "object" && payload !== null && "message" in payload
          ? String((payload as { message: unknown }).message)
          : `Supabase request failed (${response.status})`
    throw new Error(message)
  }
  return payload as T
}

export async function signInWithPassword(email: string, password: string): Promise<WebSession> {
  const session = await request<WebSession>("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  saveWebSession(session)
  return session
}

export async function signUpWithPassword(email: string, password: string): Promise<WebSession | null> {
  const result = await request<WebSession | { user: WebUser }>("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  if ("access_token" in result) {
    saveWebSession(result)
    return result
  }
  return null
}

export async function refreshWebSession(): Promise<WebSession | null> {
  const current = loadWebSession()
  if (!current?.refresh_token) return null
  try {
    const session = await request<WebSession>("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    })
    saveWebSession(session)
    return session
  } catch {
    saveWebSession(null)
    return null
  }
}

export async function signOutWeb(): Promise<void> {
  const current = loadWebSession()
  if (current?.access_token) {
    try { await request("/auth/v1/logout", { method: "POST" }, current.access_token) } catch { /* local sign-out still wins */ }
  }
  saveWebSession(null)
}

export async function readCloudRows<T>(
  table: string,
  query = "select=*",
): Promise<T[]> {
  const session = loadWebSession()
  if (!session) throw new Error("Sign in to access cloud data.")
  return request<{ data: T[] }>(`/functions/v1/api/v1/${apiResource(table)}?${query}`, {}, session.access_token).then((result) => result.data)
}

export async function upsertCloudRow<T extends Record<string, unknown>>(
  table: string,
  row: T,
  onConflict: string,
): Promise<T[]> {
  const session = loadWebSession()
  if (!session) throw new Error("Sign in to save cloud data.")
  return request<{ data: T[] }>(`/functions/v1/api/v1/${apiResource(table)}`, {
    method: "POST",
    body: JSON.stringify(row),
  }, session.access_token).then((result) => result.data)
}

export async function invokeCloudFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const session = loadWebSession()
  if (!session) throw new Error("Sign in to use cloud services.")
  return request<T>(`/functions/v1/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  }, session.access_token)
}
