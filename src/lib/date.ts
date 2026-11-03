/** Date utilities. All "day keys" are local-time YYYY-MM-DD strings. */

export type DayKey = string

export function dayKey(date: Date | number = new Date()): DayKey {
  const d = typeof date === "number" ? new Date(date) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function startOfDay(date: Date | number = new Date()): Date {
  const d = typeof date === "number" ? new Date(date) : new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date | number = new Date()): Date {
  const d = startOfDay(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function addDays(date: Date | number, days: number): Date {
  const d = typeof date === "number" ? new Date(date) : new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Monday-based start of week. */
export function startOfWeek(date: Date | number = new Date()): Date {
  const d = startOfDay(date)
  const offset = (d.getDay() + 6) % 7
  return addDays(d, -offset)
}

export function startOfMonth(date: Date | number = new Date()): Date {
  const d = typeof date === "number" ? new Date(date) : new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(date: Date | number = new Date()): Date {
  const d = typeof date === "number" ? new Date(date) : new Date(date)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

/** Inclusive list of day keys between two dates. */
export function dayRange(from: Date | number, to: Date | number): DayKey[] {
  const keys: DayKey[] = []
  let cursor = startOfDay(from)
  const last = startOfDay(to)
  while (cursor <= last) {
    keys.push(dayKey(cursor))
    cursor = addDays(cursor, 1)
  }
  return keys
}

/** The last `count` day keys, ending today (inclusive). */
export function lastNDays(count: number, end: Date | number = new Date()): DayKey[] {
  return dayRange(addDays(end, -(count - 1)), end)
}

export function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b)
}

export function isToday(date: Date | number): boolean {
  return dayKey(date) === dayKey(new Date())
}

export function formatDate(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

export function formatShortDate(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function formatTime(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
}

/** 3725 -> "1h 02m". Values under a minute render as "0m". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, "0")}m`
}

/** 3725 -> "1h 2m", without zero padding, for compact spots. */
export function formatDurationShort(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** 1500 -> "25:00" */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60_000) return "just now"
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`
  return formatShortDate(timestamp)
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"]

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
