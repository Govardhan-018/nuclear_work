import { http, isOnline } from "./platform"
import { getAllSettings } from "../db/settings"

const API_BASE = "https://api.groq.com/openai/v1"

/**
 * An optional build-time key, for personal builds where the owner would rather
 * not type one in. There is no server in this app, so a key compiled in here
 * still ships inside the APK; the in-app setting is the preferred path and
 * takes precedence. See the README for the trade-off.
 */
const BUILD_TIME_KEY = (import.meta.env.VITE_GROQ_API_KEY ?? "") as string

/**
 * Fallback catalogue, used before the live list is fetched. Groq's lineup
 * moves quickly, so Settings can refresh this from the API.
 */
export const FALLBACK_MODELS: { id: string; name: string }[] = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B" },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B" },
  { id: "meta-llama/llama-4-maverick-17b-128e-instruct", name: "Llama 4 Maverick 17B" },
  { id: "qwen/qwen3-32b", name: "Qwen 3 32B" },
  { id: "moonshotai/kimi-k2-instruct", name: "Kimi K2 Instruct" },
]

export const DEFAULT_MODEL = "llama-3.3-70b-versatile"

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

export class AiUnavailableError extends Error {
  readonly reason: "offline" | "no-key" | "rate-limited" | "failed"
  constructor(reason: AiUnavailableError["reason"], message: string) {
    super(message)
    this.name = "AiUnavailableError"
    this.reason = reason
  }
}

/** The configured key: the in-app setting wins over any build-time default. */
export async function resolveApiKey(): Promise<string> {
  const settings = await getAllSettings()
  return (settings.groqApiKey || BUILD_TIME_KEY).trim()
}

export function hasBuildTimeKey(): boolean {
  return BUILD_TIME_KEY.trim().length > 0
}

type ModelsResponse = {
  data?: Array<{ id: string; owned_by?: string; active?: boolean }>
}

/** Fetches the live model list and keeps the chat-capable entries. */
export async function fetchModels(apiKey: string): Promise<{ id: string; name: string }[]> {
  if (!isOnline()) throw new AiUnavailableError("offline", "You are offline.")
  const response = await http<ModelsResponse>({
    url: `${API_BASE}/models`,
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (response.status === 401) {
    throw new AiUnavailableError("failed", "Groq rejected the API key. Check it in Settings.")
  }
  if (!response.ok) {
    throw new AiUnavailableError("failed", response.error ?? "Could not load models.")
  }
  const models = (response.data.data ?? [])
    .filter((model) => model.active !== false)
    // Whisper and TTS models cannot answer a chat completion.
    .filter((model) => !/whisper|tts|guard|embed/i.test(model.id))
    .map((model) => ({ id: model.id, name: prettyModelName(model.id) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return models.length > 0 ? models : FALLBACK_MODELS
}

/** "meta-llama/llama-4-scout-17b-16e-instruct" -> "Llama 4 Scout 17b 16e Instruct" */
export function prettyModelName(id: string): string {
  const tail = id.includes("/") ? id.slice(id.indexOf("/") + 1) : id
  return tail
    .split("-")
    .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ")
}

type CompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string; code?: string }
}

/**
 * Sends a chat completion.
 *
 * Non-streaming on purpose: on device, requests go through CapacitorHttp so
 * they are made natively and are not blocked by the WebView's CORS policy,
 * and that path cannot stream a response body. Coach replies are short, and a
 * typing indicator covers the wait.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: { model?: string; maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const settings = await getAllSettings()
  const apiKey = await resolveApiKey()

  if (!apiKey) {
    throw new AiUnavailableError(
      "no-key",
      "Add a Groq API key in Settings to use the coach.",
    )
  }
  if (!isOnline()) {
    throw new AiUnavailableError(
      "offline",
      "The coach needs a connection. Everything else in the app works offline.",
    )
  }

  const response = await http<CompletionResponse>({
    url: `${API_BASE}/chat/completions`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: {
      model: options.model ?? settings.groqModel ?? DEFAULT_MODEL,
      messages,
      max_tokens: options.maxTokens ?? 700,
      temperature: options.temperature ?? 0.6,
      stream: false,
    },
    timeoutMs: 60_000,
  })

  if (!response.ok) {
    const detail = response.data?.error?.message ?? response.error ?? `HTTP ${response.status}`
    if (response.status === 401 || response.status === 403) {
      throw new AiUnavailableError("failed", "Groq rejected the API key. Check it in Settings.")
    }
    if (response.status === 429) {
      throw new AiUnavailableError(
        "rate-limited",
        "Groq's free tier is rate limited and you have hit it. Wait a minute, or pick a smaller model in Settings.",
      )
    }
    if (response.status === 404) {
      throw new AiUnavailableError(
        "failed",
        "That model is not available on your Groq account. Pick another in Settings.",
      )
    }
    throw new AiUnavailableError("failed", detail)
  }

  const text = response.data.choices?.[0]?.message?.content?.trim()
  if (!text) {
    throw new AiUnavailableError("failed", "The model returned an empty response.")
  }
  return text
}

/** Confirms a key and model work, by asking for a one-word reply. */
export async function testApiKey(apiKey: string, model: string): Promise<string> {
  if (!apiKey.trim()) {
    throw new AiUnavailableError("no-key", "Enter a key first.")
  }
  const response = await http<CompletionResponse>({
    url: `${API_BASE}/chat/completions`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: {
      model: model || DEFAULT_MODEL,
      messages: [{ role: "user", content: "Reply with the single word: ready" }],
      max_tokens: 10,
    },
    timeoutMs: 45_000,
  })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AiUnavailableError("failed", "Groq rejected that key.")
    }
    if (response.status === 429) {
      throw new AiUnavailableError("rate-limited", "Rate limited. Try again in a moment.")
    }
    throw new AiUnavailableError(
      "failed",
      response.data?.error?.message ?? response.error ?? `HTTP ${response.status}`,
    )
  }
  return response.data.choices?.[0]?.message?.content?.trim() ?? "ready"
}
