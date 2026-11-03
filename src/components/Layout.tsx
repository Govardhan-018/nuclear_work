import { useEffect, useState } from "react"
import type { PageId } from "../types"
import { navItems } from "../data"
import { useSettings } from "../db/settings"
import { useTaskStats } from "../db/stats"
import { Icon } from "./Icon"
import { Button } from "./UI"

export function Sidebar({
  page,
  onNavigate,
}: {
  page: PageId
  onNavigate: (page: PageId) => void
}) {
  const settings = useSettings()
  const tasks = useTaskStats()
  const name = settings.profileName.trim()
  const initials = name
    ? name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")
    : "LO"

  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onNavigate("today")}>
        <span className="brand-mark">L</span>
        <span>
          LIFE <b>OS</b>
        </span>
      </button>
      <nav>
        {navItems
          .filter((item) => item.id !== "settings")
          .map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => onNavigate(item.id as PageId)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === "tasks" && tasks.open.length > 0 && <em>{tasks.open.length}</em>}
            </button>
          ))}
      </nav>
      <div className="sidebar-bottom">
        <button
          className={page === "settings" ? "active" : ""}
          onClick={() => onNavigate("settings")}
        >
          <Icon name="settings" />
          <span>Settings</span>
        </button>
        <button className="profile" onClick={() => onNavigate("settings")}>
          <span className="avatar">{initials}</span>
          <span>
            <strong>{name || "Set your name"}</strong>
            <small>Personal workspace</small>
          </span>
          <Icon name="more" />
        </button>
      </div>
    </aside>
  )
}

export function Topbar({
  onQuickAdd,
  onMenu,
  onSearch,
  theme,
  onToggleTheme,
}: {
  onQuickAdd: () => void
  onMenu: () => void
  onSearch: () => void
  theme: "light" | "dark"
  onToggleTheme: () => void
}) {
  // The sticky bar only grows a hairline once content passes beneath it.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className={`topbar ${scrolled ? "scrolled" : ""}`}>
      <Button
        variant="icon"
        icon="menu"
        className="mobile-menu"
        aria-label="Open navigation"
        onClick={onMenu}
      />
      <button className="mobile-wordmark" aria-label="Life OS" onClick={onSearch}>
        <span>L</span>
        <strong>LIFE OS</strong>
      </button>
      <button className="search" onClick={onSearch} aria-label="Search Life OS">
        <Icon name="search" size={18} />
        <span>Search your life...</span>
        <kbd>⌘ K</kbd>
      </button>
      <div className="top-actions">
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          <span className="theme-toggle-track">
            <i>
              <Icon name={theme === "light" ? "sun" : "moon"} size={15} />
            </i>
          </span>
        </button>
        <Button variant="secondary" icon="plus" onClick={onQuickAdd}>
          Quick add
        </Button>
      </div>
    </div>
  )
}

/** Bottom tab bar. The fifth slot opens the drawer so every page is reachable. */
export function MobileNav({
  page,
  onNavigate,
  onMore,
}: {
  page: PageId
  onNavigate: (p: PageId) => void
  onMore: () => void
}) {
  const primary: PageId[] = ["today", "focus", "food", "fitness"]
  const items = primary
    .map((id) => navItems.find((item) => item.id === id))
    .filter((item): item is (typeof navItems)[number] => item !== undefined)

  const moreActive = !primary.includes(page)

  return (
    <nav className="mobile-nav">
      {items.map((item) => (
        <button
          key={item.id}
          className={page === item.id ? "active" : ""}
          onClick={() => onNavigate(item.id as PageId)}
          aria-current={page === item.id ? "page" : undefined}
          aria-label={item.label}
        >
          <Icon name={item.icon} size={21} />
          <small>{item.short}</small>
        </button>
      ))}
      <button className={moreActive ? "active" : ""} onClick={onMore} aria-label="More pages">
        <Icon name="menu" size={21} />
        <small>More</small>
      </button>
    </nav>
  )
}
