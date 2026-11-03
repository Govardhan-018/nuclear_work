import { useState } from "react"
import { Button } from "./UI"
import { BottomSheet } from "./Sheet"
import { createBook } from "../db/repo"
import type { BookStatus } from "../db/types"

const ACCENTS = ["sage", "sand", "forest", "cream"]
const STATUSES: BookStatus[] = ["Reading", "Want to read", "Completed"]

/**
 * Add a book. Shared by the Reading page and the Focus tab, so a reading
 * session can be started without leaving the timer to go and create one.
 */
export function AddBookSheet({
  onClose,
  onCreated,
  defaultStatus = "Reading",
}: {
  onClose: () => void
  onCreated?: (id: string) => void
  defaultStatus?: BookStatus
}) {
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [pages, setPages] = useState("")
  const [status, setStatus] = useState<BookStatus>(defaultStatus)
  const [cover, setCover] = useState("")

  const valid = title.trim().length > 0

  const submit = async () => {
    if (!valid) return
    const id = await createBook({
      title: title.trim(),
      author: author.trim() || "Unknown",
      pages: Math.max(0, Number(pages) || 0),
      status,
      cover: cover.trim() || title.trim().slice(0, 18).toUpperCase(),
      accent: ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
    })
    onCreated?.(id)
    onClose()
  }

  return (
    <BottomSheet
      title="Add a book"
      subtitle="Track pages, time and streaks against it"
      onClose={onClose}
      footer={
        <div className="sheet-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button className="wide" icon="plus" disabled={!valid} onClick={() => void submit()}>
            Add book
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label className="field">
          <span>Title</span>
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Four Thousand Weeks"
            maxLength={120}
          />
        </label>
        <label className="field">
          <span>Author</span>
          <input
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            placeholder="Oliver Burkeman"
            maxLength={120}
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Total pages</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={pages}
              onChange={(event) => setPages(event.target.value)}
              placeholder="288"
            />
          </label>
          <div className="field">
            <span>Status</span>
            <div className="answer-pills">
              {STATUSES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={status === option ? "active" : ""}
                  onClick={() => setStatus(option)}
                >
                  {option === "Want to read" ? "Later" : option}
                </button>
              ))}
            </div>
          </div>
        </div>
        <label className="field">
          <span>Cover text</span>
          <input
            value={cover}
            onChange={(event) => setCover(event.target.value)}
            placeholder="Shown on the generated cover — defaults to the title"
            maxLength={24}
          />
        </label>
      </form>
    </BottomSheet>
  )
}
