import { BottomSheet } from "./Sheet"
import { Icon } from "./Icon"
import { navItems } from "../data"
import { useSettings } from "../db/settings"
import { useTaskStats } from "../db/stats"
import type { PageId } from "../types"

/**
 * Everything the bottom bar has no room for, as a grid.
 *
 * This replaces the left-hand drawer: the bar already has a More tab, and two
 * ways into the same navigation was one too many. A sheet also rises from the
 * control that opened it, which a side drawer never did.
 */
export function MoreSheet({
  page,
  primary,
  onNavigate,
  onClose,
}: {
  page: PageId
  /** Destinations already on the bar, so they are not repeated here. */
  primary: PageId[]
  onNavigate: (page: PageId) => void
  onClose: () => void
}) {
  const settings = useSettings()
  const tasks = useTaskStats()
  const name = settings.profileName.trim()

  const rest = navItems.filter(
    (item) => !primary.includes(item.id as PageId) && item.id !== "settings",
  )

  return (
    <BottomSheet
      title="Everything else"
      subtitle={name ? `Signed in as ${name}` : "Your whole workspace"}
      onClose={onClose}
      className="more-sheet"
      footer={
        <button
          className={`more-settings ${page === "settings" ? "active" : ""}`}
          onClick={() => onNavigate("settings")}
        >
          <span className="more-settings-icon">
            <Icon name="settings" size={20} />
          </span>
          <span>
            <strong>Settings</strong>
            <small>Integrations, targets, notifications and your data</small>
          </span>
          <Icon name="chevronRight" size={17} />
        </button>
      }
    >
      <div className="more-grid">
        {rest.map((item) => {
          const active = page === item.id
          const badge = item.id === "tasks" && tasks.open.length > 0 ? tasks.open.length : null
          return (
            <button
              key={item.id}
              className={`more-tile ${active ? "active" : ""}`}
              onClick={() => onNavigate(item.id as PageId)}
              aria-current={active ? "page" : undefined}
            >
              <span className="more-tile-icon">
                <Icon name={item.icon} size={22} />
                {badge !== null && <em>{badge}</em>}
              </span>
              <strong>{item.label}</strong>
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}
