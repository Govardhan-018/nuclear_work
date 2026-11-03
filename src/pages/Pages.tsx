import { useEffect, useMemo, useState } from "react"
import { chartData, months, todayActivities, weeklyBars } from "../data"
import { formatDate, sameDay, useLocalState } from "../hooks"
import type { Book, FoodCheck, Habit, Task } from "../types"
import { Icon } from "../components/Icon"
import {
  Badge,
  Button,
  Card,
  Modal,
  PageHeader,
  Progress,
  SectionTitle,
  Segmented,
} from "../components/UI"
import {
  BarChart,
  Donut,
  Heatmap,
  LineChart,
  MultiLineChart,
  Ring,
} from "../components/Visuals"

type SharedProps = {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  habits: Habit[]
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>
  books: Book[]
  setBooks: React.Dispatch<React.SetStateAction<Book[]>>
  food: FoodCheck[]
  setFood: React.Dispatch<React.SetStateAction<FoodCheck[]>>
  onQuickAdd: () => void
}

type NutritionDraft = {
  protein: string | null
  carbs: string | null
  junk: string | null
  vegetables: string | null
  fruit: string | null
}

const metricCards = [
  {
    icon: "focus",
    value: "2h 45m",
    label: "Focused",
    note: "+18% this week",
    tone: "teal",
  },
  {
    icon: "book",
    value: "34 min",
    label: "Reading",
    note: "24 pages",
    tone: "blue",
  },
  {
    icon: "tasks",
    value: "5 / 7",
    label: "Tasks",
    note: "2 remaining",
    tone: "lavender",
  },
  {
    icon: "habits",
    value: "4 / 6",
    label: "Habits",
    note: "18 day best streak",
    tone: "coral",
  },
]

