import { db, newMeta, uid } from "./db"
import { addDays, dayKey, startOfDay } from "../lib/date"
import { setSetting } from "./settings"
import type {
  Activity, Book, CalendarEvent, FocusSession, Habit, HabitLog, Meal,
  NutritionLog, ReadingSession, Subject, Task,
} from "./types"

/** Prefix marking a row as generated demo content. */
export const DEMO_PREFIX = "demo:"

/** Stable id for a demo row, so re-seeding replaces rather than duplicates. */
function demoId(kind: string, index: number | string): string {
  return `${DEMO_PREFIX}${kind}:${index}`
}

/** Deterministic PRNG so demo data is identical on every device and reseed. */
function makeRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

const DEMO_DAYS = 90

const DEMO_SUBJECTS: Array<[string, "Academic" | "Reading", string]> = [
  ["Neuroscience", "Academic", "teal"],
  ["Statistics", "Academic", "blue"],
  ["Writing", "Academic", "lavender"],
  ["Research", "Academic", "coral"],
  ["General Reading", "Reading", "sage"],
]

const DEMO_HABITS: Omit<Habit, keyof ReturnType<typeof newMeta> | "id">[] = [
  { name: "Morning meditation", icon: "sun", cadence: "Daily", targetPerWeek: 7, tone: "teal", archived: 0, order: 0 },
  { name: "Read 20 pages", icon: "book", cadence: "Daily", targetPerWeek: 7, tone: "blue", archived: 0, order: 1 },
  { name: "Drink 2L water", icon: "drop", cadence: "Daily", targetPerWeek: 7, tone: "lavender", archived: 0, order: 2 },
  { name: "Strength training", icon: "fitness", cadence: "3x weekly", targetPerWeek: 3, tone: "coral", archived: 0, order: 3 },
]

const DEMO_BOOKS: Omit<Book, keyof ReturnType<typeof newMeta> | "id">[] = [
  { title: "Four Thousand Weeks", subtitle: "Time management for mortals", author: "Oliver Burkeman", pages: 288, currentPage: 176, status: "Reading", cover: "4,000", accent: "sage", startedAt: null, finishedAt: null, rating: null, notes: "" },
  { title: "The Creative Act", subtitle: "A way of being", author: "Rick Rubin", pages: 432, currentPage: 92, status: "Reading", cover: "THE CREATIVE ACT", accent: "sand", startedAt: null, finishedAt: null, rating: null, notes: "" },
  { title: "Braiding Sweetgrass", subtitle: "", author: "Robin Wall Kimmerer", pages: 408, currentPage: 0, status: "Want to read", cover: "BRAIDING SWEETGRASS", accent: "forest", startedAt: null, finishedAt: null, rating: null, notes: "" },
  { title: "Atomic Habits", subtitle: "", author: "James Clear", pages: 320, currentPage: 320, status: "Completed", cover: "ATOMIC HABITS", accent: "cream", startedAt: null, finishedAt: null, rating: 5, notes: "" },
]

/**
 * Fills the database with ~90 days of plausible history so every chart,
 * streak and average has something real to compute from. Controlled by the
 * "Demo data" switch in Settings.
 */
