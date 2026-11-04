import { http, isNative, NetworkError } from "./platform"

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

const API_URL = (import.meta.env.VITE_MAYA_API_URL as string | undefined)?.replace(/\/$/, "")
const SESSION_KEY = "maya.web.supabase.session"
const API_RESOURCES: Record<string, string> = {
  habitLogs: "habit-logs", readingSessions: "reading-sessions", focusSessions: "focus-sessions",
  nutritionLogs: "nutrition-logs", aiMessages: "ai-messages",
}
function apiResource(table: string): string { return API_RESOURCES[table] ?? table }

export function isWebCloudConfigured(): boolean {
  return Boolean(API_URL)
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

function requireConfig(): { url: string } {
  if (!API_URL) throw new Error("Maya API is not configured for this web build.")
  return { url: API_URL }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const { url } = requireConfig()
  const headers: Record<string, string> = { Accept: "application/json" }
  if (options.body) headers["Content-Type"] = "application/json"
  if (accessToken) headers.Authorization = "Bearer " + accessToken

  let body: unknown
  if (typeof options.body === "string") {
    try { body = JSON.parse(options.body) } catch { body = options.body }
  } else {
    body = options.body
  }
  const response = await http<T>({
    url: url + path,
    method: (options.method ?? "GET") as "GET" | "POST" | "PUT" | "DELETE",
    headers,
    body,
  })
  if (!response.ok) throw new Error(response.error || "Maya API request failed (" + response.status + ")")
  return response.data
}

export async function signInWithPassword(email: string, password: string): Promise<WebSession> {
  const session = await request<WebSession>("/api/v1/auth/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  const normalized = normalizeSession(session)
  saveWebSession(normalized)
  return normalized
}

function confirmationRedirectUrl(): string | undefined {
  // Native confirmation returns through Supabase's configured Site URL. The
  // WebView's localhost origin is not a public redirect destination.
  if (isNative() || typeof location === "undefined") return undefined
  return location.protocol === "http:" || location.protocol === "https:" ? location.origin : undefined
}

export async function signUpWithPassword(email: string, password: string): Promise<WebSession | null> {
  const emailRedirectTo = confirmationRedirectUrl()
  const result = await request<WebSession | { user: WebUser }>("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
    }),
  })
  if ("access_token" in result) {
    const normalized = normalizeSession(result)
    saveWebSession(normalized)
    return normalized
  }
  return null
}

export async function refreshWebSession(): Promise<WebSession | null> {
  const current = loadWebSession()
  if (!current?.refresh_token) return null
  try {
    const session = await request<WebSession>("/api/v1/auth/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    })
    const normalized = normalizeSession(session)
    saveWebSession(normalized)
    return normalized
  } catch (error) {
    // Keeping the cached session lets a signed-in device open its local data
    // while offline. A rejected refresh still clears an invalid account session.
    if (error instanceof NetworkError) return current
    saveWebSession(null)
    return null
  }
}

export async function signOutWeb(): Promise<void> {
  const current = loadWebSession()
  if (current?.access_token) {
    try { await request("/api/v1/auth/logout", { method: "POST" }, current.access_token) } catch { /* local sign-out still wins */ }
  }
  saveWebSession(null)
}

export async function readCloudRows<T>(
  table: string,
  query = "select=*",
): Promise<T[]> {
  const session = loadWebSession()
  if (!session) throw new Error("Sign in to access cloud data.")
  return request<{ data: T[] }>(`/api/v1/${apiResource(table)}?${query}`, {}, session.access_token).then((result) => result.data)
}

export async function upsertCloudRow<T extends Record<string, unknown>>(
  table: string,
  row: T,
  onConflict: string,
): Promise<T[]> {
  const session = loadWebSession()
  if (!session) throw new Error("Sign in to save cloud data.")
  return request<{ data: T[] }>(`/api/v1/${apiResource(table)}`, {
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
function normalizeSession(session: WebSession): WebSession {
  if (!session.expires_at && "expires_in" in session) {
    const expiresIn = Number((session as WebSession & { expires_in?: number }).expires_in)
    if (expiresIn > 0) session.expires_at = Math.floor(Date.now() / 1000) + expiresIn
  }
  return session
}

export async function ensureWebSession(): Promise<WebSession | null> {
  const current = loadWebSession()
  if (!current) return null
  if (!current.expires_at || current.expires_at <= Math.floor(Date.now() / 1000) + 60) {
    return refreshWebSession()
  }
  return current
}

export type CloudBootstrap = Record<string, Array<Record<string, unknown>>>
export type CloudChange = { table: string; recordId: string; operation: "upsert" | "delete"; data: Record<string, unknown> }

export async function fetchCloudBootstrap(): Promise<CloudBootstrap> {
  const session = await ensureWebSession()
  if (!session) throw new Error("Sign in to access cloud data.")
  return request<{ data: CloudBootstrap }>("/api/v1/bootstrap", {}, session.access_token).then((result) => result.data)
}

export async function pushCloudChanges(changes: CloudChange[]): Promise<void> {
  const session = await ensureWebSession()
  if (!session) throw new Error("Sign in to save cloud data.")
  await request("/api/v1/sync", { method: "POST", body: JSON.stringify({ changes }) }, session.access_token)
}
export async function resendConfirmationEmail(email: string): Promise<void> {
  const emailRedirectTo = confirmationRedirectUrl()
  await request("/api/v1/auth/resend", {
    method: "POST",
    body: JSON.stringify({
      email,
      type: "signup",
      ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
    }),
  })
}
