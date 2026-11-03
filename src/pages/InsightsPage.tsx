import { useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Segmented } from "../components/UI"
import { BarChart, Donut, Heatmap, LineChart, Ring } from "../components/Visuals"
import { useSettings } from "../db/settings"
import {
  habitIntensityByDay, isNutritionLogComplete, nutritionScore, sumBy,
  useActivities, useFocusStats, useHabitStats, useNutritionStats,
  useReadingStats, useTaskStats,
} from "../db/stats"
import {
  addDays, dayKey, formatDuration, formatShortDate, fromDayKey, lastNDays,
} from "../lib/date"
import type { PageProps } from "./shared"

type Range = "Week" | "Month" | "Year"

export function InsightsPage(_props: PageProps) {
  const [range, setRange] = useState<Range>("Month")
  const settings = useSettings()

  const focus = useFocusStats()
  const habits = useHabitStats()
  const tasks = useTaskStats()
  const reading = useReadingStats()
  const nutrition = useNutritionStats()
  const activities = useActivities()

  const windowDays = range === "Week" ? 7 : range === "Month" ? 30 : 365
  const days = useMemo(() => lastNDays(windowDays), [windowDays])
  const daySet = useMemo(() => new Set(days), [days])
  const prevDays = useMemo(
    () => lastNDays(windowDays, addDays(new Date(), -windowDays)),
    [windowDays],
  )
  const prevSet = useMemo(() => new Set(prevDays), [prevDays])

  /* ----------------------------------------------------- headline figures */

  const focusSecondsWindow = sumBy(
    focus.sessions.filter((s) => daySet.has(s.date)), (s) => s.seconds,
  )
  const focusSecondsPrev = sumBy(
    focus.sessions.filter((s) => prevSet.has(s.date)), (s) => s.seconds,
  )
  const focusChange =
    focusSecondsPrev > 0
      ? Math.round(((focusSecondsWindow - focusSecondsPrev) / focusSecondsPrev) * 100)
      : null

  /* Focus consistency: share of days in the window with any session. */
  const focusDays = days.filter((d) => focus.sessions.some((s) => s.date === d)).length
  const focusConsistency = days.length > 0 ? Math.round((focusDays / days.length) * 100) : 0

  const habitIntensity = useMemo(
    () => habitIntensityByDay(habits.habits, habits.logs, days),
    [habits.habits, habits.logs, days],
  )
  const habitConsistency =
    habitIntensity.length > 0
      ? Math.round((sumBy(habitIntensity, (v) => v) / habitIntensity.length) * 100)
      : 0
  const strongHabits = habits.enriched.filter((h) => h.consistency30 >= 80).length

  const overallChange = focusChange

  /* ------------------------------------------------------- time breakdown */

  const breakdown = useMemo(() => {
    const study = sumBy(focus.sessions.filter((s) => daySet.has(s.date) && s.type === "Academic"), (s) => s.seconds)
    const readingFocus = sumBy(focus.sessions.filter((s) => daySet.has(s.date) && s.type === "Reading"), (s) => s.seconds)
    const readingLogged = sumBy(reading.sessions.filter((s) => daySet.has(s.date)), (s) => s.minutes) * 60
    const fitness = sumBy(activities.filter((a) => daySet.has(a.date)), (a) => a.movingTimeS)
    const rows = [
      { label: "Study", seconds: study, tone: "teal" },
      { label: "Fitness", seconds: fitness, tone: "blue" },
      { label: "Reading", seconds: readingFocus + readingLogged, tone: "lavender" },
    ]
    const total = sumBy(rows, (r) => r.seconds)
    return {
      total,
      rows: rows
        .map((r) => ({ ...r, pct: total > 0 ? Math.round((r.seconds / total) * 100) : 0 }))
        .sort((a, b) => b.seconds - a.seconds),
    }
  }, [focus.sessions, reading.sessions, activities, daySet])

  /* --------------------------------------------------------- focus trend */

  const focusTrend = useMemo(() => {
    const buckets = range === "Week" ? 7 : range === "Month" ? 10 : 12
    const perBucket = Math.ceil(windowDays / buckets)
    const data: number[] = []
    const labels: string[] = []
    for (let i = buckets - 1; i >= 0; i--) {
      const end = addDays(new Date(), -i * perBucket)
      const slice = lastNDays(perBucket, end)
      const seconds = sumBy(
        focus.sessions.filter((s) => slice.includes(s.date)), (s) => s.seconds,
      )
      data.push(+(seconds / 3600).toFixed(1))
      labels.push(formatShortDate(end))
    }
    return { data, labels }
  }, [focus.sessions, range, windowDays])

  /* ---------------------------------------------------- task completion */

  const taskTrend = useMemo(() => {
    const weeks = 7
    const data: number[] = []
    const labels: string[] = []
    for (let i = weeks - 1; i >= 0; i--) {
      const end = addDays(new Date(), -i * 7)
      const slice = new Set(lastNDays(7, end))
      const completed = tasks.done.filter(
        (t) => t.completedAt !== null && slice.has(dayKey(t.completedAt)),
      ).length
      const created = tasks.tasks.filter((t) => slice.has(dayKey(t.createdAt))).length
      const rate = created > 0 ? Math.round((completed / Math.max(created, completed)) * 100) : completed > 0 ? 100 : 0
      data.push(rate)
      labels.push(i === 0 ? "Now" : `W${weeks - i}`)
    }
    return { data, labels }
  }, [tasks.done, tasks.tasks])

  /* --------------------------------------------------- fitness progression */

  const fitnessTrend = useMemo(() => {
    const buckets = 12
    const data: number[] = []
    const labels: string[] = []
    for (let i = buckets - 1; i >= 0; i--) {
      const end = addDays(new Date(), -i * 7)
      const slice = new Set(lastNDays(7, end))
      data.push(
        +(sumBy(activities.filter((a) => slice.has(a.date)), (a) => a.distanceM) / 1000).toFixed(1),
      )
      labels.push(formatShortDate(end))
    }
    return { data, labels }
  }, [activities])

  /* ----------------------------------------------------- food percentages */

  const foodRings = useMemo(() => {
    const logs = days.map((d) => nutrition.byDate.get(d)).filter(Boolean)
    const complete = logs.filter((l) => isNutritionLogComplete(l))
    const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0)
    return {
      plants: pct(complete.filter((l) => l?.vegetables && l?.fruit).length, complete.length),
      water: pct(logs.filter((l) => (l?.water ?? 0) >= settings.waterDailyTarget).length, logs.length),
      quality: complete.length > 0
        ? Math.round(sumBy(complete.map((l) => nutritionScore(l) ?? 0), (v) => v) / complete.length)
        : 0,
    }
  }, [days, nutrition.byDate, settings.waterDailyTarget])

  const habitCells = useMemo(
    () => days.map((date, i) => ({ date, value: habitIntensity[i] })),
    [days, habitIntensity],
  )

  const hasAnyData =
    focus.sessions.length > 0 || habits.habits.length > 0 ||
    activities.length > 0 || reading.sessions.length > 0

  const rangeLabel =
    range === "Week" ? "this week" : range === "Month" ? "this month" : "this year"

  if (!hasAnyData) {
    return (
      <div className="page insights-page">
        <PageHeader
          eyebrow="Insights"
          title="See the shape of your life."
          description="Patterns across your focus, health, learning and movement."
        />
        <Card>
          <EmptyState
            icon="insights"
            title="Nothing to analyse yet"
            text="Log focus sessions, habits, meals or activities and the patterns will build here."
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="page insights-page">
      <PageHeader
        eyebrow="Insights"
        title="See the shape of your life."
        description="Patterns across your focus, health, learning and movement."
        actions={
          <Segmented items={["Week", "Month", "Year"] as const} value={range} onChange={setRange} />
        }
      />

      <div className="insight-summary">
        <Card className="summary-lead">
          <span>{range} overview</span>
          <strong>{summaryHeadline(focusConsistency, habitConsistency)}</strong>
          <p>{summaryBody(focusChange, habitConsistency, focusDays, days.length, rangeLabel)}</p>
          {overallChange !== null && (
            <Badge tone={overallChange >= 0 ? "sage" : "neutral"}>
              <Icon name={overallChange >= 0 ? "arrowUp" : "info"} size={14} />{" "}
              {overallChange > 0 ? "+" : ""}
              {overallChange}% focus time
            </Badge>
          )}
        </Card>
        <Donut
          value={focusConsistency}
          label="Focus consistency"
          detail={`${focusDays} of ${days.length} days active`}
        />
        <Donut
          value={habitConsistency}
          label="Habit consistency"
          detail={`${strongHabits} habit${strongHabits === 1 ? "" : "s"} above 80%`}
          color="var(--lavender)"
        />
      </div>

      <div className="analytics-grid">
        <Card className="large-chart">
          <SectionTitle
            title="Focus & learning"
            subtitle={`Hours per period · ${rangeLabel}`}
            action={
              focusChange !== null ? (
                <Badge tone={focusChange >= 0 ? "sage" : "neutral"}>
                  {focusChange > 0 ? "+" : ""}
                  {focusChange}%
                </Badge>
              ) : undefined
            }
          />
          <div className="chart-metric">
            <strong>{formatDuration(focusSecondsWindow)}</strong>
            <span>{rangeLabel}</span>
          </div>
          <LineChart
            data={focusTrend.data}
            labels={focusTrend.labels}
            unit="h"
            gradientId="insights-focus"
          />
        </Card>

        <Card>
          <SectionTitle title="Life balance" subtitle="Share of tracked time" />
          {breakdown.total === 0 ? (
            <p className="soft-note">No tracked time in this window.</p>
          ) : (
            <div className="balance-donut">
              <div
                className="donut-css"
                style={{
                  background: buildConicGradient(breakdown.rows),
                }}
              >
                <span>
                  {formatDuration(breakdown.total)}
                  <small>tracked</small>
                </span>
              </div>
              <div>
                {breakdown.rows.map((row) => (
                  <span key={row.label}>
                    <i className={`tone-${row.tone}`} />
                    {row.label}
                    <strong>{row.pct}%</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Task completion" subtitle="Weekly rate" />
          <BarChart
            data={taskTrend.data}
            labels={taskTrend.labels}
            unit="%"
            emptyHint="No tasks completed yet."
          />
          <p className="soft-note">
            {tasks.done.length === 0
              ? "Complete a few tasks and the weekly rate will plot here."
              : `${tasks.done.length} completed, ${tasks.open.length} open, ${tasks.overdue.length} overdue.`}
          </p>
        </Card>

        <Card>
          <SectionTitle title="Habit consistency" subtitle={`Last ${days.length} days`} />
          <Heatmap cells={habitCells} metric="habit completion" compact />
          <div className="habit-insight-rows">
            {habits.enriched.length === 0 ? (
              <span>No habits yet</span>
            ) : (
              habits.enriched.slice(0, 4).map((entry) => (
                <span key={entry.habit.id}>
                  {entry.habit.name}
                  <strong>{entry.consistency30}%</strong>
                </span>
              ))
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Fitness progression" subtitle="Weekly distance · km" />
          <LineChart
            data={fitnessTrend.data}
            labels={fitnessTrend.labels}
            unit="km"
            gradientId="insights-fitness"
          />
        </Card>

        <Card>
          <SectionTitle title="Food patterns" subtitle="Positive check-in trends" />
          <div className="food-ring-row">
            <Ring value={foodRings.plants} size={96} label={`${foodRings.plants}%`} sublabel="plants" />
            <Ring value={foodRings.water} size={96} label={`${foodRings.water}%`} sublabel="water" color="var(--blue)" />
            <Ring value={foodRings.quality} size={96} label={`${foodRings.quality}%`} sublabel="quality" color="var(--lavender)" />
          </div>
          <p className="soft-note">
            {nutrition.complete.length === 0
              ? "Complete a few food check-ins to populate these."
              : `Based on ${nutrition.complete.length} complete check-ins.`}
          </p>
        </Card>
      </div>
    </div>
  )
}

function summaryHeadline(focusConsistency: number, habitConsistency: number): string {
  const avg = (focusConsistency + habitConsistency) / 2
  if (avg >= 75) return "A strong, steady stretch."
  if (avg >= 50) return "A balanced period, with room to recover."
  if (avg >= 25) return "An uneven stretch, and that is fine."
  return "A quiet period. Worth a small restart."
}

function summaryBody(
  focusChange: number | null,
  habitConsistency: number,
  focusDays: number,
  totalDays: number,
  rangeLabel: string,
): string {
  const parts: string[] = []
  parts.push(`You were active on ${focusDays} of ${totalDays} days ${rangeLabel}.`)
  if (focusChange !== null) {
    parts.push(
      `Focus time is ${focusChange >= 0 ? "up" : "down"} ${Math.abs(focusChange)}% against the previous period.`,
    )
  }
  parts.push(
    habitConsistency >= 70
      ? "Habits are holding steady."
      : habitConsistency > 0
        ? "Habits are the clearest place to gain ground."
        : "No habit data in this window.",
  )
  return parts.join(" ")
}

/** Conic gradient for the CSS donut, built from real shares. */
function buildConicGradient(rows: Array<{ pct: number; tone: string }>): string {
  const colors: Record<string, string> = {
    teal: "var(--teal)",
    blue: "var(--blue)",
    lavender: "var(--lavender)",
    coral: "var(--coral)",
    sand: "var(--sand)",
  }
  let cursor = 0
  const stops: string[] = []
  for (const row of rows) {
    const next = cursor + row.pct
    stops.push(`${colors[row.tone] ?? "var(--teal)"} ${cursor}% ${next}%`)
    cursor = next
  }
  if (cursor < 100) stops.push(`var(--line) ${cursor}% 100%`)
  return `conic-gradient(${stops.join(", ")})`
}
