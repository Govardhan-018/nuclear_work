import { useLiveQuery } from "dexie-react-hooks"
import { alive, db } from "./db"
import {
  addDays, dayKey, fromDayKey, lastNDays, startOfDay, startOfMonth, startOfWeek,
  type DayKey,
} from "../lib/date"
import type {
  Activity, Book, CalendarEvent, FocusSession, Habit, HabitLog, Meal,
  NutritionLog, ReadingSession, Subject, Task,
} from "./types"

/* -------------------------------------------------------------- live rows */

export function useTasks(): Task[] {
  return alive(useLiveQuery(() => db.tasks.toArray(), [], [] as Task[]))
}

export function useHabits(): Habit[] {
  const rows = alive(useLiveQuery(() => db.habits.toArray(), [], [] as Habit[]))
  return rows.filter((h) => h.archived !== 1).sort((a, b) => a.order - b.order)
}

export function useHabitLogs(): HabitLog[] {
  return alive(useLiveQuery(() => db.habitLogs.toArray(), [], [] as HabitLog[]))
}

export function useSubjects(kind?: "Academic" | "Reading"): Subject[] {
  const rows = alive(useLiveQuery(() => db.subjects.toArray(), [], [] as Subject[]))
  return rows
    .filter((row) => row.archived !== 1 && (kind ? row.kind === kind : true))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

export function useBooks(): Book[] {
  return alive(useLiveQuery(() => db.books.toArray(), [], [] as Book[]))
}

export function useReadingSessions(): ReadingSession[] {
  return alive(
    useLiveQuery(() => db.readingSessions.toArray(), [], [] as ReadingSession[]),
  )
}

export function useFocusSessions(): FocusSession[] {
  return alive(
    useLiveQuery(() => db.focusSessions.toArray(), [], [] as FocusSession[]),
  )
}

export function useActivities(): Activity[] {
  const rows = alive(useLiveQuery(() => db.activities.toArray(), [], [] as Activity[]))
  return rows.sort((a, b) => b.startedAt - a.startedAt)
}

export function useNutritionLogs(): NutritionLog[] {
  return alive(
    useLiveQuery(() => db.nutritionLogs.toArray(), [], [] as NutritionLog[]),
  )
}

export function useNutritionLog(date: DayKey): NutritionLog | undefined {
  return useLiveQuery(() => db.nutritionLogs.get(date), [date], undefined)
}

export function useMeals(date?: DayKey): Meal[] {
  return alive(
    useLiveQuery(
      () => (date ? db.meals.where("date").equals(date).toArray() : db.meals.toArray()),
      [date],
      [] as Meal[],
    ),
  )
}

export function useEvents(date?: DayKey): CalendarEvent[] {
  return alive(
    useLiveQuery(
      () =>
        date ? db.events.where("date").equals(date).toArray() : db.events.toArray(),
      [date],
      [] as CalendarEvent[],
    ),
  )
}

/** True before the first read resolves, so pages can hold off on empty states. */
export function useDbReady(): boolean {
  const probe = useLiveQuery(() => db.settings.count(), [], undefined)
  return probe !== undefined
}

/* ------------------------------------------------------------ aggregation */

export function sumBy<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + (pick(row) || 0), 0)
}

/** Groups numeric totals by day key. */
export function totalsByDay<T>(
  rows: T[],
  getDate: (row: T) => DayKey,
  getValue: (row: T) => number,
): Record<DayKey, number> {
  const out: Record<DayKey, number> = {}
  for (const row of rows) {
    const key = getDate(row)
    out[key] = (out[key] ?? 0) + (getValue(row) || 0)
  }
  return out
}

/** Maps day keys onto a fixed window, filling gaps with zero. */
export function seriesForDays(
  totals: Record<DayKey, number>,
  days: DayKey[],
): number[] {
  return days.map((day) => totals[day] ?? 0)
}

/* ------------------------------------------------------------------ focus */

export function focusSecondsOn(sessions: FocusSession[], date: DayKey): number {
  return sumBy(
    sessions.filter((s) => s.date === date),
    (s) => s.seconds,
  )
}

