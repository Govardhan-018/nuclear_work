import { db, newMeta, touch, uid } from "./db"
import { dayKey, type DayKey } from "../lib/date"
import { SUBJECT_TONES } from "./types"
import type {
  Activity,
  AiMessage,
  Book,
  CalendarEvent,
  EnergyLevel,
  FocusSession,
  Habit,
  HabitLog,
  Meal,
  NutritionLog,
  ReadingSession,
  Subject,
  Task,
} from "./types"

/* ------------------------------------------------------------------ tasks */

export async function createTask(
  input: Partial<Task> & Pick<Task, "title">,
): Promise<string> {
  const id = uid()
  await db.tasks.add({
    id,
    title: input.title,
    notes: input.notes ?? "",
    category: input.category ?? "Personal",
    priority: input.priority ?? "Medium",
    dueAt: input.dueAt ?? null,
    done: input.done ?? 0,
    completedAt: input.completedAt ?? null,
    ...newMeta(),
  })
  return id
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  await db.tasks.update(id, { ...patch, ...touch() })
}

export async function toggleTask(id: string): Promise<void> {
  const task = await db.tasks.get(id)
  if (!task) return
  const done = task.done === 1 ? 0 : 1
  await db.tasks.update(id, {
    done,
    completedAt: done === 1 ? Date.now() : null,
    ...touch(),
  })
}

/** Soft delete, so a future sync can propagate the removal. */
export async function deleteTask(id: string): Promise<void> {
  await db.tasks.update(id, { deleted: 1, ...touch() })
}

/* ----------------------------------------------------------------- habits */

export async function createHabit(
  input: Partial<Habit> & Pick<Habit, "name">,
): Promise<string> {
  const id = uid()
  const count = await db.habits.count()
  await db.habits.add({
    id,
    name: input.name,
    icon: input.icon ?? "habits",
    cadence: input.cadence ?? "Daily",
    targetPerWeek: input.targetPerWeek ?? 7,
    tone: input.tone ?? "teal",
    archived: 0,
    order: input.order ?? count,
    ...newMeta(),
  })
  return id
}

export async function updateHabit(id: string, patch: Partial<Habit>): Promise<void> {
  await db.habits.update(id, { ...patch, ...touch() })
}

export async function deleteHabit(id: string): Promise<void> {
  await db.habits.update(id, { deleted: 1, ...touch() })
}

/** Flips a habit's completion for a given day, creating the log if needed. */
export async function toggleHabitLog(
  habitId: string,
  date: DayKey = dayKey(),
): Promise<void> {
  const id = `${habitId}:${date}`
  const existing = await db.habitLogs.get(id)
  if (existing) {
    await db.habitLogs.update(id, {
      done: existing.done === 1 ? 0 : 1,
      deleted: 0,
      ...touch(),
    })
    return
  }
  const log: HabitLog = { id, habitId, date, done: 1, ...newMeta() }
  await db.habitLogs.add(log)
}

export async function setHabitLog(
  habitId: string,
  date: DayKey,
  done: boolean,
): Promise<void> {
  const id = `${habitId}:${date}`
  await db.habitLogs.put({
    id,
    habitId,
    date,
    done: done ? 1 : 0,
    ...newMeta(),
  })
}

/* ------------------------------------------------------------------ books */

export async function createBook(
  input: Partial<Book> & Pick<Book, "title" | "author">,
): Promise<string> {
  const id = uid()
  const status = input.status ?? "Want to read"
  await db.books.add({
    id,
    title: input.title,
    subtitle: input.subtitle ?? "",
    author: input.author,
    pages: input.pages ?? 0,
    currentPage: input.currentPage ?? 0,
    status,
    cover: input.cover ?? input.title.slice(0, 18).toUpperCase(),
    accent: input.accent ?? "sage",
    startedAt: status === "Reading" ? Date.now() : null,
    finishedAt: status === "Completed" ? Date.now() : null,
    rating: input.rating ?? null,
    notes: input.notes ?? "",
    ...newMeta(),
  })
  return id
}

export async function updateBook(id: string, patch: Partial<Book>): Promise<void> {
  await db.books.update(id, { ...patch, ...touch() })
}

export async function deleteBook(id: string): Promise<void> {
  await db.books.update(id, { deleted: 1, ...touch() })
}

/**
 * Records reading progress and logs a session for the delta. Automatically
 * flips the book to Reading, or to Completed once the last page is reached.
 */
