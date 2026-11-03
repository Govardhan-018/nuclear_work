import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "../components/Icon"
import { Badge, Button, Card, EmptyState, PageHeader, Progress, SectionTitle, Segmented } from "../components/UI"
import { BarChart, Heatmap, Ring } from "../components/Visuals"
import { addFocusSession, deleteFocusSession } from "../db/repo"
import { useSettings } from "../db/settings"
import { useBooks, useFocusStats } from "../db/stats"
import {
  dayKey, formatClock, formatDuration, formatDurationShort, formatRelative,
  lastNDays, WEEKDAY_INITIALS,
} from "../lib/date"
import type { FocusSessionType } from "../db/types"
import type { PageProps } from "./shared"

const DEFAULT_SUBJECTS = ["Neuroscience", "Statistics", "Writing", "Research"]
const PRESET_MINUTES = [15, 25, 45, 60, 90]

export function FocusPage(_props: PageProps) {
  const settings = useSettings()
  const stats = useFocusStats()
  const books = useBooks()

  const [mode, setMode] = useState<"Timer" | "Stopwatch">("Timer")
  const [sessionType, setSessionType] = useState<FocusSessionType>("Academic")
  const [targetMinutes, setTargetMinutes] = useState(25)
  const [subject, setSubject] = useState(DEFAULT_SUBJECTS[0])

  /* The timer is derived from wall-clock timestamps rather than a decrementing
     counter, so backgrounding the app or locking the phone does not lose time. */
  const [runningSince, setRunningSince] = useState<number | null>(null)
  const [accumulatedMs, setAccumulatedMs] = useState(0)
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)
  const [, forceTick] = useState(0)
  const completionHandled = useRef(false)

  const running = runningSince !== null

  /* Subject list: whatever has been used before, plus books in progress. */
  const subjects = useMemo(() => {
    const used = new Set(stats.sessions.map((s) => s.subject))
    const bookTitles = books.filter((b) => b.status === "Reading").map((b) => b.title)
    const base = sessionType === "Reading" ? bookTitles : DEFAULT_SUBJECTS
    return [...new Set([...base, ...used, ...bookTitles])].filter(Boolean)
  }, [stats.sessions, books, sessionType])

  useEffect(() => {
    if (subjects.length > 0 && !subjects.includes(subject)) setSubject(subjects[0])
  }, [subjects, subject])

  /* Re-render once a second while running. */
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => forceTick((n) => n + 1), 500)
    return () => window.clearInterval(id)
  }, [running])

  /* Recompute immediately when the app comes back to the foreground. */
  useEffect(() => {
    const onVisible = () => forceTick((n) => n + 1)
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  const elapsedMs = accumulatedMs + (runningSince !== null ? Date.now() - runningSince : 0)
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  const targetSeconds = targetMinutes * 60
  const remainingSeconds = Math.max(0, targetSeconds - elapsedSeconds)

  const displaySeconds = mode === "Timer" ? remainingSeconds : elapsedSeconds
  const progress =
    mode === "Timer"
      ? targetSeconds > 0 ? Math.min(100, (elapsedSeconds / targetSeconds) * 100) : 0
      : Math.min(100, ((elapsedSeconds % 3600) / 3600) * 100)

  const save = useCallback(
    async (completed: boolean) => {
      const seconds = Math.floor(elapsedMs / 1000)
      if (seconds < 30) return false
      await addFocusSession({
        subject,
        type: sessionType,
        mode,
        seconds,
        startedAt: sessionStartedAt ?? Date.now() - seconds * 1000,
        endedAt: Date.now(),
        completed: completed ? 1 : 0,
      })
      return true
    },
    [elapsedMs, subject, sessionType, mode, sessionStartedAt],
  )

  const reset = useCallback(() => {
    setRunningSince(null)
    setAccumulatedMs(0)
    setSessionStartedAt(null)
    completionHandled.current = false
  }, [])

  /* A timer that reaches zero saves itself and stops. */
  useEffect(() => {
    if (mode !== "Timer" || !running || remainingSeconds > 0 || completionHandled.current) return
    completionHandled.current = true
    const finishedMs = targetSeconds * 1000
    setRunningSince(null)
    setAccumulatedMs(finishedMs)
    void addFocusSession({
      subject,
      type: sessionType,
      mode,
      seconds: targetSeconds,
      startedAt: sessionStartedAt ?? Date.now() - finishedMs,
      endedAt: Date.now(),
      completed: 1,
    }).then(() => {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.([120, 60, 120])
      }
    })
  }, [mode, running, remainingSeconds, targetSeconds, subject, sessionType, sessionStartedAt])

  const start = () => {
    completionHandled.current = false
    if (sessionStartedAt === null) setSessionStartedAt(Date.now())
    setRunningSince(Date.now())
  }

  const pause = () => {
    if (runningSince === null) return
    setAccumulatedMs((ms) => ms + (Date.now() - runningSince))
    setRunningSince(null)
  }

  const stopAndSave = async () => {
    if (runningSince !== null) {
      setAccumulatedMs((ms) => ms + (Date.now() - (runningSince ?? Date.now())))
      setRunningSince(null)
    }
    await save(false)
    reset()
  }

  /* ---------------------------------------------------------- analytics */

  const dailyTargetSeconds = settings.focusDailyTargetMinutes * 60
  const targetPct =
    dailyTargetSeconds > 0 ? Math.min(100, (stats.todaySeconds / dailyTargetSeconds) * 100) : 0

  const weekHours = stats.weekSeries.map((s) => +(s / 3600).toFixed(1))
  const heatmapDays = lastNDays(98)
  const heatmapCells = heatmapDays.map((date) => ({
    date,
    value: (stats.byDay[date] ?? 0) / 3600,
  }))

  const toneForIndex = ["teal", "blue", "coral", "lavender"]

  return (
    <div className={`page focus-page ${running ? "focus-session-active" : ""}`}>
      <PageHeader
        eyebrow="Focus & study"
        title="Grow your focus."
        description="Small, undistracted sessions compound into deep learning."
        actions={
          <div className="target-pill">
            <span>Daily target</span>
            <strong>
              {formatDurationShort(stats.todaySeconds)} / {settings.focusDailyTargetMinutes / 60 >= 1
                ? `${(settings.focusDailyTargetMinutes / 60).toFixed(settings.focusDailyTargetMinutes % 60 === 0 ? 0 : 1)}h`
                : `${settings.focusDailyTargetMinutes}m`}
            </strong>
            <Progress value={targetPct} />
          </div>
        }
      />

      <div className="study-mode-controls">
        <Segmented
          items={["Timer", "Stopwatch"] as const}
          value={mode}
          onChange={(next) => {
            if (running) pause()
            reset()
            setMode(next)
          }}
        />
        <Segmented
          items={["Academic", "Reading"] as const}
          value={sessionType}
          onChange={(next) => setSessionType(next)}
        />
      </div>

      <div className="focus-layout">
        <Card className={`timer-card ${running ? "running immersive" : ""}`}>
          {running && (
            <div className="immersive-header">
              <span className="pulse-dot" />
              <strong>{sessionType} session</strong>
              <button onClick={pause} aria-label="Pause session">
                <Icon name="pause" />
              </button>
            </div>
          )}

          <div className="timer-top">
            <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <Badge tone="sage">
              {running ? `${mode} in progress` : `Ready for ${sessionType.toLowerCase()}`}
            </Badge>
          </div>

          {mode === "Timer" && !running && elapsedSeconds === 0 && (
            <div className="duration-picker">
              {PRESET_MINUTES.map((m) => (
                <button
                  key={m}
                  className={targetMinutes === m ? "active" : ""}
                  onClick={() => setTargetMinutes(m)}
                >
                  {m}m
                </button>
              ))}
            </div>
          )}

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
              label={formatClock(displaySeconds)}
              sublabel={subject}
            />
          </div>

          <div className="timer-topic">
            <span>{mode === "Timer" ? "Session length" : "Elapsed"}</span>
            <strong>
              {mode === "Timer" ? `${targetMinutes} minutes` : formatDuration(elapsedSeconds)}
            </strong>
          </div>

          <div className="timer-actions">
            <Button
              variant="secondary"
              icon="reset"
              onClick={() => void stopAndSave()}
              disabled={elapsedSeconds === 0}
            >
              {elapsedSeconds >= 30 ? "Stop & save" : "Reset"}
            </Button>
            <Button icon={running ? "pause" : "play"} onClick={running ? pause : start}>
              {running ? "Pause" : elapsedSeconds > 0 ? "Resume" : `Start ${mode.toLowerCase()}`}
            </Button>
          </div>

          {elapsedSeconds > 0 && elapsedSeconds < 30 && !running && (
            <p className="soft-note">Sessions under 30 seconds are not saved.</p>
          )}
        </Card>

        <div className="focus-side">
          <Card>
            <SectionTitle
              title="This week"
              subtitle={`${formatDuration(stats.weekSeconds)} focused`}
            />
            <BarChart
              data={weekHours}
              labels={WEEKDAY_INITIALS}
              unit="h"
              emptyHint="Run a session to start the week."
            />
            <div className="inline-stats">
              <span>
                <strong>{formatDurationShort(stats.dailyAverageSeconds)}</strong>daily average
              </span>
              <span>
                <strong>
                  {stats.weekChangePct === null ? "--" : `${stats.weekChangePct > 0 ? "+" : ""}${stats.weekChangePct}%`}
                </strong>
                vs last week
              </span>
            </div>
          </Card>

          <Card>
            <SectionTitle title="By subject" subtitle="This month" />
            {stats.subjects.length === 0 ? (
              <p className="soft-note">No sessions this month yet.</p>
            ) : (
              stats.subjects.slice(0, 5).map((entry, index) => (
                <div className="subject-row" key={entry.name}>
                  <span>
                    <i className={`tone-${toneForIndex[index % toneForIndex.length]}`} />
                    {entry.name}
                  </span>
                  <Progress value={entry.pct} tone={toneForIndex[index % toneForIndex.length]} />
                  <strong>{entry.pct}%</strong>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>

      <div className="focus-bottom">
        <Card>
          <SectionTitle title="Recent sessions" subtitle={`${stats.sessionCount} total`} />
          {stats.recent.length === 0 ? (
            <EmptyState
              icon="clock"
              title="No sessions yet"
              text="Start a timer above and it will be saved here automatically."
            />
          ) : (
            stats.recent.map((session) => (
              <div className="session-row" key={session.id}>
                <span className="session-tree">{session.completed === 1 ? "♧" : "·"}</span>
                <div>
                  <strong>{session.subject}</strong>
                  <small>
                    {session.date === dayKey() ? "Today" : formatRelative(session.startedAt)} ·{" "}
                    {session.type}
                  </small>
                </div>
                <b>{formatDurationShort(session.seconds)}</b>
                <button
                  className="row-action"
                  aria-label={`Delete ${session.subject} session`}
                  onClick={() => void deleteFocusSession(session.id)}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            ))
          )}
        </Card>

        <Card>
          <SectionTitle title="Study consistency" subtitle="Last 14 weeks" />
          <Heatmap cells={heatmapCells} metric="focus" compact unit="h" />
          <p className="soft-note">
            {stats.peakHour === null ? (
              "Log a few sessions and your strongest focus window will show up here."
            ) : (
              <>
                Your strongest focus window is{" "}
                <strong>
                  {String(stats.peakHour).padStart(2, "0")}:00–
                  {String((stats.peakHour + 2) % 24).padStart(2, "0")}:00
                </strong>
                .
              </>
            )}
          </p>
        </Card>
      </div>
    </div>
  )
}