export function useFocusStats() {
  const sessions = useFocusSessions()
  const today = dayKey()
  const weekDays = lastNDays(7)
  const monthStart = dayKey(startOfMonth())

  const byDay = totalsByDay(sessions, (s) => s.date, (s) => s.seconds)
  const weekSeries = seriesForDays(byDay, weekDays)
  const todaySeconds = byDay[today] ?? 0
  const weekSeconds = sumBy(weekSeries, (v) => v)

  const prevWeekDays = lastNDays(7, addDays(new Date(), -7))
  const prevWeekSeconds = sumBy(seriesForDays(byDay, prevWeekDays), (v) => v)
  const weekChangePct =
    prevWeekSeconds > 0
      ? Math.round(((weekSeconds - prevWeekSeconds) / prevWeekSeconds) * 100)
      : null

  const monthSessions = sessions.filter((s) => s.date >= monthStart)
  const bySubject = new Map<string, number>()
  for (const session of monthSessions) {
    bySubject.set(session.subject, (bySubject.get(session.subject) ?? 0) + session.seconds)
  }
  const subjectTotal = sumBy([...bySubject.values()], (v) => v)
  const subjects = [...bySubject.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, seconds]) => ({
      name,
      seconds,
      pct: subjectTotal > 0 ? Math.round((seconds / subjectTotal) * 100) : 0,
    }))

  const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 8)

  const activeDays = weekSeries.filter((v) => v > 0).length
  const dailyAverageSeconds = activeDays > 0 ? Math.round(weekSeconds / activeDays) : 0

  // Which hour of the day holds the most focused time.
  const byHour = new Array(24).fill(0) as number[]
  for (const session of sessions) {
    byHour[new Date(session.startedAt).getHours()] += session.seconds
  }
  const peakHour = byHour.some((v) => v > 0) ? byHour.indexOf(Math.max(...byHour)) : null

  return {
    sessions, todaySeconds, weekSeconds, weekSeries, weekDays, weekChangePct,
    subjects, recent, dailyAverageSeconds, byDay, peakHour,
    totalSeconds: sumBy(sessions, (s) => s.seconds),
    sessionCount: sessions.length,
  }
}

/* ---------------------------------------------------------------- reading */

export function useReadingStats() {
  const sessions = useReadingSessions()
  const books = useBooks()
  const today = dayKey()
  const weekDays = lastNDays(7)

  const minutesByDay = totalsByDay(sessions, (s) => s.date, (s) => s.minutes)
  const pagesByDay = totalsByDay(sessions, (s) => s.date, (s) => s.pagesRead)

  const reading = books.filter((b) => b.status === "Reading")
  const completed = books.filter((b) => b.status === "Completed")
  const wantToRead = books.filter((b) => b.status === "Want to read")

  const currentBook =
    [...reading].sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))[0] ?? null

  const totalPagesRead = sumBy(sessions, (s) => s.pagesRead)
  const totalMinutes = sumBy(sessions, (s) => s.minutes)

  return {
    sessions, books, reading, completed, wantToRead, currentBook,
    todayMinutes: minutesByDay[today] ?? 0,
    todayPages: pagesByDay[today] ?? 0,
    weekMinutes: seriesForDays(minutesByDay, weekDays),
    weekPages: seriesForDays(pagesByDay, weekDays),
    weekDays, minutesByDay, pagesByDay, totalPagesRead, totalMinutes,
    streak: streakFromDays(Object.keys(minutesByDay).filter((d) => minutesByDay[d] > 0)),
  }
}

/* ----------------------------------------------------------------- habits */

