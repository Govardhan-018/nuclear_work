export type PageId =
  | "today"
  | "calendar"
  | "focus"
  | "reading"
  | "food"
  | "tasks"
  | "habits"
  | "fitness"
  | "insights"
  | "library"
  | "settings"

export const PAGE_IDS: PageId[] = [
  "today", "calendar", "focus", "reading", "food",
  "tasks", "habits", "fitness", "insights", "library", "settings",
]

export type Task = {
  id: number
  title: string
  category: string
  due: string
  priority: "Low" | "Medium" | "High"
  done: boolean
}

export type Habit = {
  id: number
  name: string
  icon: string
  streak: number
  best: number
  done: boolean
  cadence: string
}

export type Book = {
  id: number
  title: string
  author: string
  pages: number
  current: number
  status: "Reading" | "Want to read" | "Completed"
  cover: string
  accent: string
  minutes: number
}

export type FoodCheck = {
  id: string
  label: string
  value: boolean | null
}

export type Activity = {
  time: string
  title: string
  meta: string
  type: "study" | "reading" | "task" | "habit" | "food" | "fitness"
}