export async function seedDemoData(): Promise<void> {
  const random = makeRandom(20260301)
  const now = Date.now()
  const today = startOfDay()

  /* subjects */
  const subjects: Subject[] = DEMO_SUBJECTS.map(([name, kind, tone], i) => ({
    id: demoId("subject", i),
    name,
    kind,
    tone: tone as Subject["tone"],
    archived: 0,
    order: i,
    ...newMeta(now),
  }))
  const academicSubjects = subjects.filter((s) => s.kind === "Academic")
  const readingSubjects = subjects.filter((s) => s.kind === "Reading")

  /* habits + logs */
  const habits: Habit[] = DEMO_HABITS.map((h, i) => ({ ...h, id: demoId("habit", i), ...newMeta(now) }))
  const habitLogs: HabitLog[] = []
  habits.forEach((habit, index) => {
    // Each habit gets its own reliability, so streaks differ realistically.
    const reliability = [0.88, 0.7, 0.8, 0.45][index] ?? 0.7
    for (let back = DEMO_DAYS; back >= 0; back--) {
      const date = dayKey(addDays(today, -back))
      const recencyBoost = back < 20 ? 0.08 : 0
      const hit = random() < reliability + recencyBoost
      if (!hit) continue
      habitLogs.push({
        id: `${habit.id}:${date}`,
        habitId: habit.id,
        date,
        done: 1,
        ...newMeta(now),
      })
    }
  })

  /* books + reading sessions */
  const books: Book[] = DEMO_BOOKS.map((b, i) => ({
    ...b,
    id: demoId("book", i),
    startedAt: b.status === "Want to read" ? null : addDays(today, -60).getTime(),
    finishedAt: b.status === "Completed" ? addDays(today, -21).getTime() : null,
    ...newMeta(now),
  }))
  const activeBooks = books.filter((b) => b.status !== "Want to read")
  const readingSessions: ReadingSession[] = []
  for (let back = DEMO_DAYS; back >= 0; back--) {
    if (random() > 0.62) continue
    const book = activeBooks[Math.floor(random() * activeBooks.length)]
    const date = addDays(today, -back)
    const minutes = 15 + Math.floor(random() * 45)
    readingSessions.push({
      id: demoId("reading", back),
      bookId: book.id,
      date: dayKey(date),
      startedAt: date.getTime() + 20 * 3600_000,
      minutes,
      pagesRead: Math.round(minutes * (0.7 + random() * 0.6)),
      ...newMeta(now),
    })
  }

  /* focus sessions */
  const focusSessions: FocusSession[] = []
  for (let back = DEMO_DAYS; back >= 0; back--) {
    const date = addDays(today, -back)
    const weekday = date.getDay()
    const isWeekend = weekday === 0 || weekday === 6
    const blocks = isWeekend
      ? (random() < 0.4 ? 1 : 0)
      : Math.floor(random() * 3) + (random() < 0.75 ? 1 : 0)
    for (let i = 0; i < blocks; i++) {
      const type: "Academic" | "Reading" = random() < 0.78 ? "Academic" : "Reading"
      const pool = type === "Reading" ? readingSubjects : academicSubjects
      const subject = pool[Math.floor(random() * pool.length)]
      // Weighted toward the 9-11am window so "peak focus hour" is meaningful.
      const hour = random() < 0.5 ? 9 + Math.floor(random() * 2) : 13 + Math.floor(random() * 7)
      const seconds = (20 + Math.floor(random() * 50)) * 60
      const startedAt = date.getTime() + hour * 3600_000 + Math.floor(random() * 1800) * 1000
      focusSessions.push({
        id: demoId("focus", `${back}-${i}`),
        subjectId: subject.id,
        subject: subject.name,
        type,
        mode: random() < 0.8 ? "Timer" : "Stopwatch",
        date: dayKey(date),
        startedAt,
        endedAt: startedAt + seconds * 1000,
        seconds,
        completed: random() < 0.7 ? 1 : 0,
        note: "",
        ...newMeta(now),
      })
    }
  }

  /* nutrition */
  const portions = ["Low", "Enough", "High"] as const
  const junkLevels = ["None", "Some", "A lot"] as const
  const energyLevels = ["Low", "Okay", "Good", "Great"] as const
  const nutritionLogs: NutritionLog[] = []
  for (let back = 60; back >= 1; back--) {
    if (random() > 0.78) continue
    const date = dayKey(addDays(today, -back))
    nutritionLogs.push({
      id: date,
      date,
      protein: portions[random() < 0.6 ? 1 : Math.floor(random() * 3)],
      carbs: portions[random() < 0.55 ? 1 : Math.floor(random() * 3)],
      junk: junkLevels[random() < 0.5 ? 0 : random() < 0.85 ? 1 : 2],
      vegetables: random() < 0.78,
      fruit: random() < 0.66,
      water: 4 + Math.floor(random() * 5),
      energy: energyLevels[Math.min(3, 1 + Math.floor(random() * 3))],
      note: DEMO_PREFIX,
      ...newMeta(now),
    })
  }

  /* meals for the last few days */
  const mealNames: Record<string, string[]> = {
    Breakfast: ["Oats with berries", "Eggs on toast", "Greek yoghurt bowl"],
    Lunch: ["Grain bowl", "Chicken salad", "Rice and dal"],
    Dinner: ["Pasta and greens", "Stir fry", "Soup and bread"],
    Snack: ["Apple", "Almonds", "Dark chocolate"],
  }
  const meals: Meal[] = []
  for (let back = 6; back >= 0; back--) {
    const date = dayKey(addDays(today, -back))
    for (const [type, time] of [["Breakfast", "08:15"], ["Lunch", "12:40"], ["Dinner", "19:30"]] as const) {
      if (random() > 0.85) continue
      const options = mealNames[type]
      meals.push({
        id: demoId("meal", `${date}-${type}`),
        date,
        type,
        name: options[Math.floor(random() * options.length)],
        portion: random() < 0.5 ? "1 plate" : "1 bowl",
        time,
        note: "",
        ...newMeta(now),
      })
    }
  }

  /* fitness activities */
  const activities: Activity[] = []
  const activityTypes = [
    { type: "Run", name: "Easy run", minKm: 4, maxKm: 12, pace: 330 },
    { type: "Ride", name: "Evening ride", minKm: 12, maxKm: 35, pace: 110 },
    { type: "Walk", name: "Walk", minKm: 2, maxKm: 6, pace: 700 },
    { type: "WeightTraining", name: "Strength session", minKm: 0, maxKm: 0, pace: 0 },
  ]
  for (let back = DEMO_DAYS; back >= 0; back--) {
    if (random() > 0.42) continue
    const date = addDays(today, -back)
    const kind = activityTypes[Math.floor(random() * activityTypes.length)]
    const km = kind.maxKm > 0 ? kind.minKm + random() * (kind.maxKm - kind.minKm) : 0
    const distanceM = Math.round(km * 1000)
    const movingTimeS = kind.pace > 0
      ? Math.round(km * (kind.pace + (random() - 0.5) * 40))
      : Math.round((35 + random() * 30) * 60)
    const startedAt = date.getTime() + (7 + Math.floor(random() * 12)) * 3600_000
    activities.push({
      id: demoId("activity", back),
      source: "manual",
      name: kind.name,
      type: kind.type,
      date: dayKey(date),
      startedAt,
      distanceM,
      movingTimeS,
      elapsedTimeS: movingTimeS + Math.round(random() * 240),
      elevationM: Math.round(random() * (kind.type === "Ride" ? 320 : 90)),
      averageSpeed: movingTimeS > 0 ? distanceM / movingTimeS : 0,
      averageHeartrate: 118 + Math.round(random() * 42),
      maxHeartrate: 165 + Math.round(random() * 25),
      calories: Math.round(movingTimeS / 60 * (7 + random() * 5)),
      polyline: null,
      ...newMeta(now),
    })
  }

  /* tasks */
  const demoTasks: Array<[string, Task["category"], Task["priority"], number | null, 0 | 1]> = [
    ["Review cognitive science notes", "Study", "High", addDays(today, 0).getTime() + 10.5 * 3600_000, 1],
    ["Outline weekly reflection", "Personal", "Medium", addDays(today, 0).getTime() + 16 * 3600_000, 0],
    ["Book dentist appointment", "Health", "Low", addDays(today, 1).getTime() + 9 * 3600_000, 0],
    ["Finish statistics problem set", "Study", "High", addDays(today, 3).getTime() + 18 * 3600_000, 0],
    ["Plan Sunday long run", "Fitness", "Medium", addDays(today, 4).getTime() + 8 * 3600_000, 0],
    ["Tidy reading notes", "Personal", "Low", null, 0],
    ["Submit lab report", "Study", "High", addDays(today, -2).getTime() + 17 * 3600_000, 1],
  ]
  const tasks: Task[] = demoTasks.map(([title, category, priority, dueAt, done], i) => ({
    id: demoId("task", i),
    title,
    notes: "",
    category,
    priority,
    dueAt,
    done,
    completedAt: done === 1 ? now - Math.floor(random() * 6) * 3600_000 : null,
    ...newMeta(now),
  }))

  /* calendar events */
  const events: CalendarEvent[] = [
    { title: "Neuroscience lecture", date: dayKey(today), startTime: "09:00", endTime: "10:30", category: "Study" },
    { title: "Gym session", date: dayKey(today), startTime: "18:00", endTime: "19:00", category: "Fitness" },
    { title: "Study group", date: dayKey(addDays(today, 1)), startTime: "15:00", endTime: "16:30", category: "Study" },
    { title: "Long run", date: dayKey(addDays(today, 4)), startTime: "07:30", endTime: "09:00", category: "Fitness" },
  ].map((e, i) => ({ ...e, id: demoId("event", i), note: "", ...newMeta(now) }))

  await db.transaction(
    "rw",
    [db.tasks, db.habits, db.habitLogs, db.books, db.readingSessions,
     db.focusSessions, db.subjects, db.nutritionLogs, db.meals, db.activities, db.events],
    async () => {
      await db.subjects.bulkPut(subjects)
      await db.habits.bulkPut(habits)
      await db.habitLogs.bulkPut(habitLogs)
      await db.books.bulkPut(books)
      await db.readingSessions.bulkPut(readingSessions)
      await db.focusSessions.bulkPut(focusSessions)
      await db.nutritionLogs.bulkPut(nutritionLogs)
      await db.meals.bulkPut(meals)
      await db.activities.bulkPut(activities)
      await db.tasks.bulkPut(tasks)
      await db.events.bulkPut(events)
    },
  )
}

