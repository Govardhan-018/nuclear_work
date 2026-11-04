import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
}

const resources: Record<string, string> = {
  tasks: "tasks", habits: "habits", "habit-logs": "habit_logs", books: "books",
  "reading-sessions": "reading_sessions", subjects: "subjects",
  "focus-sessions": "focus_sessions", "nutrition-logs": "nutrition_logs",
  meals: "meals", activities: "activities", events: "events",
  "ai-messages": "ai_messages", settings: "settings",
}
const flagFields = new Set(["deleted", "done", "archived", "completed", "failed"])
const aliases: Record<string, string> = {
  order: "sort_order", currentPage: "current_page", startedAt: "started_at",
  endedAt: "ended_at", completedAt: "completed_at", dueAt: "due_at",
  pagesRead: "pages_read", bookId: "book_id", subjectId: "subject_id",
  targetPerWeek: "target_per_week", finishedAt: "finished_at", stravaId: "strava_id",
  movingTimeS: "moving_time_s", elapsedTimeS: "elapsed_time_s", distanceM: "distance_m",
  elevationM: "elevation_m", averageSpeed: "average_speed", averageHeartrate: "average_heartrate",
  maxHeartrate: "max_heartrate", conversationId: "conversation_id", remoteId: "remote_id",
  syncedAt: "synced_at", createdAt: "created_at", updatedAt: "updated_at",
}
const reverseAliases: Record<string, string> = Object.fromEntries(
  Object.entries(aliases).map(([key, value]) => [value, key]),
)
function snake(key: string) { return aliases[key] ?? key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`) }
function camel(key: string) { return reverseAliases[key] ?? key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()) }

function toDb(input: Record<string, unknown>, userId: string, table: string, id?: string) {
  const row: Record<string, unknown> = { user_id: userId }
  for (const [key, value] of Object.entries(input)) {
    if (key === "userId" || key === "user_id") continue
    const target = snake(key)
    row[target] = flagFields.has(target) ? value === true || value === 1 : value
  }
  if (id && table !== "settings") row.id = id
  if (table === "settings") {
    delete row.id
    if (!row.key && id) row.key = id
  }
  return row
}
function toApi(row: Record<string, unknown> | null) {
  if (!row) return null
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (key === "user_id") continue
    const target = camel(key)
    output[target] = flagFields.has(target) ? (value ? 1 : 0) : value
  }
  return output
}
function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
function error(message: string, status: number) { return respond({ error: message }, status) }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  const url = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !serviceKey) return error("Backend is not configured", 500)

  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) return error("Authentication required", 401)
  const admin = createClient(url, serviceKey)
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (authError || !auth.user) return error("Invalid session", 401)
  const userId = auth.user.id

  const parts = new URL(request.url).pathname.split("/").filter(Boolean)
  const versionIndex = parts.lastIndexOf("v1")
  const route = versionIndex >= 0 ? parts.slice(versionIndex + 1) : []
  const resource = route[0]
  const id = route[1]

  if (resource === "health" && request.method === "GET") {
    return respond({ ok: true, service: "maya-api", userId })
  }

  if (resource === "bootstrap" && request.method === "GET") {
    const entries = await Promise.all(
      Object.entries(resources).map(async ([name, table]) => {
        const { data, error: queryError } = await admin.from(table).select("*").eq("user_id", userId).order("updated_at", { ascending: true })
        if (queryError) throw queryError
        return [name, (data ?? []).map(toApi)]
      }),
    )
    return respond({ data: Object.fromEntries(entries) })
  }

  if (resource === "sync" && request.method === "POST") {
    let input: { cursor?: number; changes?: Array<{ table: string; operation: "insert" | "update" | "delete"; recordId: string; data: Record<string, unknown> }> }
    try { input = await request.json() } catch { return error("Request body must be JSON", 400) }
    const cursor = Number.isFinite(input.cursor) ? Math.max(0, Number(input.cursor)) : 0
    const changes = Array.isArray(input.changes) ? input.changes : []
    if (changes.length > 100) return error("At most 100 changes may be sent per request", 413)

    const accepted: string[] = []
    const conflicts: Array<{ table: string; recordId: string }> = []
    for (const change of changes) {
      const table = resources[change.table] ?? resources[change.table.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)]
      if (!table || !change.recordId || !change.data || !["insert", "update", "delete"].includes(change.operation)) {
        return error("Invalid sync change", 400)
      }
      const { data: laterEvent, error: eventError } = await admin
        .from("sync_events").select("seq").eq("table_name", table)
        .eq("record_id", change.recordId).gt("seq", cursor).limit(1).maybeSingle()
      if (eventError) return error(eventError.message, 500)
      if (laterEvent) { conflicts.push({ table: change.table, recordId: change.recordId }); continue }

      const row = toDb(change.data, userId, table, change.recordId)
      const payload = change.operation === "delete" ? { ...row, deleted: true } : row
      const { error: writeError } = await admin
        .from(table).upsert(payload, { onConflict: table === "settings" ? "user_id,key" : "user_id,id" })
      if (writeError) return error(writeError.message, 500)
      accepted.push(`${change.table}:${change.recordId}`)
    }

    const { data: events, error: eventsError } = await admin
      .from("sync_events").select("seq,table_name,record_id,operation,payload,occurred_at")
      .eq("user_id", userId).gt("seq", cursor).order("seq", { ascending: true }).limit(500)
    if (eventsError) return error(eventsError.message, 500)
    const reverseResource = Object.fromEntries(Object.entries(resources).map(([key, value]) => [value, key]))
    const output = (events ?? []).map((event) => ({
      cursor: event.seq,
      table: reverseResource[event.table_name] ?? event.table_name,
      recordId: event.record_id,
      operation: event.operation,
      data: toApi(event.payload),
      occurredAt: event.occurred_at,
    }))
    return respond({
      cursor: output.length ? output[output.length - 1].cursor : cursor,
      hasMore: output.length === 500,
      accepted,
      conflicts,
      changes: output,
    })
  }

  const table = resource ? resources[resource] : undefined
  if (!table) return error("Unknown API resource", 404)

  if (request.method === "GET") {
    let query = admin.from(table).select("*").eq("user_id", userId)
    const params = new URL(request.url).searchParams
    if (id) query = query.eq(table === "settings" ? "key" : "id", id)
    if (params.has("updated_after")) query = query.gt("updated_at", params.get("updated_after")!)
    if (params.has("deleted")) query = query.eq("deleted", params.get("deleted") === "true")
    query = query.order("updated_at", { ascending: true }).limit(Math.min(Number(params.get("limit") ?? 500), 500))
    const { data, error: queryError } = await query
    if (queryError) return error(queryError.message, 500)
    return respond({ data: (data ?? []).map(toApi) })
  }

  let body: unknown = {}
  if (request.method !== "DELETE") {
    try { body = await request.json() } catch { return error("Request body must be JSON", 400) }
  }
  const items = Array.isArray(body) ? body : (body && typeof body === "object" && "data" in body ? (body as { data: unknown }).data : body)
  if (!Array.isArray(items) && (!items || typeof items !== "object")) return error("Request body must be an object or array", 400)
  const rows = (Array.isArray(items) ? items : [items]).map((item) => toDb(item as Record<string, unknown>, userId, table, id))
  const conflictTarget = table === "settings" ? "user_id,key" : "user_id,id"

  if (request.method === "DELETE") {
    if (!id) return error("A resource id is required", 400)
    const { data, error: deleteError } = await admin.from(table).update({ deleted: true }).eq("user_id", userId).eq(table === "settings" ? "key" : "id", id).select()
    if (deleteError) return error(deleteError.message, 500)
    return respond({ data: (data ?? []).map(toApi) })
  }

  const { data, error: writeError } = await admin.from(table).upsert(rows, { onConflict: conflictTarget }).select()
  if (writeError) return error(writeError.message, 500)
  return respond({ data: (data ?? []).map(toApi) }, request.method === "POST" ? 201 : 200)
})
