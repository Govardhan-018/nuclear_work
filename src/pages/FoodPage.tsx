import { useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Progress, SectionTitle } from "../components/UI"
import {
  addMeal, deleteMeal, setEnergy, setWaterGlasses, updateNutritionLog,
} from "../db/repo"
import { useSettings } from "../db/settings"
import {
  isNutritionLogComplete, nutritionScore, useMeals, useNutritionLog, useNutritionStats,
} from "../db/stats"
import { addDays, dayKey, endOfMonth, fromDayKey, startOfMonth, type DayKey } from "../lib/date"
import type { EnergyLevel, JunkLevel, MealType, PortionLevel } from "../db/types"
import type { PageProps } from "./shared"

const SIGNALS = [
  { key: "protein", label: "Protein", options: ["Low", "Enough", "High"], icon: "fitness" },
  { key: "carbs", label: "Carbohydrates", options: ["Low", "Enough", "High"], icon: "focus" },
  { key: "junk", label: "Junk food", options: ["None", "Some", "A lot"], icon: "food" },
  { key: "vegetables", label: "Vegetables", options: ["No", "Yes"], icon: "habits" },
  { key: "fruit", label: "Fruit", options: ["No", "Yes"], icon: "sun" },
] as const

const ENERGY_LEVELS: EnergyLevel[] = ["Low", "Okay", "Good", "Great"]
const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"]

