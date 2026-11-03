import { useState } from "react"
import { Button, Progress } from "../components/UI"
import { BottomSheet } from "../components/Sheet"
import { formatDuration } from "../lib/date"
import { isPodcast, vocabulary } from "../lib/media"
import type { Book } from "../db/types"

/**
 * Shown when a reading session ends: how far did you get? The answer updates
 * the book's progress and is stored as a reading session, so pages and time
 * stay in step.
 */
export function ReadingPagesPrompt({
  book,
  seconds,
  onSubmit,
  onSkip,
}: {
  book: Book
  seconds: number
  onSubmit: (pagesRead: number) => void
  onSkip: () => void
}) {
  const [pages, setPages] = useState("")
  const words = vocabulary(book)
  const podcast = isPodcast(book)

  const value = Math.max(0, Math.round(Number(pages) || 0))
  const remaining = book.pages > 0 ? Math.max(0, book.pages - book.currentPage) : null
  const capped = remaining === null ? value : Math.min(value, remaining)
  const nextPage = book.currentPage + capped
  const pct = book.pages > 0 ? (nextPage / book.pages) * 100 : 0
  const finishes = book.pages > 0 && nextPage >= book.pages

  return (
    <BottomSheet
      title="How far did you get?"
      subtitle={`${formatDuration(seconds)} of ${words.verb.toLowerCase()}`}
      onClose={onSkip}
      footer={
        <div className="sheet-actions">
          <Button variant="secondary" type="button" onClick={onSkip}>
            Skip
          </Button>
          <Button className="wide" icon="check" onClick={() => onSubmit(capped)}>
            {finishes ? `Finish ${podcast ? "podcast" : "book"}` : "Save progress"}
          </Button>
        </div>
      }
    >
      <div className="reading-prompt">
        <div className={`book-cover ${book.accent}`}>
          <span>{book.cover}</span>
        </div>
        <div>
          <strong>{book.title}</strong>
          <small>{book.author}</small>
          <Progress value={pct} />
          <small>
            {book.pages > 0
              ? `${words.unit} ${nextPage} of ${book.pages}${remaining !== null ? ` · ${Math.max(0, book.pages - nextPage)} left` : ""}`
              : `${words.unit} ${nextPage}`}
          </small>
        </div>
      </div>

      <label className="field">
        <span>{words.logged}</span>
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          min={0}
          max={remaining ?? undefined}
          value={pages}
          onChange={(event) => setPages(event.target.value)}
          placeholder="0"
        />
      </label>

      <div className="quick-pages">
        {(podcast ? [1, 2, 3, 5] : [5, 10, 20, 30]).map((n) => (
          <button
            key={n}
            type="button"
            className={value === n ? "active" : ""}
            onClick={() => setPages(String(n))}
          >
            +{n}
          </button>
        ))}
      </div>

      {finishes && (
        <p className="soft-note">
          That finishes <strong>{book.title}</strong>. It will move to your completed
          shelf with today's date.
        </p>
      )}
    </BottomSheet>
  )
}