export function TodayPage({
  tasks,
  setTasks,
  habits,
  setHabits,
  books,
  onQuickAdd,
}: SharedProps) {
  const today = new Date()
  const [todayRange, setTodayRange] = useState<"Week" | "Month">("Week")
  const [showAiCoach, setShowAiCoach] = useState(false)
  const [aiQuestion, setAiQuestion] = useState("")
  const [aiThinking, setAiThinking] = useState(false)
  const [aiMessages, setAiMessages] = useState<{
    role: "user" | "assistant"
    text: string
  }[]>([])
  const currentBook = books.find((b) => b.status === "Reading")!
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - 3 + i)
    return d
  })
  const done =
    tasks.filter((t) => t.done).length + habits.filter((h) => h.done).length
  useEffect(() => {
    if (!showAiCoach) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [showAiCoach])
  const askCoach = () => {
    const question = aiQuestion.trim()
    if (!question || aiThinking) return
    setAiMessages((messages) => [...messages, { role: "user", text: question }])
    setAiQuestion("")
    setAiThinking(true)
    window.setTimeout(() => {
      setAiMessages((messages) => [
        ...messages,
        {
          role: "assistant",
          text: question.toLowerCase().includes("study")
            ? "Keep tonight’s study block to 35 minutes. Your strongest retention window has been early morning, so use tonight for review and schedule new material for tomorrow at 9:00 AM."
            : question.toLowerCase().includes("food") ||
                question.toLowerCase().includes("protein")
              ? "You are slightly below your usual protein pattern. A simple protein-rich dinner with vegetables would support recovery without making the evening feel heavy."
              : "Based on your recent movement, study, nutrition and recovery patterns, the best next step is a light evening: one short reading session, a balanced dinner and an earlier wind-down.",
        },
      ])
      setAiThinking(false)
    }, 750)
  }
  return (
    <div className="page today-page">
      <PageHeader
        eyebrow={formatDate(today)}
        title="Good morning, Alex."
        description="A calm, focused day is taking shape."
        actions={
          <Button icon="plus" onClick={onQuickAdd}>
            Add activity
          </Button>
        }
      />
      <div className="date-strip">
        {week.map((day) => (
          <button
            key={day.toISOString()}
            className={sameDay(day, today) ? "active" : ""}
          >
            <span>{day.toLocaleDateString("en-US", { weekday: "short" })}</span>
            <strong>{day.getDate()}</strong>
            {day.getDate() % 2 === 0 && <i />}
          </button>
        ))}
      </div>
      <div className="mobile-command">
        <Card className="life-state-card">
          <div className="life-state-top">
            <div>
              <span>Today’s complete state</span>
              <strong>Strong momentum</strong>
            </div>
            <Ring value={82} size={76} label="82" sublabel="balance" />
          </div>
          <div className="life-state-bars">
            {[
              ["Movement", 78, "5.2 km"],
              ["Study", 69, "2h 45m"],
              ["Nutrition", 86, "On track"],
              ["Recovery", 74, "7h 18m"],
            ].map((item) => (
              <div key={item[0]}>
                <span>
                  {item[0]} <b>{item[2]}</b>
                </span>
                <Progress value={Number(item[1])} />
              </div>
            ))}
          </div>
        </Card>
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
          <p>
            Yesterday was well balanced: movement and nutrition improved, while
            recovery stayed slightly below your normal range.
          </p>
          <div className="ai-today-focus">
            <small>Today’s focus</small>
            <strong>
              Protect recovery and complete one 35 minute study block.
            </strong>
          </div>
          <Button
            variant="secondary"
            icon="chevronRight"
            onClick={() => setShowAiCoach(true)}
          >
            More
          </Button>
        </Card>
      </div>
      <div className="today-metrics">
        {[
          ["fitness", "5.2 km", "Movement", "+12%"],
          ["focus", "2h 45m", "Study", "69% goal"],
          ["food", "86%", "Nutrition", "On track"],
          ["sun", "7h 18m", "Recovery", "Good"],
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
            subtitle={
              todayRange === "Week"
                ? "Daily balance · May 11–17"
                : "Weekly balance · May"
            }
            action={
              <Segmented
                items={["Week", "Month"] as const}
                value={todayRange}
                onChange={setTodayRange}
              />
            }
          />
          <div className="trend-summary">
            <div>
              <strong>82%</strong>
              <span>current balance</span>
            </div>
            <Badge tone="sage">
              <Icon name="arrowUp" size={13} /> 8% improving
            </Badge>
          </div>
          <MultiLineChart
            labels={
              todayRange === "Week"
                ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                : ["W1", "W2", "W3", "W4", "Now"]
            }
            series={
              todayRange === "Week"
                ? [
                    {
                      name: "Movement",
                      data: [52, 68, 61, 76, 70, 88, 78],
                      color: "var(--teal-dark)",
                      unit: "%",
                    },
                    {
                      name: "Study",
                      data: [72, 55, 81, 64, 76, 62, 69],
                      color: "var(--lavender)",
                      unit: "%",
                    },
                    {
                      name: "Nutrition",
                      data: [78, 82, 75, 88, 80, 84, 86],
                      color: "var(--coral)",
                      unit: "%",
                    },
                    {
                      name: "Recovery",
                      data: [66, 72, 68, 78, 71, 76, 74],
                      color: "var(--ink)",
                      unit: "%",
                    },
                  ]
                : [
                    {
                      name: "Movement",
                      data: [64, 71, 74, 78, 81],
                      color: "var(--teal-dark)",
                      unit: "%",
                    },
                    {
                      name: "Study",
                      data: [58, 67, 72, 66, 69],
                      color: "var(--lavender)",
                      unit: "%",
                    },
                    {
                      name: "Nutrition",
                      data: [72, 76, 81, 83, 86],
                      color: "var(--coral)",
                      unit: "%",
                    },
                    {
                      name: "Recovery",
                      data: [70, 68, 73, 76, 74],
                      color: "var(--ink)",
                      unit: "%",
                    },
                  ]
            }
          />
        </Card>
        <Card className="today-heatmap">
          <SectionTitle
            title="Activity calendar"
            subtitle="Your consistency across all areas"
            action={<Badge tone="sage">18 day streak</Badge>}
          />
          <Heatmap metric="complete daily state" />
          <div className="heatmap-summary">
            <span>
              <strong>24</strong> active days
            </span>
            <span>
              <strong>6</strong> balanced days
            </span>
            <span>
              <strong>Thu</strong> strongest day
            </span>
          </div>
        </Card>
      </div>
      <Card className="today-next">
        <SectionTitle
          title="Next up"
          subtitle="Only what needs your attention"
          action={<Button variant="ghost">See day</Button>}
        />
        <div className="next-focus-row">
          <span className="metric-icon lavender">
            <Icon name="focus" />
          </span>
          <div>
            <strong>35 minute reading session</strong>
            <small>Four Thousand Weeks · recommended at 7:30 PM</small>
          </div>
          <Button variant="secondary" icon="play">
            Start
          </Button>
        </div>
        {tasks
          .filter((task) => !task.done)
          .slice(0, 2)
          .map((task) => (
            <label className="next-task-row" key={task.id}>
              <button
                className="checkbox"
                onClick={() =>
                  setTasks(
                    tasks.map((item) =>
                      item.id === task.id ? { ...item, done: true } : item,
                    ),
                  )
                }
              />
              <span>
                <strong>{task.title}</strong>
                <small>{task.due}</small>
              </span>
              <Badge tone={task.priority === "High" ? "coral" : "neutral"}>
                {task.priority}
              </Badge>
            </label>
          ))}
      </Card>
      {showAiCoach && (
        <div className="ai-fullscreen">
          <header className="ai-fullscreen-header">
            <div className="ai-fullscreen-brand">
              <span className="ai-orb">
                <Icon name="insights" />
              </span>
              <div>
                <small>Life OS intelligence</small>
                <strong>Daily coach</strong>
              </div>
            </div>
            <button
              className="ai-close"
              aria-label="Close AI coach"
              onClick={() => setShowAiCoach(false)}
            >
              <Icon name="close" />
            </button>
          </header>
          <div className="ai-fullscreen-body">
            <section className="ai-coach-intro">
              <span>{formatDate(today)}</span>
              <h2>Your day has a clear direction.</h2>
              <p>
                These comments use your recent movement, study, food and
                recovery patterns. They are guidance, not a score.
              </p>
            </section>
            <div className="ai-analysis-grid">
              <article className="primary">
                <span>Overall pattern</span>
                <h3>Consistency is improving without adding more pressure.</h3>
                <p>
                  Your movement and food patterns were stronger on four of the
                  last six days. Study time is steady, but longer evening
                  sessions are reducing next-morning energy.
                </p>
              </article>
              <article>
                <span>Today’s focus</span>
                <h3>One focused block, then recover.</h3>
                <p>
                  Complete a 35 minute review session. Avoid starting a new
                  academic topic tonight.
                </p>
              </article>
              <article>
                <span>Food observation</span>
                <h3>Add protein and vegetables at dinner.</h3>
                <p>
                  This will bring today closer to your strongest nutrition
                  pattern from the past month.
                </p>
              </article>
              <article>
                <span>Recovery note</span>
                <h3>Begin winding down 30 minutes earlier.</h3>
                <p>
                  Your pace and focus are both better after nights above seven
                  and a half hours.
                </p>
              </article>
            </div>
            <section className="ai-conversation">
              <div className="ai-conversation-title">
                <div>
                  <span>Ask about your data</span>
                  <strong>What would you like to understand?</strong>
                </div>
                <Badge tone="sage">Demo AI</Badge>
              </div>
              <div className="ai-messages">
                {aiMessages.length === 0 && (
                  <p>
                    Ask about your study plan, food pattern, training or
                    recovery.
                  </p>
                )}
                {aiMessages.map((message, index) => (
                  <div
                    className={message.role}
                    key={`${message.role}-${index}`}
                  >
                    {message.text}
                  </div>
                ))}
                {aiThinking && (
                  <div className="assistant thinking">
                    <i />
                    <i />
                    <i />
                  </div>
                )}
              </div>
              <form
                className="ai-question"
                onSubmit={(event) => {
                  event.preventDefault()
                  askCoach()
                }}
              >
                <input
                  value={aiQuestion}
                  onChange={(event) => setAiQuestion(event.target.value)}
                  placeholder="Ask about today’s study, food or recovery…"
                  aria-label="Ask your daily coach"
                />
                <Button
                  type="submit"
                  icon="arrowUp"
                  disabled={!aiQuestion.trim()}
                >
                  Ask
                </Button>
              </form>
            </section>
          </div>
        </div>
      )}
      <div className="overview-grid">
        <Card className="daily-progress">
          <div>
            <span className="card-kicker">Daily rhythm</span>
            <h2>Steady momentum</h2>
            <p>
              You’ve completed {done} of today’s planned activities. Each ring
              tracks its own goal.
            </p>
            <div className="progress-legend">
              <span>
                <i className="teal" />
                Focus 69%
              </span>
              <span>
                <i className="blue" />
                Movement 82%
              </span>
              <span>
                <i className="coral" />
                Habits 67%
              </span>
            </div>
          </div>
          <div className="rings-cluster">
            <Ring value={76} size={156} label="6 of 8" sublabel="activities" />
            <div className="mini-ring one" />
            <div className="mini-ring two" />
          </div>
        </Card>
        <Card className="daily-note">
          <span className="card-kicker">Daily insight</span>
          <div className="insight-orb">
            <Icon name="sun" size={24} />
          </div>
          <h3>Your most consistent week yet</h3>
          <p>You’ve shown up for your morning routine six days in a row.</p>
          <button>
            View pattern <Icon name="chevronRight" size={15} />
          </button>
        </Card>
      </div>
      <div className="metric-grid">
        {metricCards.map((item) => (
          <Card key={item.label} className="metric-card">
            <span className={`metric-icon ${item.tone}`}>
              <Icon name={item.icon} />
            </span>
            <div>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
            <small>{item.note}</small>
          </Card>
        ))}
      </div>
      <div className="dashboard-grid">
        <Card className="timeline-card">
          <SectionTitle
            title="Today’s timeline"
            subtitle="Thursday’s activities"
            action={<Button variant="ghost">View calendar</Button>}
          />
          <div className="timeline">
            {todayActivities.map((a, i) => (
              <div className="timeline-item" key={a.title}>
                <time>{a.time}</time>
                <i className={a.type} />
                <div>
                  <strong>{a.title}</strong>
                  <span>{a.meta}</span>
                </div>
                {i === 3 && <Badge tone="blue">In progress</Badge>}
              </div>
            ))}
          </div>
        </Card>
        <div className="side-stack">
          <Card>
            <SectionTitle
              title="Up next"
              action={
                <button className="round-more">
                  <Icon name="more" />
                </button>
              }
            />
            {tasks
              .filter((t) => !t.done)
              .slice(0, 3)
              .map((t) => (
                <label className="mini-task" key={t.id}>
                  <button
                    className="checkbox"
                    onClick={() =>
                      setTasks(
                        tasks.map((x) =>
                          x.id === t.id ? { ...x, done: true } : x,
                        ),
                      )
                    }
                  />
                  <span>
                    <strong>{t.title}</strong>
                    <small>
                      {t.due} · {t.category}
                    </small>
                  </span>
                </label>
              ))}
          </Card>
          <Card className="reading-now">
            <SectionTitle
              title="Currently reading"
              action={<Badge tone="sage">Reading</Badge>}
            />
            <div className={`book-cover ${currentBook.accent}`}>
              <span>{currentBook.cover}</span>
            </div>
            <div className="book-summary">
              <strong>{currentBook.title}</strong>
              <span>{currentBook.author}</span>
              <Progress
                value={(currentBook.current / currentBook.pages) * 100}
              />
              <small>
                {currentBook.current} of {currentBook.pages} pages
              </small>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CalendarGrid({
  cursor,
  selected,
  onSelect,
}: {
  cursor: Date
  selected: Date
  onSelect: (d: Date) => void
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
  return (
    <div className="month-calendar">
      <div className="weekday-row">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="month-grid">
        {days.map((d, i) => {
          const active = sameDay(d, selected)
          const outside = d.getMonth() !== cursor.getMonth()
          const effort = outside ? 0 : (d.getDate() * 7 + i * 3) % 5
          const effortLabels = ["Rest", "Light", "Moderate", "Strong", "Peak"]
          const effortTime = ["0m", "35m", "1h 20m", "2h 45m", "4h 10m"]
          return (
            <button
              key={d.toISOString()}
              className={`${active ? "selected" : ""} effort-${effort} ${
                outside ? "outside" : ""
              }`}
              onClick={() => onSelect(d)}
            >
              <span className={sameDay(d, new Date()) ? "today-number" : ""}>
                {d.getDate()}
              </span>
              {!outside && (
                <div className="effort-meta">
                  <strong>{effortLabels[effort]}</strong>
                  <small>{effortTime[effort]} tracked</small>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CalendarPage() {
  const [cursor, setCursor] = useState(new Date())
  const [selected, setSelected] = useState(new Date())
  const [view, setView] = useState<"Month" | "Week" | "Day">("Month")
  const [metric, setMetric] = useState("Study hours")
  const shift = (n: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))
  return (
    <div className="page calendar-page">
      <PageHeader
        title="Calendar"
        description="Everything you do, in one clear timeline."
        actions={
          <>
            <Segmented
              items={["Month", "Week", "Day"] as const}
              value={view}
              onChange={setView}
            />
            <Button icon="plus">Add event</Button>
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
                setSelected(new Date())
              }}
            >
              Today
            </Button>
            <Button
              variant="icon"
              icon="chevronLeft"
              onClick={() => shift(-1)}
              aria-label="Previous month"
            />
            <Button
              variant="icon"
              icon="chevronRight"
              onClick={() => shift(1)}
              aria-label="Next month"
            />
            <h2>
              {months[cursor.getMonth()]} {cursor.getFullYear()}
            </h2>
          </div>
          <div className="calendar-key effort-key">
            <span>
              <i className="effort-dot level-1" />
              Light
            </span>
            <span>
              <i className="effort-dot level-2" />
              Moderate
            </span>
            <span>
              <i className="effort-dot level-3" />
              Strong
            </span>
            <span>
              <i className="effort-dot level-4" />
              Peak effort
            </span>
          </div>
        </div>
        {view === "Month" ? (
          <CalendarGrid
            cursor={cursor}
            selected={selected}
            onSelect={setSelected}
          />
        ) : (
          <WeekDayView view={view} />
        )}
      </Card>
      <div className="calendar-lower">
        <Card className="agenda-card">
          <SectionTitle
            title={selected.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            subtitle="4 activities · 3h 20m"
          />
          <div className="agenda-list">
            {todayActivities.slice(0, 4).map((a) => (
              <div key={a.title}>
                <time>{a.time}</time>
                <span className={`agenda-icon ${a.type}`}>
                  <Icon name={a.type === "study" ? "focus" : a.type} />
                </span>
                <div>
                  <strong>{a.title}</strong>
                  <small>{a.meta}</small>
                </div>
                <Icon name="more" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="heatmap-card">
          <SectionTitle
            title="Your year in motion"
            subtitle="January – December 2026"
            action={
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                {[
                  "Study hours",
                  "Reading hours",
                  "Habit completion",
                  "Task completion",
                  "Running distance",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            }
          />
          <Heatmap metric={metric} />
          <div className="heatmap-stats">
            <div>
              <strong>246</strong>
              <span>active days</span>
            </div>
            <div>
              <strong>18 days</strong>
              <span>longest streak</span>
            </div>
            <div>
              <strong>Thursday</strong>
              <span>most active</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function WeekDayView({ view }: { view: "Week" | "Day" }) {
  const cols =
    view === "Day"
      ? ["Today"]
      : ["Mon 14", "Tue 15", "Wed 16", "Thu 17", "Fri 18", "Sat 19", "Sun 20"]
  return (
    <div className="week-view">
      <div className="week-head">
        {cols.map((x) => (
          <strong key={x}>{x}</strong>
        ))}
      </div>
      <div className="week-body">
        {cols.map((x, i) => (
          <div key={x}>
            {i % 2 === 0 && (
              <span
                className="week-event study"
                style={{ top: `${18 + i * 7}%` }}
              >
                Focus
                <br />
                <small>09:00</small>
              </span>
            )}
            {i % 3 === 0 && (
              <span
                className="week-event fitness"
                style={{ top: `${56 + i * 2}%` }}
              >
                Run
                <br />
                <small>17:30</small>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function FocusPage() {
  const [seconds, setSeconds] = useState(25 * 60)
  const [stopwatch, setStopwatch] = useState(0)
  const [running, setRunning] = useState(false)
  const [subject, setSubject] = useState("Neuroscience")
  const [mode, setMode] = useState<"Timer" | "Stopwatch">("Timer")
  const [sessionType, setSessionType] = useState<"Academic" | "Reading">(
    "Academic",
  )
  useEffect(() => {
    if (!running || (mode === "Timer" && seconds <= 0)) return
    const id = window.setInterval(() => {
      if (mode === "Timer") setSeconds((s) => Math.max(0, s - 1))
      else setStopwatch((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [running, seconds, mode])
  const activeSeconds = mode === "Timer" ? seconds : stopwatch
  const progress =
    mode === "Timer"
      ? ((25 * 60 - seconds) / (25 * 60)) * 100
      : ((stopwatch % 3600) / 3600) * 100
  const time = `${String(Math.floor(activeSeconds / 60)).padStart(2, "0")}:${String(activeSeconds % 60).padStart(2, "0")}`
  return (
    <div className={`page focus-page ${running ? "focus-session-active" : ""}`}>
      <PageHeader
        eyebrow="Focus & study"
        title="Grow your focus."
        description="Small, undistracted sessions compound into deep learning."
        actions={
          <div className="target-pill">
            <span>Daily target</span>
            <strong>2h 45m / 4h</strong>
            <Progress value={69} />
          </div>
        }
      />
      <div className="study-mode-controls">
        <Segmented
          items={["Timer", "Stopwatch"] as const}
          value={mode}
          onChange={(next) => {
            setRunning(false)
            setMode(next)
          }}
        />
        <Segmented
          items={["Academic", "Reading"] as const}
          value={sessionType}
          onChange={(next) => {
            setSessionType(next)
            setSubject(
              next === "Reading" ? "Four Thousand Weeks" : "Neuroscience",
            )
          }}
        />
      </div>
      <div className="focus-layout">
        <Card className={`timer-card ${running ? "running immersive" : ""}`}>
          {running && (
            <div className="immersive-header">
              <span className="pulse-dot" />
              <strong>{sessionType} session</strong>
              <button onClick={() => setRunning(false)}>
                <Icon name="close" />
              </button>
            </div>
          )}
          <div className="timer-top">
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option>Neuroscience</option>
              <option>Statistics</option>
              <option>Writing</option>
              <option>Four Thousand Weeks</option>
              <option>The Creative Act</option>
            </select>
            <Badge tone="sage">
              {running
                ? `${mode} in progress`
                : `Ready for ${sessionType.toLowerCase()}`}
            </Badge>
          </div>
          <div className="tree-scene">
            <div className="sun-dot" />
            <div className={`tree ${progress > 30 ? "grown" : ""}`}>
              <i />
              <span />
              <b />
            </div>
            <div className="ground" />
          </div>
          <div className="timer-ring">
            <Ring
              value={progress || 2}
              size={238}
              label={time}
              sublabel={subject}
            />
          </div>
          <div className="timer-topic">
            <span>Current topic</span>
            <strong>Memory consolidation & sleep</strong>
          </div>
          <div className="timer-actions">
            <Button
              variant="secondary"
              icon="reset"
              onClick={() => {
                setSeconds(1500)
                setStopwatch(0)
                setRunning(false)
              }}
            >
              Reset
            </Button>
            <Button
              icon={running ? "pause" : "play"}
              onClick={() => setRunning(!running)}
            >
              {running ? "Pause" : `Start ${mode.toLowerCase()}`}
            </Button>
          </div>
        </Card>
        <div className="focus-side">
          <Card>
            <SectionTitle title="This week" subtitle="12h 40m focused" />
            <BarChart
              data={weeklyBars.map((v) => +(v / 22).toFixed(1))}
              labels={["M", "T", "W", "T", "F", "S", "S"]}
            />
            <div className="inline-stats">
              <span>
                <strong>2h 06m</strong>daily average
              </span>
              <span>
                <strong>+18%</strong>vs last week
              </span>
            </div>
          </Card>
          <Card>
            <SectionTitle
              title="By subject"
              action={<Button variant="ghost">Details</Button>}
            />
            {[
              ["Neuroscience", 42, "teal"],
              ["Statistics", 31, "blue"],
              ["Writing", 18, "coral"],
              ["Research", 9, "lavender"],
            ].map((x) => (
              <div className="subject-row" key={x[0]}>
                <span>
                  <i className={`tone-${x[2]}`} />
                  {x[0]}
                </span>
                <Progress value={Number(x[1])} tone={String(x[2])} />
                <strong>{x[1]}%</strong>
              </div>
            ))}
          </Card>
        </div>
      </div>
      <div className="focus-bottom">
        <Card>
          <SectionTitle
            title="Recent sessions"
            action={<Button variant="ghost">See all</Button>}
          />
          {[
            ["Today, 09:02", "Neuroscience", "1h 25m"],
            ["Yesterday, 14:30", "Statistics", "50m"],
            ["Tue, 10:15", "Writing", "1h 10m"],
          ].map((x) => (
            <div className="session-row" key={x[0]}>
              <span className="session-tree">♧</span>
              <div>
                <strong>{x[1]}</strong>
                <small>{x[0]}</small>
              </div>
              <b>{x[2]}</b>
            </div>
          ))}
        </Card>
        <Card>
          <SectionTitle title="Study consistency" subtitle="Last 14 weeks" />
          <Heatmap metric="study" compact />
          <p className="soft-note">
            Your strongest focus window is <strong>9:00–11:00 AM</strong>.
          </p>
        </Card>
      </div>
    </div>
  )
}

export function ReadingPage({ books, setBooks }: SharedProps) {
  const [tab, setTab] = useState<"Reading" | "Want to read" | "Completed">(
    "Reading",
  )
  const [selected, setSelected] = useState<Book | null>(null)
  const visible = books.filter((b) => b.status === tab)
  return (
    <div className="page reading-page">
      <PageHeader
        eyebrow="Reading"
        title="A life measured in pages."
        description="Keep close to the ideas that are shaping you."
        actions={<Button icon="plus">Add book</Button>}
      />
      <div className="reading-hero">
        <Card className="reading-feature">
          <div
            className="reading-photo"
            role="img"
            aria-label="A quiet desk with books and a vase"
          />
          <div className="reading-feature-copy">
            <Badge tone="sage">Currently reading</Badge>
            <h2>Four Thousand Weeks</h2>
            <p>Time management for mortals</p>
            <span>Oliver Burkeman</span>
            <Progress value={61} />
            <div>
              <strong>176</strong> of 288 pages <b>61%</b>
            </div>
            <Button onClick={() => setSelected(books[0])}>
              Continue reading
            </Button>
          </div>
        </Card>
        <Card className="reading-stats">
          <SectionTitle title="Reading this month" />
          <div className="reading-stat-grid">
            <div>
              <strong>6h 42m</strong>
              <span>time read</span>
            </div>
            <div>
              <strong>312</strong>
              <span>pages</span>
            </div>
            <div>
              <strong>2</strong>
              <span>books finished</span>
            </div>
            <div>
              <strong>9 days</strong>
              <span>current streak</span>
            </div>
          </div>
          <Heatmap metric="reading" compact />
        </Card>
      </div>
      <Card className="book-shelf">
        <SectionTitle
          title="Your books"
          action={
            <Segmented
              items={["Reading", "Want to read", "Completed"] as const}
              value={tab}
              onChange={setTab}
            />
          }
        />
        <div className="books-grid">
          {visible.map((book) => (
            <button
              className="book-card"
              key={book.id}
              onClick={() => setSelected(book)}
            >
              <div className={`book-cover large ${book.accent}`}>
                <span>{book.cover}</span>
              </div>
              <strong>{book.title}</strong>
              <span>{book.author}</span>
              <Progress value={(book.current / book.pages) * 100} />
              <small>
                {book.status === "Completed"
                  ? "Finished Jan 18"
                  : book.status === "Want to read"
                    ? `${book.pages} pages`
                    : `${book.current} / ${book.pages} pages`}
              </small>
            </button>
          ))}
        </div>
      </Card>
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className="book-detail">
            <div className={`book-cover large ${selected.accent}`}>
              <span>{selected.cover}</span>
            </div>
            <div>
              <Badge tone="sage">{selected.status}</Badge>
              <h3>{selected.title}</h3>
              <p>by {selected.author}</p>
              <div className="book-detail-stats">
                <span>
                  <strong>{selected.current}</strong>current page
                </span>
                <span>
                  <strong>{selected.pages}</strong>total pages
                </span>
                <span>
                  <strong>{Math.round(selected.minutes / 60)}h</strong>read time
                </span>
              </div>
            </div>
          </div>
          <label className="field">
            Update current page
            <input
              type="number"
              value={selected.current}
              onChange={(e) => {
                const current = Math.min(+e.target.value, selected.pages)
                setSelected({ ...selected, current })
                setBooks(
                  books.map((b) =>
                    b.id === selected.id ? { ...b, current } : b,
                  ),
                )
              }}
            />
          </label>
          <Button className="wide" onClick={() => setSelected(null)}>
            Save progress
          </Button>
        </Modal>
      )}
    </div>
  )
}

export function FoodPage({ food, setFood }: SharedProps) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`
  const [nutritionEntry, setNutritionEntry] = useLocalState<NutritionDraft & {
    date: string
  } | null>(`nutrition-entry-${yesterdayKey}`, null)
  const [nutritionDraft, setNutritionDraft] = useState<NutritionDraft>({
    protein: null,
    carbs: null,
    junk: null,
    vegetables: null,
    fruit: null,
  })
  const [water, setWater] = useLocalState("health-water", 5)
  const [junkAmount, setJunkAmount] = useLocalState("health-junk", 1)
  const [protein, setProtein] = useLocalState("health-protein", 4)
  const [carbs, setCarbs] = useLocalState("health-carbs", 3)
  const [energy, setEnergy] = useLocalState("health-energy", "Good")
  const [saved, setSaved] = useState(false)
  const toggle = (id: string, value: boolean) =>
    setFood(food.map((f) => (f.id === id ? { ...f, value } : f)))
  const nutritionComplete = Object.values(nutritionDraft).every(
    (value) => value !== null,
  )
  const monthDays = new Date(
    yesterday.getFullYear(),
    yesterday.getMonth() + 1,
    0,
  ).getDate()
  const monthOffset =
    (new Date(yesterday.getFullYear(), yesterday.getMonth(), 1).getDay() + 6) %
    7
  return (
    <div className="page food-page">
      <PageHeader
        eyebrow="Nutrition"
        title="Yesterday’s food."
        description="Five quick signals, answered once. Your history stays visible in the calendar."
        actions={
          nutritionEntry ? (
            <Badge tone="sage">Yesterday logged</Badge>
          ) : (
            <Badge tone="neutral">1 check-in due</Badge>
          )
        }
      />
      <div className="nutrition-layout">
        <Card className="yesterday-checkin">
          <SectionTitle
            title={nutritionEntry ? "Yesterday is complete" : "Quick check-in"}
            subtitle={yesterday.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            action={
              nutritionEntry ? (
                <span className="locked-entry">
                  <Icon name="check" size={14} /> Locked
                </span>
              ) : undefined
            }
          />
          {nutritionEntry ? (
            <div className="nutrition-result">
              {[
                {
                  label: "Protein",
                  value: nutritionEntry.protein ?? "Not set",
                  icon: "fitness",
                },
                {
                  label: "Carbohydrates",
                  value: nutritionEntry.carbs ?? "Not set",
                  icon: "focus",
                },
                {
                  label: "Junk food",
                  value: nutritionEntry.junk ?? "Not set",
                  icon: "food",
                },
                {
                  label: "Vegetables",
                  value: nutritionEntry.vegetables ?? "Not set",
                  icon: "habits",
                },
                {
                  label: "Fruit",
                  value: nutritionEntry.fruit ?? "Not set",
                  icon: "sun",
                },
              ].map((item) => (
                <div key={item.label}>
                  <span>
                    <Icon name={item.icon} size={17} />
                  </span>
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <p>
                This check-in is saved and can’t be edited. A new check-in will
                appear tomorrow.
              </p>
            </div>
          ) : (
            <div className="nutrition-questions">
              {([
                ["protein", "Protein", ["Low", "Enough", "High"]],
                ["carbs", "Carbohydrates", ["Low", "Enough", "High"]],
                ["junk", "Junk food", ["None", "Some", "A lot"]],
                ["vegetables", "Vegetables", ["No", "Yes"]],
                ["fruit", "Fruit", ["No", "Yes"]],
              ] as [keyof NutritionDraft, string, string[]][]).map(
                ([key, label, options]) => (
                  <div className="nutrition-question" key={String(key)}>
                    <span>{String(label)}</span>
                    <div>
                      {options.map((option) => (
                        <button
                          key={option}
                          className={
                            nutritionDraft[key] === option ? "active" : ""
                          }
                          onClick={() =>
                            setNutritionDraft({
                              ...nutritionDraft,
                              [key]: option,
                            })
                          }
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ),
              )}
              <Button
                className="wide"
                icon="check"
                disabled={!nutritionComplete}
                onClick={() =>
                  setNutritionEntry({
                    ...nutritionDraft,
                    date: yesterdayKey,
                  })
                }
              >
                Save yesterday
              </Button>
            </div>
          )}
        </Card>
        <Card className="nutrition-calendar">
          <SectionTitle
            title="Monthly calendar"
            subtitle={yesterday.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
            action={<Badge tone="sage">19 logged</Badge>}
          />
          <div className="nutrition-weekdays">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>
          <div className="nutrition-month-grid">
            {Array.from({ length: monthDays }, (_, index) => {
              const day = index + 1
              const isYesterday = day === yesterday.getDate()
              const logged = isYesterday
                ? Boolean(nutritionEntry)
                : day < yesterday.getDate() && day % 4 !== 0
              return (
                <div
                  key={day}
                  className={`${logged ? "logged" : ""} ${
                    isYesterday ? "yesterday" : ""
                  } ${logged && day % 5 === 0 ? "mixed" : ""}`}
                  style={day === 1 ? { gridColumnStart: monthOffset + 1 } : {}}
                >
                  <span>{day}</span>
                  {logged && <i />}
                </div>
              )
            })}
          </div>
          <div className="nutrition-calendar-key">
            <span>
              <i /> Logged
            </span>
            <span>
              <i className="mixed" /> Mixed day
            </span>
            <span>
              <i className="empty" /> Not logged
            </span>
          </div>
        </Card>
      </div>
      <Card className={`health-flow ${saved ? "saved" : ""}`}>
        <div className="health-flow-head">
          <div>
            <span>Daily check-in</span>
            <strong>{saved ? "Today is saved" : "4 quick signals"}</strong>
          </div>
          <span className="health-completion">{saved ? "100%" : "75%"}</span>
        </div>
        <div className="health-question featured-question">
          <span>Did you eat junk food yesterday?</span>
          <div className="answer-pills">
            <button
              className={
                food.find((f) => f.id === "junk")?.value ? "active" : ""
              }
              onClick={() => toggle("junk", true)}
            >
              Yes
            </button>
            <button
              className={
                food.find((f) => f.id === "junk")?.value === false
                  ? "active"
                  : ""
              }
              onClick={() => toggle("junk", false)}
            >
              No
            </button>
          </div>
        </div>
        {food.find((f) => f.id === "junk")?.value && (
          <div className="portion-picker">
            <span>How much?</span>
            <div>
              {["A little", "One meal", "A lot"].map((item, i) => (
                <button
                  key={item}
                  className={junkAmount === i ? "active" : ""}
                  onClick={() => setJunkAmount(i)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="macro-balance">
          <div>
            <span>Protein</span>
            <strong>{protein}/5</strong>
            <input
              aria-label="Protein portions"
              type="range"
              min="0"
              max="5"
              value={protein}
              onChange={(e) => setProtein(Number(e.target.value))}
            />
          </div>
          <div>
            <span>Carbohydrates</span>
            <strong>{carbs}/5</strong>
            <input
              aria-label="Carbohydrate portions"
              type="range"
              min="0"
              max="5"
              value={carbs}
              onChange={(e) => setCarbs(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="energy-check">
          <span>How did your food make you feel?</span>
          <div>
            {["Low", "Okay", "Good", "Great"].map((item) => (
              <button
                key={item}
                className={energy === item ? "active" : ""}
                onClick={() => setEnergy(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </Card>
      <div className="food-grid">
        <Card className="checkin-card">
          <SectionTitle
            title="Today’s check-in"
            subtitle="There are no right answers here."
          />
          <div className="food-questions">
            {food.map((q) => (
              <div key={q.id}>
                <span>{q.label}</span>
                <div>
                  <button
                    className={q.value === true ? "yes active" : "yes"}
                    onClick={() => toggle(q.id, true)}
                  >
                    Yes
                  </button>
                  <button
                    className={q.value === false ? "no active" : "no"}
                    onClick={() => toggle(q.id, false)}
                  >
                    No
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Button variant="secondary" icon="plus">
            Add a custom question
          </Button>
        </Card>
        <Card className="water-card">
          <div className="water-head">
            <span className="metric-icon blue">
              <Icon name="drop" />
            </span>
            <div>
              <h3>Water</h3>
              <p>{water} of 8 glasses</p>
            </div>
            <strong>{Math.round((water / 8) * 100)}%</strong>
          </div>
          <div className="water-glasses">
            {Array.from({ length: 8 }, (_, i) => (
              <button
                key={i}
                className={i < water ? "filled" : ""}
                onClick={() => setWater(i + 1)}
              >
                <Icon name="drop" />
              </button>
            ))}
          </div>
          <Progress value={(water / 8) * 100} tone="blue" />
        </Card>
      </div>
      <div className="food-lower">
        <Card>
          <SectionTitle
            title="Meals today"
            action={<Button variant="ghost">See nutrition notes</Button>}
          />
          {[
            [
              "08:10",
              "Breakfast",
              "Greek yogurt, berries & walnuts",
              "Balanced",
            ],
            ["12:20", "Lunch", "Roasted vegetable grain bowl", "Energizing"],
            ["15:45", "Snack", "Apple and almond butter", "Light"],
          ].map((m) => (
            <div className="meal-row" key={m[0]}>
              <time>{m[0]}</time>
              <span className="meal-visual">{m[1][0]}</span>
              <div>
                <strong>{m[1]}</strong>
                <small>{m[2]}</small>
              </div>
              <Badge tone="sage">{m[3]}</Badge>
              <Icon name="more" />
            </div>
          ))}
        </Card>
        <Card>
          <SectionTitle title="Monthly patterns" subtitle="Last 30 days" />
          <div className="trend-list">
            {[
              ["Fruit & vegetables", 82, "teal"],
              ["Enough water", 71, "blue"],
              ["Comfortable timing", 76, "lavender"],
              ["Processed food", 24, "coral"],
            ].map((t) => (
              <div key={t[0]}>
                <span>
                  {t[0]}
                  <strong>{t[1]}%</strong>
                </span>
                <Progress value={Number(t[1])} tone={String(t[2])} />
              </div>
            ))}
          </div>
          <p className="soft-note">
            You tend to drink more water on days you exercise. Patterns are
            information, not grades.
          </p>
        </Card>
      </div>
    </div>
  )
}

export function TasksPage({ tasks, setTasks }: SharedProps) {
  const [tab, setTab] = useState("Today")
  const [view, setView] = useState<"List" | "Calendar">("List")
  const [editing, setEditing] = useState<Task | null | "new">(null)
  const remove = (id: number) => setTasks(tasks.filter((t) => t.id !== id))
  return (
    <div className="page tasks-page">
      <PageHeader
        eyebrow="Tasks"
        title="Make space for what matters."
        description={`${tasks.filter((t) => t.done).length} completed · ${tasks.filter((t) => !t.done).length} still in motion`}
        actions={
          <Button icon="plus" onClick={() => setEditing("new")}>
            New task
          </Button>
        }
      />
      <div className="task-controls">
        <div className="task-tabs">
          {["Today", "Upcoming", "Completed", "Overdue"].map((x) => (
            <button
              key={x}
              className={tab === x ? "active" : ""}
              onClick={() => setTab(x)}
            >
              {x}
              <span>
                {x === "Completed"
                  ? tasks.filter((t) => t.done).length
                  : x === "Today"
                    ? tasks.filter((t) => !t.done).length
                    : ""}
              </span>
            </button>
          ))}
        </div>
        <Segmented
          items={["List", "Calendar"] as const}
          value={view}
          onChange={setView}
        />
      </div>
      {view === "List" ? (
        <Card className="task-list">
          <div className="task-group-title">
            <span>Today</span>
            <small>Thursday, May 14</small>
          </div>
          {tasks
            .filter((t) => (tab === "Completed" ? t.done : !t.done))
            .map((task) => (
              <div
                className={`task-row ${task.done ? "done" : ""}`}
                key={task.id}
              >
                <button
                  className="task-check"
                  onClick={() =>
                    setTasks(
                      tasks.map((t) =>
                        t.id === task.id ? { ...t, done: !t.done } : t,
                      ),
                    )
                  }
                >
                  {task.done && <Icon name="check" size={15} />}
                </button>
                <div>
                  <strong>{task.title}</strong>
                  <span>
                    <Badge tone={task.category.toLowerCase()}>
                      {task.category}
                    </Badge>{" "}
                    {task.due}
                  </span>
                </div>
                <Badge
                  tone={
                    task.priority === "High"
                      ? "coral"
                      : task.priority === "Medium"
                        ? "sand"
                        : "neutral"
                  }
                >
                  {task.priority}
                </Badge>
                <Button
                  variant="icon"
                  icon="more"
                  onClick={() => setEditing(task)}
                  aria-label="Edit task"
                />
                <button className="delete-task" onClick={() => remove(task.id)}>
                  Delete
                </button>
              </div>
            ))}
        </Card>
      ) : (
        <Card>
          <CalendarGrid
            cursor={new Date()}
            selected={new Date()}
            onSelect={() => {}}
          />
        </Card>
      )}
      <div className="task-summary">
        <Card>
          <span>Completion rate</span>
          <strong>78%</strong>
          <small>+6% from last week</small>
          <Progress value={78} />
        </Card>
        <Card>
          <span>High priority</span>
          <strong>2</strong>
          <small>1 due today</small>
        </Card>
        <Card>
          <span>Focus time linked</span>
          <strong>4h 20m</strong>
          <small>Across 6 tasks</small>
        </Card>
      </div>
      {editing && (
        <TaskModal
          task={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(task) => {
            setTasks(
              editing === "new"
                ? [...tasks, { ...task, id: Date.now() }]
                : tasks.map((t) => (t.id === task.id ? task : t)),
            )
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function TaskModal({
  task,
  onClose,
  onSave,
}: {
  task: Task | null
  onClose: () => void
  onSave: (t: Task) => void
}) {
  const [form, setForm] = useState<Task>(
    task ?? {
      id: 0,
      title: "",
      category: "Personal",
      due: "Today, 17:00",
      priority: "Medium",
      done: false,
    },
  )
  return (
    <Modal title={task ? "Edit task" : "Add a task"} onClose={onClose}>
      <div className="form-grid">
        <label className="field full">
          Task name
          <input
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="What needs doing?"
          />
        </label>
        <label className="field">
          Category
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option>Personal</option>
            <option>Study</option>
            <option>Health</option>
            <option>Fitness</option>
          </select>
        </label>
        <label className="field">
          Priority
          <select
            value={form.priority}
            onChange={(e) =>
              setForm({ ...form, priority: e.target.value as Task["priority"] })
            }
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
        <label className="field full">
          Due date
          <input
            value={form.due}
            onChange={(e) => setForm({ ...form, due: e.target.value })}
          />
        </label>
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => form.title && onSave(form)}>Save task</Button>
      </div>
    </Modal>
  )
}

export function HabitsPage({ habits, setHabits }: SharedProps) {
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState("")
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
            value={67}
            size={120}
            label={`${habits.filter((h) => h.done).length}/${habits.length}`}
            sublabel="today"
          />
          <div>
            <span>Today’s rhythm</span>
            <strong>Keep the chain gentle.</strong>
            <p>Two more check-ins to complete today.</p>
          </div>
        </Card>
        <Card>
          <span className="metric-icon coral">
            <Icon name="habits" />
          </span>
          <div>
            <small>Longest active streak</small>
            <strong>18 days</strong>
            <span>Morning meditation</span>
          </div>
        </Card>
        <Card>
          <span className="metric-icon sand">
            <Icon name="sun" />
          </span>
          <div>
            <small>Monthly consistency</small>
            <strong>81%</strong>
            <span>+7% from April</span>
          </div>
        </Card>
      </div>
      <div className="habit-list">
        {habits.map((h) => (
          <Card key={h.id} className="habit-card">
            <button
              className={`habit-toggle ${h.done ? "done" : ""}`}
              onClick={() =>
                setHabits(
                  habits.map((x) =>
                    x.id === h.id ? { ...x, done: !x.done } : x,
                  ),
                )
              }
            >
              {h.done ? <Icon name="check" /> : <Icon name={h.icon} />}
            </button>
            <div className="habit-main">
              <div>
                <h3>{h.name}</h3>
                <span>{h.cadence}</span>
              </div>
              <Heatmap metric={h.name} compact />
            </div>
            <div className="streaks">
              <span>
                <strong>{h.streak}</strong>current
              </span>
              <span>
                <strong>{h.best}</strong>best
              </span>
            </div>
            <Icon name="more" />
          </Card>
        ))}
      </div>
      <Card className="habit-history">
        <SectionTitle
          title="Monthly history"
          subtitle="May 2026"
          action={
            <Segmented
              items={["Month", "Year"] as const}
              value="Month"
              onChange={() => {}}
            />
          }
        />
        <div className="habit-month">
          <Heatmap metric="habits" />
          <div>
            <strong>81%</strong>
            <span>overall consistency</span>
          </div>
        </div>
      </Card>
      {showNew && (
        <Modal title="Create a habit" onClose={() => setShowNew(false)}>
          <label className="field">
            Habit name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Evening walk"
            />
          </label>
          <label className="field">
            Frequency
            <select>
              <option>Every day</option>
              <option>Weekdays</option>
              <option>3 times a week</option>
            </select>
          </label>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (name) {
                  setHabits([
                    ...habits,
                    {
                      id: Date.now(),
                      name,
                      icon: "sun",
                      streak: 0,
                      best: 0,
                      done: false,
                      cadence: "Daily",
                    },
                  ])
                  setShowNew(false)
                }
              }}
            >
              Create habit
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function FitnessPage() {
  const [syncing, setSyncing] = useState(false)
  const [showWorkout, setShowWorkout] = useState(false)
  const sync = () => {
    setSyncing(true)
    window.setTimeout(() => setSyncing(false), 1300)
  }
  return (
    <div className="page fitness-page">
      <PageHeader
        eyebrow="Fitness"
        title="Move with purpose."
        description="Your training, recovery and progress in one place."
        actions={
          <Button icon="reset" onClick={sync}>
            {syncing ? "Syncing…" : "Sync Strava"}
          </Button>
        }
      />
      <Card className={`strava-sync ${syncing ? "syncing" : ""}`}>
        <span className="strava-mark">S</span>
        <div>
          <small>Connected to Strava</small>
          <strong>
            {syncing
              ? "Processing latest activities…"
              : "All activities are up to date"}
          </strong>
          <span>Last synced 4 minutes ago · 148 activities imported</span>
        </div>
        <i />
      </Card>
      <div className="fitness-stats">
        {[
          ["42.6 km", "This month", "+12%", "teal"],
          ["5:42 /km", "Average pace", "–0:08", "blue"],
          ["4h 03m", "Running time", "6 activities", "lavender"],
          ["18.4 km", "This week", "72% of goal", "coral"],
        ].map((x) => (
          <Card key={x[1]}>
            <span className={`metric-icon ${x[3]}`}>
              <Icon name="fitness" />
            </span>
            <div>
              <strong>{x[0]}</strong>
              <span>{x[1]}</span>
            </div>
            <Badge tone="sage">{x[2]}</Badge>
          </Card>
        ))}
      </div>
      <div className="fitness-main">
        <Card className="activity-map">
          <SectionTitle
            title="Previous workout"
            subtitle="Riverside easy run · Today, 6:02 PM"
            action={
              <div className="workout-card-actions">
                <Badge tone="sage">Strava</Badge>
                <Button variant="ghost" onClick={() => setShowWorkout(true)}>
                  More info
                </Button>
              </div>
            }
          />
          <div className="map-placeholder">
            <svg viewBox="0 0 600 260">
              <path
                className="map-road"
                d="M-20 80C100 20 160 180 280 100s160-30 340 40M40 280C100 190 190 230 250 150S390 90 650 50M120-20c30 80-20 130 30 190s80 80 60 130M430-30c-60 100 30 160-10 310"
              />
              <path
                className="route"
                d="M108 210c46-42 30-98 82-110 80-18 76 72 146 54 50-13 46-74 100-76 38-2 51 37 84 54"
              />
              <circle cx="108" cy="210" r="7" />
              <circle cx="520" cy="132" r="7" />
            </svg>
            <div className="map-badge">
              <strong>5.24 km</strong>
              <span>29:54 · 5:42 /km</span>
            </div>
          </div>
          <div className="run-details">
            {[
              ["5.24 km", "Distance"],
              ["29:54", "Time"],
              ["5:42 /km", "Avg pace"],
              ["153 bpm", "Avg heart rate"],
            ].map((x) => (
              <div key={x[1]}>
                <strong>{x[0]}</strong>
                <span>{x[1]}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle title="Weekly mileage" subtitle="May 11–17" />
          <BarChart
            data={[5.2, 0, 7.4, 4.8, 0, 11.2, 3.1]}
            labels={["M", "T", "W", "T", "F", "S", "S"]}
            unit="km"
          />
          <div className="goal-row">
            <span>
              Weekly goal<strong>18.4 / 25 km</strong>
            </span>
            <Progress value={74} />
          </div>
        </Card>
      </div>
      <div className="fitness-bottom">
        <Card>
          <SectionTitle
            title="Recent activities"
            action={<Button variant="ghost">View all</Button>}
          />
          {[
            ["Today", "Riverside easy run", "5.24 km", "29:54"],
            ["Saturday", "Long run · Greenway", "11.20 km", "1:08:12"],
            ["Thursday", "Recovery run", "4.80 km", "29:06"],
          ].map((x) => (
            <div className="fitness-row" key={x[0]}>
              <span>
                <Icon name="fitness" />
              </span>
              <div>
                <strong>{x[1]}</strong>
                <small>{x[0]}</small>
              </div>
              <b>{x[2]}</b>
              <small>{x[3]}</small>
            </div>
          ))}
        </Card>
        <Card>
          <SectionTitle title="Personal records" />
          {[
            ["Fastest 5K", "24:38", "Apr 21"],
            ["Longest run", "16.4 km", "Mar 30"],
            ["Best 10K", "52:10", "Feb 16"],
          ].map((x, i) => (
            <div className="record-row" key={x[0]}>
              <span>{i + 1}</span>
              <div>
                <strong>{x[0]}</strong>
                <small>{x[2]}</small>
              </div>
              <b>{x[1]}</b>
            </div>
          ))}
          <div className="strava-card">
            <span className="strava-mark">S</span>
            <div>
              <strong>Strava connected</strong>
              <small>Automatic sync is active.</small>
            </div>
            <Button variant="secondary" onClick={sync}>
              Manage
            </Button>
          </div>
        </Card>
      </div>
      {showWorkout && (
        <Modal title="Riverside easy run" onClose={() => setShowWorkout(false)}>
          <div className="workout-detail-head">
            <span className="metric-icon teal">
              <Icon name="fitness" />
            </span>
            <div>
              <strong>Thursday, May 14 · 6:02 PM</strong>
              <small>Imported from Strava · Outdoor run</small>
            </div>
            <Badge tone="sage">Completed</Badge>
          </div>
          <div className="workout-detail-grid">
            {[
              ["5.24 km", "Distance"],
              ["29:54", "Moving time"],
              ["31:08", "Elapsed time"],
              ["5:42 /km", "Average pace"],
              ["4:51 /km", "Best pace"],
              ["153 bpm", "Average heart rate"],
              ["174 bpm", "Maximum heart rate"],
              ["42 m", "Elevation gain"],
              ["428 kcal", "Energy"],
              ["172 spm", "Cadence"],
              ["3.1", "Aerobic effect"],
              ["6 / 10", "Perceived effort"],
            ].map((item) => (
              <div key={item[1]}>
                <strong>{item[0]}</strong>
                <span>{item[1]}</span>
              </div>
            ))}
          </div>
          <div className="workout-splits">
            <SectionTitle title="Kilometre splits" subtitle="Pace per km" />
            {[
              ["1", "5:51", "148"],
              ["2", "5:44", "151"],
              ["3", "5:39", "154"],
              ["4", "5:36", "157"],
              ["5", "5:31", "160"],
            ].map((split) => (
              <div key={split[0]}>
                <span>KM {split[0]}</span>
                <Progress value={65 + Number(split[0]) * 6} />
                <strong>{split[1]}</strong>
                <small>{split[2]} bpm</small>
              </div>
            ))}
          </div>
          <Button className="wide" onClick={() => setShowWorkout(false)}>
            Done
          </Button>
        </Modal>
      )}
    </div>
  )
}

export function InsightsPage() {
  const [range, setRange] = useState<"Week" | "Month" | "Year">("Month")
  return (
    <div className="page insights-page">
      <PageHeader
        eyebrow="Insights"
        title="See the shape of your life."
        description="Patterns across your focus, health, learning and movement."
        actions={
          <Segmented
            items={["Week", "Month", "Year"] as const}
            value={range}
            onChange={setRange}
          />
        }
      />
      <div className="insight-summary">
        <Card className="summary-lead">
          <span>May overview</span>
          <strong>
            A balanced month,
            <br />
            with room to recover.
          </strong>
          <p>
            Your learning and movement trends are rising. Evenings have been
            less consistent, so protect your wind-down routine.
          </p>
          <Badge tone="sage">
            <Icon name="arrowUp" size={14} /> 8% overall consistency
          </Badge>
        </Card>
        <Donut
          value={84}
          label="Focus consistency"
          detail="16 of 19 planned sessions"
        />
        <Donut
          value={76}
          label="Habit consistency"
          detail="4 habits above 80%"
          color="var(--lavender)"
        />
      </div>
      <div className="analytics-grid">
        <Card className="large-chart">
          <SectionTitle
            title="Focus & learning"
            subtitle="Hours per week · Jan 26 – May 17"
            action={<Badge tone="sage">+18.2%</Badge>}
          />
          <div className="chart-metric">
            <strong>14.8h</strong>
            <span>this week</span>
          </div>
          <LineChart
            data={chartData}
            labels={[
              "Jan 26",
              "Feb 9",
              "Feb 23",
              "Mar 9",
              "Mar 23",
              "Apr 6",
              "Apr 20",
              "May 4",
              "May 11",
              "May 12",
              "May 14",
              "May 17",
            ]}
            unit="h"
          />
        </Card>
        <Card>
          <SectionTitle title="Life balance" subtitle="Share of tracked time" />
          <div className="balance-donut">
            <div className="donut-css">
              <span>
                41h<small>tracked</small>
              </span>
            </div>
            <div>
              {[
                ["Study", "38%", "teal"],
                ["Fitness", "24%", "blue"],
                ["Reading", "18%", "lavender"],
                ["Habits", "12%", "coral"],
                ["Other", "8%", "sand"],
              ].map((x) => (
                <span key={x[0]}>
                  <i className={`tone-${x[2]}`} />
                  {x[0]}
                  <strong>{x[1]}</strong>
                </span>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <SectionTitle title="Task completion" subtitle="Weekly rate" />
          <BarChart
            data={[62, 71, 68, 78, 82, 76, 86]}
            labels={["W1", "W2", "W3", "W4", "W5", "W6", "Now"]}
            unit="%"
          />
          <p className="soft-note">
            You finish <strong>23% more tasks</strong> when they’re scheduled
            before noon.
          </p>
        </Card>
        <Card>
          <SectionTitle title="Habit consistency" subtitle="Last 12 weeks" />
          <Heatmap metric="habit insights" compact />
          <div className="habit-insight-rows">
            <span>
              Morning meditation<strong>92%</strong>
            </span>
            <span>
              Read 20 pages<strong>84%</strong>
            </span>
            <span>
              Drink 2L water<strong>76%</strong>
            </span>
          </div>
        </Card>
        <Card>
          <SectionTitle
            title="Fitness progression"
            subtitle="Weekly running distance · km"
          />
          <LineChart
            data={[18, 22, 19, 26, 24, 31, 28, 35, 33, 39, 37, 43]}
            labels={months.slice(0, 12)}
            unit="km"
          />
        </Card>
        <Card>
          <SectionTitle
            title="Food patterns"
            subtitle="Positive check-in trends"
          />
          <div className="food-ring-row">
            <Ring value={82} size={96} label="82%" sublabel="plants" />
            <Ring
              value={71}
              size={96}
              label="71%"
              sublabel="water"
              color="var(--blue)"
            />
            <Ring
              value={76}
              size={96}
              label="76%"
              sublabel="timing"
              color="var(--lavender)"
            />
          </div>
        </Card>
      </div>
    </div>
  )
}

export function LibraryPage({ books }: SharedProps) {
  const [filter, setFilter] = useState("All")
  const collections = [
    {
      type: "Books",
      title: "Reading library",
      count: `${books.length} books`,
      icon: "book",
      tone: "sage",
    },
    {
      type: "Subjects",
      title: "Academic subjects",
      count: "6 subjects",
      icon: "focus",
      tone: "blue",
    },
    {
      type: "Courses",
      title: "Active courses",
      count: "3 courses",
      icon: "library",
      tone: "lavender",
    },
    {
      type: "Resources",
      title: "Learning resources",
      count: "24 saved",
      icon: "library",
      tone: "coral",
    },
    {
      type: "Goals",
      title: "Personal goals",
      count: "8 active",
      icon: "habits",
      tone: "sand",
    },
  ]
  return (
    <div className="page library-page">
      <PageHeader
        eyebrow="Library"
        title="Everything you’re becoming."
        description="Books, ideas, courses and goals—beautifully organized."
        actions={<Button icon="plus">Add to library</Button>}
      />
      <Card className="library-feature">
        <div className="library-feature-image" />
        <div>
          <Badge tone="sage">Featured collection</Badge>
          <h2>The intentional life</h2>
          <p>
            Eight books, three courses and twelve notes exploring attention,
            time and meaningful work.
          </p>
          <div className="collection-people">
            <span>AM</span>
            <span>8 books</span>
            <span>3 courses</span>
          </div>
          <Button variant="secondary">Open collection</Button>
        </div>
      </Card>
      <div className="library-filter">
        <div>
          {["All", "Books", "Subjects", "Courses", "Resources", "Goals"].map(
            (x) => (
              <button
                className={filter === x ? "active" : ""}
                onClick={() => setFilter(x)}
                key={x}
              >
                {x}
              </button>
            ),
          )}
        </div>
        <Button variant="secondary" icon="search">
          Search library
        </Button>
      </div>
      <div className="collection-grid">
        {collections
          .filter((x) => filter === "All" || x.type === filter)
          .map((c) => (
            <Card className={`collection-card ${c.tone}`} key={c.title}>
              <span>
                <Icon name={c.icon} size={26} />
              </span>
              <div>
                <small>{c.type}</small>
                <h3>{c.title}</h3>
                <p>{c.count}</p>
              </div>
              <button>
                <Icon name="chevronRight" />
              </button>
            </Card>
          ))}
      </div>
      <Card>
        <SectionTitle
          title="Recently opened"
          action={<Button variant="ghost">View all</Button>}
        />
        <div className="recent-grid">
          {[
            ["Neuroscience foundations", "Subject", "Updated today"],
            ["Four Thousand Weeks", "Book", "Read 24 pages"],
            ["Statistics for Research", "Course", "Lesson 8 of 12"],
            ["Run a half marathon", "Goal", "72% complete"],
          ].map((x, i) => (
            <div key={x[0]}>
              <span className={`recent-thumb r${i}`}>
                <Icon
                  name={i === 1 ? "book" : i === 3 ? "fitness" : "library"}
                />
              </span>
              <strong>{x[0]}</strong>
              <small>
                {x[1]} · {x[2]}
              </small>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