/**
 * Removes only demo-generated rows. Every seeded record carries the `demo:`
 * id prefix, so anything the user created themselves survives untouched.
 */
export async function removeDemoData(): Promise<void> {
  const isDemo = (row: { id: string }) => row.id.startsWith(DEMO_PREFIX)

  await db.transaction(
    "rw",
    [db.tasks, db.habits, db.habitLogs, db.books, db.readingSessions,
     db.focusSessions, db.subjects, db.nutritionLogs, db.meals, db.activities, db.events],
    async () => {
      const habitIds = await db.habits.filter(isDemo).primaryKeys()
      await db.habits.bulkDelete(habitIds)
      // Habit logs are keyed `${habitId}:${date}`, so they go with their habit.
      const orphanLogs = await db.habitLogs
        .filter((log) => log.habitId.startsWith(DEMO_PREFIX))
        .primaryKeys()
      await db.habitLogs.bulkDelete(orphanLogs)

      for (const table of [
        db.tasks, db.books, db.readingSessions, db.focusSessions,
        db.subjects, db.meals, db.activities, db.events,
      ]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ids = await (table as any).filter(isDemo).primaryKeys()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (table as any).bulkDelete(ids)
      }

      // Nutrition logs are keyed by date, so they are tagged by their note.
      const demoNutrition = await db.nutritionLogs
        .filter((log) => log.note === DEMO_PREFIX)
        .primaryKeys()
      await db.nutritionLogs.bulkDelete(demoNutrition)
    },
  )
}

