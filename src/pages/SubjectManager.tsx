import { useState } from "react"
import { Icon } from "../components/Icon"
import { Button, EmptyState } from "../components/UI"
import { BottomSheet } from "../components/Sheet"
import { createSubject, deleteSubject, updateSubject } from "../db/repo"
import { useSubjects } from "../db/stats"
import { SUBJECT_TONES, type FocusSessionType, type Subject, type SubjectTone } from "../db/types"

/**
 * Create, rename, recolour and remove study subjects and reading categories.
 * Deleting never touches recorded sessions: they keep the name they were
 * logged with, so tracked time is never rewritten.
 */
export function SubjectManager({
  kind,
  onClose,
  onCreated,
}: {
  kind: FocusSessionType
  onClose: () => void
  onCreated?: (id: string) => void
}) {
  const subjects = useSubjects(kind)
  const [editing, setEditing] = useState<Subject | "new" | null>(null)

  return (
    <BottomSheet
      title={kind === "Reading" ? "Reading categories" : "Study subjects"}
      subtitle={
        subjects.length === 0
          ? "None yet"
          : `${subjects.length} ${subjects.length === 1 ? "entry" : "entries"}`
      }
      onClose={onClose}
      footer={
        <Button icon="plus" className="wide" onClick={() => setEditing("new")}>
          New {kind === "Reading" ? "category" : "subject"}
        </Button>
      }
    >
      {subjects.length === 0 ? (
        <EmptyState
          icon="focus"
          title={`No ${kind === "Reading" ? "categories" : "subjects"} yet`}
          text="Create one and every session you run will be grouped under it."
        />
      ) : (
        <div className="subject-list">
          {subjects.map((subject) => (
            <div className="subject-row" key={subject.id}>
              <i className={`swatch tone-${subject.tone}`} aria-hidden="true" />
              <span>{subject.name}</span>
              <button
                className="row-action"
                aria-label={`Edit ${subject.name}`}
                onClick={() => setEditing(subject)}
              >
                <Icon name="edit" size={17} />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <SubjectForm
          kind={kind}
          subject={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onCreated={onCreated}
        />
      )}
    </BottomSheet>
  )
}

function SubjectForm({
  kind,
  subject,
  onClose,
  onCreated,
}: {
  kind: FocusSessionType
  subject: Subject | null
  onClose: () => void
  onCreated?: (id: string) => void
}) {
  const existing = useSubjects(kind)
  const [name, setName] = useState(subject?.name ?? "")
  const [tone, setTone] = useState<SubjectTone>(subject?.tone ?? SUBJECT_TONES[0])
  const [confirmDelete, setConfirmDelete] = useState(false)

  const trimmed = name.trim()
  const duplicate = existing.some(
    (candidate) =>
      candidate.id !== subject?.id &&
      candidate.name.toLowerCase() === trimmed.toLowerCase(),
  )
  const valid = trimmed.length > 0 && !duplicate

  const submit = async () => {
    if (!valid) return
    if (subject) {
      await updateSubject(subject.id, { name: trimmed, tone })
    } else {
      const id = await createSubject({ name: trimmed, kind, tone })
      onCreated?.(id)
    }
    onClose()
  }

  return (
    <BottomSheet
      title={subject ? "Edit subject" : `New ${kind === "Reading" ? "category" : "subject"}`}
      onClose={onClose}
      footer={
        <div className="sheet-actions">
          {subject && (
            <Button
              variant="danger"
              icon="trash"
              type="button"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )}
          <Button className="wide" disabled={!valid} onClick={() => void submit()}>
            {subject ? "Save" : "Create"}
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
          <span>Name</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={kind === "Reading" ? "e.g. Non-fiction" : "e.g. Computer Networks"}
            maxLength={48}
          />
        </label>
        {duplicate && (
          <p className="field-error">
            You already have {kind === "Reading" ? "a category" : "a subject"} with that name.
          </p>
        )}

        <div className="field">
          <span>Colour</span>
          <div className="tone-picker">
            {SUBJECT_TONES.map((option) => (
              <button
                key={option}
                type="button"
                className={`swatch tone-${option} ${tone === option ? "active" : ""}`}
                aria-label={option}
                aria-pressed={tone === option}
                onClick={() => setTone(option)}
              />
            ))}
          </div>
        </div>
      </form>

      {confirmDelete && subject && (
        <BottomSheet
          title={`Delete “${subject.name}”?`}
          onClose={() => setConfirmDelete(false)}
          footer={
            <div className="sheet-actions">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                className="wide"
                onClick={async () => {
                  await deleteSubject(subject.id)
                  setConfirmDelete(false)
                  onClose()
                }}
              >
                Delete
              </Button>
            </div>
          }
        >
          <p className="modal-intro">
            Sessions already recorded under this subject are kept and still show its
            name. Only the option to pick it for new sessions is removed.
          </p>
        </BottomSheet>
      )}
    </BottomSheet>
  )
}
