import type { PageId } from "../types"
import { navItems } from "../data"
import { Icon } from "./Icon"
import { Button } from "./UI"

export function Sidebar({
  page,
  onNavigate,
}: {
  page: PageId
  onNavigate: (page: PageId) => void
}) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onNavigate("today")}>
        <span className="brand-mark">L</span>
        <span>
          LIFE <b>OS</b>
        </span>
      </button>
      <nav>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={page === item.id ? "active" : ""}
            onClick={() => onNavigate(item.id as PageId)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {item.id === "tasks" && <em>3</em>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button>
          <Icon name="settings" />
          <span>Settings</span>
        </button>
        <button className="profile">
          <span className="avatar">AM</span>
          <span>
            <strong>Alex Morgan</strong>
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
  return (
    <div className="topbar">
      <Button
        variant="icon"
        icon="menu"
        className="mobile-menu"
        aria-label="Open navigation"
        onClick={onMenu}
      />
      <button className="mobile-wordmark" aria-label="Life OS">
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
        <button className="notification">
          <span />
        </button>
      </div>
    </div>
  )
}

export function MobileNav({
  page,
  onNavigate,
}: {
  page: PageId
  onNavigate: (p: PageId) => void
}) {
  const items = navItems.filter((i) =>
    ["today", "focus", "food", "fitness"].includes(i.id),
  )
  return (
    <nav className="mobile-nav">
      {items.map((item) => (
        <button
          key={item.id}
          className={page === item.id ? "active" : ""}
          onClick={() => onNavigate(item.id as PageId)}
        >
          <Icon name={item.icon} />
          <small>{item.label}</small>
        </button>
      ))}
    </nav>
  )
}
