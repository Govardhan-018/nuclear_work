import { useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { Badge, Button, Card, EmptyState, PageHeader, Progress, SectionTitle, Segmented } from "../components/UI"
import { Heatmap, MultiLineChart, Ring } from "../components/Visuals"
import {
  computeBalance, balanceLabel, habitIntensityByDay, nutritionScore, sumBy,
  useActivities, useBooks, useEvents, useFocusSessions, useHabitLogs, useHabits,
  useMeals, useNutritionLogs, useReadingSessions, useTasks,
} from "../db/stats"
import { toggleTask } from "../db/repo"
import { useSettings } from "../db/settings"
import {
  addDays, dayKey, formatDate, formatDuration, formatDurationShort, formatTime,
  lastNDays, startOfWeek, WEEKDAY_LABELS, type DayKey,
} from "../lib/date"
import { localBrief as localBriefFrom } from "../services/coach"
import { greeting } from "./shared"
import { AiCoach } from "./AiCoach"
import type { PageProps } from "./shared"

type TimelineEntry = {
  id: string
  time: string
  at: number
  title: string
  meta: string
  type: "study" | "reading" | "task" | "habit" | "food" | "fitness" | "event"
}

export function TodayPage({ onNavigate, onQuickAdd }: PageProps) {
  const settings = useSettings()
  const [selected, setSelected] = useState<DayKey>(dayKey())
  const [range, setRange] = useState<"Week" | "Month">("Week")
  const [showCoach, setShowCoach] = useState(false)

  const tasks = useTasks()
  const habits = useHabits()
  const habitLogs = useHabitLogs()
  const books = useBooks()
  const focusSessions = useFocusSessions()
  const readingSessions = useReadingSessions()
  const activities = useActivities()
  const nutritionLogs = useNutritionLogs()
  const meals = useMeals(selected)
  const events = useEvents(selected)

  const today = dayKey()
  const isToday = selected === today
  const selectedDate = useMemo(() => {
    const [y, m, d] = selected.split("-").map(Number)
    return new Date(y, m - 1, d)
  }, [selected])

  /* The seven-day strip is centred so today sits one from the right. */
  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(new Date(), -5 + i)),
    [],
  )

  const dayFocus = focusSessions.filter((s) => s.date === selected)
  const dayReading = readingSessions.filter((s) => s.date === selected)
  const dayActivities = activities.filter((a) => a.date === selected)
  const dayNutrition = nutritionLogs.find((n) => n.date === selected)

  const focusSeconds = sumBy(dayFocus, (s) => s.seconds)
  const readingMinutes = sumBy(dayReading, (s) => s.minutes)
  const activeMinutes = Math.round(sumBy(dayActivities, (a) => a.movingTimeS) / 60)
  const distanceKm = sumBy(dayActivities, (a) => a.distanceM) / 1000

  const habitsDoneSet = new Set(
    habitLogs.filter((l) => l.date === selected && l.done === 1).map((l) => l.habitId),
  )
  const habitsDone = habits.filter((h) => habitsDoneSet.has(h.id)).length

  const dayTasks = tasks.filter(
    (t) => t.dueAt !== null && dayKey(t.dueAt) === selected,
  )
  const dayTasksDone = dayTasks.filter((t) => t.done === 1).length

  const focusTargetSeconds = settings.focusDailyTargetMinutes * 60
  const nutrition = nutritionScore(dayNutrition)

  const balance = computeBalance({
    focusSeconds,
    focusTargetSeconds,
    habitsDone,
    habitsTotal: habits.length,
    tasksDone: dayTasksDone,
    tasksTotal: dayTasks.length,
    nutrition,
    activeMinutes,
  })

  /* ----------------------------------------------------------- timeline */

  const timeline = useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = []

    for (const session of dayFocus) {
      entries.push({
        id: `focus-${session.id}`,
        at: session.startedAt,
        time: formatTime(session.startedAt),
        title: `${session.type === "Reading" ? "Reading" : "Deep work"} · ${session.subject}`,
        meta: `${formatDurationShort(session.seconds)} · focus`,
        type: "study",
      })
    }
    for (const session of dayReading) {
      const book = books.find((b) => b.id === session.bookId)
      entries.push({
        id: `reading-${session.id}`,
        at: session.startedAt,
        time: formatTime(session.startedAt),
        title: book?.title ?? "Reading",
        meta: `${session.pagesRead} pages · reading`,
        type: "reading",
      })
    }
    for (const activity of dayActivities) {
      entries.push({
        id: `activity-${activity.id}`,
        at: activity.startedAt,
        time: formatTime(activity.startedAt),
        title: activity.name,
        meta: `${activity.distanceM > 0 ? `${(activity.distanceM / 1000).toFixed(1)} km · ` : ""}fitness`,
        type: "fitness",
      })
    }
    for (const meal of meals) {
      const at = parseTimeOnDay(selectedDate, meal.time)
      entries.push({
        id: `meal-${meal.id}`,
        at,
        time: meal.time,
        title: `${meal.type} · ${meal.name}`,
        meta: `${meal.portion || "logged"} · food`,
        type: "food",
      })
    }
    for (const event of events) {
      const at = parseTimeOnDay(selectedDate, event.startTime)
      entries.push({
        id: `event-${event.id}`,
        at,
        time: event.startTime,
        title: event.title,
        meta: `${event.startTime}–${event.endTime} · ${event.category.toLowerCase()}`,
        type: "event",
      })
    }
    for (const task of dayTasks.filter((t) => t.done === 1 && t.completedAt)) {
      entries.push({
        id: `task-${task.id}`,
        at: task.completedAt as number,
        time: formatTime(task.completedAt as number),
        title: task.title,
        meta: `completed · ${task.category.toLowerCase()}`,
        type: "task",
      })
    }

    return entries.sort((a, b) => a.at - b.at)
  }, [dayFocus, dayReading, dayActivities, meals, events, dayTasks, books, selectedDate])

  /* -------------------------------------------------------- trend chart */

  const trend = useMemo(() => {
    const buildDay = (key: DayKey) => {
      const f = sumBy(focusSessions.filter((s) => s.date === key), (s) => s.seconds)
      const a = sumBy(activities.filter((x) => x.date === key), (x) => x.movingTimeS) / 60
      const n = nutritionScore(nutritionLogs.find((x) => x.date === key))
      const doneSet = new Set(
        habitLogs.filter((l) => l.date === key && l.done === 1).map((l) => l.habitId),
      )
      return {
        movement: Math.min(100, Math.round((a / 30) * 100)),
        study: focusTargetSeconds > 0 ? Math.min(100, Math.round((f / focusTargetSeconds) * 100)) : 0,
        nutrition: n ?? 0,
        habits: habits.length > 0
          ? Math.round((habits.filter((h) => doneSet.has(h.id)).length / habits.length) * 100)
          : 0,
      }
    }

    if (range === "Week") {
      const start = startOfWeek()
      const keys = Array.from({ length: 7 }, (_, i) => dayKey(addDays(start, i)))
      const rows = keys.map(buildDay)
      return {
        labels: WEEKDAY_LABELS,
        series: [
          { name: "Movement", data: rows.map((r) => r.movement), color: "var(--teal-dark)", unit: "%" },
          { name: "Study", data: rows.map((r) => r.study), color: "var(--lavender)", unit: "%" },
          { name: "Nutrition", data: rows.map((r) => r.nutrition), color: "var(--coral)", unit: "%" },
          { name: "Habits", data: rows.map((r) => r.habits), color: "var(--ink)", unit: "%" },
        ],
      }
    }

    // Month view: five buckets of seven days, oldest first.
    const buckets = Array.from({ length: 5 }, (_, i) => {
      const end = addDays(new Date(), -(4 - i) * 7)
      return lastNDays(7, end).map(buildDay)
    })
    const avg = (rows: ReturnType<typeof buildDay>[], pick: (r: ReturnType<typeof buildDay>) => number) =>
      Math.round(sumBy(rows, pick) / Math.max(1, rows.length))
    return {
      labels: ["W1", "W2", "W3", "W4", "Now"],
      series: [
        { name: "Movement", data: buckets.map((b) => avg(b, (r) => r.movement)), color: "var(--teal-dark)", unit: "%" },
        { name: "Study", data: buckets.map((b) => avg(b, (r) => r.study)), color: "var(--lavender)", unit: "%" },
        { name: "Nutrition", data: buckets.map((b) => avg(b, (r) => r.nutrition)), color: "var(--coral)", unit: "%" },
        { name: "Habits", data: buckets.map((b) => avg(b, (r) => r.habits)), color: "var(--ink)", unit: "%" },
      ],
    }
  }, [range, focusSessions, activities, nutritionLogs, habitLogs, habits, focusTargetSeconds])

  /* ------------------------------------------------------------ heatmap */

  const heatmapDays = lastNDays(182)
  const heatmapCells = useMemo(() => {
    const focusByDay = new Map<string, number>()
    for (const s of focusSessions) {
      focusByDay.set(s.date, (focusByDay.get(s.date) ?? 0) + s.seconds)
    }
    const activityByDay = new Map<string, number>()
    for (const a of activities) {
      activityByDay.set(a.date, (activityByDay.get(a.date) ?? 0) + a.movingTimeS)
    }
    const habitIntensity = habitIntensityByDay(habits, habitLogs, heatmapDays)
    return heatmapDays.map((date, index) => {
      const focusHours = (focusByDay.get(date) ?? 0) / 3600
      const activeHours = (activityByDay.get(date) ?? 0) / 3600
      return { date, value: focusHours + activeHours + habitIntensity[index] * 2 }
    })
  }, [focusSessions, activities, habits, habitLogs, heatmapDays.join(",")])

  const activeDays = heatmapCells.filter((c) => c.value > 0).length
  const strongDays = heatmapCells.filter((c) => c.value >= 3).length
  const strongestWeekday = useMemo(() => {
    const totals = new Array(7).fill(0) as number[]
    for (const cell of heatmapCells) {
      const [y, m, d] = cell.date.split("-").map(Number)
      const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7
      totals[weekday] += cell.value
    }
    const best = totals.indexOf(Math.max(...totals))
    return totals[best] > 0 ? WEEKDAY_LABELS[best] : "--"
  }, [heatmapCells])

  /* ------------------------------------------------------------- render */

  const openTasks = tasks.filter((t) => t.done !== 1)
  const nextTasks = [...openTasks]
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
    .slice(0, 3)
  const currentBook = books.find((b) => b.status === "Reading") ?? null
  const name = settings.profileName.trim()

  const activityByDayCount = useMemo(() => {
    const set = new Set<string>()
    for (const s of focusSessions) set.add(s.date)
    for (const a of activities) set.add(a.date)
    for (const l of habitLogs) if (l.done === 1) set.add(l.date)
    for (const s of readingSessions) set.add(s.date)
    return set
  }, [focusSessions, activities, habitLogs, readingSessions])

  const pillars: Array<[string, number, string]> = [
    ["Movement", Math.min(100, Math.round((activeMinutes / 30) * 100)), distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : `${activeMinutes}m`],
    ["Study", focusTargetSeconds > 0 ? Math.min(100, Math.round((focusSeconds / focusTargetSeconds) * 100)) : 0, formatDurationShort(focusSeconds)],
    ["Nutrition", nutrition ?? 0, nutrition === null ? "Not logged" : `${nutrition}%`],
    ["Habits", habits.length > 0 ? Math.round((habitsDone / habits.length) * 100) : 0, `${habitsDone}/${habits.length}`],
  ]

  return (
    <div className="page today-page">
      <PageHeader
        eyebrow={formatDate(selectedDate)}
        title={isToday ? `${greeting()}${name ? `, ${name}` : ""}.` : formatDate(selectedDate)}
        description={
          balance === null
            ? "Nothing logged for this day yet."
            : `${balanceLabel(balance)} — ${balance}% balance across your pillars.`
        }
        actions={
          <Button icon="plus" onClick={onQuickAdd}>
            Add activity
          </Button>
        }
      />

      <div className="date-strip">
        {week.map((day) => {
          const key = dayKey(day)
          return (
            <button
              key={key}
              className={key === selected ? "active" : ""}
              onClick={() => setSelected(key)}
              aria-pressed={key === selected}
            >
              <span>{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <strong>{day.getDate()}</strong>
              {activityByDayCount.has(key) && <i />}
            </button>
          )
        })}
      </div>

      <div className="mobile-command">
        <Card className="life-state-card">
          <div className="life-state-top">
            <div>
              <span>{isToday ? "Today’s complete state" : "Day summary"}</span>
              <strong>{balanceLabel(balance)}</strong>
            </div>
            <Ring
              value={balance ?? 0}
              size={76}
              label={balance === null ? "--" : String(balance)}
              sublabel="balance"
            />
          </div>
          <div className="life-state-bars">
            {pillars.map(([label, value, detail]) => (
              <div key={label}>
                <span>
                  {label} <b>{detail}</b>
                </span>
                <Progress value={value} />
              </div>
            ))}
          </div>
        </Card>

        <CoachCard onOpen={() => setShowCoach(true)} />
      </div>

      <div className="today-metrics">
        {[
          ["fitness", distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : `${activeMinutes}m`, "Movement", dayActivities.length > 0 ? `${dayActivities.length} activity${dayActivities.length === 1 ? "" : "s"}` : "None yet"],
          ["focus", formatDurationShort(focusSeconds), "Study", `${pillars[1][1]}% of goal`],
          ["food", nutrition === null ? "--" : `${nutrition}%`, "Nutrition", dayNutrition ? "Logged" : "Not logged"],
          ["book", `${readingMinutes}m`, "Reading", `${sumBy(dayReading, (s) => s.pagesRead)} pages`],
        ].map((item, index) => (
          <Card className="today-metric" key={item[2]}>
            <span className={index % 2 ? "lavender" : "lime"}>
              <Icon name={item[0]} />
            </span>
            <div>
              <strong>{item[1]}</strong>
              <small>{item[2]}</small>
            </div>
            <b>{item[3]}</b>
          </Card>
        ))}
      </div>

      <div className="today-analytics">
        <Card className="today-trend">
          <SectionTitle
            title="Your rhythm"
            subtitle={range === "Week" ? "Daily balance · this week" : "Weekly balance · last 5 weeks"}
            action={
              <Segmented items={["Week", "Month"] as const} value={range} onChange={setRange} />
            }
          />
          <div className="trend-summary">
            <div>
              <strong>{balance === null ? "--" : `${balance}%`}</strong>
              <span>current balance</span>
            </div>
            {balance !== null && (
              <Badge tone={balance >= 65 ? "sage" : "neutral"}>
                <Icon name={balance >= 65 ? "arrowUp" : "info"} size={13} /> {balanceLabel(balance)}
              </Badge>
            )}
          </div>
          <MultiLineChart labels={trend.labels} series={trend.series} />
        </Card>

        <Card className="today-heatmap">
          <SectionTitle
            title="Activity calendar"
            subtitle="Your consistency across all areas"
            action={<Badge tone="sage">{activeDays} active days</Badge>}
          />
          <Heatmap cells={heatmapCells} metric="activity" />
          <div className="heatmap-summary">
            <span>
              <strong>{activeDays}</strong> active days
            </span>
            <span>
              <strong>{strongDays}</strong> strong days
            </span>
            <span>
              <strong>{strongestWeekday}</strong> strongest day
            </span>
          </div>
        </Card>
      </div>

      <Card className="today-next">
        <SectionTitle
          title="Next up"
          subtitle="Only what needs your attention"
          action={<Button variant="ghost" onClick={() => onNavigate("calendar")}>See day</Button>}
        />
        {currentBook && (
          <div className="next-focus-row">
            <span className="metric-icon lavender">
              <Icon name="focus" />
            </span>
            <div>
              <strong>Reading session</strong>
              <small>
                {currentBook.title} · page {currentBook.currentPage} of {currentBook.pages}
              </small>
            </div>
            <Button variant="secondary" icon="play" onClick={() => onNavigate("focus")}>
              Start
            </Button>
          </div>
        )}
        {nextTasks.slice(0, 2).map((task) => (
          <label className="next-task-row" key={task.id}>
            <button
              className="checkbox"
              aria-label={`Complete ${task.title}`}
              onClick={() => void toggleTask(task.id)}
            />
            <span>
              <strong>{task.title}</strong>
              <small>{task.dueAt ? formatDate(task.dueAt) : "No due date"}</small>
            </span>
            <Badge tone={task.priority === "High" ? "coral" : "neutral"}>{task.priority}</Badge>
          </label>
        ))}
        {nextTasks.length === 0 && !currentBook && (
          <EmptyState
            icon="check"
            title="Nothing waiting"
            text="No open tasks and no book in progress. Add something from the + button."
          />
        )}
      </Card>

      <div className="overview-grid">
        <Card className="daily-progress">
          <div>
            <span className="card-kicker">Daily rhythm</span>
            <h2>{balanceLabel(balance)}</h2>
            <p>
              {dayTasks.length + habits.length > 0
                ? `You’ve completed ${dayTasksDone + habitsDone} of ${dayTasks.length + habits.length} planned items for this day.`
                : "Nothing planned for this day yet."}
            </p>
            <div className="progress-legend">
              <span>
                <i className="teal" />
                Focus {pillars[1][1]}%
              </span>
              <span>
                <i className="blue" />
                Movement {pillars[0][1]}%
              </span>
              <span>
                <i className="coral" />
                Habits {pillars[3][1]}%
              </span>
            </div>
          </div>
          <div className="rings-cluster">
            <Ring
              value={
                dayTasks.length + habits.length > 0
                  ? ((dayTasksDone + habitsDone) / (dayTasks.length + habits.length)) * 100
                  : 0
              }
              size={156}
              label={`${dayTasksDone + habitsDone} of ${dayTasks.length + habits.length}`}
              sublabel="activities"
            />
            <div className="mini-ring one" />
            <div className="mini-ring two" />
          </div>
        </Card>

        <Card className="daily-note">
          <span className="card-kicker">Daily insight</span>
          <div className="insight-orb">
            <Icon name="sun" size={24} />
          </div>
          <DailyInsight
            focusSeconds={focusSeconds}
            habitsDone={habitsDone}
            habitsTotal={habits.length}
            activeMinutes={activeMinutes}
            readingMinutes={readingMinutes}
          />
          <button onClick={() => onNavigate("insights")}>
            View pattern <Icon name="chevronRight" size={15} />
          </button>
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card className="timeline-card">
          <SectionTitle
            title={isToday ? "Today’s timeline" : "Timeline"}
            subtitle={formatDate(selectedDate)}
            action={<Button variant="ghost" onClick={() => onNavigate("calendar")}>View calendar</Button>}
          />
          {timeline.length === 0 ? (
            <EmptyState
              icon="clock"
              title="Nothing logged"
              text="Focus sessions, meals, reading and workouts will appear here as you log them."
            />
          ) : (
            <div className="timeline">
              {timeline.map((entry) => (
                <div className="timeline-item" key={entry.id}>
                  <time>{entry.time}</time>
                  <i className={entry.type} />
                  <div>
                    <strong>{entry.title}</strong>
                    <span>{entry.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="side-stack">
          <Card>
            <SectionTitle
              title="Up next"
              action={
                <button className="round-more" aria-label="All tasks" onClick={() => onNavigate("tasks")}>
                  <Icon name="more" />
                </button>
              }
            />
            {nextTasks.length === 0 ? (
              <p className="soft-note">No open tasks. Enjoy the clear deck.</p>
            ) : (
              nextTasks.map((task) => (
                <label className="mini-task" key={task.id}>
                  <button
                    className="checkbox"
                    aria-label={`Complete ${task.title}`}
                    onClick={() => void toggleTask(task.id)}
                  />
                  <span>
                    <strong>{task.title}</strong>
                    <small>
                      {task.dueAt ? formatDate(task.dueAt) : "Someday"} · {task.category}
                    </small>
                  </span>
                </label>
              ))
            )}
          </Card>

          <Card className="reading-now">
            <SectionTitle
              title="Currently reading"
              action={<Badge tone="sage">{currentBook ? "Reading" : "None"}</Badge>}
            />
            {currentBook ? (
              <>
                <div className={`book-cover ${currentBook.accent}`}>
                  <span>{currentBook.cover}</span>
                </div>
                <div className="book-summary">
                  <strong>{currentBook.title}</strong>
                  <span>{currentBook.author}</span>
                  <Progress
                    value={currentBook.pages > 0 ? (currentBook.currentPage / currentBook.pages) * 100 : 0}
                  />
                  <small>
                    {currentBook.currentPage} of {currentBook.pages} pages
                  </small>
                </div>
              </>
            ) : (
              <EmptyState
                icon="book"
                title="No book in progress"
                text="Add one from the Reading page to track pages and minutes."
              />
            )}
          </Card>
        </div>
      </div>

      {showCoach && <AiCoach onClose={() => setShowCoach(false)} />}
    </div>
  )
}

/** The compact coach card. Shows the on-device brief; AI is opt-in behind "More". */
function CoachCard({ onOpen }: { onOpen: () => void }) {
  const brief = useLocalBrief()
  return (
    <Card className="ai-coach-card">
      <div className="ai-coach-head">
        <span className="ai-orb">
          <Icon name="insights" />
        </span>
        <div>
          <small>Life OS intelligence</small>
          <strong>Your daily coach</strong>
        </div>
        <Badge tone="sage">AI</Badge>
      </div>
      <p>{brief.summary}</p>
      <div className="ai-today-focus">
        <small>Today’s focus</small>
        <strong>{brief.focus}</strong>
      </div>
      <Button variant="secondary" icon="chevronRight" onClick={onOpen}>
        More
      </Button>
    </Card>
  )
}

function DailyInsight({
  focusSeconds, habitsDone, habitsTotal, activeMinutes, readingMinutes,
}: {
  focusSeconds: number
  habitsDone: number
  habitsTotal: number
  activeMinutes: number
  readingMinutes: number
}) {
  if (habitsTotal > 0 && habitsDone === habitsTotal) {
    return (
      <>
        <h3>Every habit checked off</h3>
        <p>All {habitsTotal} habits are done for this day. That is the whole chain intact.</p>
      </>
    )
  }
  if (focusSeconds >= 3600) {
    return (
      <>
        <h3>A solid block of focus</h3>
        <p>{formatDuration(focusSeconds)} of focused work logged. Protect the recovery that follows it.</p>
      </>
    )
  }
  if (activeMinutes > 0) {
    return (
      <>
        <h3>You moved today</h3>
        <p>{activeMinutes} active minutes logged. Movement earlier in the day tends to lift everything after it.</p>
      </>
    )
  }
  if (readingMinutes > 0) {
    return (
      <>
        <h3>Pages are adding up</h3>
        <p>{readingMinutes} minutes of reading logged. Small sessions compound faster than long rare ones.</p>
      </>
    )
  }
  return (
    <>
      <h3>The day is still open</h3>
      <p>Nothing logged yet. One small entry is enough to start the pattern.</p>
    </>
  )
}

/** Rule-based brief, computed on device so it works with no key and no network. */
function useLocalBrief() {
  const settings = useSettings()
  const focusSessions = useFocusSessions()
  const habits = useHabits()
  const habitLogs = useHabitLogs()
  const tasks = useTasks()
  const activities = useActivities()
  const readingSessions = useReadingSessions()
  const nutritionLogs = useNutritionLogs()

  const today = dayKey()
  const yesterday = dayKey(addDays(new Date(), -1))
  const doneSet = new Set(
    habitLogs.filter((l) => l.date === today && l.done === 1).map((l) => l.habitId),
  )
  const open = tasks.filter((t) => t.done !== 1)

  const streaks = habits.map((habit) => {
    const days = new Set(
      habitLogs.filter((l) => l.habitId === habit.id && l.done === 1).map((l) => l.date),
    )
    let streak = 0
    let cursor = new Date()
    if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1)
    while (days.has(dayKey(cursor))) {
      streak += 1
      cursor = addDays(cursor, -1)
    }
    return { streak, name: habit.name }
  })
  const longest = streaks.reduce((a, b) => (b.streak > a.streak ? b : a), { streak: 0, name: "" })

  return localBriefFrom({
    focusSecondsToday: sumBy(focusSessions.filter((s) => s.date === today), (s) => s.seconds),
    focusTargetSeconds: settings.focusDailyTargetMinutes * 60,
    habitsDone: habits.filter((h) => doneSet.has(h.id)).length,
    habitsTotal: habits.length,
    openTasks: open.length,
    overdueTasks: open.filter((t) => t.dueAt !== null && t.dueAt < Date.now()).length,
    nutritionLoggedYesterday: nutritionLogs.some((n) => n.date === yesterday),
    activeMinutesToday: Math.round(
      sumBy(activities.filter((a) => a.date === today), (a) => a.movingTimeS) / 60,
    ),
    readingMinutesToday: sumBy(readingSessions.filter((s) => s.date === today), (s) => s.minutes),
    longestStreak: longest.streak,
    longestStreakName: longest.name,
  })
}

/** "08:15" on a given date, as epoch ms. */
function parseTimeOnDay(date: Date, time: string): number {
  const [h, m] = time.split(":").map(Number)
  const d = new Date(date)
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0)
  return d.getTime()
}
