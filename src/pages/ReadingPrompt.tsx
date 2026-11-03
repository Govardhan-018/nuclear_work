import { useState } from "react"
import { Button, Progress } from "../components/UI"
import { BottomSheet } from "../components/Sheet"
import { formatDuration } from "../lib/date"
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

  const value = Math.max(0, Math.round(Number(pages) || 0))
  const remaining = book.pages > 0 ? Math.max(0, book.pages - book.currentPage) : null
  const capped = remaining === null ? value : Math.min(value, remaining)
  const nextPage = book.currentPage + capped
  const pct = book.pages > 0 ? (nextPage / book.pages) * 100 : 0
  const finishes = book.pages > 0 && nextPage >= book.pages

  return (
    <BottomSheet
      title="How far did you get?"
      subtitle={`${formatDuration(seconds)} of reading`}
      onClose={onSkip}
      footer={
        <div className="sheet-actions">
          <Button variant="secondary" type="button" onClick={onSkip}>
            Skip
          </Button>
          <Button className="wide" icon="check" onClick={() => onSubmit(capped)}>
            {finishes ? "Finish book" : "Save progress"}
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
              ? `page ${nextPage} of ${book.pages}${remaining !== null ? ` · ${Math.max(0, book.pages - nextPage)} left` : ""}`
              : `page ${nextPage}`}
          </small>
        </div>
      </div>

      <label className="field">
        <span>Pages read</span>
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
        {[5, 10, 20, 30].map((n) => (
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
