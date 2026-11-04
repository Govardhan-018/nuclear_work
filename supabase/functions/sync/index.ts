import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const tableNames: Record<string, string> = {
  tasks: "tasks", habits: "habits", habitLogs: "habit_logs", books: "books",
  readingSessions: "reading_sessions", subjects: "subjects",
  focusSessions: "focus_sessions", nutritionLogs: "nutrition_logs", meals: "meals",
  activities: "activities", events: "events", aiMessages: "ai_messages", settings: "settings",
}
const MAX_CHANGES = 100
const MAX_EVENTS = 500
type IncomingChange = {
  table: string
  operation: "insert" | "update" | "delete"
  recordId: string
  data: Record<string, unknown>
}
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
const flagFields = new Set(["deleted", "done", "archived", "completed", "failed"])
function camelToSnake(key: string) {
  return aliases[key] ?? key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}
function snakeToCamel(key: string) {
  return reverseAliases[key] ?? key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}
function toServerRecord(change: IncomingChange, userId: string, table: string) {
  const record: Record<string, unknown> = { user_id: userId, id: change.recordId }
  for (const [key, value] of Object.entries(change.data ?? {})) {
    if (key === "id" || key === "userId") continue
    const targetKey = camelToSnake(key)
    record[targetKey] = flagFields.has(targetKey) ? value === true || value === 1 : value
  }
  if (table === "settings") {
    delete record.id
    record.key = change.data.key ?? change.recordId
  }
  return record
}
function toClientRecord(payload: Record<string, unknown> | null) {
  if (!payload) return null
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (key === "user_id") continue
    const clientKey = snakeToCamel(key)
    output[clientKey] = flagFields.has(clientKey) ? (value ? 1 : 0) : value
  }
  return output
}
function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405)
  const url = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!url || !anonKey) return jsonResponse({ error: "Server is not configured" }, 500)
  const authorization = request.headers.get("Authorization")
  if (!authorization?.startsWith("Bearer ")) return jsonResponse({ error: "Authentication required" }, 401)
  const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: auth, error: authError } = await client.auth.getUser()
  if (authError || !auth.user) return jsonResponse({ error: "Invalid session" }, 401)

  let input: { cursor?: number; changes?: IncomingChange[] }
  try { input = await request.json() } catch { return jsonResponse({ error: "Request body must be JSON" }, 400) }
  const cursor = Number.isFinite(input.cursor) ? Math.max(0, Number(input.cursor)) : 0
  const changes = Array.isArray(input.changes) ? input.changes : []
  if (changes.length > MAX_CHANGES) return jsonResponse({ error: `At most ${MAX_CHANGES} changes may be sent per request` }, 413)

  const accepted: string[] = []
  const conflicts: Array<{ table: string; recordId: string }> = []
  for (const change of changes) {
    const table = tableNames[change.table]
    if (!table || !change.recordId || !change.data || !["insert", "update", "delete"].includes(change.operation)) {
      return jsonResponse({ error: "Invalid change shape or table" }, 400)
    }
    const { data: laterEvent, error: eventError } = await client
      .from("sync_events").select("seq").eq("table_name", table)
      .eq("record_id", change.recordId).gt("seq", cursor).limit(1).maybeSingle()
    if (eventError) return jsonResponse({ error: eventError.message }, 500)
    if (laterEvent) { conflicts.push({ table: change.table, recordId: change.recordId }); continue }

    const row = toServerRecord(change, auth.user.id, table)
    const { error } = change.operation === "delete"
      ? await client.from(table).upsert({ ...row, deleted: true }, { onConflict: table === "settings" ? "user_id,key" : "user_id,id" })
      : await client.from(table).upsert(row, { onConflict: table === "settings" ? "user_id,key" : "user_id,id" })
    if (error) return jsonResponse({ error: error.message }, 500)
    accepted.push(`${change.table}:${change.recordId}`)
  }

  const { data: events, error: eventsError } = await client
    .from("sync_events").select("seq,table_name,record_id,operation,payload,occurred_at")
    .gt("seq", cursor).order("seq", { ascending: true }).limit(MAX_EVENTS)
  if (eventsError) return jsonResponse({ error: eventsError.message }, 500)
  const changesOut = (events ?? []).map((event) => ({
    cursor: event.seq,
    table: Object.entries(tableNames).find(([, value]) => value === event.table_name)?.[0] ?? event.table_name,
    recordId: event.record_id,
    operation: event.operation,
    data: toClientRecord(event.payload),
    occurredAt: event.occurred_at,
  }))
  const nextCursor = changesOut.length ? changesOut[changesOut.length - 1].cursor : cursor
  return jsonResponse({
    cursor: nextCursor, hasMore: changesOut.length === MAX_EVENTS,
    accepted, conflicts, changes: changesOut,
  })
})
