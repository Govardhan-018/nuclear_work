import { Icon } from "./Icon"

/** Dial colours, resolved to CSS variables rather than class names: a
 *  `tone-*` class would pick up the global `.tone-* { background: … !important }`
 *  rule and paint the icon as a solid block. */
const DIAL_COLOR: Record<string, string> = {
  teal: "var(--teal-dark)",
  lavender: "var(--lavender)",
  coral: "var(--coral)",
  blue: "var(--blue)",
  sand: "var(--sand)",
}

/**
 * One pillar of the day as a compact dial. Replaces the row of identical
 * horizontal bars, which gave four different measures the same visual weight
 * and no sense of a target.
 */
export function PillarRing({
  icon,
  label,
  detail,
  value,
  tone,
  muted = false,
}: {
  icon: string
  label: string
  detail: string
  /** 0-100. */
  value: number
  tone: string
  /** Nothing logged for this pillar yet. */
  muted?: boolean
}) {
  const r = 26
  const circumference = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const color = DIAL_COLOR[tone] ?? DIAL_COLOR.teal

  return (
    <div className={`pillar ${muted ? "is-muted" : ""}`}>
      <div className="pillar-dial">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle className="pillar-track" cx="32" cy="32" r={r} />
          <circle
            className="pillar-value"
            cx="32"
            cy="32"
            r={r}
            stroke={muted ? "var(--line)" : color}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct / 100)}
          />
        </svg>
        <span className="pillar-icon" style={{ color: muted ? "var(--muted)" : color }}>
          <Icon name={icon} size={17} />
        </span>
      </div>
      <strong>{detail}</strong>
      <small>{label}</small>
    </div>
  )
}
