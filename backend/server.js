import { createServer } from "node:http"

const PORT = Number(process.env.PORT || 10000)
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "")
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
const ALLOWED_ORIGINS = new Set((process.env.CORS_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean))

const resources = {
  tasks: "tasks", habits: "habits", "habit-logs": "habit_logs", books: "books",
  "reading-sessions": "reading_sessions", subjects: "subjects", "focus-sessions": "focus_sessions",
  "nutrition-logs": "nutrition_logs", meals: "meals", activities: "activities", events: "events",
  "ai-messages": "ai_messages", settings: "settings",
}
const aliases = {
  order: "sort_order", currentPage: "current_page", startedAt: "started_at", endedAt: "ended_at",
  completedAt: "completed_at", dueAt: "due_at", pagesRead: "pages_read", bookId: "book_id",
  subjectId: "subject_id", targetPerWeek: "target_per_week", finishedAt: "finished_at",
  stravaId: "strava_id", movingTimeS: "moving_time_s", elapsedTimeS: "elapsed_time_s",
  distanceM: "distance_m", elevationM: "elevation_m", averageSpeed: "average_speed",
  averageHeartrate: "average_heartrate", maxHeartrate: "max_heartrate",
  conversationId: "conversation_id", remoteId: "remote_id", syncedAt: "synced_at",
  createdAt: "created_at", updatedAt: "updated_at",
}
const reverseAliases = Object.fromEntries(Object.entries(aliases).map(([k,v]) => [v,k]))
const flags = new Set(["deleted","done","archived","completed","failed"])
const timestampFields = new Set(["due_at","completed_at","finished_at","started_at","ended_at","created_at","updated_at","synced_at"])
const snake = (key) => aliases[key] || key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase())
const camel = (key) => reverseAliases[key] || key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
const dbRecord = (input, userId, table, id) => {
  const row = { user_id: userId }
  for (const [key,value] of Object.entries(input || {})) {
    if (key === "user_id" || key === "userId") continue
    const field = snake(key)
    if ((table === "settings" || table === "ai_messages") && ["deleted","remote_id","synced_at","updated_at"].includes(field)) continue
    let storedValue = value
    if (timestampFields.has(field) && value !== null && value !== undefined) {
      const epoch = Number(value)
      if (Number.isFinite(epoch)) storedValue = new Date(epoch).toISOString()
    }
    row[field] = flags.has(field) ? value === true || value === 1 : storedValue
  }
  if (table !== "settings" && id) row.id = id
  if (table === "settings") { delete row.id; if (!row.key && id) row.key = id }
  return row
}
const apiRecord = (row) => {
  if (!row) return null
  return Object.fromEntries(Object.entries(row).filter(([k]) => k !== "user_id").map(([k,v]) => {
    const key = camel(k)
    const converted = timestampFields.has(k) && v !== null ? Date.parse(String(v)) : v
    return [key, flags.has(key) ? (v ? 1 : 0) : converted]
  }))
}
function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type":"application/json", ...headers })
  res.end(JSON.stringify(body))
}
async function json(req) {
  let data = ""
  for await (const chunk of req) { data += chunk; if (data.length > 1_000_000) throw new Error("Request too large") }
  return data ? JSON.parse(data) : {}
}
function headersFor(req, origin) {
  const allowed = !ALLOWED_ORIGINS.size || ALLOWED_ORIGINS.has(origin)
  return {
    "Access-Control-Allow-Origin": allowed ? (origin || "*") : "null",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Vary": "Origin",
  }
}
async function supabaseFetch(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(body === undefined ? {} : { "Content-Type":"application/json", Prefer:"return=representation,resolution=merge-duplicates" }),
      ...(token ? { "x-user-token": token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let result = null
  try { result = text ? JSON.parse(text) : null } catch { result = text }
  return { response, result }
}
async function authenticate(token) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null
  return response.json()
}
async function handle(req, res) {
  const origin = req.headers.origin || ""
  const cors = headersFor(req, origin)
  if (req.method === "OPTIONS") return send(res, 204, {}, cors)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_PUBLISHABLE_KEY) return send(res, 500, { error:"Backend is not configured" }, cors)

  const url = new URL(req.url, `http://${req.headers.host}`)
  const parts = url.pathname.split("/").filter(Boolean)
  const index = parts.indexOf("v1")
  const route = index < 0 ? [] : parts.slice(index + 1)
  const resource = route[0]
  const id = route[1]

  if (resource === "health" && req.method === "GET") return send(res, 200, { ok:true, service:"maya-api" }, cors)

  if (resource === "auth") {
    const action = route[1]
    if (!new Set(["signup","token","logout","user","recover"]).has(action)) return send(res,404,{error:"Unknown auth action"},cors)
    const target = new URL(`${SUPABASE_URL}/auth/v1/${action}`)
    url.searchParams.forEach((v,k) => target.searchParams.set(k,v))
    const authHeaders = { apikey:SUPABASE_PUBLISHABLE_KEY, "Content-Type":"application/json" }
    if (req.headers.authorization) authHeaders.Authorization = req.headers.authorization
    const payload = ["GET","HEAD"].includes(req.method) ? undefined : await json(req)
    const response = await fetch(target, { method:req.method, headers:authHeaders, body:payload === undefined ? undefined : JSON.stringify(payload) })
    const text = await response.text()
    res.writeHead(response.status,{...cors,"Content-Type":response.headers.get("Content-Type") || "application/json"})
    return res.end(text)
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i,"")
  if (!token) return send(res,401,{error:"Authentication required"},cors)
  const user = await authenticate(token)
  if (!user?.id) return send(res,401,{error:"Invalid session"},cors)

  if (resource === "bootstrap" && req.method === "GET") {
    const entries = await Promise.all(Object.entries(resources).map(async ([name,table]) => {
      const filter = table === "ai_messages" ? "created_at" : table === "settings" ? "key" : "updated_at"
      const {response,result} = await supabaseFetch(`${table}?user_id=eq.${user.id}&select=*&order=${filter}.asc&limit=500`)
      if (!response.ok) throw new Error(result?.message || "Could not load data")
      return [name,(result || []).map(apiRecord)]
    }))
    return send(res,200,{data:Object.fromEntries(entries)},cors)
  }

  if (resource === "sync" && req.method === "POST") {
    const input = await json(req)
    const changes = Array.isArray(input.changes) ? input.changes : []
    if (changes.length > 100) return send(res,413,{error:"At most 100 changes per request"},cors)
    const accepted = []
    for (const change of changes) {
      const name = change.table.replace(/[A-Z]/g,(c)=>"-"+c.toLowerCase())
      const table = resources[name] || resources[change.table]
      if (!table || !change.recordId || !change.data) return send(res,400,{error:"Invalid sync change"},cors)
      const row = dbRecord(change.data,user.id,table,change.recordId)
      if (change.operation === "delete") row.deleted = true
      const conflict = table === "settings" ? "user_id,key" : "user_id,id"
      const {response,result} = await supabaseFetch(`${table}?on_conflict=${conflict}`,{method:"POST",body:row})
      if (!response.ok) return send(res,400,{error:result?.message || "Sync write failed"},cors)
      accepted.push(`${change.table}:${change.recordId}`)
    }
    return send(res,200,{cursor:input.cursor || 0,hasMore:false,accepted,conflicts:[],changes:[]},cors)
  }

  const table = resources[resource]
  if (!table) return send(res,404,{error:"Unknown API resource"},cors)
  if (req.method === "GET") {
    const filterField = table === "settings" ? "key" : "id"
    const params = new URLSearchParams({select:"*",user_id:`eq.${user.id}`,limit:String(Math.min(Number(url.searchParams.get("limit") || 500),500))})
    if (id) params.set(filterField,`eq.${id}`)
    const order = table === "ai_messages" ? "created_at" : table === "settings" ? "key" : "updated_at"
    params.set("order",`${order}.asc`)
    const {response,result} = await supabaseFetch(`${table}?${params}`)
    return send(res,response.status,response.ok?{data:(result||[]).map(apiRecord)}:{error:result?.message||"Read failed"},cors)
  }
  if (!["POST","PATCH","DELETE"].includes(req.method)) return send(res,405,{error:"Method not allowed"},cors)

  const conflict = table === "settings" ? "user_id,key" : "user_id,id"
  if (req.method === "DELETE") {
    if (!id || table === "settings" || table === "ai_messages") return send(res,400,{error:"This resource does not support soft delete"},cors)
    const {response,result}=await supabaseFetch(`${table}?user_id=eq.${user.id}&id=eq.${id}`,{method:"PATCH",body:{deleted:true}})
    return send(res,response.status,response.ok?{data:(result||[]).map(apiRecord)}:{error:result?.message||"Delete failed"},cors)
  }
  const payload = await json(req)
  const values = Array.isArray(payload) ? payload : [payload]
  if (values.length > 100) return send(res,413,{error:"At most 100 records per request"},cors)
  const rows=values.map((item)=>dbRecord(item,user.id,table,id))
  const {response,result}=await supabaseFetch(`${table}?on_conflict=${encodeURIComponent(conflict)}`,{method:"POST",body:rows})
  return send(res,response.status,response.ok?{data:(result||[]).map(apiRecord)}:{error:result?.message||"Write failed"},cors)
}
createServer((req,res)=>{handle(req,res).catch((e)=>send(res,500,{error:e.message||"Unexpected server error"},headersFor(req,req.headers.origin||"")))})
.listen(PORT,"0.0.0.0",()=>console.log(`Maya API listening on ${PORT}`))