export function FoodPage(_props: PageProps) {
  const settings = useSettings()
  const stats = useNutritionStats()
  const today = dayKey()
  const yesterday = dayKey(addDays(new Date(), -1))

  const [checkInDate, setCheckInDate] = useState<DayKey>(yesterday)
  const [editing, setEditing] = useState(false)
  const [addingMeal, setAddingMeal] = useState(false)
  const [monthCursor, setMonthCursor] = useState(() => new Date())

  const checkInLog = useNutritionLog(checkInDate)
  const todayLog = useNutritionLog(today)
  const meals = useMeals(today)

  const complete = isNutritionLogComplete(checkInLog)
  const showForm = editing || !complete

  /* Month grid: real logged days, clicking one moves the check-in to that day. */
  const monthCells = useMemo(() => {
    const first = startOfMonth(monthCursor)
    const last = endOfMonth(monthCursor)
    const offset = (first.getDay() + 6) % 7
    const count = last.getDate()
    return {
      offset,
      days: Array.from({ length: count }, (_, i) => {
        const date = dayKey(new Date(first.getFullYear(), first.getMonth(), i + 1))
        const log = stats.byDate.get(date)
        const score = nutritionScore(log)
        return {
          day: i + 1,
          date,
          logged: isNutritionLogComplete(log),
          mixed: score !== null && score < 55,
          future: date > today,
        }
      }),
    }
  }, [monthCursor, stats.byDate, today])

  const loggedThisMonth = monthCells.days.filter((d) => d.logged).length

  /* 30-day pattern percentages, all computed from real check-ins. */
  const patterns = useMemo(() => {
    const window = Array.from({ length: 30 }, (_, i) => dayKey(addDays(new Date(), -i)))
    const logs = window.map((d) => stats.byDate.get(d)).filter(Boolean)
    const complete = logs.filter((l) => isNutritionLogComplete(l))
    const pct = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 100) : 0)
    const waterTarget = settings.waterDailyTarget
    return [
      ["Fruit & vegetables", pct(complete.filter((l) => l?.vegetables && l?.fruit).length, complete.length), "teal"],
      ["Enough water", pct(logs.filter((l) => (l?.water ?? 0) >= waterTarget).length, logs.length), "blue"],
      ["Protein on target", pct(complete.filter((l) => l?.protein === "Enough" || l?.protein === "High").length, complete.length), "lavender"],
      ["Processed food", pct(complete.filter((l) => l?.junk === "Some" || l?.junk === "A lot").length, complete.length), "coral"],
    ] as Array<[string, number, string]>
  }, [stats.byDate, settings.waterDailyTarget])

  const water = todayLog?.water ?? 0
  const waterTarget = settings.waterDailyTarget
  const checkInScore = nutritionScore(checkInLog)

  const setSignal = (key: string, value: string) => {
    const patch =
      key === "vegetables" || key === "fruit"
        ? { [key]: value === "Yes" }
        : key === "junk"
          ? { junk: value as JunkLevel }
          : { [key]: value as PortionLevel }
    void updateNutritionLog(checkInDate, patch)
  }

  const currentValue = (key: string): string | null => {
    if (!checkInLog) return null
    if (key === "vegetables") return checkInLog.vegetables === null ? null : checkInLog.vegetables ? "Yes" : "No"
    if (key === "fruit") return checkInLog.fruit === null ? null : checkInLog.fruit ? "Yes" : "No"
    return (checkInLog as unknown as Record<string, string | null>)[key] ?? null
  }

  return (
    <div className="page food-page">
      <PageHeader
        eyebrow="Nutrition"
        title={checkInDate === yesterday ? "Yesterday’s food." : "Food check-in."}
        description="Five quick signals, answered once. Your history stays visible in the calendar."
        actions={
          complete ? (
            <Badge tone="sage">{checkInScore}% quality</Badge>
          ) : (
            <Badge tone="neutral">1 check-in due</Badge>
          )
        }
      />

      <div className="nutrition-layout">
        <Card className="yesterday-checkin">
          <SectionTitle
            title={complete && !editing ? "Check-in complete" : "Quick check-in"}
            subtitle={fromDayKey(checkInDate).toLocaleDateString(undefined, {
              weekday: "long", month: "long", day: "numeric",
            })}
            action={
              complete ? (
                editing ? (
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Done
                  </Button>
                ) : (
                  <Button variant="ghost" icon="edit" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )
              ) : undefined
            }
          />

          {!showForm ? (
            <div className="nutrition-result">
              {SIGNALS.map((signal) => (
                <div key={signal.key}>
                  <span>
                    <Icon name={signal.icon} size={17} />
                  </span>
                  <small>{signal.label}</small>
                  <strong>{currentValue(signal.key) ?? "Not set"}</strong>
                </div>
              ))}
              <p>
                Saved. Quality score for this day is <strong>{checkInScore}%</strong>. You can
                edit it at any time.
              </p>
            </div>
          ) : (
            <div className="nutrition-questions">
              {SIGNALS.map((signal) => (
                <div className="nutrition-question" key={signal.key}>
                  <span>{signal.label}</span>
                  <div>
                    {signal.options.map((option) => (
                      <button
                        key={option}
                        className={currentValue(signal.key) === option ? "active" : ""}
                        onClick={() => setSignal(signal.key, option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <Button
                className="wide"
                icon="check"
                disabled={!complete}
                onClick={() => setEditing(false)}
              >
                {complete ? "Save check-in" : "Answer all five to save"}
              </Button>
            </div>
          )}
        </Card>

        <Card className="nutrition-calendar">
          <SectionTitle
            title="Monthly calendar"
            subtitle={monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            action={
              <div className="inline-nav">
                <button
                  aria-label="Previous month"
                  onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
                >
                  <Icon name="chevronLeft" size={16} />
                </button>
                <Badge tone="sage">{loggedThisMonth} logged</Badge>
                <button
                  aria-label="Next month"
                  onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
                >
                  <Icon name="chevronRight" size={16} />
                </button>
              </div>
            }
          />
          <div className="nutrition-weekdays">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>
          <div className="nutrition-month-grid">
            {monthCells.days.map((cell) => (
              <button
                key={cell.date}
                type="button"
                className={`${cell.logged ? "logged" : ""} ${cell.date === checkInDate ? "yesterday" : ""} ${cell.mixed ? "mixed" : ""}`}
                style={cell.day === 1 ? { gridColumnStart: monthCells.offset + 1 } : undefined}
                disabled={cell.future}
                onClick={() => {
                  setCheckInDate(cell.date)
                  setEditing(false)
                }}
                aria-label={`Check-in for ${cell.date}`}
              >
                <span>{cell.day}</span>
                {cell.logged && <i />}
              </button>
            ))}
          </div>
          <div className="nutrition-calendar-key">
            <span>
              <i /> Logged
            </span>
            <span>
              <i className="mixed" /> Lower quality
            </span>
            <span>
              <i className="empty" /> Not logged
            </span>
          </div>
        </Card>
      </div>

      <Card className="health-flow">
        <div className="health-flow-head">
          <div>
            <span>Today</span>
            <strong>{todayLog?.energy ? "Energy logged" : "How is today going?"}</strong>
          </div>
          <span className="health-completion">
            {todayLog ? `${Math.round(((todayLog.water / Math.max(1, waterTarget)) * 50) + (todayLog.energy ? 50 : 0))}%` : "0%"}
          </span>
        </div>

        <div className="energy-check">
          <span>How did your food make you feel?</span>
          <div>
            {ENERGY_LEVELS.map((level) => (
              <button
                key={level}
                className={todayLog?.energy === level ? "active" : ""}
                onClick={() => void setEnergy(today, level)}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="macro-balance">
          <div>
            <span>Today’s protein</span>
            <strong>{todayLog?.protein ?? "Not set"}</strong>
            <div className="answer-pills">
              {["Low", "Enough", "High"].map((option) => (
                <button
                  key={option}
                  className={todayLog?.protein === option ? "active" : ""}
                  onClick={() => void updateNutritionLog(today, { protein: option as PortionLevel })}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span>Today’s carbohydrates</span>
            <strong>{todayLog?.carbs ?? "Not set"}</strong>
            <div className="answer-pills">
              {["Low", "Enough", "High"].map((option) => (
                <button
                  key={option}
                  className={todayLog?.carbs === option ? "active" : ""}
                  onClick={() => void updateNutritionLog(today, { carbs: option as PortionLevel })}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="food-grid">
        <Card className="checkin-card">
          <SectionTitle
            title="Meals today"
            subtitle={meals.length === 0 ? "Nothing logged yet" : `${meals.length} logged`}
            action={
              <Button variant="ghost" icon="plus" onClick={() => setAddingMeal(true)}>
                Add
              </Button>
            }
          />
          {meals.length === 0 ? (
            <EmptyState icon="food" title="No meals yet" text="Log what you eat to build the picture over time." />
          ) : (
            [...meals]
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((meal) => (
                <div className="meal-row" key={meal.id}>
                  <time>{meal.time}</time>
                  <span className="meal-visual">{meal.type[0]}</span>
                  <div>
                    <strong>{meal.type}</strong>
                    <small>{meal.name}</small>
                  </div>
                  <Badge tone="sage">{meal.portion || "logged"}</Badge>
                  <button
                    className="row-action"
                    aria-label={`Delete ${meal.name}`}
                    onClick={() => void deleteMeal(meal.id)}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              ))
          )}
        </Card>

        <Card className="water-card">
          <div className="water-head">
            <span className="metric-icon blue">
              <Icon name="drop" />
            </span>
            <div>
              <h3>Water</h3>
              <p>
                {water} of {waterTarget} glasses
              </p>
            </div>
            <strong>{Math.round((water / Math.max(1, waterTarget)) * 100)}%</strong>
          </div>
          <div className="water-glasses">
            {Array.from({ length: waterTarget }, (_, i) => (
              <button
                key={i}
                className={i < water ? "filled" : ""}
                aria-label={`${i + 1} glasses`}
                // Tapping the current level clears back to it, so mistakes are undoable.
                onClick={() => void setWaterGlasses(today, i + 1 === water ? i : i + 1)}
              >
                <Icon name="drop" />
              </button>
            ))}
          </div>
          <Progress value={(water / Math.max(1, waterTarget)) * 100} tone="blue" />
        </Card>
      </div>

      <div className="food-lower">
        <Card>
          <SectionTitle title="Monthly patterns" subtitle="Last 30 days" />
          <div className="trend-list">
            {patterns.map(([label, value, tone]) => (
              <div key={label}>
                <span>
                  {label}
                  <strong>{value}%</strong>
                </span>
                <Progress value={value} tone={tone} />
              </div>
            ))}
          </div>
          <p className="soft-note">
            {stats.complete.length === 0
              ? "Patterns appear once you have a few complete check-ins."
              : `${stats.complete.length} complete check-ins so far, ${stats.streak} day streak. Patterns are information, not grades.`}
          </p>
        </Card>

        <Card>
          <SectionTitle title="Quality over time" subtitle="Complete check-ins only" />
          {stats.scores.length === 0 ? (
            <EmptyState icon="insights" title="No data yet" text="Complete a few check-ins to see the trend." />
          ) : (
            <div className="trend-list">
              {stats.scores.slice(-7).reverse().map((entry) => (
                <div key={entry.date}>
                  <span>
                    {fromDayKey(entry.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
                    <strong>{entry.score}%</strong>
                  </span>
                  <Progress value={entry.score} tone={entry.score >= 70 ? "teal" : "coral"} />
                </div>
              ))}
            </div>
          )}
          {stats.averageScore !== null && (
            <p className="soft-note">
              Average quality: <strong>{stats.averageScore}%</strong> across {stats.complete.length} days.
            </p>
          )}
        </Card>
      </div>

      {addingMeal && <MealModal onClose={() => setAddingMeal(false)} />}
    </div>
  )
}

function MealModal({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<MealType>("Lunch")
  const [name, setName] = useState("")
  const [portion, setPortion] = useState("")
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }),
  )

  const submit = async () => {
    if (!name.trim()) return
    await addMeal({ type, name: name.trim(), portion, time })
    onClose()
  }

  return (
    <Modal title="Log a meal" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label className="field">
          <span>What did you eat?</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Grain bowl with chickpeas" />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Meal</span>
            <select value={type} onChange={(e) => setType(e.target.value as MealType)}>
              {MEAL_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Time</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Portion</span>
          <input value={portion} onChange={(e) => setPortion(e.target.value)} placeholder="1 bowl" />
        </label>
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim()} icon="plus">
            Log meal
          </Button>
        </div>
      </form>
    </Modal>
  )
}
