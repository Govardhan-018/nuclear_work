import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { navItems } from "./data"
import { PAGE_IDS, type PageId } from "./types"
import { MobileNav, Sidebar, Topbar } from "./components/Layout"
import { Button, Modal } from "./components/UI"
import { Icon } from "./components/Icon"
import { MayaMark } from "./components/MayaMark"
import { initializeDatabase } from "./db/seed"
import { setSetting, useSettings } from "./db/settings"
import { useDbReady } from "./db/stats"
import {
  applyNativeTheme, hideSplash, registerBackButton, registerDeepLinks,
} from "./native"
import { isNative } from "./services/platform"
import { TodayPage } from "./pages/TodayPage"
import { CalendarPage } from "./pages/CalendarPage"
import { FocusPage } from "./pages/FocusPage"
import { ReadingPage } from "./pages/ReadingPage"
import { FoodPage } from "./pages/FoodPage"
import { TasksPage } from "./pages/TasksPage"
import { HabitsPage } from "./pages/HabitsPage"
import { FitnessPage } from "./pages/FitnessPage"
import { InsightsPage } from "./pages/InsightsPage"
import { LibraryPage } from "./pages/LibraryPage"
import { SettingsPage } from "./pages/SettingsPage"

function pageFromHash(): PageId {
  const hash = location.hash.slice(1) as PageId
  return PAGE_IDS.includes(hash) ? hash : "today"
}

