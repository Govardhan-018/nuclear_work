import Dexie, { type EntityTable } from "dexie"
import { SUBJECT_TONES } from "./types"
import type {
  Activity,
  AiMessage,
  Book,
  CalendarEvent,
  FocusSession,
  Habit,
  HabitLog,
  Meal,
  NutritionLog,
  ReadingSession,
  SettingRecord,
  Subject,
  SyncMeta,
  Task,
} from "./types"

/**
 * Local-first store. IndexedDB lives in the app's private storage on Android,
 * so the app remains usable without a network. Sync metadata lets signed-in
 * users share records through the Maya API.
 */
export class LifeOsDatabase extends Dexie {
  tasks!: EntityTable<Task, "id">
  habits!: EntityTable<Habit, "id">
  habitLogs!: EntityTable<HabitLog, "id">
  books!: EntityTable<Book, "id">
  readingSessions!: EntityTable<ReadingSession, "id">
  focusSessions!: EntityTable<FocusSession, "id">
  subjects!: EntityTable<Subject, "id">
  nutritionLogs!: EntityTable<NutritionLog, "id">
  meals!: EntityTable<Meal, "id">
  activities!: EntityTable<Activity, "id">
  events!: EntityTable<CalendarEvent, "id">
  aiMessages!: EntityTable<AiMessage, "id">
  settings!: EntityTable<SettingRecord, "key">

  constructor() {
    super("life-os")

    this.version(1).stores({
      tasks: "id, done, dueAt, category, priority, updatedAt, deleted",
      habits: "id, archived, order, updatedAt, deleted",
      habitLogs: "id, habitId, date, [habitId+date], updatedAt, deleted",
      books: "id, status, updatedAt, deleted",
      readingSessions: "id, bookId, date, startedAt, updatedAt, deleted",
      focusSessions: "id, date, type, subject, startedAt, updatedAt, deleted",
      nutritionLogs: "id, date, updatedAt, deleted",
      meals: "id, date, type, updatedAt, deleted",
      activities: "id, source, date, type, startedAt, stravaId, updatedAt, deleted",
      events: "id, date, category, updatedAt, deleted",
      aiMessages: "id, conversationId, createdAt",
      settings: "key, updatedAt",
    })

    // v2 introduces user-managed subjects. Existing sessions keep their
    // denormalised subject name and are linked to the migrated records.
    this.version(2).stores({
      subjects: "id, kind, archived, order, updatedAt, deleted",
      focusSessions: "id, date, type, subject, subjectId, startedAt, updatedAt, deleted",
    }).upgrade(async (tx) => {
      const sessions = await tx.table("focusSessions").toArray()
      const now = Date.now()
      const seen = new Map<string, string>()
      const created: Subject[] = []

      for (const session of sessions) {
        const key = `${session.type}:${session.subject}`
        if (!session.subject || seen.has(key)) continue
        const id = uid()
        seen.set(key, id)
        created.push({
          id,
          name: session.subject,
          kind: session.type === "Reading" ? "Reading" : "Academic",
          tone: SUBJECT_TONES[created.length % SUBJECT_TONES.length],
          archived: 0,
          order: created.length,
          createdAt: now,
          updatedAt: now,
          deleted: 0,
          syncedAt: null,
          remoteId: null,
        })
      }

      if (created.length > 0) await tx.table("subjects").bulkAdd(created)
      await Promise.all(
        sessions.map((session) =>
          tx.table("focusSessions").update(session.id, {
            subjectId: seen.get(`${session.type}:${session.subject}`) ?? null,
          }),
        ),
      )
    })
  }
}

export const db = new LifeOsDatabase()

/** Fresh sync metadata for a newly created record. */
export function newMeta(now = Date.now()): SyncMeta {
  return { createdAt: now, updatedAt: now, deleted: 0, syncedAt: null, remoteId: null }
}

/** Fields to merge into a record being updated. */
export function touch(): Pick<SyncMeta, "updatedAt" | "syncedAt"> {
  return { updatedAt: Date.now(), syncedAt: null }
}

export function uid(prefix = ""): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return prefix ? `${prefix}:${random}` : random
}

/** Filters out soft-deleted rows. */
export function alive<T extends { deleted: 0 | 1 }>(rows: T[] | undefined): T[] {
  return (rows ?? []).filter((row) => row.deleted !== 1)
}
