import { useEffect, useMemo, useRef, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Icon } from "../components/Icon"
import { Badge, Button } from "../components/UI"
import { db } from "../db/db"
import { addAiMessage, clearAiConversation } from "../db/repo"
import { useSettings } from "../db/settings"
import {
  isNutritionLogComplete, nutritionScore, sumBy, useActivities, useFocusSessions,
  useHabitLogs, useHabits, useNutritionLogs, useReadingSessions, useTasks,
} from "../db/stats"
import { askCoach } from "../services/coach"
import { AiUnavailableError, prettyModelName } from "../services/groq"
import { addDays, dayKey, formatDate, formatDuration, lastNDays } from "../lib/date"
import type { ChatMessage } from "../services/groq"

const CONVERSATION_ID = "daily-coach"

/** Starter prompts, phrased around data the app actually holds. */
const SUGGESTIONS = [
  "How has my focus been this week?",
  "What should I work on today?",
  "Is my nutrition on track?",
  "How is my training trending?",
]

/**
 * Full-screen coach. The four analysis cards are computed on device from real
 * rows, so they are accurate offline; the conversation below them calls
 * Groq and degrades to a clear message when that is unavailable.
 */
export function AiCoach({ onClose }: { onClose: () => void }) {
  const settings = useSettings()
  const [question, setQuestion] = useState("")
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  const stored = useLiveQuery(
    () => db.aiMessages.where("conversationId").equals(CONVERSATION_ID).sortBy("createdAt"),
    [],
    [],
  )

  const insights = useComputedInsights()

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" })
  }, [stored?.length, thinking])

  const hasKey = settings.groqApiKey.trim().length > 0

  const send = async (preset?: string) => {
    const text = (preset ?? question).trim()
    if (!text || thinking) return
    setQuestion("")
    setError(null)
    await addAiMessage({ conversationId: CONVERSATION_ID, role: "user", text })
    setThinking(true)
    try {
      const history: ChatMessage[] = (stored ?? []).map((m) => ({
        role: m.role === "system" ? "assistant" : m.role,
        content: m.text,
      }))
      const reply = await askCoach(text, history)
      await addAiMessage({
        conversationId: CONVERSATION_ID,
        role: "assistant",
        text: reply,
        model: settings.groqModel,
      })
    } catch (err) {
      const message =
        err instanceof AiUnavailableError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong talking to the model."
      setError(message)
      await addAiMessage({
        conversationId: CONVERSATION_ID,
        role: "assistant",
        text: message,
        failed: 1,
      })
    } finally {
      setThinking(false)
    }
  }

  return (
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
        <button className="ai-close" aria-label="Close AI coach" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>

      <div className="ai-fullscreen-body">
        <section className="ai-coach-intro">
          <span>{formatDate(new Date())}</span>
          <h2>{insights.headline}</h2>
          <p>
            These observations are computed from what you have logged. They are
            guidance, not a score.
          </p>
        </section>

        <div className="ai-analysis-grid">
          {insights.cards.map((card, index) => (
            <article key={card.title} className={index === 0 ? "primary" : undefined}>
              <span>{card.kicker}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>

        <section className="ai-conversation">
          <div className="ai-conversation-title">
            <div>
              <span>Ask about your data</span>
              <strong>What would you like to understand?</strong>
            </div>
            <Badge tone={hasKey ? "sage" : "neutral"}>
              {hasKey ? prettyModelName(settings.groqModel) : "No API key"}
            </Badge>
          </div>

          {!hasKey && (
            <div className="ai-notice">
              <Icon name="key" size={16} />
              <span>
                Add a Groq API key in Settings to ask questions. Everything above
                works offline without one.
              </span>
            </div>
          )}

          <div className="ai-messages" ref={messagesRef}>
            {(stored ?? []).length === 0 && (
              <div className="ai-suggestions">
                <p>Ask about your study pattern, food, training or recovery.</p>
                <div className="suggestion-chips">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      disabled={!hasKey || thinking}
                      onClick={() => void send(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(stored ?? []).map((message) => (
              <div
                className={`${message.role}${message.failed === 1 ? " failed" : ""}`}
                key={message.id}
              >
                {message.text}
              </div>
            ))}
            {thinking && (
              <div className="assistant thinking">
                <i />
                <i />
                <i />
              </div>
            )}
          </div>

          {error && <div className="ai-error">{error}</div>}

          <form
            className="ai-question"
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={hasKey ? "Ask about today’s study, food or recovery…" : "Add a Groq API key in Settings first"}
              aria-label="Ask your daily coach"
              disabled={!hasKey || thinking}
            />
            <Button type="submit" icon="arrowUp" disabled={!question.trim() || thinking || !hasKey}>
              Ask
            </Button>
          </form>

          {(stored ?? []).length > 0 && (
            <button
              className="ai-clear"
              onClick={() => void clearAiConversation(CONVERSATION_ID)}
            >
              Clear conversation
            </button>
          )}
        </section>
      </div>
    </div>
  )
}

type InsightCard = { kicker: string; title: string; body: string }

/** Four honest observations derived purely from local rows. */
function useComputedInsights(): { headline: string; cards: InsightCard[] } {
  const settings = useSettings()
  const focusSessions = useFocusSessions()
  const habits = useHabits()
  const habitLogs = useHabitLogs()
  const tasks = useTasks()
  const activities = useActivities()
  const readingSessions = useReadingSessions()
  const nutritionLogs = useNutritionLogs()

  return useMemo(() => {
    const days14 = lastNDays(14)
    const days7 = lastNDays(7)
    const prev7 = lastNDays(7, addDays(new Date(), -7))
    const inSet = (set: string[], date: string) => set.includes(date)

    const focus7 = sumBy(focusSessions.filter((s) => inSet(days7, s.date)), (s) => s.seconds)
    const focusPrev7 = sumBy(focusSessions.filter((s) => inSet(prev7, s.date)), (s) => s.seconds)
    const focusDelta = focusPrev7 > 0 ? Math.round(((focus7 - focusPrev7) / focusPrev7) * 100) : null

    const activeDays14 = new Set(
      [
        ...focusSessions.filter((s) => inSet(days14, s.date)).map((s) => s.date),
        ...activities.filter((a) => inSet(days14, a.date)).map((a) => a.date),
      ],
    ).size

    const cards: InsightCard[] = []

    /* overall */
    cards.push({
      kicker: "Overall pattern",
      title:
        activeDays14 >= 10
          ? "You are showing up consistently."
          : activeDays14 >= 5
            ? "A workable rhythm, with gaps."
            : "The pattern is still forming.",
      body:
        activeDays14 === 0
          ? "Nothing logged in the last fortnight. Start with whichever area you care about most — one entry is enough."
          : `You logged something on ${activeDays14} of the last 14 days. ${
              focusDelta === null
                ? "There is not enough history yet to compare weeks."
                : `Focus time is ${focusDelta >= 0 ? "up" : "down"} ${Math.abs(focusDelta)}% against the week before.`
            }`,
    })

    /* focus */
    const byHour = new Array(24).fill(0) as number[]
    for (const session of focusSessions) {
      byHour[new Date(session.startedAt).getHours()] += session.seconds
    }
    const peak = byHour.some((v) => v > 0) ? byHour.indexOf(Math.max(...byHour)) : null
    const todayFocus = sumBy(
      focusSessions.filter((s) => s.date === dayKey()),
      (s) => s.seconds,
    )
    const target = settings.focusDailyTargetMinutes * 60
    cards.push({
      kicker: "Focus",
      title:
        todayFocus >= target
          ? "Today's target is already met."
          : todayFocus > 0
            ? "A block is on the board."
            : "No focus logged yet today.",
      body:
        peak === null
          ? "Run a few timed sessions and the app will work out when you focus best."
          : `Your strongest focus window is around ${String(peak).padStart(2, "0")}:00. Today you are at ${formatDuration(todayFocus)} of a ${formatDuration(target)} target.`,
    })

    /* nutrition */
    const complete = nutritionLogs.filter((n) => isNutritionLogComplete(n))
    const recent = complete.filter((n) => inSet(days14, n.date))
    const avgScore =
      recent.length > 0
        ? Math.round(sumBy(recent.map((n) => nutritionScore(n) ?? 0), (v) => v) / recent.length)
        : null
    cards.push({
      kicker: "Food observation",
      title:
        avgScore === null
          ? "No complete food check-ins yet."
          : avgScore >= 70
            ? "Your food pattern is holding up."
            : "There is room in the food pattern.",
      body:
        avgScore === null
          ? "The Food Tracker takes about twenty seconds a day and drives the nutrition pillar on Today."
          : `${recent.length} check-ins over 14 days, averaging ${avgScore}/100. ${
              avgScore >= 70
                ? "Keep doing what you are doing."
                : "Vegetables and protein are usually the fastest levers."
            }`,
    })

    /* habits + movement */
    const doneToday = new Set(
      habitLogs.filter((l) => l.date === dayKey() && l.done === 1).map((l) => l.habitId),
    )
    const remaining = habits.filter((h) => !doneToday.has(h.id))
    const openTasks = tasks.filter((t) => t.done !== 1)
    const overdue = openTasks.filter((t) => t.dueAt !== null && t.dueAt < Date.now())
    cards.push({
      kicker: "What to do next",
      title:
        overdue.length > 0
          ? `Clear ${overdue.length} overdue item${overdue.length === 1 ? "" : "s"}.`
          : remaining.length > 0
            ? `${remaining.length} habit${remaining.length === 1 ? "" : "s"} left today.`
            : "You are on top of today.",
      body:
        overdue.length > 0
          ? `Oldest: ${overdue.sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))[0].title}.`
          : remaining.length > 0
            ? `Remaining: ${remaining.map((h) => h.name).join(", ")}.`
            : `${readingSessions.filter((s) => s.date === dayKey()).length} reading session(s) logged today. Protect your wind-down.`,
    })

    const headline =
      activeDays14 === 0
        ? "Let's get the first few days on the board."
        : activeDays14 >= 10
          ? "Your week has a clear shape."
          : "Your day has a clear direction."

    return { headline, cards }
  }, [focusSessions, habits, habitLogs, tasks, activities, readingSessions, nutritionLogs, settings.focusDailyTargetMinutes])
}
