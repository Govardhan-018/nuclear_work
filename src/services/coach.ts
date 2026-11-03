import { db } from "../db/db"
import {
  habitIntensityByDay, isNutritionLogComplete, longestStreakFromDays,
  nutritionScore, streakFromDays, sumBy,
} from "../db/stats"
import { addDays, dayKey, formatDuration, lastNDays } from "../lib/date"
import { chatCompletion, type ChatMessage } from "./groq"

const SYSTEM_PROMPT = `You are the coach inside Maya, a personal tracking app for study, reading, nutrition, habits and fitness.

You are given a factual summary of what the user actually logged. Rules:
- Ground every claim in the numbers provided. Never invent data.
- If the summary says something was not logged, say so plainly rather than guessing.
- Be concise: 2-4 short sentences unless asked for more.
- Be practical and specific. Prefer one concrete next action over general advice.
- Warm and matter-of-fact. No hype, no emoji, no bullet lists unless asked.
- You are not a doctor. For anything medical, suggest talking to a professional.`

/** A compact, factual digest of the last 14 days for the model to reason over. */
export async function buildContextSummary(): Promise<string> {
  const [tasks, habits, habitLogs, books, readingSessions, focusSessions, nutritionLogs, activities] =
    await Promise.all([
      db.tasks.toArray(), db.habits.toArray(), db.habitLogs.toArray(),
      db.books.toArray(), db.readingSessions.toArray(), db.focusSessions.toArray(),
      db.nutritionLogs.toArray(), db.activities.toArray(),
    ])

  const live = <T extends { deleted: 0 | 1 }>(rows: T[]) => rows.filter((r) => r.deleted !== 1)
  const today = dayKey()
  const days14 = lastNDays(14)
  const inWindow = (date: string) => date >= days14[0]

  const liveFocus = live(focusSessions).filter((s) => inWindow(s.date))
  const liveReading = live(readingSessions).filter((s) => inWindow(s.date))
  const liveActivities = live(activities).filter((a) => inWindow(a.date))
  const liveHabits = live(habits).filter((h) => h.archived !== 1)
  const liveLogs = live(habitLogs)
  const liveTasks = live(tasks)
  const liveNutrition = live(nutritionLogs).filter((n) => inWindow(n.date))

  const lines: string[] = []
  lines.push(`Date: ${new Date().toDateString()}`)
  lines.push("")

  /* focus */
  const focusToday = sumBy(liveFocus.filter((s) => s.date === today), (s) => s.seconds)
  const focus14 = sumBy(liveFocus, (s) => s.seconds)
  const focusDays = new Set(liveFocus.map((s) => s.date)).size
  lines.push("FOCUS & STUDY")
  if (liveFocus.length === 0) {
    lines.push("- No focus sessions logged in the last 14 days.")
  } else {
    lines.push(`- Today: ${formatDuration(focusToday)} across ${liveFocus.filter((s) => s.date === today).length} session(s).`)
    lines.push(`- Last 14 days: ${formatDuration(focus14)} over ${focusDays} active day(s).`)
    const bySubject = new Map<string, number>()
    for (const s of liveFocus) bySubject.set(s.subject, (bySubject.get(s.subject) ?? 0) + s.seconds)
    const top = [...bySubject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    lines.push(`- By subject: ${top.map(([n, sec]) => `${n} ${formatDuration(sec)}`).join(", ")}.`)
    const byHour = new Array(24).fill(0) as number[]
    for (const s of liveFocus) byHour[new Date(s.startedAt).getHours()] += s.seconds
    const peak = byHour.indexOf(Math.max(...byHour))
    lines.push(`- Most productive hour: ${String(peak).padStart(2, "0")}:00.`)
  }
  lines.push("")

  /* habits */
  lines.push("HABITS")
  if (liveHabits.length === 0) {
    lines.push("- No habits set up.")
  } else {
    for (const habit of liveHabits) {
      const days = liveLogs.filter((l) => l.habitId === habit.id && l.done === 1).map((l) => l.date)
      const set = new Set(days)
      const hits14 = days14.filter((d) => set.has(d)).length
      lines.push(
        `- ${habit.name} (${habit.cadence}): ${hits14}/14 days, current streak ${streakFromDays(days)}, best ${longestStreakFromDays(days)}. Today: ${set.has(today) ? "done" : "not yet"}.`,
      )
    }
    const intensity = habitIntensityByDay(liveHabits, liveLogs, days14)
    const avg = Math.round((sumBy(intensity, (v) => v) / intensity.length) * 100)
    lines.push(`- Overall habit completion over 14 days: ${avg}%.`)
  }
  lines.push("")

  /* tasks */
  const open = liveTasks.filter((t) => t.done !== 1)
  const overdue = open.filter((t) => t.dueAt !== null && t.dueAt < Date.now())
  const doneToday = liveTasks.filter(
    (t) => t.done === 1 && t.completedAt !== null && dayKey(t.completedAt) === today,
  )
  lines.push("TASKS")
  lines.push(`- ${open.length} open, ${overdue.length} overdue, ${doneToday.length} completed today.`)
  if (open.length > 0) {
    lines.push(
      `- Open items: ${open.slice(0, 8).map((t) => `${t.title} [${t.priority}${t.dueAt ? `, due ${new Date(t.dueAt).toDateString()}` : ""}]`).join("; ")}.`,
    )
  }
  lines.push("")

  /* reading */
  const reading = live(books).filter((b) => b.status === "Reading")
  lines.push("READING")
  if (liveReading.length === 0 && reading.length === 0) {
    lines.push("- Nothing logged.")
  } else {
    const minutes14 = sumBy(liveReading, (s) => s.minutes)
    const pages14 = sumBy(liveReading, (s) => s.pagesRead)
    lines.push(`- Last 14 days: ${minutes14} minutes, ${pages14} pages.`)
    for (const book of reading.slice(0, 3)) {
      const pct = book.pages > 0 ? Math.round((book.currentPage / book.pages) * 100) : 0
      lines.push(`- Reading "${book.title}" by ${book.author}: page ${book.currentPage}/${book.pages} (${pct}%).`)
    }
  }
  lines.push("")

  /* nutrition */
  lines.push("NUTRITION")
  const complete = liveNutrition.filter((n) => isNutritionLogComplete(n))
  if (complete.length === 0) {
    lines.push("- No complete check-ins in the last 14 days.")
  } else {
    const scores = complete.map((n) => nutritionScore(n) ?? 0)
    lines.push(`- ${complete.length}/14 days checked in, average quality score ${Math.round(sumBy(scores, (s) => s) / scores.length)}/100.`)
    const water = sumBy(liveNutrition, (n) => n.water)
    lines.push(`- Average water: ${(water / Math.max(1, liveNutrition.length)).toFixed(1)} glasses/day.`)
    const yesterday = liveNutrition.find((n) => n.date === dayKey(addDays(new Date(), -1)))
    if (yesterday) {
      lines.push(`- Yesterday: protein ${yesterday.protein ?? "n/a"}, carbs ${yesterday.carbs ?? "n/a"}, junk ${yesterday.junk ?? "n/a"}, vegetables ${yesterday.vegetables ? "yes" : "no"}, fruit ${yesterday.fruit ? "yes" : "no"}, energy ${yesterday.energy ?? "n/a"}.`)
    }
  }
  lines.push("")

  /* fitness */
  lines.push("FITNESS")
  if (liveActivities.length === 0) {
    lines.push("- No activities in the last 14 days.")
  } else {
    const km = sumBy(liveActivities, (a) => a.distanceM) / 1000
    const movingS = sumBy(liveActivities, (a) => a.movingTimeS)
    lines.push(`- ${liveActivities.length} activities, ${km.toFixed(1)} km, ${formatDuration(movingS)} moving time.`)
    const byType = new Map<string, number>()
    for (const a of liveActivities) byType.set(a.type, (byType.get(a.type) ?? 0) + 1)
    lines.push(`- Types: ${[...byType.entries()].map(([t, n]) => `${t} x${n}`).join(", ")}.`)
    const recent = [...liveActivities].sort((a, b) => b.startedAt - a.startedAt)[0]
    lines.push(`- Most recent: ${recent.name} on ${new Date(recent.startedAt).toDateString()}, ${(recent.distanceM / 1000).toFixed(1)} km in ${formatDuration(recent.movingTimeS)}.`)
  }

  return lines.join("\n")
}

/** Asks the coach a free-form question with the user's data attached. */
export async function askCoach(
  question: string,
  history: ChatMessage[] = [],
): Promise<string> {
  const summary = await buildContextSummary()
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Here is the user's logged data:\n\n${summary}` },
    ...history.slice(-8),
    { role: "user", content: question },
  ]
  return chatCompletion(messages, { maxTokens: 500 })
}

