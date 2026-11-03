import { Browser } from "@capacitor/browser"
import { db, newMeta } from "../db/db"
import { getAllSettings, setSettings } from "../db/settings"
import { dayKey } from "../lib/date"
import type { Activity } from "../db/types"
import { http, isNative, isOnline, NetworkError } from "./platform"

const AUTHORIZE_URL = "https://www.strava.com/oauth/mobile/authorize"
const WEB_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize"
const TOKEN_URL = "https://www.strava.com/oauth/token"
const API_BASE = "https://www.strava.com/api/v3"
const SCOPE = "activity:read_all,profile:read_all"

/**
 * Strava matches the redirect against the "Authorization Callback Domain"
 * configured on the API application. On device we follow Strava's documented
 * mobile pattern of a custom scheme whose host is a domain-shaped string, so
 * the callback domain to register is `lifeos.app`. In a browser we come back
 * to the dev server and the callback domain is `localhost`.
 */
export const NATIVE_REDIRECT_URI = "lifeos://lifeos.app/strava-callback"
export const NATIVE_CALLBACK_DOMAIN = "lifeos.app"

export function redirectUri(): string {
  if (isNative()) return NATIVE_REDIRECT_URI
  return `${window.location.origin}/strava-callback`
}

export function callbackDomain(): string {
  return isNative() ? NATIVE_CALLBACK_DOMAIN : "localhost"
}

export type StravaStatus =
  | { state: "unconfigured" }
  | { state: "disconnected" }
  | { state: "connected"; athlete: string; lastSyncAt: number }

export async function getStravaStatus(): Promise<StravaStatus> {
  const s = await getAllSettings()
  if (!s.stravaClientId || !s.stravaClientSecret) return { state: "unconfigured" }
  if (!s.stravaRefreshToken) return { state: "disconnected" }
  return {
    state: "connected",
    athlete: s.stravaAthleteName,
    lastSyncAt: s.stravaLastSyncAt,
  }
}

export function buildAuthorizeUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    approval_prompt: "auto",
    scope: SCOPE,
  })
  const base = isNative() ? AUTHORIZE_URL : WEB_AUTHORIZE_URL
  return `${base}?${params.toString()}`
}

/** Opens Strava's consent screen. The result arrives via deep link. */
export async function beginStravaAuth(): Promise<void> {
  const { stravaClientId } = await getAllSettings()
  if (!stravaClientId) throw new Error("Add your Strava Client ID first.")
  const url = buildAuthorizeUrl(stravaClientId)
  if (isNative()) {
    await Browser.open({ url, presentationStyle: "popover" })
  } else {
    window.location.href = url
  }
}

/**
 * Pulls the `code` out of whatever the user or the deep link handed us: a full
 * redirect URL, a query string, or the bare code pasted by hand.
 */
export function extractAuthCode(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (!trimmed.includes("?") && !trimmed.includes("=") && !trimmed.includes("/")) {
    return trimmed
  }
  const query = trimmed.slice(trimmed.indexOf("?") + 1)
  const params = new URLSearchParams(query)
  return params.get("code")
}

export function extractAuthError(input: string): string | null {
  const index = input.indexOf("?")
  if (index === -1) return null
  return new URLSearchParams(input.slice(index + 1)).get("error")
}

type StravaTokenResponse = {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete?: { firstname?: string; lastname?: string; username?: string }
}

/** Trades the one-time authorization code for a token pair. */
export async function exchangeCodeForToken(code: string): Promise<void> {
  const s = await getAllSettings()
  if (!s.stravaClientId || !s.stravaClientSecret) {
    throw new Error("Add your Strava Client ID and Client Secret first.")
  }
  // Strava documents this endpoint with query parameters rather than a body,
  // and that is the form it accepts most reliably.
  const response = await http<StravaTokenResponse>({
    url: TOKEN_URL,
    method: "POST",
    params: {
      client_id: s.stravaClientId,
      client_secret: s.stravaClientSecret,
      code,
      grant_type: "authorization_code",
    },
  })
  if (!response.ok) {
    throw new Error(`Strava rejected the authorization: ${response.error ?? response.status}`)
  }
  const data = response.data
  const athlete = data.athlete
  const name = [athlete?.firstname, athlete?.lastname].filter(Boolean).join(" ")
  await setSettings({
    stravaAccessToken: data.access_token,
    stravaRefreshToken: data.refresh_token,
    stravaExpiresAt: data.expires_at * 1000,
    stravaAthleteName: name || athlete?.username || "Strava athlete",
  })
}