export async function logReadingProgress(
  bookId: string,
  nextPage: number,
  minutes = 0,
): Promise<void> {
  const book = await db.books.get(bookId)
  if (!book) return
  const clamped = Math.max(0, book.pages > 0 ? Math.min(nextPage, book.pages) : nextPage)
  const pagesRead = Math.max(0, clamped - book.currentPage)
  const now = Date.now()

  const patch: Partial<Book> = { currentPage: clamped, ...touch() }
  if (book.status === "Want to read" && clamped > 0) {
    patch.status = "Reading"
    patch.startedAt = book.startedAt ?? now
  }
  if (book.pages > 0 && clamped >= book.pages) {
    patch.status = "Completed"
    patch.finishedAt = now
  }
  await db.books.update(bookId, patch)

  if (pagesRead > 0 || minutes > 0) {
    const session: ReadingSession = {
      id: uid(),
      bookId,
      date: dayKey(now),
      startedAt: now,
      minutes,
      pagesRead,
      ...newMeta(now),
    }
    await db.readingSessions.add(session)
  }
}

/**
 * Records pages finished in a sitting. Used when a reading session ends and
 * the user says how far they got, so the book's progress and the reading
 * history stay in step.
 */
export async function addPagesRead(
  bookId: string,
  pagesRead: number,
  minutes: number,
): Promise<void> {
  const book = await db.books.get(bookId)
  if (!book) return
  const next = book.currentPage + Math.max(0, Math.round(pagesRead))
  await logReadingProgress(bookId, next, minutes)
}

export async function addReadingSession(
  input: Partial<ReadingSession> & Pick<ReadingSession, "minutes">,
): Promise<string> {
  const id = uid()
  const startedAt = input.startedAt ?? Date.now()
  await db.readingSessions.add({
    id,
    bookId: input.bookId ?? null,
    date: input.date ?? dayKey(startedAt),
    startedAt,
    minutes: input.minutes,
    pagesRead: input.pagesRead ?? 0,
    ...newMeta(),
  })
  return id
}

/* --------------------------------------------------------------- subjects */

export async function createSubject(
  input: Partial<Subject> & Pick<Subject, "name">,
): Promise<string> {
  const id = uid()
  const kind = input.kind ?? "Academic"
  const count = await db.subjects.where("kind").equals(kind).count()
  await db.subjects.add({
    id,
    name: input.name.trim(),
    kind,
    tone: input.tone ?? SUBJECT_TONES[count % SUBJECT_TONES.length],
    archived: 0,
    order: input.order ?? count,
    ...newMeta(),
  })
  return id
}

export async function updateSubject(
  id: string,
  patch: Partial<Subject>,
): Promise<void> {
  const next = { ...patch }
  if (typeof next.name === "string") next.name = next.name.trim()
  await db.subjects.update(id, { ...next, ...touch() })

  // Sessions keep a denormalised name so old entries stay readable; refresh
  // it so existing history follows the rename.
  if (typeof next.name === "string" && next.name) {
    const sessions = await db.focusSessions.where("subjectId").equals(id).toArray()
    if (sessions.length > 0) {
      await db.focusSessions.bulkPut(
        sessions.map((session) => ({ ...session, subject: next.name as string, ...touch() })),
      )
    }
  }
}

/**
 * Soft-deletes a subject. Sessions are deliberately left alone: they keep the
 * subject name they were recorded with, so deleting a subject never rewrites
 * history or loses tracked time.
 */
export async function deleteSubject(id: string): Promise<void> {
  await db.subjects.update(id, { deleted: 1, archived: 1, ...touch() })
}

export async function reorderSubjects(ids: string[]): Promise<void> {
  const now = Date.now()
  await db.subjects.bulkUpdate(
    ids.map((id, index) => ({ key: id, changes: { order: index, updatedAt: now } })),
  )
}

/** Creates the starter set on first use of the Focus page. */
export async function ensureDefaultSubjects(): Promise<void> {
  const existing = await db.subjects.count()
  if (existing > 0) return
  const defaults: Array<[string, Subject["kind"]]> = [
    ["General Study", "Academic"],
    ["Research", "Academic"],
    ["General Reading", "Reading"],
  ]
  for (const [name, kind] of defaults) {
    await createSubject({ name, kind })
  }
}

/* ---------------------------------------------------------- focus sessions */

export async function addFocusSession(
  input: Partial<FocusSession> & Pick<FocusSession, "seconds" | "subject">,
): Promise<string> {
  const id = uid()
  const endedAt = input.endedAt ?? Date.now()
  const startedAt = input.startedAt ?? endedAt - input.seconds * 1000
  await db.focusSessions.add({
    id,
    subjectId: input.subjectId ?? null,
    subject: input.subject,
    type: input.type ?? "Academic",
    mode: input.mode ?? "Timer",
    date: input.date ?? dayKey(startedAt),
    startedAt,
    endedAt,
    seconds: Math.round(input.seconds),
    completed: input.completed ?? 0,
    note: input.note ?? "",
    ...newMeta(),
  })
  return id
}

export async function deleteFocusSession(id: string): Promise<void> {
  await db.focusSessions.update(id, { deleted: 1, ...touch() })
}

/* -------------------------------------------------------------- nutrition */

