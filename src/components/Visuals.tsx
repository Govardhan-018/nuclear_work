import { useMemo, useState } from "react"
import { Card } from "./UI"
import { fromDayKey, type DayKey } from "../lib/date"

/* Charts receive real data, which means they must survive empty arrays,
   single points and all-zero series without producing NaN geometry. */

function safeMax(data: number[]): number {
  const max = data.length > 0 ? Math.max(...data) : 0
  return max > 0 ? max : 1
}

/** Horizontal position of point `i`, safe when there is only one point. */
function xAt(index: number, length: number): number {
  if (length <= 1) return 50
  return (index / (length - 1)) * 100
}

export function Ring({
  value,
  size = 126,
  label,
  sublabel,
  color = "var(--teal)",
}: {
  value: number
  size?: number
  label: string
  sublabel?: string
  color?: string
}) {
  const r = 45
  const dash = 2 * Math.PI * r
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 110 110" aria-hidden="true">
        <circle className="ring-bg" cx="55" cy="55" r={r} />
        <circle
          className="ring-value"
          cx="55"
          cy="55"
          r={r}
          stroke={color}
          strokeDasharray={dash}
          strokeDashoffset={dash * (1 - clamped / 100)}
        />
      </svg>
      <div className="ring-label">
        <strong>{label}</strong>
        {sublabel && <span>{sublabel}</span>}
      </div>
    </div>
  )
}

export function LineChart({
  data,
  labels,
  color = "var(--teal)",
  unit = "",
  gradientId = "area",
}: {
  data: number[]
  labels?: string[]
  color?: string
  unit?: string
  /** Must be unique per chart on the page, or gradients bleed between them. */
  gradientId?: string
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (data.length === 0) return <ChartEmpty />

  const max = safeMax(data)
  const yAt = (value: number) => 92 - (value / max) * 72
  const points = data.map((v, i) => `${xAt(i, data.length)},${yAt(v)}`).join(" ")

  return (
    <div className="line-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {[20, 44, 68, 92].map((y) => (
          <line key={y} x1="0" x2="100" y1={y} y2={y} className="grid-line" />
        ))}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".22" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,92 ${points} 100,92`} fill={`url(#${gradientId})`} />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((v, i) => (
          <circle
            key={i}
            cx={xAt(i, data.length)}
            cy={yAt(v)}
            r={hovered === i ? 2 : 1.1}
            fill={color}
          />
        ))}
        {/* Full-height hit targets so a fingertip can select a point. */}
        {data.map((_, i) => (
          <rect
            key={`hit-${i}`}
            x={(i / data.length) * 100}
            y="0"
            width={100 / data.length}
            height="100"
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onTouchStart={() => setHovered(i)}
            onTouchEnd={() => setHovered(null)}
          />
        ))}
      </svg>
      {hovered !== null && (
        <div
          className="chart-tooltip"
          style={{ left: `${(hovered / Math.max(1, data.length - 1)) * 88 + 6}%` }}
        >
          <strong>
            {formatValue(data[hovered])}
            {unit}
          </strong>
          <span>{labels?.[hovered] ?? `Point ${hovered + 1}`}</span>
        </div>
      )}
      {labels && (
        <div className="chart-labels">
          {labels.map((label, i) =>
            i % Math.ceil(labels.length / 6) === 0 || i === labels.length - 1 ? (
              <span key={`${label}-${i}`}>{label}</span>
            ) : null,
          )}
        </div>
      )}
    </div>
  )
}

