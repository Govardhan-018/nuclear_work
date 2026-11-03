import { http, isOnline } from "./platform"
import { getAllSettings } from "../db/settings"

const API_BASE = "https://openrouter.ai/api/v1"

/**
 * Curated fallback list of OpenRouter's free tier. Availability changes often,
 * so Settings can refresh this from the live catalogue; these are the defaults
 * shown before anyone does.
 */
export const FALLBACK_FREE_MODELS: { id: string; name: string }[] = [
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B Instruct" },
  { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3" },
  { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (reasoning)" },
  { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B" },
  { id: "qwen/qwen-2.5-72b-instruct:free", name: "Qwen 2.5 72B Instruct" },
  { id: "mistralai/mistral-small-3.2-24b-instruct:free", name: "Mistral Small 3.2 24B" },
]

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

export class AiUnavailableError extends Error {
  readonly reason: "offline" | "no-key" | "failed"
  constructor(reason: "offline" | "no-key" | "failed", message: string) {
    super(message)
    this.name = "AiUnavailableError"
    this.reason = reason
  }
}

type ModelsResponse = {
  data?: Array<{
    id: string
    name?: string
    pricing?: { prompt?: string; completion?: string }
  }>
}

/** Fetches the live catalogue and keeps only models that cost nothing. */
export async function fetchFreeModels(
  apiKey: string,
): Promise<{ id: string; name: string }[]> {
  if (!isOnline()) throw new AiUnavailableError("offline", "You are offline.")
  const response = await http<ModelsResponse>({
    url: `${API_BASE}/models`,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
  })
  if (!response.ok) {
    throw new AiUnavailableError("failed", response.error ?? "Could not load models.")
  }
  const models = response.data.data ?? []
  const free = models
    .filter((m) => {
      const prompt = Number(m.pricing?.prompt ?? "1")
      const completion = Number(m.pricing?.completion ?? "1")
      return prompt === 0 && completion === 0
    })
    .map((m) => ({ id: m.id, name: m.name ?? m.id }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return free.length > 0 ? free : FALLBACK_FREE_MODELS
}

type CompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

/**
 * Sends a chat completion. Non-streaming on purpose: CapacitorHttp performs
 * requests natively and cannot stream a response body, and the coach replies
 * are short enough that waiting for the whole message is fine.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: { model?: string; maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const settings = await getAllSettings()
  const apiKey = settings.openRouterApiKey.trim()

  if (!apiKey) {
    throw new AiUnavailableError(
      "no-key",
      "Add an OpenRouter API key in Settings to use the coach.",
    )
  }
  if (!isOnline()) {
    throw new AiUnavailableError(
      "offline",
      "The coach needs a connection. Everything else in the app works offline.",
    )
  }

  const model = options.model ?? settings.openRouterModel ?? FALLBACK_FREE_MODELS[0].id

  const response = await http<CompletionResponse>({
    url: `${API_BASE}/chat/completions`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // OpenRouter uses these for attribution on its dashboard.
      "HTTP-Referer": "https://lifeos.app",
      "X-Title": "Life OS",
    },
    body: {
      model,
      messages,
      max_tokens: options.maxTokens ?? 600,
      temperature: options.temperature ?? 0.6,
    },
    timeoutMs: 60_000,
  })

  if (!response.ok) {
    const detail = response.data?.error?.message ?? response.error ?? `HTTP ${response.status}`
    if (response.status === 401) {
      throw new AiUnavailableError("failed", "OpenRouter rejected the API key. Check it in Settings.")
    }
    if (response.status === 429) {
      throw new AiUnavailableError(
        "failed",
        "This free model is rate limited right now. Try again shortly, or pick another model in Settings.",
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

/** Confirms a key works by asking for a one-word reply. */
export async function testApiKey(apiKey: string, model: string): Promise<string> {
  const response = await http<CompletionResponse>({
    url: `${API_BASE}/chat/completions`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://lifeos.app",
      "X-Title": "Life OS",
    },
    body: {
      model,
      messages: [{ role: "user", content: "Reply with the single word: ready" }],
      max_tokens: 10,
    },
    timeoutMs: 45_000,
  })
  if (!response.ok) {
    throw new AiUnavailableError(
      "failed",
      response.data?.error?.message ?? response.error ?? `HTTP ${response.status}`,
    )
  }
  return response.data.choices?.[0]?.message?.content?.trim() ?? "ready"
}