/** The short "yesterday in review + today's focus" card on the Today page. */
export async function generateDailyBrief(): Promise<{ summary: string; focus: string }> {
  const context = await buildContextSummary()
  const reply = await chatCompletion(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `Here is the user's logged data:\n\n${context}` },
      {
        role: "user",
        content:
          'Write today\'s brief. Respond with exactly two lines and no other text.\nLine 1: "SUMMARY: " then one or two sentences reviewing the last few days against the data.\nLine 2: "FOCUS: " then a single concrete action for today, under 90 characters.',
      },
    ],
    { maxTokens: 220, temperature: 0.5 },
  )

  const summaryMatch = reply.match(/SUMMARY:\s*(.+)/i)
  const focusMatch = reply.match(/FOCUS:\s*(.+)/i)
  return {
    summary: summaryMatch?.[1]?.trim() ?? reply.split("\n")[0]?.trim() ?? reply.trim(),
    focus: focusMatch?.[1]?.trim() ?? "",
  }
}

/**
 * A rule-based brief computed entirely on device. Used when there is no API
 * key or no connection, so the card is never empty.
 */
export function localBrief(input: {
  focusSecondsToday: number
  focusTargetSeconds: number
  habitsDone: number
  habitsTotal: number
  openTasks: number
  overdueTasks: number
  nutritionLoggedYesterday: boolean
  activeMinutesToday: number
  readingMinutesToday: number
  longestStreak: number
  longestStreakName: string
}): { summary: string; focus: string } {
  const observations: string[] = []

  if (input.focusSecondsToday > 0) {
    observations.push(`${formatDuration(input.focusSecondsToday)} focused so far today`)
  }
  if (input.habitsTotal > 0) {
    observations.push(`${input.habitsDone} of ${input.habitsTotal} habits checked off`)
  }
  if (input.activeMinutesToday > 0) {
    observations.push(`${input.activeMinutesToday} active minutes`)
  }
  if (input.readingMinutesToday > 0) {
    observations.push(`${input.readingMinutesToday} minutes of reading`)
  }

  const summary =
    observations.length > 0
      ? `${observations.slice(0, 3).join(", ")}.${input.longestStreak >= 3 ? ` Your longest run going is ${input.longestStreak} days on ${input.longestStreakName}.` : ""}`
      : "Nothing logged yet today. Start anywhere: a short focus block, a habit, or a quick meal check-in."

  let focus: string
  if (input.overdueTasks > 0) {
    focus = `Clear ${input.overdueTasks} overdue task${input.overdueTasks === 1 ? "" : "s"} before adding anything new.`
  } else if (input.focusSecondsToday < input.focusTargetSeconds / 4) {
    focus = "Protect one 25 minute focus block today."
  } else if (input.habitsTotal > 0 && input.habitsDone < input.habitsTotal) {
    focus = `Finish the remaining ${input.habitsTotal - input.habitsDone} habit check-in${input.habitsTotal - input.habitsDone === 1 ? "" : "s"}.`
  } else if (!input.nutritionLoggedYesterday) {
    focus = "Log yesterday's food check-in so the nutrition trend stays accurate."
  } else if (input.activeMinutesToday === 0) {
    focus = "Get some movement in, even a short walk."
  } else {
    focus = "You are on track. Keep the pace steady and protect your wind-down."
  }

  return { summary, focus }
}
