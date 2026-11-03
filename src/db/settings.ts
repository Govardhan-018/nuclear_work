import { useLiveQuery } from "dexie-react-hooks"
import { db } from "./db"
import { DEFAULT_SETTINGS, type AppSettings } from "./types"

/** Reads one setting, falling back to its default. */
export async function getSetting<K extends keyof AppSettings>(
  key: K,
): Promise<AppSettings[K]> {
  const row = await db.settings.get(key as string)
  return (row ? (row.value as AppSettings[K]) : DEFAULT_SETTINGS[key])
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  await db.settings.put({ key: key as string, value, updatedAt: Date.now() })
}

export async function setSettings(patch: Partial<AppSettings>): Promise<void> {
  const now = Date.now()
  const rows = Object.entries(patch).map(([key, value]) => ({
    key,
    value,
    updatedAt: now,
  }))
  if (rows.length > 0) await db.settings.bulkPut(rows)
}

export async function getAllSettings(): Promise<AppSettings> {
  const rows = await db.settings.toArray()
  const merged = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    if (row.key in merged) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(merged as any)[row.key] = row.value
    }
  }
  return merged
}

/**
 * Reactive settings. Returns defaults on the first render before IndexedDB
 * resolves, so callers never have to handle `undefined`.
 */
export function useSettings(): AppSettings {
  const rows = useLiveQuery(() => db.settings.toArray(), [], undefined)
  if (!rows) return DEFAULT_SETTINGS
  const merged = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    if (row.key in merged) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(merged as any)[row.key] = row.value
    }
  }
  return merged
}

/** True once settings have actually loaded from IndexedDB. */
export function useSettingsReady(): boolean {
  const rows = useLiveQuery(() => db.settings.toArray(), [], undefined)
  return rows !== undefined
}
