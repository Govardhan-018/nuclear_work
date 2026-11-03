import { useEffect, useState } from "react"
import { Icon } from "../components/Icon"
import { Button } from "../components/UI"
import { BottomSheet } from "../components/Sheet"
import { formatClock, formatDuration } from "../lib/date"
import type { FocusSessionType } from "../db/types"

export type SessionView = {
  mode: "Timer" | "Stopwatch"
  type: FocusSessionType
  subject: string
  tone: string
  /** Seconds shown on the clock. */
  display: number
  /** 0-100. */
  progress: number
  elapsed: number
  targetSeconds: number
  running: boolean
  finished: boolean
}

/**
 * The immersive session screen. Deliberately a separate full-screen surface
 * rather than a state of the setup card: it keeps the running timer free of
 * the page's absolutely positioned decoration, and nothing can be tapped by
 * accident while a session is in progress.
 */
export function FocusSessionOverlay({
  view,
  onPause,
  onResume,
  onEnd,
  onDismiss,
}: {
  view: SessionView
  onPause: () => void
  onResume: () => void
  onEnd: () => void
  onDismiss: () => void
}) {
  const [confirmEnd, setConfirmEnd] = useState(false)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // A circle of r=46 in a 100-unit box; dash offset drives the sweep.
  const circumference = 2 * Math.PI * 46
  const sweep = circumference * (1 - Math.min(100, Math.max(0, view.progress)) / 100)

  if (view.finished) {
    return (
      <div className="session-overlay finished">
        <div className="session-complete">
          <span className="complete-burst" aria-hidden="true" />
          <span className="complete-mark">
            <Icon name="check" size={34} />
          </span>
          <h2>Session complete</h2>
          <p>
            {formatDuration(view.elapsed)} of {view.type.toLowerCase()} focus on{" "}
            <strong>{view.subject}</strong>.
          </p>
          <Button className="wide" onClick={onDismiss}>
            Done
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="session-overlay" role="dialog" aria-modal="true" aria-label="Focus session">
      <header className="session-head">
        <span className={`pulse-dot ${view.running ? "" : "paused"}`} aria-hidden="true" />
        <strong>
          {view.type} session{view.running ? "" : " · paused"}
        </strong>
        <button
          className="session-minimise"
          onClick={onDismiss}
          aria-label="Hide the session and keep the timer running"
        >
          <Icon name="chevronRight" size={20} />
        </button>
      </header>

      <div className="session-body">
        <div className="session-ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="session-ring-bg" cx="50" cy="50" r="46" />
            <circle
              className="session-ring-value"
              cx="50"
              cy="50"
              r="46"
              strokeDasharray={circumference}
              strokeDashoffset={sweep}
            />
          </svg>
          <div className="session-clock">
            <strong aria-live="off">{formatClock(view.display)}</strong>
            <span>{view.subject}</span>
          </div>
        </div>

        <dl className="session-facts">
          <div>
            <dt>{view.mode === "Timer" ? "Session length" : "Elapsed"}</dt>
            <dd>
              {view.mode === "Timer"
                ? `${Math.round(view.targetSeconds / 60)} minutes`
                : formatDuration(view.elapsed)}
            </dd>
          </div>
          <div>
            <dt>Focused so far</dt>
            <dd>{formatDuration(view.elapsed)}</dd>
          </div>
        </dl>
      </div>

      <footer className="session-actions">
        {view.running ? (
          <Button variant="secondary" icon="pause" className="wide" onClick={onPause}>
            Pause
          </Button>
        ) : (
          <Button icon="play" className="wide" onClick={onResume}>
            Resume
          </Button>
        )}
        <Button
          variant="danger"
          icon="close"
          onClick={() => (view.elapsed >= 30 ? setConfirmEnd(true) : onEnd())}
        >
          End session
        </Button>
      </footer>

      {confirmEnd && (
        <BottomSheet
          title="End this session?"
          onClose={() => setConfirmEnd(false)}
          footer={
            <div className="sheet-actions">
              <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
                Keep going
              </Button>
              <Button
                variant="danger"
                className="wide"
                onClick={() => {
                  setConfirmEnd(false)
                  onEnd()
                }}
              >
                End and save
              </Button>
            </div>
          }
        >
          <p className="modal-intro">
            {formatDuration(view.elapsed)} will be saved to your history
            {view.mode === "Timer" && view.display > 0
              ? `, with ${formatDuration(view.display)} left on the clock.`
              : "."}
          </p>
        </BottomSheet>
      )}
    </div>
  )
}
