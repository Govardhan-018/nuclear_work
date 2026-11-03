import { useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { Select } from "../components/Select"
import { Button, Card, EmptyState, Modal, PageHeader, SectionTitle, Segmented } from "../components/UI"
import { Heatmap } from "../components/Visuals"
import { createEvent, deleteEvent } from "../db/repo"
import {
  habitIntensityByDay, streakFromDays, sumBy, useActivities, useEvents,
  useFocusSessions, useHabitLogs, useHabits, useMeals, useReadingSessions, useTasks,
} from "../db/stats"
import {
  addDays, dayKey, dayRange, endOfMonth, formatDuration, formatTime, fromDayKey,
  MONTHS, startOfMonth, startOfWeek, WEEKDAY_LABELS, type DayKey,
} from "../lib/date"
import type { PageProps } from "./shared"

type Metric = "Study hours" | "Reading hours" | "Habit completion" | "Task completion" | "Activity distance"

const METRICS: Metric[] = [
  "Study hours", "Reading hours", "Habit completion", "Task completion", "Activity distance",
]

const EFFORT_LABELS = ["Rest", "Light", "Moderate", "Strong", "Peak"]
const EVENT_CATEGORIES = ["Study", "Personal", "Health", "Fitness", "Work"]

export function CalendarPage(_props: PageProps) {
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState<DayKey>(dayKey())
  const [view, setView] = useState<"Month" | "Week" | "Day">("Month")
  const [metric, setMetric] = useState<Metric>("Study hours")
  const [adding, setAdding] = useState(false)

  const focusSessions = useFocusSessions()
  const readingSessions = useReadingSessions()
  const activities = useActivities()
  const habits = useHabits()
  const habitLogs = useHabitLogs()
  const tasks = useTasks()
  const allEvents = useEvents()
  const selectedDate = fromDayKey(selected)
  const meals = useMeals(selected)

  const shift = (n: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))

  /* Effort per day: focus hours + active hours + habit completion, bucketed 0-4. */
  const effortByDay = useMemo(() => {
    const out = new Map<DayKey, { level: number; detailSeconds: number }>()
    const focus = new Map<string, number>()
    for (const s of focusSessions) focus.set(s.date, (focus.get(s.date) ?? 0) + s.seconds)
    const active = new Map<string, number>()
    for (const a of activities) active.set(a.date, (active.get(a.date) ?? 0) + a.movingTimeS)

    const allDays = new Set<string>([...focus.keys(), ...active.keys(), ...habitLogs.map((l) => l.date)])
    const dayList = [...allDays]
    const intensity = habitIntensityByDay(habits, habitLogs, dayList)

    dayList.forEach((date, index) => {
      const seconds = (focus.get(date) ?? 0) + (active.get(date) ?? 0)
      const hours = seconds / 3600
      const score = hours + intensity[index] * 1.5
      const level = score <= 0 ? 0 : score < 1 ? 1 : score < 2.5 ? 2 : score < 4 ? 3 : 4
      out.set(date, { level, detailSeconds: seconds })
    })
    return out
  }, [focusSessions, activities, habits, habitLogs])

  /* Six-week grid starting on the Monday before the first of the month. */
  const monthDays = useMemo(() => {
    const first = startOfMonth(cursor)
    const start = startOfWeek(first)
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [cursor])

  const eventsForSelected = allEvents
    .filter((e) => e.date === selected)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  /* Agenda combines events with everything logged that day. */
  const agenda = useMemo(() => {
    const rows: Array<{ id: string; time: string; at: number; title: string; meta: string; type: string; eventId?: string }> = []
    for (const event of eventsForSelected) {
      rows.push({
        id: `event-${event.id}`,
        eventId: event.id,
        time: event.startTime,
        at: toMinutes(event.startTime),
        title: event.title,
        meta: `${event.startTime}–${event.endTime} · ${event.category.toLowerCase()}`,
        type: event.category.toLowerCase() === "fitness" ? "fitness" : "study",
      })
    }
    for (const s of focusSessions.filter((s) => s.date === selected)) {
      rows.push({
        id: `focus-${s.id}`, time: formatTime(s.startedAt),
        at: new Date(s.startedAt).getHours() * 60 + new Date(s.startedAt).getMinutes(),
        title: s.subject, meta: `${formatDuration(s.seconds)} · focus`, type: "study",
      })
    }
    for (const s of readingSessions.filter((s) => s.date === selected)) {
      rows.push({
        id: `read-${s.id}`, time: formatTime(s.startedAt),
        at: new Date(s.startedAt).getHours() * 60 + new Date(s.startedAt).getMinutes(),
        title: "Reading", meta: `${s.pagesRead} pages · ${s.minutes} min`, type: "reading",
      })
    }
    for (const a of activities.filter((a) => a.date === selected)) {
      rows.push({
        id: `act-${a.id}`, time: formatTime(a.startedAt),
        at: new Date(a.startedAt).getHours() * 60 + new Date(a.startedAt).getMinutes(),
        title: a.name,
        meta: `${a.distanceM > 0 ? `${(a.distanceM / 1000).toFixed(1)} km · ` : ""}${formatDuration(a.movingTimeS)}`,
        type: "fitness",
      })
    }
    for (const m of meals) {
      rows.push({
        id: `meal-${m.id}`, time: m.time, at: toMinutes(m.time),
        title: `${m.type} · ${m.name}`, meta: m.portion || "logged", type: "food",
      })
    }
    return rows.sort((a, b) => a.at - b.at)
  }, [eventsForSelected, focusSessions, readingSessions, activities, meals, selected])

  const agendaSeconds =
    sumBy(focusSessions.filter((s) => s.date === selected), (s) => s.seconds) +
    sumBy(activities.filter((a) => a.date === selected), (a) => a.movingTimeS)

  /* Year heatmap for the selected metric. */
  const yearDays = useMemo(() => {
    const end = endOfMonth(cursor)
    return dayRange(addDays(end, -363), end)
  }, [cursor])

  const heatmapCells = useMemo(() => {
    const habitIntensity = habitIntensityByDay(habits, habitLogs, yearDays)
    return yearDays.map((date, index) => {
      switch (metric) {
        case "Reading hours":
          return { date, value: sumBy(readingSessions.filter((s) => s.date === date), (s) => s.minutes) / 60 }
        case "Habit completion":
          return { date, value: habitIntensity[index] }
        case "Task completion":
          return {
            date,
            value: tasks.filter((t) => t.completedAt !== null && dayKey(t.completedAt) === date).length,
          }
        case "Activity distance":
          return { date, value: sumBy(activities.filter((a) => a.date === date), (a) => a.distanceM) / 1000 }
        default:
          return { date, value: sumBy(focusSessions.filter((s) => s.date === date), (s) => s.seconds) / 3600 }
      }
    })
  }, [metric, yearDays, focusSessions, readingSessions, activities, tasks, habits, habitLogs])

  const activeDays = heatmapCells.filter((c) => c.value > 0).length
  const longestStreak = useMemo(
    () => longestRun(heatmapCells.filter((c) => c.value > 0).map((c) => c.date)),
    [heatmapCells],
  )
  const mostActiveWeekday = useMemo(() => {
    const totals = new Array(7).fill(0) as number[]
    for (const cell of heatmapCells) {
      totals[(fromDayKey(cell.date).getDay() + 6) % 7] += cell.value
    }
    const best = totals.indexOf(Math.max(...totals))
    return totals[best] > 0 ? fullWeekday(best) : "--"
  }, [heatmapCells])

  const currentStreak = useMemo(
    () => streakFromDays(heatmapCells.filter((c) => c.value > 0).map((c) => c.date)),
    [heatmapCells],
  )

  return (
    <div className="page calendar-page">
      <PageHeader
        title="Calendar"
        description="Everything you do, in one clear timeline."
        actions={
          <>
            <Segmented items={["Month", "Week", "Day"] as const} value={view} onChange={setView} />
            <Button icon="plus" onClick={() => setAdding(true)}>
              Add event
            </Button>
          </>
        }
      />

      <Card className="calendar-shell">
        <div className="calendar-toolbar">
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                setCursor(new Date())
                setSelected(dayKey())
              }}
            >
              Today
            </Button>
            <Button variant="icon" icon="chevronLeft" onClick={() => shift(-1)} aria-label="Previous month" />
            <Button variant="icon" icon="chevronRight" onClick={() => shift(1)} aria-label="Next month" />
            <h2>
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </h2>
          </div>
          <div className="calendar-key effort-key">
            {EFFORT_LABELS.slice(1).map((label, i) => (
              <span key={label}>
                <i className={`effort-dot level-${i + 1}`} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {view === "Month" ? (
          <div className="month-calendar">
            <div className="weekday-row">
              {WEEKDAY_LABELS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="month-grid">
              {monthDays.map((date) => {
                const key = dayKey(date)
                const outside = date.getMonth() !== cursor.getMonth()
                const effort = outside ? 0 : (effortByDay.get(key)?.level ?? 0)
                const seconds = effortByDay.get(key)?.detailSeconds ?? 0
                const hasEvent = allEvents.some((e) => e.date === key)
                return (
                  <button
                    key={key}
                    className={`${key === selected ? "selected" : ""} effort-${effort} ${outside ? "outside" : ""}`}
                    onClick={() => setSelected(key)}
                    aria-label={`${date.toDateString()} — ${EFFORT_LABELS[effort]}`}
                  >
                    <span className={key === dayKey() ? "today-number" : ""}>{date.getDate()}</span>
                    {!outside && (
                      <div className="effort-meta">
                        <strong>{EFFORT_LABELS[effort]}</strong>
                        <small>{seconds > 0 ? `${formatDuration(seconds)} tracked` : hasEvent ? "planned" : ""}</small>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <WeekDayView
            view={view}
            anchor={selectedDate}
            events={allEvents}
            onSelectDay={setSelected}
          />
        )}
      </Card>

      <div className="calendar-lower">
        <Card className="agenda-card">
          <SectionTitle
            title={selectedDate.toLocaleDateString(undefined, {
              weekday: "long", month: "long", day: "numeric",
            })}
            subtitle={
              agenda.length === 0
                ? "Nothing logged or planned"
                : `${agenda.length} item${agenda.length === 1 ? "" : "s"}${agendaSeconds > 0 ? ` · ${formatDuration(agendaSeconds)}` : ""}`
            }
            action={<Button variant="ghost" icon="plus" onClick={() => setAdding(true)}>Event</Button>}
          />
          {agenda.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="An open day"
              text="Add an event, or log a focus session, meal or workout and it will appear here."
            />
          ) : (
            <div className="agenda-list">
              {agenda.map((row) => (
                <div key={row.id}>
                  <time>{row.time}</time>
                  <span className={`agenda-icon ${row.type}`}>
                    <Icon name={row.type === "study" ? "focus" : row.type === "reading" ? "book" : row.type} />
                  </span>
                  <div>
                    <strong>{row.title}</strong>
                    <small>{row.meta}</small>
                  </div>
                  {row.eventId ? (
                    <button
                      className="row-action"
                      aria-label={`Delete ${row.title}`}
                      onClick={() => void deleteEvent(row.eventId as string)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  ) : (
                    <Icon name="check" size={16} />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="heatmap-card">
          <SectionTitle
            title="Your year in motion"
            subtitle={`${fromDayKey(yearDays[0]).toLocaleDateString(undefined, { month: "short", year: "numeric" })} – ${fromDayKey(yearDays[yearDays.length - 1]).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`}
            action={
              <Select
                value={metric}
                options={METRICS.map((x) => ({ value: x, label: x }))}
                onChange={(value) => setMetric(value as Metric)}
                sheetTitle="Heatmap metric"
                className="compact"
              />
            }
          />
          <Heatmap cells={heatmapCells} metric={metric.toLowerCase()} />
          <div className="heatmap-stats">
            <div>
              <strong>{activeDays}</strong>
              <span>active days</span>
            </div>
            <div>
              <strong>{longestStreak} days</strong>
              <span>longest streak</span>
            </div>
            <div>
              <strong>{mostActiveWeekday}</strong>
              <span>most active</span>
            </div>
          </div>
          {currentStreak > 0 && (
            <p className="soft-note">
              Current streak: <strong>{currentStreak} day{currentStreak === 1 ? "" : "s"}</strong>.
            </p>
          )}
        </Card>
      </div>

      {adding && (
        <EventModal
          date={selected}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}

function EventModal({ date, onClose }: { date: DayKey; onClose: () => void }) {
  const [title, setTitle] = useState("")
  const [day, setDay] = useState(date)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("10:00")
  const [category, setCategory] = useState("Study")
  const [note, setNote] = useState("")

  const submit = async () => {
    if (!title.trim()) return
    await createEvent({ title: title.trim(), date: day, startTime, endTime, category, note })
    onClose()
  }

  return (
    <Modal title="Add event" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label className="field">
          <span>Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Neuroscience lecture" />
        </label>
        <label className="field">
          <span>Date</span>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Start</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className="field">
            <span>End</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>
        <div className="field">
          <span>Category</span>
          <Select
            value={category}
            options={EVENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
            onChange={setCategory}
            sheetTitle="Category"
          />
        </div>
        <label className="field">
          <span>Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </label>
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title.trim()}>
            Add event
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function WeekDayView({
  view, anchor, events, onSelectDay,
}: {
  view: "Week" | "Day"
  anchor: Date
  events: ReturnType<typeof useEvents>
  onSelectDay: (day: DayKey) => void
}) {
  const days = useMemo(() => {
    if (view === "Day") return [anchor]
    const start = startOfWeek(anchor)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [view, anchor])

  return (
    <div className="week-view">
      <div className="week-head">
        {days.map((date) => (
          <strong key={dayKey(date)}>
            {view === "Day"
              ? date.toLocaleDateString(undefined, { weekday: "long", day: "numeric" })
              : `${date.toLocaleDateString(undefined, { weekday: "short" })} ${date.getDate()}`}
          </strong>
        ))}
      </div>
      <div className="week-body">
        {days.map((date) => {
          const key = dayKey(date)
          const dayEvents = events.filter((e) => e.date === key)
          return (
            <div key={key} onClick={() => onSelectDay(key)}>
              {dayEvents.map((event) => {
                // Position events between 06:00 and 23:00 of the column height.
                const minutes = toMinutes(event.startTime)
                const top = Math.max(0, Math.min(92, ((minutes - 360) / (17 * 60)) * 100))
                return (
                  <span
                    key={event.id}
                    className={`week-event ${event.category.toLowerCase() === "fitness" ? "fitness" : "study"}`}
                    style={{ top: `${top}%` }}
                  >
                    {event.title}
                    <br />
                    <small>{event.startTime}</small>
                  </span>
                )
              })}
              {dayEvents.length === 0 && <span className="week-empty">—</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

/** Longest run of consecutive days present in the list. */
function longestRun(days: DayKey[]): number {
  const sorted = [...new Set(days)].sort()
  let best = 0
  let run = 0
  let previous: DayKey | null = null
  for (const day of sorted) {
    run = previous !== null && dayKey(addDays(fromDayKey(previous), 1)) === day ? run + 1 : 1
    best = Math.max(best, run)
    previous = day
  }
  return best
}

function fullWeekday(index: number): string {
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index]
}
