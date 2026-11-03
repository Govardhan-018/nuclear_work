/**
 * Navigation metadata. `short` is what the bottom tab bar renders: five full
 * labels do not fit across a phone, and truncating them ("Focus & St…") reads
 * worse than a shorter word.
 */
export const navItems = [
  { id: "today", label: "Today", short: "Today", icon: "today" },
  { id: "calendar", label: "Calendar", short: "Calendar", icon: "calendar" },
  { id: "focus", label: "Focus & Study", short: "Focus", icon: "focus" },
  { id: "reading", label: "Reading", short: "Reading", icon: "book" },
  { id: "food", label: "Food Tracker", short: "Food", icon: "food" },
  { id: "tasks", label: "Tasks", short: "Tasks", icon: "tasks" },
  { id: "habits", label: "Habits", short: "Habits", icon: "habits" },
  { id: "fitness", label: "Fitness", short: "Fitness", icon: "fitness" },
  { id: "insights", label: "Insights", short: "Insights", icon: "insights" },
  { id: "library", label: "Library", short: "Library", icon: "library" },
  { id: "settings", label: "Settings", short: "Settings", icon: "settings" },
] as const
