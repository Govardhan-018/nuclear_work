import { useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Progress, SectionTitle, Segmented } from "../components/UI"
import { createTask, deleteTask, toggleTask, updateTask } from "../db/repo"
import { useFocusSessions, useTaskStats } from "../db/stats"
import { addDays, dayKey, formatShortDate, formatTime, lastNDays, startOfDay } from "../lib/date"
import type { Priority, Task, TaskCategory } from "../db/types"
import type { PageProps } from "./shared"

const TABS = ["Today", "Upcoming", "Completed", "Overdue"] as const
type Tab = (typeof TABS)[number]

const CATEGORIES: TaskCategory[] = ["Personal", "Study", "Health", "Fitness", "Work"]
const PRIORITIES: Priority[] = ["Low", "Medium", "High"]

export function TasksPage(_props: PageProps) {
  const stats = useTaskStats()
  const focusSessions = useFocusSessions()
  const [tab, setTab] = useState<Tab>("Today")
  const [view, setView] = useState<"List" | "Board">("List")
  const [editing, setEditing] = useState<Task | "new" | null>(null)

  const visible = useMemo(() => {
    const sortByDue = (a: Task, b: Task) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity)
    switch (tab) {
      case "Completed":
        return [...stats.done].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      case "Upcoming":
        return [...stats.upcoming, ...stats.someday].sort(sortByDue)
      case "Overdue":
        return [...stats.overdue].sort(sortByDue)
      default:
        return [...stats.todayTasks].sort(sortByDue)
    }
  }, [tab, stats])

  const countFor = (name: Tab): number => {
    switch (name) {
      case "Completed": return stats.done.length
      case "Upcoming": return stats.upcoming.length + stats.someday.length
      case "Overdue": return stats.overdue.length
      default: return stats.todayTasks.length
    }
  }

  /* Completion over the last 7 days vs the 7 before it. */
  const weekly = useMemo(() => {
    const week = new Set(lastNDays(7))
    const prev = new Set(lastNDays(7, addDays(new Date(), -7)))
    const inWindow = (set: Set<string>, ts: number | null) =>
      ts !== null && set.has(dayKey(ts))
    const doneThis = stats.done.filter((t) => inWindow(week, t.completedAt)).length
    const donePrev = stats.done.filter((t) => inWindow(prev, t.completedAt)).length
    const change = donePrev > 0 ? Math.round(((doneThis - donePrev) / donePrev) * 100) : null
    return { doneThis, donePrev, change }
  }, [stats.done])

  const highPriority = stats.open.filter((t) => t.priority === "High")
  const highDueToday = highPriority.filter(
    (t) => t.dueAt !== null && dayKey(t.dueAt) === dayKey(),
  ).length

  const focusSecondsThisWeek = useMemo(() => {
    const week = new Set(lastNDays(7))
    return focusSessions.filter((s) => week.has(s.date)).reduce((t, s) => t + s.seconds, 0)
  }, [focusSessions])

  const groupLabel =
    tab === "Today" ? "Due today or earlier"
      : tab === "Upcoming" ? "Coming up"
        : tab === "Overdue" ? "Past due" : "Finished"

  return (
    <div className="page tasks-page">
      <PageHeader
        eyebrow="Tasks"
        title="Make space for what matters."
        description={`${stats.done.length} completed · ${stats.open.length} still in motion`}
        actions={
          <Button icon="plus" onClick={() => setEditing("new")}>
            New task
          </Button>
        }
      />

      <div className="task-controls">
        <div className="task-tabs">
          {TABS.map((name) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              onClick={() => setTab(name)}
            >
              {name}
              <span>{countFor(name) > 0 ? countFor(name) : ""}</span>
            </button>
          ))}
        </div>
        <Segmented items={["List", "Board"] as const} value={view} onChange={setView} />
      </div>

      {view === "List" ? (
        <Card className="task-list">
          <div className="task-group-title">
            <span>{groupLabel}</span>
            <small>
              {new Date().toLocaleDateString(undefined, {
                weekday: "long", month: "long", day: "numeric",
              })}
            </small>
          </div>
          {visible.length === 0 ? (
            <EmptyState
              icon="check"
              title={tab === "Overdue" ? "Nothing overdue" : `Nothing in ${tab.toLowerCase()}`}
              text={
                tab === "Completed"
                  ? "Completed tasks will collect here."
                  : "Add a task with the button above."
              }
            />
          ) : (
            visible.map((task) => (
              <TaskRow key={task.id} task={task} onEdit={() => setEditing(task)} />
            ))
          )}
        </Card>
      ) : (
        <div className="task-board">
          {CATEGORIES.map((category) => {
            const items = stats.open.filter((t) => t.category === category)
            return (
              <Card key={category} className="task-board-column">
                <SectionTitle title={category} subtitle={`${items.length} open`} />
                {items.length === 0 ? (
                  <p className="soft-note">Nothing here.</p>
                ) : (
                  items.map((task) => (
                    <TaskRow key={task.id} task={task} onEdit={() => setEditing(task)} compact />
                  ))
                )}
              </Card>
            )
          })}
        </div>
      )}

      <div className="task-summary">
        <Card>
          <span>Completion rate</span>
          <strong>{stats.completionPct}%</strong>
          <small>
            {weekly.change === null
              ? `${weekly.doneThis} done this week`
              : `${weekly.change > 0 ? "+" : ""}${weekly.change}% from last week`}
          </small>
          <Progress value={stats.completionPct} />
        </Card>
        <Card>
          <span>High priority</span>
          <strong>{highPriority.length}</strong>
          <small>{highDueToday} due today</small>
        </Card>
        <Card>
          <span>Focus time this week</span>
          <strong>
            {Math.floor(focusSecondsThisWeek / 3600)}h {Math.floor((focusSecondsThisWeek % 3600) / 60)}m
          </strong>
          <small>Across {focusSessions.length} sessions</small>
        </Card>
      </div>

      {editing && (
        <TaskModal
          task={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function TaskRow({
  task, onEdit, compact = false,
}: {
  task: Task
  onEdit: () => void
  compact?: boolean
}) {
  const overdue = task.done !== 1 && task.dueAt !== null && task.dueAt < Date.now()
  return (
    <div className={`task-row ${task.done === 1 ? "done" : ""} ${overdue ? "overdue" : ""}`}>
      <button
        className="task-check"
        aria-label={task.done === 1 ? `Reopen ${task.title}` : `Complete ${task.title}`}
        onClick={() => void toggleTask(task.id)}
      >
        {task.done === 1 && <Icon name="check" size={15} />}
      </button>
      <div>
        <strong>{task.title}</strong>
        <span>
          <Badge tone={task.category.toLowerCase()}>{task.category}</Badge>{" "}
          {formatDue(task)}
        </span>
      </div>
      {!compact && (
        <Badge tone={task.priority === "High" ? "coral" : task.priority === "Medium" ? "sand" : "neutral"}>
          {task.priority}
        </Badge>
      )}
      <Button variant="icon" icon="edit" onClick={onEdit} aria-label={`Edit ${task.title}`} />
      <button className="delete-task" onClick={() => void deleteTask(task.id)}>
        Delete
      </button>
    </div>
  )
}

function formatDue(task: Task): string {
  if (task.done === 1 && task.completedAt) {
    return `Completed ${formatShortDate(task.completedAt)}`
  }
  if (task.dueAt === null) return "Someday"
  const due = new Date(task.dueAt)
  const todayStart = startOfDay().getTime()
  const tomorrowStart = startOfDay(addDays(new Date(), 1)).getTime()
  if (task.dueAt < todayStart) return `Overdue · ${formatShortDate(task.dueAt)}`
  if (task.dueAt < tomorrowStart) return `Today, ${formatTime(due)}`
  if (task.dueAt < tomorrowStart + 86_400_000) return `Tomorrow, ${formatTime(due)}`
  return `${formatShortDate(task.dueAt)}, ${formatTime(due)}`
}

function TaskModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const [title, setTitle] = useState(task?.title ?? "")
  const [notes, setNotes] = useState(task?.notes ?? "")
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? "Personal")
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "Medium")
  // New tasks default to a due date of today. Without one they land in
  // "Someday" and disappear from the Today tab the user just added them from.
  const [hasDue, setHasDue] = useState(task ? task.dueAt !== null : true)
  const [dueDate, setDueDate] = useState(
    task?.dueAt ? dayKey(task.dueAt) : dayKey(),
  )
  const [dueTime, setDueTime] = useState(
    task?.dueAt
      ? new Date(task.dueAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
      : "17:00",
  )

  const submit = async () => {
    if (!title.trim()) return
    let dueAt: number | null = null
    if (hasDue) {
      const [y, m, d] = dueDate.split("-").map(Number)
      const [hh, mm] = dueTime.split(":").map(Number)
      dueAt = new Date(y, m - 1, d, hh || 0, mm || 0).getTime()
    }
    const payload = { title: title.trim(), notes, category, priority, dueAt }
    if (task) await updateTask(task.id, payload)
    else await createTask(payload)
    onClose()
  }

  return (
    <Modal title={task ? "Edit task" : "Add a task"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="form-grid">
          <label className="field full">
            <span>Task name</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
            />
          </label>
          <label className="field">
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="field full checkbox-field">
            <input type="checkbox" checked={hasDue} onChange={(e) => setHasDue(e.target.checked)} />
            <span>Set a due date</span>
          </label>
          {hasDue && (
            <>
              <label className="field">
                <span>Date</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
              <label className="field">
                <span>Time</span>
                <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
              </label>
            </>
          )}
          <label className="field full">
            <span>Notes</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </label>
        </div>
        <div className="modal-actions">
          {task && (
            <Button
              variant="danger"
              icon="trash"
              type="button"
              onClick={async () => {
                await deleteTask(task.id)
                onClose()
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title.trim()}>
            Save task
          </Button>
        </div>
      </form>
    </Modal>
  )
}
