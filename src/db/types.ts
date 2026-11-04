import type { DayKey } from "../lib/date"

/**
 * Every syncable record carries metadata for the shared cloud sync layer. `deleted` is a soft-delete tombstone (0/1 rather
 * than boolean because IndexedDB cannot index booleans). `deleted` is a soft-delete tombstone (0/1 rather
 * than boolean because IndexedDB cannot index booleans).
 */
export type SyncMeta = {
  createdAt: number
  updatedAt: number
  deleted: 0 | 1
  /** Set once the record has been pushed to a remote backend. */
  syncedAt?: number | null
  /** Identifier assigned by the remote backend, if any. */
  remoteId?: string | null
}

export type Priority = "Low" | "Medium" | "High"
export type TaskCategory = "Study" | "Personal" | "Health" | "Fitness" | "Work"

export type Task = SyncMeta & {
  id: string
  title: string
  notes?: string
  category: TaskCategory
  priority: Priority
  /** Epoch ms, or null for "someday". */
  dueAt: number | null
  done: 0 | 1
  completedAt: number | null
}

export type Habit = SyncMeta & {
  id: string
  name: string
  icon: string
  cadence: string
  /** How many days per week counts as on-track. 7 = daily. */
  targetPerWeek: number
  tone: string
  archived: 0 | 1
  order: number
}

export type HabitLog = SyncMeta & {
  /** `${habitId}:${date}` so a day can only be logged once per habit. */
  id: string
  habitId: string
  date: DayKey
  done: 0 | 1
}

export type BookStatus = "Reading" | "Want to read" | "Completed"

/**
 * Books and podcasts share a record. A podcast counts episodes where a book
 * counts pages, so `pages`/`currentPage` hold whichever unit applies and the
 * labels follow `kind`. Reusing the field means every existing statistic,
 * chart and streak keeps working untouched.
 */
export type MediaKind = "book" | "podcast"

export type Book = SyncMeta & {
  id: string
  /** Absent on records created before podcasts existed; treat as "book". */
  kind?: MediaKind
  title: string
  subtitle?: string
  author: string
  pages: number
  currentPage: number
  status: BookStatus
  /** Short text shown on the generated cover. */
  cover: string
  accent: string
  startedAt: number | null
  finishedAt: number | null
  rating: number | null
  notes?: string
}

export type ReadingSession = SyncMeta & {
  id: string
  bookId: string | null
  date: DayKey
  startedAt: number
  minutes: number
  pagesRead: number
}

export type FocusSessionType = "Academic" | "Reading"

/** Palette offered when creating a subject. */
export const SUBJECT_TONES = [
  "teal", "blue", "lavender", "coral", "sand", "forest", "sage",
] as const
export type SubjectTone = (typeof SUBJECT_TONES)[number]

/**
 * A study subject or reading category. Sessions reference it by id, and keep
 * a denormalised `subject` name so history survives a rename or deletion.
 */
export type Subject = SyncMeta & {
  id: string
  name: string
  /** Academic subjects and reading categories share the model but not the list. */
  kind: FocusSessionType
  tone: SubjectTone
  archived: 0 | 1
  order: number
}

export type FocusSession = SyncMeta & {
  id: string
  /** Subject id, or null for sessions logged before subjects existed. */
  subjectId: string | null
  /**
   * Book a reading session was spent on. Optional because sessions recorded
   * before reading was book-aware have no value.
   */
  bookId?: string | null
  /** Subject name as it was at the time, so history survives a rename. */
  subject: string
  type: FocusSessionType
  mode: "Timer" | "Stopwatch"
  date: DayKey
  startedAt: number
  endedAt: number
  seconds: number
  /** 1 when a timer ran to zero rather than being stopped early. */
  completed: 0 | 1
  note?: string
}

export type PortionLevel = "Low" | "Enough" | "High"
export type JunkLevel = "None" | "Some" | "A lot"
export type EnergyLevel = "Low" | "Okay" | "Good" | "Great"

