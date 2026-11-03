import { Directory, Encoding, Filesystem } from "@capacitor/filesystem"
import { Share } from "@capacitor/share"
import { db } from "../db/db"
import { SECRET_SETTING_KEYS } from "../db/types"
import { isNative } from "./platform"

const BACKUP_VERSION = 1

export type BackupFile = {
  app: "life-os"
  version: number
  exportedAt: string
  includesSecrets: boolean
  tables: Record<string, unknown[]>
}

/**
 * Serialises every table. Credentials are left out by default so a backup can
 * be shared or synced without leaking API keys.
 */
export async function buildBackup(includeSecrets = false): Promise<BackupFile> {
  const [
    tasks, habits, habitLogs, books, readingSessions, focusSessions,
    nutritionLogs, meals, activities, events, aiMessages, settings,
  ] = await Promise.all([
    db.tasks.toArray(), db.habits.toArray(), db.habitLogs.toArray(),
    db.books.toArray(), db.readingSessions.toArray(), db.focusSessions.toArray(),
    db.nutritionLogs.toArray(), db.meals.toArray(), db.activities.toArray(),
    db.events.toArray(), db.aiMessages.toArray(), db.settings.toArray(),
  ])

  const secretKeys = new Set<string>(SECRET_SETTING_KEYS as string[])
  const safeSettings = includeSecrets
    ? settings
    : settings.filter((row) => !secretKeys.has(row.key))

  return {
    app: "life-os",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    includesSecrets: includeSecrets,
    tables: {
      tasks, habits, habitLogs, books, readingSessions, focusSessions,
      nutritionLogs, meals, activities, events, aiMessages,
      settings: safeSettings,
    },
  }
}

export type ExportResult = { method: "file" | "download" | "clipboard"; location: string }

/**
 * Writes the backup where the user can reach it: the Documents directory plus
 * a share sheet on device, a normal download in the browser.
 */
export async function exportBackup(includeSecrets = false): Promise<ExportResult> {
  const backup = await buildBackup(includeSecrets)
  const json = JSON.stringify(backup, null, 2)
  const filename = `life-os-backup-${new Date().toISOString().slice(0, 10)}.json`

  if (isNative()) {
    const written = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    })
    try {
      await Share.share({
        title: "Life OS backup",
        url: written.uri,
        dialogTitle: "Save or send your backup",
      })
    } catch {
      /* The user dismissed the share sheet; the file is still written. */
    }
    return { method: "file", location: `Documents/${filename}` }
  }

  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return { method: "download", location: filename }
}

export type ImportResult = { imported: number; tables: string[] }

/**
 * Restores a backup. Rows are merged by primary key, so importing the same
 * file twice is harmless.
 */
export async function importBackup(json: string): Promise<ImportResult> {
  let parsed: BackupFile
  try {
    parsed = JSON.parse(json) as BackupFile
  } catch {
    throw new Error("That file is not valid JSON.")
  }
  if (parsed.app !== "life-os" || typeof parsed.tables !== "object") {
    throw new Error("That does not look like a Life OS backup.")
  }
  if (parsed.version > BACKUP_VERSION) {
    throw new Error("This backup was made by a newer version of the app.")
  }

  const targets: Record<string, { bulkPut: (rows: never[]) => Promise<unknown> }> = {
    tasks: db.tasks, habits: db.habits, habitLogs: db.habitLogs,
    books: db.books, readingSessions: db.readingSessions,
    focusSessions: db.focusSessions, nutritionLogs: db.nutritionLogs,
    meals: db.meals, activities: db.activities, events: db.events,
    aiMessages: db.aiMessages, settings: db.settings,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any

  let imported = 0
  const touched: string[] = []
  for (const [name, table] of Object.entries(targets)) {
    const rows = parsed.tables[name]
    if (!Array.isArray(rows) || rows.length === 0) continue
    await table.bulkPut(rows as never[])
    imported += rows.length
    touched.push(name)
  }
  return { imported, tables: touched }
}

/** Reads a file the user picked with an <input type="file">. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Could not read that file."))
    reader.readAsText(file)
  })
}
