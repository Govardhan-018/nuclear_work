import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "../components/Icon"
import { Badge, Button, Card, EmptyState, PageHeader, Progress, SectionTitle, Segmented } from "../components/UI"
import { BarChart, Heatmap } from "../components/Visuals"
import { Select, type SelectOption } from "../components/Select"
import { addFocusSession, deleteFocusSession, ensureDefaultSubjects } from "../db/repo"
import { setSetting, useSettings } from "../db/settings"
import { useFocusStats, useSubjects } from "../db/stats"
import {
  dayKey, formatClock, formatDuration, formatDurationShort, formatRelative,
  lastNDays, WEEKDAY_INITIALS,
} from "../lib/date"
import type { ActiveFocusSession, FocusSessionType } from "../db/types"
import { SubjectManager } from "./SubjectManager"
import { FocusSessionOverlay, type SessionView } from "./FocusSession"
import type { PageProps } from "./shared"

const PRESET_MINUTES = [15, 25, 45, 60, 90]
/** Sessions shorter than this are treated as a mis-tap and not recorded. */
const MIN_SAVED_SECONDS = 30

export function FocusPage(_props: PageProps) {
  const settings = useSettings()
  const stats = useFocusStats()

  const [mode, setMode] = useState<"Timer" | "Stopwatch">("Timer")
  const [sessionType, setSessionType] = useState<FocusSessionType>("Academic")
  const [targetMinutes, setTargetMinutes] = useState(25)
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const [managingSubjects, setManagingSubjects] = useState(false)

  /* Timestamp-driven so backgrounding the phone cannot lose or gain time. */
  const [runningSince, setRunningSince] = useState<number | null>(null)
  const [accumulatedMs, setAccumulatedMs] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [finished, setFinished] = useState(false)
  const [, tick] = useState(0)
  const saving = useRef(false)
  const hydrated = useRef(false)

  const subjects = useSubjects(sessionType)
  const active = runningSince !== null || accumulatedMs > 0

  useEffect(() => {
    void ensureDefaultSubjects()
  }, [])

  /* Restore a session left running when the page was last unmounted. */
  useEffect(() => {
    if (hydrated.current) return
    const stored = settings.activeFocusSession
    if (!stored) return
    hydrated.current = true
    setMode(stored.mode)
    setSessionType(stored.type)
    setTargetMinutes(stored.targetMinutes)
    setSubjectId(stored.subjectId)
    setStartedAt(stored.startedAt)
    setAccumulatedMs(stored.accumulatedMs)
    setRunningSince(stored.runningSince)
  }, [settings.activeFocusSession])

  /** Writes the live session, or clears it. Called only on transitions. */
  const persist = useCallback(
    (next: ActiveFocusSession | null) => {
      hydrated.current = true
      void setSetting("activeFocusSession", next)
    },
    [],
  )

  /* Keep a valid selection as the list or the mode changes. */
  useEffect(() => {
    if (subjects.length === 0) {
      setSubjectId(null)
      return
    }
    if (!subjects.some((subject) => subject.id === subjectId)) {
      setSubjectId(subjects[0].id)
    }
  }, [subjects, subjectId])

  const subject = subjects.find((candidate) => candidate.id === subjectId) ?? null

  /* One interval while running; nothing is scheduled when idle. */
  useEffect(() => {
    if (runningSince === null) return
    const id = window.setInterval(() => tick((n) => n + 1), 250)
    return () => window.clearInterval(id)
  }, [runningSince])

  /* Recompute the moment the app returns to the foreground. */
  useEffect(() => {
    const onVisible = () => tick((n) => n + 1)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [])

  const elapsedMs = accumulatedMs + (runningSince !== null ? Date.now() - runningSince : 0)
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  const targetSeconds = targetMinutes * 60
  const remaining = Math.max(0, targetSeconds - elapsedSeconds)

  const save = useCallback(
    async (seconds: number, completed: boolean) => {
      if (seconds < MIN_SAVED_SECONDS || saving.current) return
      saving.current = true
      try {
        await addFocusSession({
          subjectId: subject?.id ?? null,
          subject: subject?.name ?? "Focus",
          type: sessionType,
          mode,
          seconds,
          startedAt: startedAt ?? Date.now() - seconds * 1000,
          endedAt: Date.now(),
          completed: completed ? 1 : 0,
        })
      } finally {
        saving.current = false
      }
    },
    [subject, sessionType, mode, startedAt],
  )

  const reset = useCallback(() => {
    setRunningSince(null)
    setAccumulatedMs(0)
    setStartedAt(null)
    setOverlayOpen(false)
    setFinished(false)
    persist(null)
  }, [persist])

  /* A countdown that reaches zero saves itself and shows the completion state. */
  useEffect(() => {
    if (mode !== "Timer" || runningSince === null || remaining > 0 || finished) return
    setRunningSince(null)
    setAccumulatedMs(targetSeconds * 1000)
    setFinished(true)
    setOverlayOpen(true)
    persist(null)
    void save(targetSeconds, true)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([130, 70, 130])
    }
  }, [mode, runningSince, remaining, targetSeconds, finished, save, persist])

  const snapshot = useCallback(
    (overrides: Partial<ActiveFocusSession>): ActiveFocusSession => ({
      subjectId: subject?.id ?? null,
      subjectName: subject?.name ?? "Focus",
      type: sessionType,
      mode,
      targetMinutes,
      startedAt: startedAt ?? Date.now(),
      accumulatedMs,
      runningSince,
      ...overrides,
    }),
    [subject, sessionType, mode, targetMinutes, startedAt, accumulatedMs, runningSince],
  )

  const start = () => {
    if (!subject) {
      setManagingSubjects(true)
      return
    }
    const now = Date.now()
    const begin = startedAt ?? now
    setFinished(false)
    setStartedAt(begin)
    setRunningSince(now)
    setOverlayOpen(true)
    persist(snapshot({ startedAt: begin, runningSince: now }))
  }

  const pause = () => {
    if (runningSince === null) return
    const banked = accumulatedMs + (Date.now() - runningSince)
    setAccumulatedMs(banked)
    setRunningSince(null)
    persist(snapshot({ accumulatedMs: banked, runningSince: null }))
  }

  const resume = () => {
    const now = Date.now()
    setRunningSince(now)
    persist(snapshot({ runningSince: now }))
  }

  const endSession = async () => {
    const seconds = Math.floor(
      (accumulatedMs + (runningSince !== null ? Date.now() - runningSince : 0)) / 1000,
    )
    setRunningSince(null)
    await save(seconds, false)
    reset()
  }

  /* ---------------------------------------------------------- analytics */

  const dailyTargetSeconds = settings.focusDailyTargetMinutes * 60
  const targetPct =
    dailyTargetSeconds > 0 ? Math.min(100, (stats.todaySeconds / dailyTargetSeconds) * 100) : 0
  const weekHours = stats.weekSeries.map((seconds) => +(seconds / 3600).toFixed(1))
  const heatmapCells = lastNDays(98).map((date) => ({
    date,
    value: (stats.byDay[date] ?? 0) / 3600,
  }))

  const subjectOptions: SelectOption[] = subjects.map((entry) => ({
    value: entry.id,
    label: entry.name,
    tone: entry.tone,
  }))

  const progress =
    mode === "Timer"
      ? targetSeconds > 0 ? Math.min(100, (elapsedSeconds / targetSeconds) * 100) : 0
      : Math.min(100, ((elapsedSeconds % 3600) / 3600) * 100)

  const view: SessionView = {
    mode,
    type: sessionType,
    subject: subject?.name ?? "Focus",
    tone: subject?.tone ?? "teal",
    display: mode === "Timer" ? remaining : elapsedSeconds,
    progress,
    elapsed: elapsedSeconds,
    targetSeconds,
    running: runningSince !== null,
    finished,
  }

  const toneClasses = ["teal", "blue", "coral", "lavender", "sand"]

  return (
    <div className="page focus-page">
      <PageHeader
        eyebrow="Focus & study"
        title="Grow your focus."
        description="Small, undistracted sessions compound into deep learning."
      />

      <Card className="target-card">
        <div>
          <span>Daily target</span>
          <strong>
            {formatDurationShort(stats.todaySeconds)} of{" "}
            {formatDurationShort(dailyTargetSeconds)}
          </strong>
        </div>
        <Progress value={targetPct} />
        <small>
          {targetPct >= 100
            ? "Target met for today."
            : `${Math.round(targetPct)}% of today's goal`}
        </small>
      </Card>

      <div className="study-mode-controls">
        <Segmented
          items={["Timer", "Stopwatch"] as const}
          value={mode}
          onChange={(next) => {
            if (active) return
            setMode(next)
          }}
        />
        <Segmented
          items={["Academic", "Reading"] as const}
          value={sessionType}
          onChange={(next) => {
            if (active) return
            setSessionType(next)
          }}
        />
      </div>
      {active && !overlayOpen && (
        <button className="resume-banner" onClick={() => setOverlayOpen(true)}>
          <span className={`pulse-dot ${runningSince !== null ? "" : "paused"}`} />
          <span>
            <strong>
              {runningSince !== null ? "Session running" : "Session paused"} ·{" "}
              {formatClock(view.display)}
            </strong>
            <small>{subject?.name ?? "Focus"}</small>
          </span>
          <Icon name="chevronRight" size={18} />
        </button>
      )}

      <Card className="setup-card">
        <div className="setup-row">
          <div className="field">
            <span>{sessionType === "Reading" ? "Reading category" : "Subject"}</span>
            <Select
              value={subjectId}
              options={subjectOptions}
              onChange={setSubjectId}
              placeholder={subjects.length === 0 ? "Create one first" : "Choose…"}
              sheetTitle={sessionType === "Reading" ? "Reading category" : "Study subject"}
              disabled={active}
              footer={
                <Button
                  variant="secondary"
                  icon="settings"
                  className="wide"
                  onClick={() => setManagingSubjects(true)}
                >
                  Manage {sessionType === "Reading" ? "categories" : "subjects"}
                </Button>
              }
            />
          </div>
          <Button
            variant="icon"
            icon="plus"
            aria-label={`Manage ${sessionType === "Reading" ? "categories" : "subjects"}`}
            onClick={() => setManagingSubjects(true)}
          />
        </div>

        {mode === "Timer" && (
          <div className="field">
            <span>Session length</span>
            <div className="duration-picker">
              {PRESET_MINUTES.map((minutes) => (
                <button
                  key={minutes}
                  className={targetMinutes === minutes ? "active" : ""}
                  disabled={active}
                  onClick={() => setTargetMinutes(minutes)}
                >
                  {minutes}m
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="setup-preview">
          <span className="setup-clock">
            {mode === "Timer" ? formatClock(targetSeconds) : "00:00"}
          </span>
          <small>
            {subjects.length === 0
              ? `Create a ${sessionType === "Reading" ? "category" : "subject"} to begin`
              : mode === "Timer"
                ? `${targetMinutes} minute ${sessionType.toLowerCase()} block`
                : `Open-ended ${sessionType.toLowerCase()} session`}
          </small>
        </div>

        <Button
          icon="play"
          className="wide start-button"
          onClick={active ? () => setOverlayOpen(true) : start}
        >
          {active ? "Return to session" : `Start ${sessionType.toLowerCase()} session`}
        </Button>
      </Card>

      <div className="focus-bottom">
        <Card>
          <SectionTitle title="This week" subtitle={`${formatDuration(stats.weekSeconds)} focused`} />
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
                {stats.weekChangePct === null
                  ? "--"
                  : `${stats.weekChangePct > 0 ? "+" : ""}${stats.weekChangePct}%`}
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
              <div className="subject-row-stat" key={entry.name}>
                <span>
                  <i className={`tone-${toneClasses[index % toneClasses.length]}`} />
                  {entry.name}
                </span>
                <Progress value={entry.pct} tone={toneClasses[index % toneClasses.length]} />
                <strong>{entry.pct}%</strong>
              </div>
            ))
          )}
        </Card>
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
                  <Icon name="trash" size={16} />
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

      {managingSubjects && (
        <SubjectManager
          kind={sessionType}
          onClose={() => setManagingSubjects(false)}
          onCreated={(id) => setSubjectId(id)}
        />
      )}

      {overlayOpen && (
        <FocusSessionOverlay
          view={view}
          onPause={pause}
          onResume={resume}
          onEnd={() => void endSession()}
          onDismiss={() => (finished ? reset() : setOverlayOpen(false))}
        />
      )}
    </div>
  )
}