export type NutritionLog = SyncMeta & {
  /** The day key doubles as the primary key: one check-in per day. */
  id: DayKey
  date: DayKey
  protein: PortionLevel | null
  carbs: PortionLevel | null
  junk: JunkLevel | null
  vegetables: boolean | null
  fruit: boolean | null
  /** Glasses of water. */
  water: number
  energy: EnergyLevel | null
  note?: string
}

export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack"

export type Meal = SyncMeta & {
  id: string
  date: DayKey
  type: MealType
  name: string
  /** Free text, e.g. "grain bowl, 1 plate". */
  portion?: string
  time: string
  note?: string
}

export type ActivitySource = "strava" | "manual"

export type Activity = SyncMeta & {
  /** `strava:<id>` for imported activities, a uuid for manual ones. */
  id: string
  source: ActivitySource
  stravaId?: number
  name: string
  /** Strava sport type, e.g. Run, Ride, Walk, WeightTraining. */
  type: string
  date: DayKey
  startedAt: number
  distanceM: number
  movingTimeS: number
  elapsedTimeS: number
  elevationM: number
  averageSpeed: number
  averageHeartrate: number | null
  maxHeartrate: number | null
  calories: number | null
  /** Encoded polyline of the route summary, when Strava provides one. */
  polyline: string | null
}

export type CalendarEvent = SyncMeta & {
  id: string
  title: string
  date: DayKey
  startTime: string
  endTime: string
  category: string
  note?: string
}

export type AiMessage = {
  id: string
  conversationId: string
  role: "user" | "assistant" | "system"
  text: string
  model?: string
  createdAt: number
  /** Set when the request failed, so the UI can offer a retry. */
  failed?: 0 | 1
}

export type SettingRecord = {
  key: string
  value: unknown
  updatedAt: number
}

/**
 * A focus session that is currently running or paused. Persisted so the timer
 * survives navigating to another tab, and so a session is not silently lost if
 * Android kills the app in the background.
 */
export type ActiveFocusSession = {
  subjectId: string | null
  subjectName: string
  /** Set for reading sessions, so ending one can update the book. */
  bookId?: string | null
  type: FocusSessionType
  mode: "Timer" | "Stopwatch"
  targetMinutes: number
  /** When the session first began, for the saved record. */
  startedAt: number
  /** Time banked before the current run segment. */
  accumulatedMs: number
  /** Epoch ms the current run began, or null while paused. */
  runningSince: number | null
}

/** Everything the Settings page can read and write. */
export type AppSettings = {
  profileName: string
  theme: "light" | "dark"
  demoData: boolean
  onboarded: boolean
  /** Minutes before a task's due time to notify. 0 means at the due time. */
  taskReminderLeadMinutes: number
  taskRemindersEnabled: boolean
  focusDailyTargetMinutes: number
  readingDailyTargetMinutes: number
  waterDailyTarget: number
  stravaClientId: string
  stravaClientSecret: string
  stravaAccessToken: string
  stravaRefreshToken: string
  stravaExpiresAt: number
  stravaAthleteName: string
  stravaLastSyncAt: number
  groqApiKey: string
  groqModel: string
  activeFocusSession: ActiveFocusSession | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  profileName: "",
  theme: "light",
  demoData: true,
  onboarded: false,
  taskReminderLeadMinutes: 10,
  taskRemindersEnabled: true,
  focusDailyTargetMinutes: 240,
  readingDailyTargetMinutes: 30,
  waterDailyTarget: 8,
  stravaClientId: "",
  stravaClientSecret: "",
  stravaAccessToken: "",
  stravaRefreshToken: "",
  stravaExpiresAt: 0,
  stravaAthleteName: "",
  stravaLastSyncAt: 0,
  groqApiKey: "",
  groqModel: "llama-3.3-70b-versatile",
  activeFocusSession: null,
}

/** Keys that hold credentials; masked in the UI and excluded from exports. */
export const SECRET_SETTING_KEYS: (keyof AppSettings)[] = [
  "stravaClientSecret",
  "stravaAccessToken",
  "stravaRefreshToken",
  "groqApiKey",
]