/** Counts consecutive days ending today (or yesterday) present in the set. */
export function streakFromDays(days: string[]): number {
  const set = new Set(days)
  let streak = 0
  let cursor = startOfDay()
  // A streak survives until the end of today, so start from yesterday if today
  // has not been logged yet.
  if (!set.has(dayKey(cursor))) cursor = addDays(cursor, -1)
  while (set.has(dayKey(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function longestStreakFromDays(days: string[]): number {
  const sorted = [...new Set(days)].sort()
  let best = 0
  let run = 0
  let previous: string | null = null
  for (const day of sorted) {
    // fromDayKey parses in local time; `new Date("YYYY-MM-DD")` would parse as
    // UTC and shift the day for anyone west of Greenwich.
    run = previous !== null && dayKey(addDays(fromDayKey(previous), 1)) === day ? run + 1 : 1
    best = Math.max(best, run)
    previous = day
  }
  return best
}

export function useHabitStats() {
  const habits = useHabits()
  const logs = useHabitLogs()
  const today = dayKey()

  const doneByHabit = new Map<string, string[]>()
  for (const log of logs) {
    if (log.done !== 1) continue
    const list = doneByHabit.get(log.habitId) ?? []
    list.push(log.date)
    doneByHabit.set(log.habitId, list)
  }

  const enriched = habits.map((habit) => {
    const days = doneByHabit.get(habit.id) ?? []
    const set = new Set(days)
    const last30 = lastNDays(30)
    const hits30 = last30.filter((d) => set.has(d)).length
    return {
      habit,
      days,
      doneToday: set.has(today),
      streak: streakFromDays(days),
      best: longestStreakFromDays(days),
      consistency30: Math.round((hits30 / 30) * 100),
    }
  })

  const doneToday = enriched.filter((h) => h.doneToday).length
  const longest = enriched.reduce(
    (acc, h) => (h.streak > acc.streak ? { streak: h.streak, name: h.habit.name } : acc),
    { streak: 0, name: "" },
  )

  // Share of habit check-ins actually completed over the last 30 days.
  const monthDays = lastNDays(30)
  const possible = habits.length * monthDays.length
  const achieved = enriched.reduce((total, entry) => {
    const set = new Set(entry.days)
    return total + monthDays.filter((d) => set.has(d)).length
  }, 0)

  return {
    habits, logs, enriched, doneToday,
    total: habits.length,
    longestStreak: longest.streak,
    longestStreakName: longest.name,
    monthlyConsistency: possible > 0 ? Math.round((achieved / possible) * 100) : 0,
  }
}

/** Completion ratio per day across all habits, for heatmaps. */
export function habitIntensityByDay(
  habits: Habit[], logs: HabitLog[], days: DayKey[],
): number[] {
  if (habits.length === 0) return days.map(() => 0)
  const doneSet = new Set(logs.filter((l) => l.done === 1).map((l) => `${l.habitId}:${l.date}`))
  return days.map((day) => {
    const hits = habits.filter((h) => doneSet.has(`${h.id}:${day}`)).length
    return hits / habits.length
  })
}

/* ------------------------------------------------------------------ tasks */

export function useTaskStats() {
  const tasks = useTasks()
  const now = Date.now()
  const todayEnd = startOfDay(addDays(new Date(), 1)).getTime()

  const open = tasks.filter((t) => t.done !== 1)
  const done = tasks.filter((t) => t.done === 1)
  const todayTasks = open.filter((t) => t.dueAt !== null && t.dueAt < todayEnd)
  const upcoming = open.filter((t) => t.dueAt !== null && t.dueAt >= todayEnd)
  const someday = open.filter((t) => t.dueAt === null)
  const overdue = open.filter((t) => t.dueAt !== null && t.dueAt < now)

  const completedToday = done.filter(
    (t) => t.completedAt !== null && dayKey(t.completedAt) === dayKey(),
  )

  return {
    tasks, open, done, todayTasks, upcoming, someday, overdue, completedToday,
    completionPct:
      tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0,
  }
}

/* ---------------------------------------------------------------- fitness */

export function useFitnessStats() {
  const activities = useActivities()
  const monthStart = dayKey(startOfMonth())
  const weekStart = dayKey(startOfWeek())
  const weekDays = lastNDays(7)

  const month = activities.filter((a) => a.date >= monthStart)
  const week = activities.filter((a) => a.date >= weekStart)
  const runs = activities.filter((a) => a.type.toLowerCase().includes("run"))
  const monthRuns = month.filter((a) => a.type.toLowerCase().includes("run"))

  const monthDistanceM = sumBy(month, (a) => a.distanceM)
  const monthMovingS = sumBy(month, (a) => a.movingTimeS)
  const runDistanceM = sumBy(monthRuns, (a) => a.distanceM)
  const runMovingS = sumBy(monthRuns, (a) => a.movingTimeS)

  // Average pace in seconds per kilometre.
  const avgPaceSecPerKm =
    runDistanceM > 0 ? Math.round(runMovingS / (runDistanceM / 1000)) : null

  const distanceByDay = totalsByDay(activities, (a) => a.date, (a) => a.distanceM / 1000)

  const prevMonthStart = dayKey(startOfMonth(addDays(startOfMonth(), -1)))
  const prevMonth = activities.filter(
    (a) => a.date >= prevMonthStart && a.date < monthStart,
  )
  const prevDistanceM = sumBy(prevMonth, (a) => a.distanceM)
  const distanceChangePct =
    prevDistanceM > 0
      ? Math.round(((monthDistanceM - prevDistanceM) / prevDistanceM) * 100)
      : null

  const withHr = activities.filter((a) => a.averageHeartrate !== null)
  const avgHeartrate =
    withHr.length > 0
      ? Math.round(sumBy(withHr, (a) => a.averageHeartrate ?? 0) / withHr.length)
      : null

  const longestRun = runs.reduce<Activity | null>(
    (best, a) => (!best || a.distanceM > best.distanceM ? a : best),
    null,
  )

  return {
    activities, month, week, runs, monthRuns,
    monthDistanceKm: monthDistanceM / 1000,
    monthMovingS, avgPaceSecPerKm, distanceChangePct, avgHeartrate, longestRun,
    weekSeriesKm: seriesForDays(distanceByDay, weekDays),
    weekDays, distanceByDay,
    monthElevationM: sumBy(month, (a) => a.elevationM),
    monthCount: month.length,
    totalDistanceKm: sumBy(activities, (a) => a.distanceM) / 1000,
  }
}

/* -------------------------------------------------------------- nutrition */

export function nutritionScore(log: NutritionLog | undefined): number | null {
  if (!log) return null
  let score = 0
  let max = 0
  const portion = (v: string | null) => (v === "Enough" ? 1 : v === "High" ? 0.6 : v === "Low" ? 0.4 : null)

  for (const value of [portion(log.protein), portion(log.carbs)]) {
    if (value !== null) { score += value; max += 1 }
  }
  if (log.junk !== null) {
    score += log.junk === "None" ? 1 : log.junk === "Some" ? 0.5 : 0
    max += 1
  }
  if (log.vegetables !== null) { score += log.vegetables ? 1 : 0; max += 1 }
  if (log.fruit !== null) { score += log.fruit ? 1 : 0; max += 1 }

  return max > 0 ? Math.round((score / max) * 100) : null
}

export function isNutritionLogComplete(log: NutritionLog | undefined): boolean {
  if (!log) return false
  return (
    log.protein !== null && log.carbs !== null && log.junk !== null &&
    log.vegetables !== null && log.fruit !== null
  )
}

export function useNutritionStats() {
  const logs = useNutritionLogs()
  const today = dayKey()
  const yesterday = dayKey(addDays(new Date(), -1))

  const byDate = new Map(logs.map((l) => [l.date, l]))
  const complete = logs.filter((l) => isNutritionLogComplete(l))
  const scores = complete
    .map((l) => ({ date: l.date, score: nutritionScore(l) ?? 0 }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const monthStart = dayKey(startOfMonth())
  const monthLogs = complete.filter((l) => l.date >= monthStart)

  return {
    logs, byDate, complete, scores,
    todayLog: byDate.get(today),
    yesterdayLog: byDate.get(yesterday),
    loggedThisMonth: monthLogs.length,
    streak: streakFromDays(complete.map((l) => l.date)),
    averageScore:
      scores.length > 0
        ? Math.round(sumBy(scores, (s) => s.score) / scores.length)
        : null,
  }
}

/* ------------------------------------------------------- the balance score */

/**
 * A single 0-100 "how was today" number, averaged over whichever of the four
 * pillars have any data. Returns null when nothing has been logged at all, so
 * the UI can show an empty state rather than a misleading zero.
 */
export function computeBalance(input: {
  focusSeconds: number
  focusTargetSeconds: number
  habitsDone: number
  habitsTotal: number
  tasksDone: number
  tasksTotal: number
  nutrition: number | null
  activeMinutes: number
}): number | null {
  const parts: number[] = []
  if (input.focusTargetSeconds > 0 && input.focusSeconds > 0) {
    parts.push(Math.min(100, (input.focusSeconds / input.focusTargetSeconds) * 100))
  }
  if (input.habitsTotal > 0) {
    parts.push((input.habitsDone / input.habitsTotal) * 100)
  }
  if (input.tasksTotal > 0) {
    parts.push((input.tasksDone / input.tasksTotal) * 100)
  }
  if (input.nutrition !== null) parts.push(input.nutrition)
  if (input.activeMinutes > 0) parts.push(Math.min(100, (input.activeMinutes / 30) * 100))

  if (parts.length === 0) return null
  return Math.round(sumBy(parts, (p) => p) / parts.length)
}

export function balanceLabel(score: number | null): string {
  if (score === null) return "Nothing logged yet"
  if (score >= 85) return "Strong momentum"
  if (score >= 65) return "Steady and balanced"
  if (score >= 45) return "Finding your rhythm"
  if (score >= 25) return "A slower day"
  return "Rest and reset"
}
