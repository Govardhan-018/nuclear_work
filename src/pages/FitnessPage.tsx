import { useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Progress, SectionTitle } from "../components/UI"
import { BarChart } from "../components/Visuals"
import { addManualActivity, deleteActivity } from "../db/repo"
import { useSettings } from "../db/settings"
import { useFitnessStats } from "../db/stats"
import { syncStravaActivities } from "../services/strava"
import { isOnline } from "../services/platform"
import { polylineToSvgPath } from "../lib/polyline"
import {
  dayKey, formatDuration, formatRelative, formatShortDate, formatTime,
  WEEKDAY_INITIALS,
} from "../lib/date"
import type { Activity } from "../db/types"
import { formatDistance, formatPace, humanizeActivityType, signed } from "./shared"
import type { PageProps } from "./shared"

export function FitnessPage({ onNavigate }: PageProps) {
  const settings = useSettings()
  const stats = useFitnessStats()
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Activity | null>(null)
  const [adding, setAdding] = useState(false)

  const connected = settings.stravaRefreshToken.length > 0
  const configured = settings.stravaClientId.length > 0 && settings.stravaClientSecret.length > 0

  const sync = async () => {
    if (!connected) {
      onNavigate("settings")
      return
    }
    setSyncing(true)
    setSyncError(null)
    setSyncMessage(null)
    try {
      const result = await syncStravaActivities()
      setSyncMessage(result.message)
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Sync failed.")
    } finally {
      setSyncing(false)
    }
  }

  const latest = stats.activities[0] ?? null
  const weekKm = stats.weekSeriesKm.reduce((a, b) => a + b, 0)
  const weeklyGoalKm = 25

  /* Personal records, computed from whatever has been imported or logged. */
  const records = useMemo(() => {
    const runs = stats.runs.filter((a) => a.distanceM > 0 && a.movingTimeS > 0)
    const rows: Array<{ label: string; value: string; when: string }> = []

    const longest = runs.reduce<Activity | null>(
      (best, a) => (!best || a.distanceM > best.distanceM ? a : best), null,
    )
    if (longest) {
      rows.push({
        label: "Longest run",
        value: formatDistance(longest.distanceM),
        when: formatShortDate(longest.startedAt),
      })
    }

    const fastest5k = runs
      .filter((a) => a.distanceM >= 5000)
      .reduce<Activity | null>(
        (best, a) =>
          !best || a.movingTimeS / (a.distanceM / 1000) < best.movingTimeS / (best.distanceM / 1000)
            ? a : best,
        null,
      )
    if (fastest5k) {
      rows.push({
        label: "Best 5K pace",
        value: formatPace(fastest5k.movingTimeS / (fastest5k.distanceM / 1000)),
        when: formatShortDate(fastest5k.startedAt),
      })
    }

    const biggestClimb = stats.activities.reduce<Activity | null>(
      (best, a) => (!best || a.elevationM > best.elevationM ? a : best), null,
    )
    if (biggestClimb && biggestClimb.elevationM > 0) {
      rows.push({
        label: "Most elevation",
        value: `${Math.round(biggestClimb.elevationM)} m`,
        when: formatShortDate(biggestClimb.startedAt),
      })
    }
    return rows
  }, [stats.runs, stats.activities])

  const statCards: Array<[string, string, string, string]> = [
    [
      `${stats.monthDistanceKm.toFixed(1)} km`, "This month",
      stats.distanceChangePct === null ? `${stats.monthCount} activities` : signed(stats.distanceChangePct),
      "teal",
    ],
    [formatPace(stats.avgPaceSecPerKm), "Average pace", `${stats.monthRuns.length} runs`, "blue"],
    [
      formatDuration(stats.monthMovingS), "Moving time",
      `${stats.monthCount} activit${stats.monthCount === 1 ? "y" : "ies"}`, "lavender",
    ],
    [
      `${weekKm.toFixed(1)} km`, "This week",
      `${Math.round((weekKm / weeklyGoalKm) * 100)}% of goal`, "coral",
    ],
  ]

  return (
    <div className="page fitness-page">
      <PageHeader
        eyebrow="Fitness"
        title="Move with purpose."
        description="Your training, recovery and progress in one place."
        actions={
          <>
            <Button variant="secondary" icon="plus" onClick={() => setAdding(true)}>
              Log activity
            </Button>
            <Button icon="sync" onClick={() => void sync()} disabled={syncing}>
              {syncing ? "Syncing…" : connected ? "Sync Strava" : "Connect Strava"}
            </Button>
          </>
        }
      />

      <Card className={`strava-sync ${syncing ? "syncing" : ""}`}>
        <span className="strava-mark">S</span>
        <div>
          <small>{connected ? "Connected to Strava" : configured ? "Strava not connected" : "Strava not set up"}</small>
          <strong>
            {syncing
              ? "Processing latest activities…"
              : syncError
                ? syncError
                : syncMessage
                  ? syncMessage
                  : connected
                    ? "All activities are up to date"
                    : "Connect in Settings to import your activities"}
          </strong>
          <span>
            {connected
              ? `${settings.stravaAthleteName || "Athlete"} · ${
                  settings.stravaLastSyncAt > 0
                    ? `last synced ${formatRelative(settings.stravaLastSyncAt)}`
                    : "never synced"
                } · ${stats.activities.filter((a) => a.source === "strava").length} imported`
              : !isOnline()
                ? "You are offline. Everything else still works."
                : "Add your Strava API keys under Settings → Integrations."}
          </span>
        </div>
        {!connected && (
          <Button variant="secondary" onClick={() => onNavigate("settings")}>
            Set up
          </Button>
        )}
        {connected && <i />}
      </Card>

      <div className="fitness-stats">
        {statCards.map(([value, label, note, tone]) => (
          <Card key={label}>
            <span className={`metric-icon ${tone}`}>
              <Icon name="fitness" />
            </span>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
            <Badge tone="sage">{note}</Badge>
          </Card>
        ))}
      </div>

      <div className="fitness-main">
        <Card className="activity-map">
          {latest ? (
            <>
              <SectionTitle
                title="Previous workout"
                subtitle={`${latest.name} · ${latest.date === dayKey() ? "Today" : formatShortDate(latest.startedAt)}, ${formatTime(latest.startedAt)}`}
                action={
                  <div className="workout-card-actions">
                    <Badge tone="sage">{latest.source === "strava" ? "Strava" : "Manual"}</Badge>
                    <Button variant="ghost" onClick={() => setDetail(latest)}>
                      More info
                    </Button>
                  </div>
                }
              />
              <RouteMap activity={latest} />
              <div className="run-details">
                {[
                  [formatDistance(latest.distanceM), "Distance"],
                  [formatDuration(latest.movingTimeS), "Time"],
                  [
                    latest.distanceM > 0
                      ? formatPace(latest.movingTimeS / (latest.distanceM / 1000))
                      : "--",
                    "Avg pace",
                  ],
                  [latest.averageHeartrate ? `${Math.round(latest.averageHeartrate)} bpm` : "--", "Avg heart rate"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon="fitness"
              title="No activities yet"
              text="Connect Strava in Settings, or log an activity by hand with the button above."
            />
          )}
        </Card>

        <Card>
          <SectionTitle title="Weekly distance" subtitle="Last seven days" />
          <BarChart
            data={stats.weekSeriesKm.map((v) => +v.toFixed(1))}
            labels={WEEKDAY_INITIALS}
            unit="km"
            emptyHint="No activities this week."
          />
          <div className="goal-row">
            <span>
              Weekly goal
              <strong>
                {weekKm.toFixed(1)} / {weeklyGoalKm} km
              </strong>
            </span>
            <Progress value={Math.min(100, (weekKm / weeklyGoalKm) * 100)} />
          </div>
        </Card>
      </div>

      <div className="fitness-bottom">
        <Card>
          <SectionTitle
            title="Recent activities"
            subtitle={`${stats.activities.length} total`}
          />
          {stats.activities.length === 0 ? (
            <p className="soft-note">Nothing imported or logged yet.</p>
          ) : (
            stats.activities.slice(0, 8).map((activity) => (
              <div className="fitness-row" key={activity.id}>
                <span>
                  <Icon name="fitness" />
                </span>
                <div>
                  <strong>{activity.name}</strong>
                  <small>
                    {activity.date === dayKey() ? "Today" : formatShortDate(activity.startedAt)} ·{" "}
                    {humanizeActivityType(activity.type)}
                  </small>
                </div>
                <b>{activity.distanceM > 0 ? formatDistance(activity.distanceM) : "--"}</b>
                <small>{formatDuration(activity.movingTimeS)}</small>
                <button
                  className="row-action"
                  aria-label={`Open ${activity.name}`}
                  onClick={() => setDetail(activity)}
                >
                  <Icon name="chevronRight" size={16} />
                </button>
              </div>
            ))
          )}
        </Card>

        <Card>
          <SectionTitle title="Personal records" subtitle="From your own history" />
          {records.length === 0 ? (
            <p className="soft-note">Records appear once you have a few activities.</p>
          ) : (
            records.map((record, i) => (
              <div className="record-row" key={record.label}>
                <span>{i + 1}</span>
                <div>
                  <strong>{record.label}</strong>
                  <small>{record.when}</small>
                </div>
                <b>{record.value}</b>
              </div>
            ))
          )}
          <div className="strava-card">
            <span className="strava-mark">S</span>
            <div>
              <strong>{connected ? "Strava connected" : "Strava not connected"}</strong>
              <small>
                {connected
                  ? `Syncing as ${settings.stravaAthleteName || "you"}.`
                  : "Add your API keys to import activities."}
              </small>
            </div>
            <Button variant="secondary" onClick={() => onNavigate("settings")}>
              Manage
            </Button>
          </div>
        </Card>
      </div>

      {detail && <WorkoutModal activity={detail} onClose={() => setDetail(null)} />}
      {adding && <ManualActivityModal onClose={() => setAdding(false)} />}
    </div>
  )
}

function RouteMap({ activity }: { activity: Activity }) {
  const path = activity.polyline ? polylineToSvgPath(activity.polyline, 600, 260, 28) : null

  return (
    <div className="map-placeholder">
      <svg viewBox="0 0 600 260">
        {path ? (
          <>
            <path className="route" d={path} />
            <RouteMarkers path={path} />
          </>
        ) : (
          <text x="300" y="130" textAnchor="middle" className="map-note">
            {activity.source === "strava" ? "No route recorded" : "Manual entry"}
          </text>
        )}
      </svg>
      <div className="map-badge">
        <strong>{formatDistance(activity.distanceM)}</strong>
        <span>
          {formatDuration(activity.movingTimeS)}
          {activity.distanceM > 0
            ? ` · ${formatPace(activity.movingTimeS / (activity.distanceM / 1000))}`
            : ""}
        </span>
      </div>
    </div>
  )
}

function RouteMarkers({ path }: { path: string }) {
  const segments = path.split("L")
  const first = segments[0].replace("M", "").trim().split(" ").map(Number)
  const last = segments[segments.length - 1].trim().split(" ").map(Number)
  if (!Number.isFinite(first[0]) || !Number.isFinite(last[0])) return null
  return (
    <>
      <circle cx={first[0]} cy={first[1]} r="7" />
      <circle cx={last[0]} cy={last[1]} r="7" />
    </>
  )
}

function WorkoutModal({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const pace =
    activity.distanceM > 0 ? formatPace(activity.movingTimeS / (activity.distanceM / 1000)) : "--"

  const facts: Array<[string, string]> = [
    [formatDistance(activity.distanceM), "Distance"],
    [formatDuration(activity.movingTimeS), "Moving time"],
    [formatDuration(activity.elapsedTimeS), "Elapsed time"],
    [pace, "Average pace"],
    [activity.averageSpeed > 0 ? `${(activity.averageSpeed * 3.6).toFixed(1)} km/h` : "--", "Average speed"],
    [activity.averageHeartrate ? `${Math.round(activity.averageHeartrate)} bpm` : "--", "Average heart rate"],
    [activity.maxHeartrate ? `${Math.round(activity.maxHeartrate)} bpm` : "--", "Maximum heart rate"],
    [`${Math.round(activity.elevationM)} m`, "Elevation gain"],
    [activity.calories ? `${Math.round(activity.calories)} kcal` : "--", "Energy"],
  ]

  return (
    <Modal title={activity.name} onClose={onClose}>
      <div className="workout-detail-head">
        <span className="metric-icon teal">
          <Icon name="fitness" />
        </span>
        <div>
          <strong>
            {new Date(activity.startedAt).toLocaleDateString(undefined, {
              weekday: "long", month: "long", day: "numeric",
            })}{" "}
            · {formatTime(activity.startedAt)}
          </strong>
          <small>
            {activity.source === "strava" ? "Imported from Strava" : "Logged by hand"} ·{" "}
            {humanizeActivityType(activity.type)}
          </small>
        </div>
        <Badge tone="sage">Completed</Badge>
      </div>

      {activity.polyline && <RouteMap activity={activity} />}

      <div className="workout-detail-grid">
        {facts.map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="modal-actions">
        <Button
          variant="danger"
          icon="trash"
          type="button"
          onClick={async () => {
            await deleteActivity(activity.id)
            onClose()
          }}
        >
          Remove
        </Button>
        <Button className="wide" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  )
}

const ACTIVITY_TYPES = ["Run", "Ride", "Walk", "Hike", "Swim", "WeightTraining", "Yoga", "Workout"]

function ManualActivityModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("")
  const [type, setType] = useState("Run")
  const [distance, setDistance] = useState("")
  const [duration, setDuration] = useState("")
  const [date, setDate] = useState(dayKey())
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }),
  )

  const submit = async () => {
    const minutes = Number(duration) || 0
    const km = Number(distance) || 0
    const [y, mo, d] = date.split("-").map(Number)
    const [hh, mm] = time.split(":").map(Number)
    const startedAt = new Date(y, mo - 1, d, hh || 0, mm || 0).getTime()
    const movingTimeS = Math.round(minutes * 60)
    await addManualActivity({
      name: name.trim() || humanizeActivityType(type),
      type,
      date,
      startedAt,
      distanceM: Math.round(km * 1000),
      movingTimeS,
      elapsedTimeS: movingTimeS,
      averageSpeed: movingTimeS > 0 ? (km * 1000) / movingTimeS : 0,
    })
    onClose()
  }

  return (
    <Modal title="Log an activity" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label className="field">
          <span>Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Evening run" />
        </label>
        <label className="field">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {humanizeActivityType(t)}
              </option>
            ))}
          </select>
        </label>
        <div className="field-row">
          <label className="field">
            <span>Distance (km)</span>
            <input type="number" inputMode="decimal" step="0.01" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="5.2" />
          </label>
          <label className="field">
            <span>Duration (min)</span>
            <input type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30" />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Start time</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon="plus">
            Log activity
          </Button>
        </div>
      </form>
    </Modal>
  )
}