export async function getOrCreateNutritionLog(date: DayKey): Promise<NutritionLog> {
  const existing = await db.nutritionLogs.get(date)
  if (existing) return existing
  const fresh: NutritionLog = {
    id: date,
    date,
    protein: null,
    carbs: null,
    junk: null,
    vegetables: null,
    fruit: null,
    water: 0,
    energy: null,
    note: "",
    ...newMeta(),
  }
  await db.nutritionLogs.add(fresh)
  return fresh
}

export async function updateNutritionLog(
  date: DayKey,
  patch: Partial<NutritionLog>,
): Promise<void> {
  await getOrCreateNutritionLog(date)
  await db.nutritionLogs.update(date, { ...patch, ...touch() })
}

export async function setWaterGlasses(date: DayKey, glasses: number): Promise<void> {
  await updateNutritionLog(date, { water: Math.max(0, glasses) })
}

export async function setEnergy(date: DayKey, energy: EnergyLevel): Promise<void> {
  await updateNutritionLog(date, { energy })
}

export async function addMeal(
  input: Partial<Meal> & Pick<Meal, "name">,
): Promise<string> {
  const id = uid()
  const now = new Date()
  await db.meals.add({
    id,
    date: input.date ?? dayKey(now),
    type: input.type ?? "Snack",
    name: input.name,
    portion: input.portion ?? "",
    time:
      input.time ??
      now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    note: input.note ?? "",
    ...newMeta(),
  })
  return id
}

export async function deleteMeal(id: string): Promise<void> {
  await db.meals.update(id, { deleted: 1, ...touch() })
}

/* ------------------------------------------------------------- activities */

export async function addManualActivity(
  input: Partial<Activity> & Pick<Activity, "name" | "type">,
): Promise<string> {
  const id = uid("manual")
  const startedAt = input.startedAt ?? Date.now()
  await db.activities.add({
    id,
    source: "manual",
    name: input.name,
    type: input.type,
    date: input.date ?? dayKey(startedAt),
    startedAt,
    distanceM: input.distanceM ?? 0,
    movingTimeS: input.movingTimeS ?? 0,
    elapsedTimeS: input.elapsedTimeS ?? input.movingTimeS ?? 0,
    elevationM: input.elevationM ?? 0,
    averageSpeed: input.averageSpeed ?? 0,
    averageHeartrate: input.averageHeartrate ?? null,
    maxHeartrate: input.maxHeartrate ?? null,
    calories: input.calories ?? null,
    polyline: input.polyline ?? null,
    ...newMeta(),
  })
  return id
}

export async function deleteActivity(id: string): Promise<void> {
  await db.activities.update(id, { deleted: 1, ...touch() })
}

/** Inserts or refreshes activities pulled from Strava. */
export async function upsertActivities(rows: Activity[]): Promise<number> {
  if (rows.length === 0) return 0
  await db.activities.bulkPut(rows)
  return rows.length
}

/* ----------------------------------------------------------------- events */

export async function createEvent(
  input: Partial<CalendarEvent> & Pick<CalendarEvent, "title">,
): Promise<string> {
  const id = uid()
  await db.events.add({
    id,
    title: input.title,
    date: input.date ?? dayKey(),
    startTime: input.startTime ?? "09:00",
    endTime: input.endTime ?? "10:00",
    category: input.category ?? "Personal",
    note: input.note ?? "",
    ...newMeta(),
  })
  return id
}

export async function updateEvent(
  id: string,
  patch: Partial<CalendarEvent>,
): Promise<void> {
  await db.events.update(id, { ...patch, ...touch() })
}

export async function deleteEvent(id: string): Promise<void> {
  await db.events.update(id, { deleted: 1, ...touch() })
}

/* ------------------------------------------------------------ ai messages */

export async function addAiMessage(
  input: Omit<AiMessage, "id" | "createdAt"> & Partial<Pick<AiMessage, "createdAt">>,
): Promise<string> {
  const id = uid()
  await db.aiMessages.add({ ...input, id, createdAt: input.createdAt ?? Date.now() })
  return id
}

export async function clearAiConversation(conversationId: string): Promise<void> {
  await db.aiMessages.where("conversationId").equals(conversationId).delete()
}

/* ----------------------------------------------------------------- bulk io */

/** Hard-deletes everything. Used by Settings → Clear all data. */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.tasks, db.habits, db.habitLogs, db.books, db.readingSessions,
      db.focusSessions, db.subjects, db.nutritionLogs, db.meals, db.activities,
      db.events, db.aiMessages,
    ],
    async () => {
      await Promise.all([
        db.tasks.clear(), db.habits.clear(), db.habitLogs.clear(),
        db.books.clear(), db.readingSessions.clear(), db.focusSessions.clear(),
        db.subjects.clear(), db.nutritionLogs.clear(), db.meals.clear(),
        db.activities.clear(), db.events.clear(), db.aiMessages.clear(),
      ])
    },
  )
}
