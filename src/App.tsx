import { useEffect, useState } from "react"
import {
  initialBooks,
  initialFoodChecks,
  initialHabits,
  initialTasks,
  navItems,
} from "./data"
import { useLocalState } from "./hooks"
import type { PageId } from "./types"
import { MobileNav, Sidebar, Topbar } from "./components/Layout"
import { Button, Modal } from "./components/UI"
import { Icon } from "./components/Icon"
import {
  CalendarPage,
  FitnessPage,
  FocusPage,
  FoodPage,
  HabitsPage,
  InsightsPage,
  LibraryPage,
  ReadingPage,
  TasksPage,
  TodayPage,
} from "./pages/Pages"

const pageIds: PageId[] = [
  "today",
  "calendar",
  "focus",
  "reading",
  "food",
  "tasks",
  "habits",
  "fitness",
  "insights",
  "library",
]

export default function App() {
  const initialPage = pageIds.includes(location.hash.slice(1) as PageId)
    ? location.hash.slice(1) as PageId
    : "today"
  const [page, setPage] = useState<PageId>(initialPage)
  const [quickAdd, setQuickAdd] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [tasks, setTasks] = useLocalState("tasks", initialTasks)
  const [habits, setHabits] = useLocalState("habits", initialHabits)
  const [books, setBooks] = useLocalState("books", initialBooks)
  const [food, setFood] = useLocalState("food", initialFoodChecks)
  const [theme, setTheme] = useLocalState<"light" | "dark">("theme", "light")

  const navigate = (next: PageId) => {
    setPage(next)
    location.hash = next
    setMobileMenu(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  useEffect(() => {
    const onHash = () => {
      const next = location.hash.slice(1) as PageId
      if (pageIds.includes(next)) setPage(next)
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === "Escape") setSearchOpen(false)
    }
    window.addEventListener("keydown", onShortcut)
    return () => window.removeEventListener("keydown", onShortcut)
  }, [])

  const shared = {
    tasks,
    setTasks,
    habits,
    setHabits,
    books,
    setBooks,
    food,
    setFood,
    onQuickAdd: () => setQuickAdd(true),
  }
  const pages: Record<PageId, React.ReactNode> = {
    today: <TodayPage {...shared} />,
    calendar: <CalendarPage />,
    focus: <FocusPage />,
    reading: <ReadingPage {...shared} />,
    food: <FoodPage {...shared} />,
    tasks: <TasksPage {...shared} />,
    habits: <HabitsPage {...shared} />,
    fitness: <FitnessPage />,
    insights: <InsightsPage />,
    library: <LibraryPage {...shared} />,
  }

  return (
    <div className="app-shell">
      <div className={mobileMenu ? "mobile-drawer open" : "mobile-drawer"}>
        <Sidebar page={page} onNavigate={navigate} />
      </div>
      {mobileMenu && (
        <div className="drawer-scrim" onClick={() => setMobileMenu(false)} />
      )}
      <Sidebar page={page} onNavigate={navigate} />
      <main className="app-main">
        <Topbar
          onQuickAdd={() => setQuickAdd(true)}
          onMenu={() => setMobileMenu(true)}
          onSearch={() => setSearchOpen(true)}
          theme={theme}
          onToggleTheme={() =>
            setTheme((current) => (current === "light" ? "dark" : "light"))
          }
        />
        {pages[page]}
        <footer>
          <span>LIFE OS</span>
          <p>Understand your days. Improve your habits. Build a better life.</p>
        </footer>
      </main>
      <MobileNav page={page} onNavigate={navigate} />
      {quickAdd && (
        <QuickAdd onClose={() => setQuickAdd(false)} onNavigate={navigate} />
      )}
      {searchOpen && (
        <SearchPalette
          onClose={() => setSearchOpen(false)}
          onNavigate={navigate}
        />
      )}
    </div>
  )
}

function SearchPalette({
  onClose,
  onNavigate,
}: {
  onClose: () => void
  onNavigate: (page: PageId) => void
}) {
  const [query, setQuery] = useState("")
  const results = navItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <Modal title="Go anywhere" onClose={onClose}>
      <div className="command-search">
        <Icon name="search" size={18} />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pages and features…"
          aria-label="Search pages and features"
        />
        <kbd>ESC</kbd>
      </div>
      <div className="command-results">
        {results.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onNavigate(item.id as PageId)
              onClose()
            }}
          >
            <span>
              <Icon name={item.icon} />
            </span>
            <div>
              <strong>{item.label}</strong>
              <small>Open {item.label.toLowerCase()}</small>
            </div>
            <Icon name="chevronRight" size={16} />
          </button>
        ))}
        {results.length === 0 && (
          <div className="command-empty">No matching page found.</div>
        )}
      </div>
    </Modal>
  )
}

function QuickAdd({
  onClose,
  onNavigate,
}: {
  onClose: () => void
  onNavigate: (page: PageId) => void
}) {
  const actions = [
    ["Focus session", "Start a timed deep-work block", "focus", "focus"],
    ["Task", "Add something to your plan", "tasks", "tasks"],
    ["Reading", "Log pages or reading time", "book", "reading"],
    ["Meal", "Record a meal or check-in", "food", "food"],
    ["Habit", "Mark or create a habit", "habits", "habits"],
    ["Activity", "Log a run or workout", "fitness", "fitness"],
  ] as const
  return (
    <Modal title="Quick add" onClose={onClose}>
      <p className="modal-intro">What would you like to capture?</p>
      <div className="quick-grid">
        {actions.map((action) => (
          <button
            key={action[0]}
            onClick={() => {
              onNavigate(action[3])
              onClose()
            }}
          >
            <span>
              <Icon name={action[2]} />
            </span>
            <div>
              <strong>{action[0]}</strong>
              <small>{action[1]}</small>
            </div>
            <Icon name="chevronRight" size={17} />
          </button>
        ))}
      </div>
      <Button variant="secondary" className="wide" onClick={onClose}>
        Close
      </Button>
    </Modal>
  )
}