export function MultiLineChart({
  labels,
  series,
}: {
  labels: string[]
  series: { name: string; data: number[]; color: string; unit: string }[]
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (labels.length === 0 || series.length === 0) return <ChartEmpty />

  const toPoints = (data: number[]) =>
    data.map((value, index) => `${xAt(index, data.length)},${92 - (clamp01(value) / 100) * 72}`).join(" ")

  return (
    <div className="multi-line-chart">
      <div className="multi-chart-legend">
        {series.map((item) => (
          <span key={item.name}>
            <i style={{ background: item.color }} />
            {item.name}
            <strong>
              {formatValue(item.data[item.data.length - 1] ?? 0)}
              {item.unit}
            </strong>
          </span>
        ))}
      </div>
      <div className="multi-chart-canvas">
        <div className="multi-y-axis">
          <span>100</span>
          <span>75</span>
          <span>50</span>
          <span>25</span>
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {[20, 38, 56, 74, 92].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} className="grid-line" />
          ))}
          {series.map((item) => (
            <g key={item.name}>
              <polyline
                points={toPoints(item.data)}
                fill="none"
                stroke={item.color}
                strokeWidth="2.2"
                vectorEffect="non-scaling-stroke"
              />
              {item.data.map((value, index) => (
                <circle
                  key={index}
                  cx={xAt(index, item.data.length)}
                  cy={92 - (clamp01(value) / 100) * 72}
                  r={hovered === index ? 1.8 : 0.9}
                  fill={item.color}
                />
              ))}
            </g>
          ))}
          {labels.map((label, index) => (
            <rect
              key={`${label}-${index}`}
              x={(index / labels.length) * 100}
              y="0"
              width={100 / labels.length}
              height="100"
              fill="transparent"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={() => setHovered(index)}
              onTouchEnd={() => setHovered(null)}
            />
          ))}
        </svg>
        {hovered !== null && (
          <div
            className="multi-tooltip"
            style={{
              left: `${Math.min((hovered / Math.max(1, labels.length - 1)) * 86 + 8, 76)}%`,
            }}
          >
            <b>{labels[hovered]}</b>
            {series.map((item) => (
              <span key={item.name}>
                <i style={{ background: item.color }} />
                {item.name}
                <strong>
                  {formatValue(item.data[hovered] ?? 0)}
                  {item.unit}
                </strong>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="multi-x-axis">
        {labels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
    </div>
  )
}

export function BarChart({
  data,
  labels,
  unit = "h",
  emptyHint,
}: {
  data: number[]
  labels: string[]
  unit?: string
  emptyHint?: string
}) {
  const [hover, setHover] = useState<number | null>(null)

  if (data.length === 0) return <ChartEmpty hint={emptyHint} />

  const max = safeMax(data)
  const allZero = data.every((v) => v === 0)

  return (
    <div className="bar-chart">
      {data.map((value, i) => (
        <div
          // Weekday initials repeat ("T", "S"), so the index has to be part of
          // the key or React collapses the duplicate columns.
          key={`${labels[i] ?? ""}-${i}`}
          className="bar-column"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          onTouchStart={() => setHover(i)}
          onTouchEnd={() => setHover(null)}
        >
          <div
            className={`bar-value ${hover === i ? "hover" : ""} ${value === 0 ? "zero" : ""}`}
            style={{ height: allZero ? "2%" : `${Math.max((value / max) * 100, value > 0 ? 4 : 1.5)}%` }}
          >
            {hover === i && (
              <span>
                {formatValue(value)}
                {unit}
              </span>
            )}
          </div>
          <small>{labels[i]}</small>
        </div>
      ))}
    </div>
  )
}

export type HeatmapCell = { date: DayKey; value: number }

/**
 * Contribution-style grid. `cells` must already be in chronological order;
 * values are normalised against the largest value present, so the scale
 * adapts to whatever the user actually does.
 */
export function Heatmap({
  cells,
  metric = "activity",
  compact = false,
  unit = "",
}: {
  cells: HeatmapCell[]
  metric?: string
  compact?: boolean
  unit?: string
}) {
  const { levels, monthLabels } = useMemo(() => {
    const max = safeMax(cells.map((c) => c.value))
    const computed = cells.map((cell) => {
      if (cell.value <= 0) return 0
      const ratio = cell.value / max
      if (ratio > 0.75) return 4
      if (ratio > 0.5) return 3
      if (ratio > 0.25) return 2
      return 1
    })

    // One label per month boundary found in the window.
    const seen = new Set<string>()
    const labels: string[] = []
    for (const cell of cells) {
      const month = cell.date.slice(0, 7)
      if (seen.has(month)) continue
      seen.add(month)
      labels.push(
        fromDayKey(cell.date).toLocaleDateString(undefined, { month: "short" }),
      )
    }
    return { levels: computed, monthLabels: labels }
  }, [cells])

  if (cells.length === 0) {
    return <ChartEmpty hint={`No ${metric} logged yet.`} />
  }

  return (
    <div className={`heatmap-wrap ${compact ? "compact" : ""}`}>
      {!compact && monthLabels.length > 1 && (
        <div className="heatmap-months">
          {monthLabels.map((label, i) => (
            <span key={`${label}-${i}`}>{label}</span>
          ))}
        </div>
      )}
      <div className="heatmap">
        {cells.map((cell, i) => (
          <i
            key={cell.date}
            className={`level-${levels[i]}`}
            title={`${cell.date} — ${cell.value > 0 ? `${formatValue(cell.value)}${unit}` : `no ${metric}`}`}
          />
        ))}
      </div>
      {!compact && (
        <div className="heatmap-legend">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((v) => (
            <i key={v} className={`level-${v}`} />
          ))}
          <span>More</span>
        </div>
      )}
    </div>
  )
}

export function Donut({
  value,
  label,
  detail,
  color = "var(--teal)",
}: {
  value: number
  label: string
  detail: string
  color?: string
}) {
  return (
    <Card className="donut-card">
      <Ring value={value} size={92} label={`${Math.round(value)}%`} color={color} />
      <div>
        <span>{label}</span>
        <strong>{detail}</strong>
      </div>
    </Card>
  )
}

function ChartEmpty({ hint }: { hint?: string }) {
  return <div className="chart-empty">{hint ?? "Not enough data yet."}</div>
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

/** Keeps axis labels short: 2 decimals at most, no trailing zeros. */
function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "0"
  if (Number.isInteger(value)) return String(value)
  return String(Math.round(value * 10) / 10)
}
