import { Capacitor, CapacitorHttp } from "@capacitor/core"

export const isNative = (): boolean => Capacitor.isNativePlatform()
export const platformName = (): string => Capacitor.getPlatform()

export type HttpRequest = {
  url: string
  method?: "GET" | "POST" | "PUT" | "DELETE"
  headers?: Record<string, string>
  params?: Record<string, string>
  body?: unknown
  /** Milliseconds before the request is abandoned. */
  timeoutMs?: number
}

export type HttpResponse<T = unknown> = {
  ok: boolean
  status: number
  data: T
  error?: string
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NetworkError"
  }
}

function buildUrl(url: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return url
  const query = new URLSearchParams(params).toString()
  return url.includes("?") ? `${url}&${query}` : `${url}?${query}`
}

/**
 * One HTTP entry point for the whole app.
 *
 * On device this goes through CapacitorHttp, which performs the request
 * natively and therefore is not subject to the WebView's CORS policy — that
 * matters because neither Strava nor OpenRouter allows arbitrary browser
 * origins. In a browser it falls back to fetch, which is enough for
 * development against endpoints that do send CORS headers.
 */
export async function http<T = unknown>(req: HttpRequest): Promise<HttpResponse<T>> {
  const method = req.method ?? "GET"
  const timeoutMs = req.timeoutMs ?? 30_000

  if (isNative()) {
    try {
      const response = await CapacitorHttp.request({
        url: buildUrl(req.url, req.params),
        method,
        headers: req.headers,
        data: req.body,
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
      })
      const status = response.status ?? 0
      return {
        ok: status >= 200 && status < 300,
        status,
        data: response.data as T,
        error: status >= 200 && status < 300 ? undefined : describe(response.data),
      }
    } catch (error) {
      throw new NetworkError(
        error instanceof Error ? error.message : "Network request failed",
      )
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(buildUrl(req.url, req.params), {
      method,
      headers: {
        ...(req.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...req.headers,
      },
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      signal: controller.signal,
    })
    const text = await response.text()
    let data: unknown = text
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      /* non-JSON response; keep the raw text */
    }
    return {
      ok: response.ok,
      status: response.status,
      data: data as T,
      error: response.ok ? undefined : describe(data),
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new NetworkError("The request timed out.")
    }
    throw new NetworkError(
      error instanceof Error ? error.message : "Network request failed",
    )
  } finally {
    clearTimeout(timer)
  }
}

/** Best-effort human-readable message out of an arbitrary error payload. */
function describe(data: unknown): string {
  if (typeof data === "string" && data.trim()) return data.slice(0, 300)
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>
    const candidate =
      record.message ?? record.error_description ?? record.error ?? record.errors
    if (typeof candidate === "string") return candidate
    if (candidate) return JSON.stringify(candidate).slice(0, 300)
  }
  return "Request failed"
}

/** Navigator.onLine is a hint, not a guarantee, but it is enough to skip calls. */
export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false
}
