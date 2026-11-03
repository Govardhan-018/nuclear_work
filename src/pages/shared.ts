import type { PageId } from "../types"

export type PageProps = {
  onNavigate: (page: PageId) => void
  onQuickAdd: () => void
}

export const TONE_BY_CATEGORY: Record<string, string> = {
  Study: "lavender",
  Personal: "sage",
  Health: "coral",
  Fitness: "teal",
  Work: "blue",
}

/** Maps a Strava sport type onto one of the app's icons. */
export function activityIcon(type: string): string {
  const t = type.toLowerCase()
  if (t.includes("run")) return "fitness"
  if (t.includes("ride") || t.includes("bike") || t.includes("cycl")) return "fitness"
  if (t.includes("walk") || t.includes("hike")) return "fitness"
  if (t.includes("swim")) return "drop"
  return "fitness"
}

/** "Run" -> "Run", "WeightTraining" -> "Weight Training". */
export function humanizeActivityType(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2")
}

export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 5) return "Still up"
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  if (hour < 22) return "Good evening"
  return "Good night"
}

/** Seconds per km -> "5:42 /km". */
export function formatPace(secondsPerKm: number | null): string {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) {
    return "--"
  }
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${String(seconds).padStart(2, "0")} /km`
}

export function formatDistance(metres: number): string {
  if (metres <= 0) return "0 km"
  const km = metres / 1000
  return km < 10 ? `${km.toFixed(2)} km` : `${km.toFixed(1)} km`
}

export function signed(value: number | null, suffix = "%"): string {
  if (value === null) return "--"
  return `${value > 0 ? "+" : ""}${value}${suffix}`
}