export default function App() {
  const settings = useSettings()
  const ready = useDbReady()

  const [page, setPage] = useState<PageId>(pageFromHash)
  const [quickAdd, setQuickAdd] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null)
  const [booted, setBooted] = useState(false)

  /* Internal history so the Android back button can walk back through pages. */
  const history = useRef<PageId[]>([pageFromHash()])

  const navigate = useCallback((next: PageId) => {
    setPage((current) => {
      if (current !== next) history.current.push(next)
      return next
    })
    location.hash = next
    setMobileMenu(false)
    setQuickAdd(false)
    setSearchOpen(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  /* Seed or migrate on first run, then reveal the UI. */
  useEffect(() => {
    let cancelled = false
    void initializeDatabase()
      .catch((error) => {
        console.error("Database initialisation failed", error)
      })
      .finally(() => {
        if (!cancelled) {
          setBooted(true)
          void hideSplash()
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onHash = () => {
      const next = pageFromHash()
      setPage(next)
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    void applyNativeTheme(settings.theme)
  }, [settings.theme])

  /* Keyboard shortcuts, desktop and dev only but harmless on device. */
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === "Escape") {
        setSearchOpen(false)
        setQuickAdd(false)
        setMobileMenu(false)
      }
    }
    window.addEventListener("keydown", onShortcut)
    return () => window.removeEventListener("keydown", onShortcut)
  }, [])

  /* Android hardware back. */
  useEffect(
    () =>
      registerBackButton(() => {
        if (searchOpen) {
          setSearchOpen(false)
          return true
        }
        if (quickAdd) {
          setQuickAdd(false)
          return true
        }
        if (mobileMenu) {
          setMobileMenu(false)
          return true
        }
        if (history.current.length > 1) {
          history.current.pop()
          const previous = history.current[history.current.length - 1]
          setPage(previous)
          location.hash = previous
          return true
        }
        if (page !== "today") {
          setPage("today")
          location.hash = "today"
          return true
        }
        return false
      }),
    [searchOpen, quickAdd, mobileMenu, page],
  )

  /* Strava's OAuth redirect comes back as a deep link. */
  useEffect(
    () =>
      registerDeepLinks((result) => {
        setBanner({ ok: result.ok, text: result.message })
        if (result.ok) navigate("fitness")
      }),
    [navigate],
  )

  useEffect(() => {
    if (!banner) return
    const id = window.setTimeout(() => setBanner(null), 8000)
    return () => window.clearTimeout(id)
  }, [banner])

  const pageProps = useMemo(
    () => ({ onNavigate: navigate, onQuickAdd: () => setQuickAdd(true) }),
    [navigate],
  )

  const pages: Record<PageId, React.ReactNode> = {
    today: <TodayPage {...pageProps} />,
    calendar: <CalendarPage {...pageProps} />,
    focus: <FocusPage {...pageProps} />,
    reading: <ReadingPage {...pageProps} />,
    food: <FoodPage {...pageProps} />,
    tasks: <TasksPage {...pageProps} />,
    habits: <HabitsPage {...pageProps} />,
    fitness: <FitnessPage {...pageProps} />,
    insights: <InsightsPage {...pageProps} />,
    library: <LibraryPage {...pageProps} />,
    settings: <SettingsPage {...pageProps} />,
  }

  if (!booted || !ready) {
    return (
      <div className="app-boot">
        <MayaMark size={56} />
        <strong>MAYA</strong>
        <i />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className={mobileMenu ? "mobile-drawer open" : "mobile-drawer"}>
        <Sidebar page={page} onNavigate={navigate} />
      </div>
      {mobileMenu && <div className="drawer-scrim" onClick={() => setMobileMenu(false)} />}
      <Sidebar page={page} onNavigate={navigate} />

      <main className="app-main">
        <Topbar
          onQuickAdd={() => setQuickAdd(true)}
          onMenu={() => setMobileMenu(true)}
          onSearch={() => setSearchOpen(true)}
          theme={settings.theme}
          onToggleTheme={() =>
            void setSetting("theme", settings.theme === "light" ? "dark" : "light")
          }
        />

        {banner && (
          <div className={`app-banner ${banner.ok ? "ok" : "error"}`}>
            <Icon name={banner.ok ? "check" : "alert"} size={16} />
            <span>{banner.text}</span>
            <button onClick={() => setBanner(null)} aria-label="Dismiss">
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        {pages[page]}

        <footer>
          <span>MAYA</span>
          <p>Understand your days. Improve your habits. Build a better life.</p>
          {isNative() && <small>Running offline-first on this device.</small>}
        </footer>
      </main>

      <MobileNav page={page} onNavigate={navigate} onMore={() => setMobileMenu(true)} />

      {quickAdd && <QuickAdd onClose={() => setQuickAdd(false)} onNavigate={navigate} />}
      {searchOpen && (
        <SearchPalette onClose={() => setSearchOpen(false)} onNavigate={navigate} />
      )}
    </div>
  )
}

function SearchPalette({
  onClose, onNavigate,
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
          <button key={item.id} onClick={() => onNavigate(item.id as PageId)}>
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
        {results.length === 0 && <div className="command-empty">No matching page found.</div>}
      </div>
    </Modal>
  )
}

function QuickAdd({
  onClose, onNavigate,
}: {
  onClose: () => void
  onNavigate: (page: PageId) => void
}) {
  const actions: Array<[string, string, string, PageId]> = [
    ["Focus session", "Start a timed deep-work block", "focus", "focus"],
    ["Task", "Add something to your plan", "tasks", "tasks"],
    ["Reading", "Log pages or reading time", "book", "reading"],
    ["Meal", "Record a meal or check-in", "food", "food"],
    ["Habit", "Mark or create a habit", "habits", "habits"],
    ["Activity", "Log a run or workout", "fitness", "fitness"],
    ["Event", "Put something in the calendar", "calendar", "calendar"],
  ]
  return (
    <Modal title="Quick add" onClose={onClose}>
      <p className="modal-intro">What would you like to capture?</p>
      <div className="quick-grid">
        {actions.map(([title, description, icon, target]) => (
          <button key={title} onClick={() => onNavigate(target)}>
            <span>
              <Icon name={icon} />
            </span>
            <div>
              <strong>{title}</strong>
              <small>{description}</small>
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
