import { useMemo, useState } from "react"
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Progress, SectionTitle, Segmented } from "../components/UI"
import { Heatmap } from "../components/Visuals"
import { Select } from "../components/Select"
import { AddBookSheet } from "../components/BookForm"
import { Icon } from "../components/Icon"
import { isPodcast, vocabulary } from "../lib/media"
import { addReadingSession, deleteBook, logReadingProgress, updateBook } from "../db/repo"
import { useReadingStats } from "../db/stats"
import { dayKey, formatShortDate, lastNDays, startOfMonth } from "../lib/date"
import type { Book, BookStatus } from "../db/types"
import type { PageProps } from "./shared"

const BOOK_STATUSES: BookStatus[] = ["Reading", "Want to read", "Completed"]

export function ReadingPage(_props: PageProps) {
  const stats = useReadingStats()
  const [tab, setTab] = useState<BookStatus>("Reading")
  const [kindFilter, setKindFilter] = useState<"All" | "Books" | "Podcasts">("All")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const visible = stats.books
    .filter((b) => b.status === tab)
    .filter((b) =>
      kindFilter === "All"
        ? true
        : kindFilter === "Podcasts"
          ? isPodcast(b)
          : !isPodcast(b),
    )
  const podcastCount = stats.books.filter((b) => isPodcast(b)).length
  const selected = stats.books.find((b) => b.id === selectedId) ?? null
  const feature = stats.currentBook

  /* Month-to-date reading figures. */
  const monthStart = dayKey(startOfMonth())
  const monthSessions = stats.sessions.filter((s) => s.date >= monthStart)
  const monthMinutes = monthSessions.reduce((t, s) => t + s.minutes, 0)
  const monthPages = monthSessions.reduce((t, s) => t + s.pagesRead, 0)
  const finishedThisMonth = stats.completed.filter(
    (b) => b.finishedAt !== null && dayKey(b.finishedAt) >= monthStart,
  ).length

  const heatmapCells = useMemo(() => {
    const days = lastNDays(98)
    return days.map((date) => ({ date, value: stats.minutesByDay[date] ?? 0 }))
  }, [stats.minutesByDay])

  const featureProgress =
    feature && feature.pages > 0 ? (feature.currentPage / feature.pages) * 100 : 0

  return (
    <div className="page reading-page">
      <PageHeader
        eyebrow="Reading"
        title="A life measured in pages."
        description="Keep close to the ideas that are shaping you."
        actions={
          <Button icon="plus" onClick={() => setAdding(true)}>
            Add book
          </Button>
        }
      />

      <div className="reading-hero">
        <Card className="reading-feature">
          <div className="reading-photo" role="img" aria-label="A quiet desk with books" />
          <div className="reading-feature-copy">
            {feature ? (
              <>
                <Badge tone="sage">Currently reading</Badge>
                <h2>{feature.title}</h2>
                <p>{feature.subtitle || feature.author}</p>
                <span>{feature.author}</span>
                <Progress value={featureProgress} />
                <div>
                  <strong>{feature.currentPage}</strong> of {feature.pages} pages{" "}
                  <b>{Math.round(featureProgress)}%</b>
                </div>
                <Button onClick={() => setSelectedId(feature.id)}>Continue reading</Button>
              </>
            ) : (
              <>
                <Badge tone="neutral">Nothing in progress</Badge>
                <h2>Pick up a book</h2>
                <p>Add one and log pages as you go.</p>
                <Button onClick={() => setAdding(true)}>Add a book</Button>
              </>
            )}
          </div>
        </Card>

        <Card className="reading-stats">
          <SectionTitle title="Reading this month" />
          <div className="reading-stat-grid">
            <div>
              <strong>
                {Math.floor(monthMinutes / 60)}h {monthMinutes % 60}m
              </strong>
              <span>time read</span>
            </div>
            <div>
              <strong>{monthPages}</strong>
              <span>pages</span>
            </div>
            <div>
              <strong>{finishedThisMonth}</strong>
              <span>books finished</span>
            </div>
            <div>
              <strong>{stats.streak} days</strong>
              <span>current streak</span>
            </div>
          </div>
          <Heatmap cells={heatmapCells} metric="reading" compact unit=" min" />
        </Card>
      </div>

      <Card className="book-shelf">
        <SectionTitle
          title="Your library"
          subtitle={`${stats.books.length} item${stats.books.length === 1 ? "" : "s"}${podcastCount > 0 ? ` · ${podcastCount} podcast${podcastCount === 1 ? "" : "s"}` : ""}`}
          action={
            <Segmented
              items={["Reading", "Want to read", "Completed"] as const}
              value={tab}
              onChange={setTab}
            />
          }
        />
        {podcastCount > 0 && (
          <div className="library-filter kind-filter">
            <div>
              {(["All", "Books", "Podcasts"] as const).map((option) => (
                <button
                  key={option}
                  className={kindFilter === option ? "active" : ""}
                  onClick={() => setKindFilter(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState
            icon="book"
            title={`Nothing in "${tab}"`}
            text="Add a book to start tracking pages, minutes and streaks."
          />
        ) : (
          <div className="books-grid">
            {visible.map((book) => (
              <button className="book-card" key={book.id} onClick={() => setSelectedId(book.id)}>
                <div className={`book-cover large ${book.accent}`}>
                  <span>{book.cover}</span>
                </div>
                <strong>{book.title}</strong>
                <span>{book.author}</span>
                <Progress value={book.pages > 0 ? (book.currentPage / book.pages) * 100 : 0} />
                <small>
                  {book.status === "Completed"
                    ? book.finishedAt
                      ? `Finished ${formatShortDate(book.finishedAt)}`
                      : "Finished"
                    : book.status === "Want to read"
                      ? `${book.pages} ${vocabulary(book).units}`
                      : `${book.currentPage} / ${book.pages} ${vocabulary(book).units}`}
                </small>
                {isPodcast(book) && (
                  <span className="media-tag">
                    <Icon name="podcast" size={12} /> Podcast
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </Card>

      {selected && <BookDetail book={selected} onClose={() => setSelectedId(null)} />}
      {adding && <AddBookSheet onClose={() => setAdding(false)} />}
    </div>
  )
}

function BookDetail({ book, onClose }: { book: Book; onClose: () => void }) {
  const stats = useReadingStats()
  const [page, setPage] = useState(String(book.currentPage))
  const [minutes, setMinutes] = useState("")
  const [saving, setSaving] = useState(false)

  const sessions = stats.sessions.filter((s) => s.bookId === book.id)
  const totalMinutes = sessions.reduce((t, s) => t + s.minutes, 0)

  const save = async () => {
    setSaving(true)
    const nextPage = Number(page)
    if (Number.isFinite(nextPage)) {
      await logReadingProgress(book.id, nextPage, Number(minutes) || 0)
    } else if (Number(minutes) > 0) {
      await addReadingSession({ bookId: book.id, minutes: Number(minutes) })
    }
    setSaving(false)
    onClose()
  }

  return (
    <Modal title={book.title} onClose={onClose}>
      <div className="book-detail">
        <div className={`book-cover large ${book.accent}`}>
          <span>{book.cover}</span>
        </div>
        <div>
          <Badge tone="sage">{book.status}</Badge>
          <h3>{book.title}</h3>
          <p>by {book.author}</p>
          <div className="book-detail-stats">
            <span>
              <strong>{book.currentPage}</strong>current {vocabulary(book).unit}
            </span>
            <span>
              <strong>{book.pages}</strong>total {vocabulary(book).units}
            </span>
            <span>
              <strong>
                {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
              </strong>
              read time
            </span>
          </div>
        </div>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Current {vocabulary(book).unit}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={book.pages || undefined}
            value={page}
            onChange={(e) => setPage(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Minutes {vocabulary(book).pastVerb.toLowerCase()}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={minutes}
            placeholder="0"
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>
      </div>

      <div className="field">
        <span>Status</span>
        <Select
          value={book.status}
          options={BOOK_STATUSES.map((s) => ({ value: s, label: s }))}
          onChange={(value) => void updateBook(book.id, { status: value as BookStatus })}
          sheetTitle="Reading status"
        />
      </div>

      <div className="modal-actions">
        <Button
          variant="danger"
          icon="trash"
          type="button"
          onClick={async () => {
            await deleteBook(book.id)
            onClose()
          }}
        >
          Remove
        </Button>
        <Button className="wide" onClick={() => void save()} disabled={saving}>
          Save progress
        </Button>
      </div>
    </Modal>
  )
}
