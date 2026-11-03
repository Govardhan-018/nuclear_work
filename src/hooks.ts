import { useEffect, useState } from "react"

export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(`life-os:${key}`)
      return stored ? JSON.parse(stored) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    localStorage.setItem(`life-os:${key}`, JSON.stringify(value))
  }, [key, value])
  return [value, setValue] as const
}

export function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

export function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}
