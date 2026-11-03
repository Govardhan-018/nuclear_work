import { useState } from "react"
import { Button } from "./UI"
import { Icon } from "./Icon"
import { BottomSheet } from "./Sheet"
import { createBook } from "../db/repo"
import { vocabulary } from "../lib/media"
import type { BookStatus, MediaKind } from "../db/types"

const ACCENTS = ["sage", "sand", "forest", "cream"]
const STATUSES: BookStatus[] = ["Reading", "Want to read", "Completed"]

/**
 * Add a book or a podcast. Shared by the Reading page and the Focus tab, so a
 * session can be started without leaving the timer to go and create one.
 */
export function AddBookSheet({
  onClose,
  onCreated,
  defaultStatus = "Reading",
  defaultKind = "book",
}: {
  onClose: () => void
  onCreated?: (id: string) => void
  defaultStatus?: BookStatus
  defaultKind?: MediaKind
}) {
  const [kind, setKind] = useState<MediaKind>(defaultKind)
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [units, setUnits] = useState("")
  const [status, setStatus] = useState<BookStatus>(defaultStatus)
  const [cover, setCover] = useState("")

  const words = vocabulary({ kind })
  const valid = title.trim().length > 0

  const submit = async () => {
    if (!valid) return
    const id = await createBook({
      kind,
      title: title.trim(),
      author: author.trim() || "Unknown",
      pages: Math.max(0, Number(units) || 0),
      status,
      cover: cover.trim() || title.trim().slice(0, 18).toUpperCase(),
      accent: ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
    })
    onCreated?.(id)
    onClose()
  }

  return (
    <BottomSheet
      title={kind === "podcast" ? "Add a podcast" : "Add a book"}
      subtitle={`Track ${words.units}, time and streaks against it`}
      onClose={onClose}
      footer={
        <div className="sheet-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button className="wide" icon="plus" disabled={!valid} onClick={() => void submit()}>
            Add {kind}
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
        <div className="field">
          <span>Type</span>
          <div className="kind-picker">
            {(["book", "podcast"] as MediaKind[]).map((option) => (
              <button
                key={option}
                type="button"
                className={kind === option ? "active" : ""}
                aria-pressed={kind === option}
                onClick={() => setKind(option)}
              >
                <Icon name={option === "podcast" ? "podcast" : "book"} size={18} />
                {option === "podcast" ? "Podcast" : "Book"}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Title</span>
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={kind === "podcast" ? "Hard Fork" : "Four Thousand Weeks"}
            maxLength={120}
          />
        </label>

        <label className="field">
          <span>{words.creator}</span>
          <input
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            placeholder={kind === "podcast" ? "The New York Times" : "Oliver Burkeman"}
            maxLength={120}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>{words.total}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={units}
              onChange={(event) => setUnits(event.target.value)}
              placeholder={kind === "podcast" ? "40" : "288"}
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
                  {option === "Want to read"
                    ? "Later"
                    : option === "Reading" && kind === "podcast"
                      ? "Listening"
                      : option}
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

        {kind === "podcast" && Number(units) === 0 && (
          <p className="soft-note">
            Leave the episode count at zero for an ongoing show. Progress is counted
            up rather than toward a total.
          </p>
        )}
      </form>
    </BottomSheet>
  )
}
