import { useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { Badge, Button, Card, EmptyState, PageHeader, Progress, SectionTitle } from "../components/UI"
import { useFocusStats, useHabitStats, useReadingStats, useTaskStats, sumBy, useActivities } from "../db/stats"
import { formatDuration, formatRelative } from "../lib/date"
import { humanizeActivityType } from "./shared"
import type { PageProps } from "./shared"
import type { PageId } from "../types"

type Filter = "All" | "Books" | "Subjects" | "Habits" | "Activities"
const FILTERS: Filter[] = ["All", "Books", "Subjects", "Habits", "Activities"]

export function LibraryPage({ onNavigate }: PageProps) {
  const [filter, setFilter] = useState<Filter>("All")
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)

  const reading = useReadingStats()
  const focus = useFocusStats()
  const habits = useHabitStats()
  const tasks = useTaskStats()
  const activities = useActivities()

  const collections: Array<{
    type: Filter
    title: string
    count: string
    icon: string
    tone: string
    page: PageId
  }> = [
    {
      type: "Books", title: "Reading library",
      count: `${reading.books.length} book${reading.books.length === 1 ? "" : "s"} · ${reading.completed.length} finished`,
      icon: "book", tone: "sage", page: "reading",
    },
    {
      type: "Subjects", title: "Study subjects",
      count: `${focus.subjects.length} subject${focus.subjects.length === 1 ? "" : "s"} · ${formatDuration(focus.totalSeconds)}`,
      icon: "focus", tone: "blue", page: "focus",
    },
    {
      type: "Habits", title: "Habits in progress",
      count: `${habits.total} active · ${habits.longestStreak} day best streak`,
      icon: "habits", tone: "lavender", page: "habits",
    },
    {
      type: "Activities", title: "Training history",
      count: `${activities.length} activit${activities.length === 1 ? "y" : "ies"} · ${(sumBy(activities, (a) => a.distanceM) / 1000).toFixed(0)} km`,
      icon: "fitness", tone: "coral", page: "fitness",
    },
  ]

  /* Everything in one searchable list. */
  const items = useMemo(() => {
    const rows: Array<{
      id: string
      name: string
      kind: Filter
      meta: string
      icon: string
      page: PageId
      progress?: number
    }> = []

    for (const book of reading.books) {
      rows.push({
        id: `book-${book.id}`, name: book.title, kind: "Books",
        meta: `${book.author} · ${book.status}`,
        icon: "book", page: "reading",
        progress: book.pages > 0 ? (book.currentPage / book.pages) * 100 : 0,
      })
    }
    for (const subject of focus.subjects) {
      rows.push({
        id: `subject-${subject.name}`, name: subject.name, kind: "Subjects",
        meta: `${formatDuration(subject.seconds)} this month`,
        icon: "focus", page: "focus", progress: subject.pct,
      })
    }
    for (const entry of habits.enriched) {
      rows.push({
        id: `habit-${entry.habit.id}`, name: entry.habit.name, kind: "Habits",
        meta: `${entry.streak} day streak · ${entry.consistency30}% over 30 days`,
        icon: entry.habit.icon, page: "habits", progress: entry.consistency30,
      })
    }
    for (const activity of activities.slice(0, 40)) {
      rows.push({
        id: `activity-${activity.id}`, name: activity.name, kind: "Activities",
        meta: `${humanizeActivityType(activity.type)} · ${formatRelative(activity.startedAt)}`,
        icon: "fitness", page: "fitness",
      })
    }
    return rows
  }, [reading.books, focus.subjects, habits.enriched, activities])

  const visible = items.filter((item) => {
    if (filter !== "All" && item.kind !== filter) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return item.name.toLowerCase().includes(q) || item.meta.toLowerCase().includes(q)
  })

  /* "Recently opened" = the genuinely most recent thing in each area. */
  const recent = useMemo(() => {
    const rows: Array<{ title: string; kind: string; detail: string; icon: string; page: PageId }> = []
    const topSubject = focus.recent[0]
    if (topSubject) {
      rows.push({
        title: topSubject.subject, kind: "Subject",
        detail: formatRelative(topSubject.startedAt), icon: "focus", page: "focus",
      })
    }
    if (reading.currentBook) {
      rows.push({
        title: reading.currentBook.title, kind: "Book",
        detail: `Page ${reading.currentBook.currentPage} of ${reading.currentBook.pages}`,
        icon: "book", page: "reading",
      })
    }
    const topHabit = habits.enriched.find((h) => h.streak > 0)
    if (topHabit) {
      rows.push({
        title: topHabit.habit.name, kind: "Habit",
        detail: `${topHabit.streak} day streak`, icon: "habits", page: "habits",
      })
    }
    if (activities[0]) {
      rows.push({
        title: activities[0].name, kind: "Activity",
        detail: formatRelative(activities[0].startedAt), icon: "fitness", page: "fitness",
      })
    }
    return rows
  }, [focus.recent, reading.currentBook, habits.enriched, activities])

  const totalTracked =
    focus.totalSeconds + sumBy(activities, (a) => a.movingTimeS) + reading.totalMinutes * 60

  return (
    <div className="page library-page">
      <PageHeader
        eyebrow="Library"
        title="Everything you’re becoming."
        description="Books, subjects, habits and training, all in one place."
        actions={
          <Button icon="plus" onClick={() => onNavigate("reading")}>
            Add to library
          </Button>
        }
      />

      <Card className="library-feature">
        <div className="library-feature-image" />
        <div>
          <Badge tone="sage">Your collection</Badge>
          <h2>{reading.books.length + habits.total + focus.subjects.length} things in motion</h2>
          <p>
            {reading.books.length} book{reading.books.length === 1 ? "" : "s"},{" "}
            {focus.subjects.length} study subject{focus.subjects.length === 1 ? "" : "s"} and{" "}
            {habits.total} habit{habits.total === 1 ? "" : "s"}, with{" "}
            {formatDuration(totalTracked)} tracked in total.
          </p>
          <div className="collection-people">
            <span>{reading.completed.length} read</span>
            <span>{tasks.done.length} tasks done</span>
            <span>{habits.longestStreak}d streak</span>
          </div>
          <Button variant="secondary" onClick={() => onNavigate("insights")}>
            Open insights
          </Button>
        </div>
      </Card>

      <div className="library-filter">
        <div>
          {FILTERS.map((name) => (
            <button
              key={name}
              className={filter === name ? "active" : ""}
              onClick={() => setFilter(name)}
            >
              {name}
            </button>
          ))}
        </div>
        {searching ? (
          <input
            autoFocus
            className="library-search"
            value={query}
            placeholder="Search your library…"
            aria-label="Search library"
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => !query && setSearching(false)}
          />
        ) : (
          <Button variant="secondary" icon="search" onClick={() => setSearching(true)}>
            Search library
          </Button>
        )}
      </div>

      {filter === "All" && !query && (
        <div className="collection-grid">
          {collections.map((c) => (
            <Card className={`collection-card ${c.tone}`} key={c.title}>
              <span>
                <Icon name={c.icon} size={26} />
              </span>
              <div>
                <small>{c.type}</small>
                <h3>{c.title}</h3>
                <p>{c.count}</p>
              </div>
              <button onClick={() => onNavigate(c.page)} aria-label={`Open ${c.title}`}>
                <Icon name="chevronRight" />
              </button>
            </Card>
          ))}
        </div>
      )}

      {(filter !== "All" || query) && (
        <Card>
          <SectionTitle
            title={query ? `Results for “${query}”` : filter}
            subtitle={`${visible.length} item${visible.length === 1 ? "" : "s"}`}
          />
          {visible.length === 0 ? (
            <EmptyState icon="search" title="Nothing found" text="Try a different filter or search term." />
          ) : (
            visible.map((item) => (
              <div className="fitness-row" key={item.id}>
                <span>
                  <Icon name={item.icon} />
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.meta}</small>
                </div>
                {item.progress !== undefined && (
                  <div style={{ minWidth: 70 }}>
                    <Progress value={item.progress} />
                  </div>
                )}
                <button
                  className="row-action"
                  aria-label={`Open ${item.name}`}
                  onClick={() => onNavigate(item.page)}
                >
                  <Icon name="chevronRight" size={16} />
                </button>
              </div>
            ))
          )}
        </Card>
      )}

      <Card>
        <SectionTitle
          title="Recently active"
          action={<Button variant="ghost" onClick={() => onNavigate("insights")}>View all</Button>}
        />
        {recent.length === 0 ? (
          <EmptyState icon="library" title="Nothing yet" text="Your most recent book, subject, habit and workout will show here." />
        ) : (
          <div className="recent-grid">
            {recent.map((row, i) => (
              <button key={row.title} onClick={() => onNavigate(row.page)}>
                <span className={`recent-thumb r${i}`}>
                  <Icon name={row.icon} />
                </span>
                <strong>{row.title}</strong>
                <small>
                  {row.kind} · {row.detail}
                </small>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