/**
 * Pulls across data written by the pre-database build, which kept a handful of
 * arrays under `life-os:*` in localStorage.
 */
async function migrateLegacyLocalStorage(): Promise<boolean> {
  if (typeof localStorage === "undefined") return false
  const legacyTasks = localStorage.getItem("life-os:tasks")
  const legacyHabits = localStorage.getItem("life-os:habits")
  const legacyBooks = localStorage.getItem("life-os:books")
  if (!legacyTasks && !legacyHabits && !legacyBooks) return false

  const now = Date.now()
  try {
    if (legacyTasks) {
      const parsed = JSON.parse(legacyTasks) as Array<Record<string, unknown>>
      await db.tasks.bulkPut(
        parsed.map((t) => ({
          id: uid(),
          title: String(t.title ?? "Untitled"),
          notes: "",
          category: (t.category as Task["category"]) ?? "Personal",
          priority: (t.priority as Task["priority"]) ?? "Medium",
          dueAt: null,
          done: t.done ? 1 : 0,
          completedAt: t.done ? now : null,
          ...newMeta(now),
        })) as Task[],
      )
    }
    if (legacyHabits) {
      const parsed = JSON.parse(legacyHabits) as Array<Record<string, unknown>>
      await db.habits.bulkPut(
        parsed.map((h, index) => ({
          id: uid(),
          name: String(h.name ?? "Habit"),
          icon: String(h.icon ?? "habits"),
          cadence: String(h.cadence ?? "Daily"),
          targetPerWeek: 7,
          tone: "teal",
          archived: 0 as const,
          order: index,
          ...newMeta(now),
        })) as Habit[],
      )
    }
    if (legacyBooks) {
      const parsed = JSON.parse(legacyBooks) as Array<Record<string, unknown>>
      await db.books.bulkPut(
        parsed.map((b) => ({
          id: uid(),
          title: String(b.title ?? "Untitled"),
          subtitle: "",
          author: String(b.author ?? ""),
          pages: Number(b.pages ?? 0),
          currentPage: Number(b.current ?? 0),
          status: (b.status as Book["status"]) ?? "Want to read",
          cover: String(b.cover ?? ""),
          accent: String(b.accent ?? "sage"),
          startedAt: null,
          finishedAt: null,
          rating: null,
          notes: "",
          ...newMeta(now),
        })) as Book[],
      )
    }
    for (const key of ["tasks", "habits", "books", "food"]) {
      localStorage.removeItem(`life-os:${key}`)
    }
    return true
  } catch {
    return false
  }
}

let initPromise: Promise<void> | null = null

/**
 * Runs once at startup: migrates any legacy data, then seeds demo content on a
 * genuinely empty first launch.
 *
 * Guarded by a module-level promise because React StrictMode invokes mount
 * effects twice in development; without it both passes see an empty database
 * and seed a duplicate set of demo rows.
 */
export function initializeDatabase(): Promise<void> {
  initPromise ??= runInitialization()
  return initPromise
}

async function runInitialization(): Promise<void> {
  const settingsCount = await db.settings.count()
  const alreadyInitialized = settingsCount > 0

  if (alreadyInitialized) return

  const migrated = await migrateLegacyLocalStorage()
  if (!migrated) {
    await seedDemoData()
    await setSetting("demoData", true)
  } else {
    await setSetting("demoData", false)
  }

  const legacyTheme = typeof localStorage !== "undefined"
    ? localStorage.getItem("life-os:theme")
    : null
  if (legacyTheme === '"dark"' || legacyTheme === "dark") {
    await setSetting("theme", "dark")
  }
  await setSetting("onboarded", true)
}
