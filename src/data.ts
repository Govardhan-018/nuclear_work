import type { Activity, Book, FoodCheck, Habit, Task } from "./types"

export const initialTasks: Task[] = [
  {
    id: 1,
    title: "Review cognitive science notes",
    category: "Study",
    due: "Today, 10:30",
    priority: "High",
    done: true,
  },
  {
    id: 2,
    title: "Outline weekly reflection",
    category: "Personal",
    due: "Today, 16:00",
    priority: "Medium",
    done: false,
  },
  {
    id: 3,
    title: "Book dentist appointment",
    category: "Health",
    due: "Tomorrow",
    priority: "Low",
    done: false,
  },
  {
    id: 4,
    title: "Finish statistics problem set",
    category: "Study",
    due: "Fri, 18:00",
    priority: "High",
    done: false,
  },
  {
    id: 5,
    title: "Plan Sunday long run",
    category: "Fitness",
    due: "Sat",
    priority: "Medium",
    done: true,
  },
]

export const initialHabits: Habit[] = [
  {
    id: 1,
    name: "Morning meditation",
    icon: "sun",
    streak: 18,
    best: 24,
    done: true,
    cadence: "Daily",
  },
  {
    id: 2,
    name: "Read 20 pages",
    icon: "book",
    streak: 12,
    best: 31,
    done: false,
    cadence: "Daily",
  },
  {
    id: 3,
    name: "Drink 2L water",
    icon: "drop",
    streak: 8,
    best: 15,
    done: true,
    cadence: "Daily",
  },
  {
    id: 4,
    name: "Strength training",
    icon: "fitness",
    streak: 3,
    best: 9,
    done: false,
    cadence: "3× weekly",
  },
]

export const initialBooks: Book[] = [
  {
    id: 1,
    title: "Four Thousand Weeks",
    author: "Oliver Burkeman",
    pages: 288,
    current: 176,
    status: "Reading",
    cover: "4,000",
    accent: "sage",
    minutes: 410,
  },
  {
    id: 2,
    title: "The Creative Act",
    author: "Rick Rubin",
    pages: 432,
    current: 92,
    status: "Reading",
    cover: "THE CREATIVE ACT",
    accent: "sand",
    minutes: 185,
  },
  {
    id: 3,
    title: "Braiding Sweetgrass",
    author: "Robin Wall Kimmerer",
    pages: 408,
    current: 0,
    status: "Want to read",
    cover: "BRAIDING SWEETGRASS",
    accent: "forest",
    minutes: 0,
  },
  {
    id: 4,
    title: "Atomic Habits",
    author: "James Clear",
    pages: 320,
    current: 320,
    status: "Completed",
    cover: "ATOMIC HABITS",
    accent: "cream",
    minutes: 620,
  },
]

export const initialFoodChecks: FoodCheck[] = [
  { id: "fruit", label: "Included fruit or vegetables?", value: true },
  { id: "water", label: "Drank enough water?", value: null },
  { id: "ontime", label: "Ate at comfortable times?", value: true },
  { id: "junk", label: "Had highly processed food?", value: false },
]

export const todayActivities: Activity[] = [
  {
    time: "07:30",
    title: "Morning meditation",
    meta: "15 min · habit",
    type: "habit",
  },
  {
    time: "09:00",
    title: "Deep work · Neuroscience",
    meta: "1 hr 25 min · focus",
    type: "study",
  },
  {
    time: "12:20",
    title: "Lunch · grain bowl",
    meta: "Balanced meal · food",
    type: "food",
  },
  {
    time: "15:30",
    title: "Four Thousand Weeks",
    meta: "24 pages · reading",
    type: "reading",
  },
  {
    time: "18:00",
    title: "Easy run",
    meta: "5.2 km · fitness",
    type: "fitness",
  },
]

export const navItems = [
  { id: "today", label: "Today", icon: "today" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "focus", label: "Focus & Study", icon: "focus" },
  { id: "reading", label: "Reading", icon: "book" },
  { id: "food", label: "Food Tracker", icon: "food" },
  { id: "tasks", label: "Tasks", icon: "tasks" },
  { id: "habits", label: "Habits", icon: "habits" },
  { id: "fitness", label: "Fitness", icon: "fitness" },
  { id: "insights", label: "Insights", icon: "insights" },
  { id: "library", label: "Library", icon: "library" },
] as const

export const chartData = [42, 48, 46, 58, 64, 61, 72, 68, 77, 83, 79, 88]
export const weeklyBars = [65, 82, 48, 93, 72, 88, 54]
export const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]
