import { useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { Select } from "../components/Select"
import { Button, Card, EmptyState, Modal, PageHeader, SectionTitle, Segmented } from "../components/UI"
import { Heatmap, Ring } from "../components/Visuals"
import { createHabit, deleteHabit, toggleHabitLog, updateHabit } from "../db/repo"
import { habitIntensityByDay, useHabitStats } from "../db/stats"
import { addDays, dayKey, lastNDays, startOfMonth } from "../lib/date"
import type { Habit } from "../db/types"
import type { PageProps } from "./shared"

const ICON_CHOICES = ["sun", "book", "drop", "fitness", "habits", "focus", "food", "moon", "flame"]
const CADENCES = [
  { label: "Every day", value: "Daily", target: 7 },
  { label: "Weekdays", value: "Weekdays", target: 5 },
  { label: "3 times a week", value: "3x weekly", target: 3 },
  { label: "Twice a week", value: "2x weekly", target: 2 },
  { label: "Once a week", value: "Weekly", target: 1 },
]

export function HabitsPage(_props: PageProps) {
  const stats = useHabitStats()
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [historyRange, setHistoryRange] = useState<"Month" | "Year">("Month")

  const today = dayKey()
  const remaining = stats.total - stats.doneToday
  const todayPct = stats.total > 0 ? (stats.doneToday / stats.total) * 100 : 0

  const historyDays = useMemo(
    () => (historyRange === "Month" ? lastNDays(35) : lastNDays(364)),
    [historyRange],
  )
  const historyCells = useMemo(() => {
    const intensity = habitIntensityByDay(stats.habits, stats.logs, historyDays)
    return historyDays.map((date, i) => ({ date, value: intensity[i] }))
  }, [stats.habits, stats.logs, historyDays])

  /* Month-to-date consistency across every habit. */
  const monthConsistency = useMemo(() => {
    const monthStart = dayKey(startOfMonth())
    const days = lastNDays(40).filter((d) => d >= monthStart && d <= today)
    if (days.length === 0 || stats.habits.length === 0) return 0
    const intensity = habitIntensityByDay(stats.habits, stats.logs, days)
    return Math.round((intensity.reduce((a, b) => a + b, 0) / intensity.length) * 100)
  }, [stats.habits, stats.logs, today])

  const prevMonthConsistency = useMemo(() => {
    const prevStart = startOfMonth(addDays(startOfMonth(), -1))
    const prevEnd = addDays(startOfMonth(), -1)
    const days: string[] = []
    for (let d = new Date(prevStart); d <= prevEnd; d = addDays(d, 1)) days.push(dayKey(d))
    if (days.length === 0 || stats.habits.length === 0) return null
    const intensity = habitIntensityByDay(stats.habits, stats.logs, days)
    return Math.round((intensity.reduce((a, b) => a + b, 0) / intensity.length) * 100)
  }, [stats.habits, stats.logs])

  const monthDelta = prevMonthConsistency === null ? null : monthConsistency - prevMonthConsistency

  return (
    <div className="page habits-page">
      <PageHeader
        eyebrow="Habits"
        title="Consistency over intensity."
        description="Every check-in is a vote for the person you’re becoming."
        actions={
          <Button icon="plus" onClick={() => setShowNew(true)}>
            New habit
          </Button>
        }
      />

      <div className="habit-overview">
        <Card>
          <Ring
            value={todayPct}
            size={120}
            label={`${stats.doneToday}/${stats.total}`}
            sublabel="today"
          />
          <div>
            <span>Today’s rhythm</span>
            <strong>
              {stats.total === 0
                ? "No habits yet."
                : remaining === 0
                  ? "All done for today."
                  : "Keep the chain gentle."}
            </strong>
            <p>
              {stats.total === 0
                ? "Create your first habit to start a streak."
                : remaining === 0
                  ? "Every habit checked off. That is the whole chain intact."
                  : `${remaining} more check-in${remaining === 1 ? "" : "s"} to complete today.`}
            </p>
          </div>
        </Card>

        <Card>
          <span className="metric-icon coral">
            <Icon name="flame" />
          </span>
          <div>
            <small>Longest active streak</small>
            <strong>{stats.longestStreak} days</strong>
            <span>{stats.longestStreakName || "No streak yet"}</span>
          </div>
        </Card>

        <Card>
          <span className="metric-icon sand">
            <Icon name="sun" />
          </span>
          <div>
            <small>This month’s consistency</small>
            <strong>{monthConsistency}%</strong>
            <span>
              {monthDelta === null
                ? "No previous month to compare"
                : `${monthDelta > 0 ? "+" : ""}${monthDelta}% from last month`}
            </span>
          </div>
        </Card>
      </div>

      {stats.enriched.length === 0 ? (
        <Card>
          <EmptyState
            icon="habits"
            title="No habits yet"
            text="Add one small, repeatable thing. Streaks and consistency build from there."
          />
        </Card>
      ) : (
        <div className="habit-list">
          {stats.enriched.map(({ habit, days, doneToday, streak, best }) => {
            const cells = lastNDays(98).map((date) => ({
              date,
              value: days.includes(date) ? 1 : 0,
            }))
            return (
              <Card key={habit.id} className="habit-card">
                <button
                  className={`habit-toggle ${doneToday ? "done" : ""}`}
                  onClick={() => void toggleHabitLog(habit.id)}
                  aria-pressed={doneToday}
                  aria-label={`${doneToday ? "Undo" : "Complete"} ${habit.name} for today`}
                >
                  {doneToday ? <Icon name="check" /> : <Icon name={habit.icon} />}
                </button>
                <div className="habit-main">
                  <div>
                    <h3>{habit.name}</h3>
                    <span>{habit.cadence}</span>
                  </div>
                  <Heatmap cells={cells} metric={habit.name} compact />
                </div>
                <div className="streaks">
                  <span>
                    <strong>{streak}</strong>current
                  </span>
                  <span>
                    <strong>{best}</strong>best
                  </span>
                </div>
                <button
                  className="row-action"
                  aria-label={`Edit ${habit.name}`}
                  onClick={() => setEditing(habit)}
                >
                  <Icon name="more" />
                </button>
              </Card>
            )
          })}
        </div>
      )}

      <Card className="habit-history">
        <SectionTitle
          title="History"
          subtitle={
            historyRange === "Month"
              ? "Last five weeks"
              : "Last twelve months"
          }
          action={
            <Segmented
              items={["Month", "Year"] as const}
              value={historyRange}
              onChange={setHistoryRange}
            />
          }
        />
        <div className="habit-month">
          <Heatmap cells={historyCells} metric="habit completion" />
          <div>
            <strong>{monthConsistency}%</strong>
            <span>overall consistency</span>
          </div>
        </div>
      </Card>

      {showNew && <HabitModal onClose={() => setShowNew(false)} />}
      {editing && <HabitModal habit={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function HabitModal({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const [name, setName] = useState(habit?.name ?? "")
  const [icon, setIcon] = useState(habit?.icon ?? "sun")
  const [cadence, setCadence] = useState(habit?.cadence ?? "Daily")

  const submit = async () => {
    if (!name.trim()) return
    const match = CADENCES.find((c) => c.value === cadence)
    const payload = { name: name.trim(), icon, cadence, targetPerWeek: match?.target ?? 7 }
    if (habit) await updateHabit(habit.id, payload)
    else await createHabit(payload)
    onClose()
  }

  return (
    <Modal title={habit ? "Edit habit" : "Create a habit"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label className="field">
          <span>Habit name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Evening walk"
          />
        </label>

        <div className="field">
          <span>Icon</span>
          <div className="icon-picker">
            {ICON_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                className={icon === choice ? "active" : ""}
                onClick={() => setIcon(choice)}
                aria-label={choice}
              >
                <Icon name={choice} size={18} />
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Frequency</span>
          <Select
            value={cadence}
            options={CADENCES.map((c) => ({ value: c.value, label: c.label }))}
            onChange={setCadence}
            sheetTitle="Frequency"
          />
        </div>

        <div className="modal-actions">
          {habit && (
            <Button
              variant="danger"
              icon="trash"
              type="button"
              onClick={async () => {
                await deleteHabit(habit.id)
                onClose()
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            {habit ? "Save habit" : "Create habit"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
