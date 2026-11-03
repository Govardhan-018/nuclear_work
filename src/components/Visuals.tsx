import { useMemo, useState } from "react"
import { Card } from "./UI"

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
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 110 110">
        <circle className="ring-bg" cx="55" cy="55" r={r} />
        <circle
          className="ring-value"
          cx="55"
          cy="55"
          r={r}
          stroke={color}
          strokeDasharray={dash}
          strokeDashoffset={dash * (1 - value / 100)}
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
}: {
  data: number[]
  labels?: string[]
  color?: string
  unit?: string
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * 100},${92 - (v / Math.max(...data)) * 72}`,
    )
    .join(" ")
  return (
    <div className="line-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {[20, 44, 68, 92].map((y) => (
          <line key={y} x1="0" x2="100" y1={y} y2={y} className="grid-line" />
        ))}
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".22" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,92 ${points} 100,92`} fill="url(#area)" />
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
            cx={(i / (data.length - 1)) * 100}
            cy={92 - (v / Math.max(...data)) * 72}
            r={hovered === i ? 2 : 1.1}
            fill={color}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      {hovered !== null && (
        <div
          className="chart-tooltip"
          style={{ left: `${(hovered / (data.length - 1)) * 88 + 6}%` }}
        >
          <strong>
            {data[hovered]}
            {unit}
          </strong>
          <span>{labels?.[hovered] ?? `Point ${hovered + 1}`}</span>
        </div>
      )}
      {labels && (
        <div className="chart-labels">
          {labels.map(
            (label, i) =>
              (i % Math.ceil(labels.length / 6) === 0 ||
                i === labels.length - 1) && <span key={label}>{label}</span>,
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
  series: {
    name: string
    data: number[]
    color: string
    unit: string
  }[]
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const toPoints = (data: number[]) =>
    data
      .map(
        (value, index) =>
          `${(index / (data.length - 1)) * 100},${92 - (value / 100) * 72}`,
      )
      .join(" ")
  return (
    <div className="multi-line-chart">
      <div className="multi-chart-legend">
        {series.map((item) => (
          <span key={item.name}>
            <i style={{ background: item.color }} />
            {item.name}
            <strong>
              {item.data[item.data.length - 1]}
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
                  cx={(index / (item.data.length - 1)) * 100}
                  cy={92 - (value / 100) * 72}
                  r={hovered === index ? 1.8 : 0.9}
                  fill={item.color}
                />
              ))}
            </g>
          ))}
          {labels.map((_, index) => (
            <rect
              key={index}
              x={(index / labels.length) * 100}
              y="0"
              width={100 / labels.length}
              height="100"
              fill="transparent"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        {hovered !== null && (
          <div
            className="multi-tooltip"
            style={{
              left: `${Math.min((hovered / (labels.length - 1)) * 86 + 8, 76)}%`,
            }}
          >
            <b>{labels[hovered]}</b>
            {series.map((item) => (
              <span key={item.name}>
                <i style={{ background: item.color }} />
                {item.name}
                <strong>
                  {item.data[hovered]}
                  {item.unit}
                </strong>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="multi-x-axis">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  )
}

export function BarChart({
  data,
  labels,
  unit = "h",
}: {
  data: number[]
  labels: string[]
  unit?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...data)
  return (
    <div className="bar-chart">
      {data.map((value, i) => (
        <div
          className="bar-column"
          key={labels[i]}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        >
          <div
            className={`bar-value ${hover === i ? "hover" : ""}`}
            style={{ height: `${(value / max) * 100}%` }}
          >
            {hover === i && (
              <span>
                {value}
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

export function Heatmap({
  metric = "Study hours",
  compact = false,
}: {
  metric?: string
  compact?: boolean
}) {
  const values = useMemo(
    () =>
      Array.from({ length: compact ? 98 : 196 }, (_, i) =>
        (i * 17 + i * i * 3 + metric.length) % 11 > 7
          ? 4
          : (i * 13 + metric.length) % 5,
      ),
    [metric, compact],
  )
  return (
    <div className={`heatmap-wrap ${compact ? "compact" : ""}`}>
      {!compact && (
        <div className="heatmap-months">
          <span>Jan</span>
          <span>Mar</span>
          <span>May</span>
          <span>Jul</span>
          <span>Sep</span>
          <span>Nov</span>
        </div>
      )}
      <div className="heatmap">
        {values.map((v, i) => (
          <i
            key={i}
            className={`level-${v}`}
            title={`${metric}: ${v === 0 ? "No activity" : v}`}
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
      <Ring value={value} size={92} label={`${value}%`} color={color} />
      <div>
        <span>{label}</span>
        <strong>{detail}</strong>
      </div>
    </Card>
  )
}