/** Returns a valid access token, refreshing it when it is close to expiry. */
async function getAccessToken(): Promise<string> {
  const s = await getAllSettings()
  if (!s.stravaRefreshToken) throw new Error("Strava is not connected.")

  // Refresh a minute early to avoid racing the expiry.
  if (s.stravaAccessToken && s.stravaExpiresAt > Date.now() + 60_000) {
    return s.stravaAccessToken
  }

  const response = await http<StravaTokenResponse>({
    url: TOKEN_URL,
    method: "POST",
    params: {
      client_id: s.stravaClientId,
      client_secret: s.stravaClientSecret,
      grant_type: "refresh_token",
      refresh_token: s.stravaRefreshToken,
    },
  })
  if (!response.ok) {
    // A refused refresh means the grant was revoked; force a reconnect.
    await setSettings({
      stravaAccessToken: "",
      stravaRefreshToken: "",
      stravaExpiresAt: 0,
    })
    throw new Error("Strava sign-in expired. Please connect again.")
  }
  await setSettings({
    stravaAccessToken: response.data.access_token,
    stravaRefreshToken: response.data.refresh_token,
    stravaExpiresAt: response.data.expires_at * 1000,
  })
  return response.data.access_token
}

type StravaActivity = {
  id: number
  name: string
  sport_type?: string
  type?: string
  start_date: string
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  average_speed: number
  average_heartrate?: number
  max_heartrate?: number
  calories?: number
  map?: { summary_polyline?: string | null }
}

function toActivity(raw: StravaActivity): Activity {
  const startedAt = new Date(raw.start_date).getTime()
  return {
    id: `strava:${raw.id}`,
    source: "strava",
    stravaId: raw.id,
    name: raw.name || "Activity",
    type: raw.sport_type || raw.type || "Workout",
    date: dayKey(startedAt),
    startedAt,
    distanceM: raw.distance ?? 0,
    movingTimeS: raw.moving_time ?? 0,
    elapsedTimeS: raw.elapsed_time ?? 0,
    elevationM: raw.total_elevation_gain ?? 0,
    averageSpeed: raw.average_speed ?? 0,
    averageHeartrate: raw.average_heartrate ?? null,
    maxHeartrate: raw.max_heartrate ?? null,
    calories: raw.calories ?? null,
    polyline: raw.map?.summary_polyline ?? null,
    ...newMeta(),
  }
}

export type SyncResult = {
  imported: number
  pages: number
  skipped: boolean
  message: string
}

/**
 * Imports activities newer than the last sync. Passing `full` re-reads the
 * whole history, which is what the "Re-import everything" action uses.
 */
export async function syncStravaActivities(
  options: { full?: boolean } = {},
): Promise<SyncResult> {
  if (!isOnline()) {
    return { imported: 0, pages: 0, skipped: true, message: "You are offline. Strava sync will run when you reconnect." }
  }

  const settings = await getAllSettings()
  if (!settings.stravaRefreshToken) throw new Error("Strava is not connected.")

  const token = await getAccessToken()
  // Strava's `after` filter is in seconds. Re-read a day of overlap so edits
  // to recent activities are picked up.
  const after =
    options.full || settings.stravaLastSyncAt === 0
      ? undefined
      : Math.floor((settings.stravaLastSyncAt - 86_400_000) / 1000)

  let page = 1
  let imported = 0
  const perPage = 100
  const maxPages = options.full ? 20 : 5

  while (page <= maxPages) {
    const params: Record<string, string> = {
      page: String(page),
      per_page: String(perPage),
    }
    if (after !== undefined) params.after = String(after)

    const response = await http<StravaActivity[] | Record<string, unknown>>({
      url: `${API_BASE}/athlete/activities`,
      headers: { Authorization: `Bearer ${token}` },
      params,
    })

    if (response.status === 429) {
      return {
        imported, pages: page - 1, skipped: false,
        message: `Strava rate limit reached. Imported ${imported} activities; try again in 15 minutes.`,
      }
    }
    if (!response.ok) {
      throw new Error(`Strava sync failed: ${response.error ?? response.status}`)
    }

    const batch = Array.isArray(response.data) ? response.data : []
    if (batch.length === 0) break

    await db.activities.bulkPut(batch.map(toActivity))
    imported += batch.length
    if (batch.length < perPage) break
    page += 1
  }

  await setSettings({ stravaLastSyncAt: Date.now() })
  return {
    imported,
    pages: page,
    skipped: false,
    message:
      imported === 0
        ? "Already up to date."
        : `Imported ${imported} activit${imported === 1 ? "y" : "ies"} from Strava.`,
  }
}

export async function disconnectStrava(
  options: { removeActivities?: boolean } = {},
): Promise<void> {
  if (options.removeActivities) {
    const ids = await db.activities.filter((a) => a.source === "strava").primaryKeys()
    await db.activities.bulkDelete(ids)
  }
  await setSettings({
    stravaAccessToken: "",
    stravaRefreshToken: "",
    stravaExpiresAt: 0,
    stravaAthleteName: "",
    stravaLastSyncAt: 0,
  })
}

export { NetworkError }
