import { db } from "../db/db"
import { SECRET_SETTING_KEYS } from "../db/types"
import { isOnline } from "./platform"
import { fetchCloudBootstrap, ensureWebSession, isWebCloudConfigured, pushCloudChanges, type CloudChange } from "./supabase"

const CLOUD_OWNER_KEY = "maya.cloud.owner"
const collections = [
  ["tasks", "tasks"], ["habits", "habits"], ["habitLogs", "habit-logs"], ["books", "books"],
  ["readingSessions", "reading-sessions"], ["subjects", "subjects"], ["focusSessions", "focus-sessions"],
  ["nutritionLogs", "nutrition-logs"], ["meals", "meals"], ["activities", "activities"],
  ["events", "events"], ["aiMessages", "ai-messages"], ["settings", "settings"],
] as const
type Collection = (typeof collections)[number]
type Row = Record<string, unknown>
type PendingChange = { collection: Collection; key: string; row: Row; change: CloudChange }
let activeSync: Promise<{ pushed: number; pulled: number }> | null = null

function recordTime(row: Row): number {
  return Number(row.updatedAt ?? row.createdAt ?? 0)
}

function recordKey(table: string, row: Row): string | null {
  const value = table === "settings" ? row.key : row.id
  return typeof value === "string" && value ? value : null
}

function isPrivateSetting(row: Row): boolean {
  return typeof row.key === "string" && (SECRET_SETTING_KEYS as string[]).includes(row.key)
}

export async function syncCloudData(): Promise<{ pushed: number; pulled: number }> {
  if (activeSync) return activeSync
  activeSync = performSync().finally(() => { activeSync = null })
  return activeSync
}

async function performSync(): Promise<{ pushed: number; pulled: number }> {
  if (!isWebCloudConfigured()) throw new Error("Set VITE_MAYA_API_URL to enable cloud sync.")
  const session = await ensureWebSession()
  if (!session) throw new Error("Sign in to sync your data.")
  const previousOwner = localStorage.getItem(CLOUD_OWNER_KEY)
  if (previousOwner && previousOwner !== session.user.id) {
    throw new Error("This device has local data linked to another account. Sign back into that account before syncing.")
  }

  const remote = await fetchCloudBootstrap()
  const pending: PendingChange[] = []
  let pulled = 0

  for (const collection of collections) {
    const [tableName, resourceName] = collection
    const table = db.table(tableName)
    const localRows = await table.toArray() as Row[]
    const remoteRows = remote[resourceName] ?? []
    const remoteByKey = new Map<string, Row>()
    for (const row of remoteRows) {
      const key = recordKey(tableName, row)
      if (key && !(tableName === "settings" && isPrivateSetting(row))) remoteByKey.set(key, row)
    }
    const localKeys = new Set<string>()

    for (const local of localRows) {
      const key = recordKey(tableName, local)
      if (!key || (tableName === "settings" && isPrivateSetting(local))) continue
      localKeys.add(key)
      const cloud = remoteByKey.get(key)
      const localTime = recordTime(local)
      const cloudTime = cloud ? recordTime(cloud) : -1

      if (cloud && cloudTime >= localTime) {
        await table.put({ ...cloud, syncedAt: cloudTime })
        if (cloudTime > localTime) pulled += 1
        continue
      }

      const data = { ...local }
      delete data.syncedAt
      delete data.remoteId
      const change: CloudChange = {
        table: tableName,
        recordId: key,
        operation: local.deleted === 1 ? "delete" : "upsert",
        data,
      }
      pending.push({ collection, key, row: local, change })
    }

    for (const cloud of remoteRows) {
      const key = recordKey(tableName, cloud)
      if (!key || localKeys.has(key) || (tableName === "settings" && isPrivateSetting(cloud))) continue
      const cloudTime = recordTime(cloud)
      await table.put({ ...cloud, syncedAt: cloudTime })
      pulled += 1
    }
  }

  for (let start = 0; start < pending.length; start += 100) {
    const batch = pending.slice(start, start + 100)
    await pushCloudChanges(batch.map((item) => item.change))
    for (const item of batch) {
      const table = db.table(item.collection[0])
      const current = await table.get(item.key) as Row | undefined
      if (current && recordTime(current) === recordTime(item.row)) {
        await table.update(item.key, { syncedAt: recordTime(item.row) })
      }
    }
  }

  localStorage.setItem(CLOUD_OWNER_KEY, session.user.id)
  window.dispatchEvent(new CustomEvent("maya:cloud-sync-complete", { detail: { pushed: pending.length, pulled } }))
  return { pushed: pending.length, pulled }
}

export function startAutomaticCloudSync(): () => void {
  let stopped = false
  const run = () => {
    if (stopped || !isOnline() || !isWebCloudConfigured() || !localStorage.getItem("maya.web.supabase.session")) return
    void syncCloudData().catch((error) => {
      const message = error instanceof Error ? error.message : "Cloud sync failed."
      console.warn("Cloud sync paused:", message)
      window.dispatchEvent(new CustomEvent("maya:cloud-sync-error", { detail: { message } }))
    })
  }
  const onVisible = () => { if (document.visibilityState === "visible") run() }
  window.addEventListener("online", run)
  window.addEventListener("maya:cloud-session-changed", run)
  document.addEventListener("visibilitychange", onVisible)
  const interval = window.setInterval(run, 120_000)
  run()
  return () => {
    stopped = true
    window.clearInterval(interval)
    window.removeEventListener("online", run)
    window.removeEventListener("maya:cloud-session-changed", run)
    document.removeEventListener("visibilitychange", onVisible)
  }
}

export const cloudOwnerStorageKey = CLOUD_OWNER_KEY