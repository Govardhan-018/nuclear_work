import type { Book, MediaKind } from "../db/types"

/** Records predating podcasts have no kind; they are books. */
export function kindOf(item: Pick<Book, "kind">): MediaKind {
  return item.kind === "podcast" ? "podcast" : "book"
}

export function isPodcast(item: Pick<Book, "kind">): boolean {
  return kindOf(item) === "podcast"
}

type Vocabulary = {
  /** "page" / "episode" */
  unit: string
  units: string
  /** "pages read" / "episodes listened" */
  logged: string
  /** "Author" / "Publisher" */
  creator: string
  /** "Reading" / "Listening" */
  verb: string
  /** "Read" / "Listened" */
  pastVerb: string
  /** "Total pages" / "Total episodes" */
  total: string
  icon: string
}

const BOOK: Vocabulary = {
  unit: "page", units: "pages", logged: "Pages read", creator: "Author",
  verb: "Reading", pastVerb: "Read", total: "Total pages", icon: "book",
}

const PODCAST: Vocabulary = {
  unit: "episode", units: "episodes", logged: "Episodes finished",
  creator: "Show or host", verb: "Listening", pastVerb: "Listened",
  total: "Total episodes", icon: "podcast",
}

export function vocabulary(item: Pick<Book, "kind">): Vocabulary {
  return isPodcast(item) ? PODCAST : BOOK
}

/** "page 176 of 288" / "episode 12 of 40". */
export function progressLabel(item: Book): string {
  const v = vocabulary(item)
  return item.pages > 0
    ? `${v.unit} ${item.currentPage} of ${item.pages}`
    : `${v.unit} ${item.currentPage}`
}
