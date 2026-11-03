import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Icon } from "./Icon"

/**
 * A bottom sheet. On a phone this is the native-feeling way to present a
 * choice or a short form; above 760px it centres like a dialog.
 */
export function BottomSheet({
  title,
  subtitle,
  children,
  onClose,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
}) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  /*
   * Rendered into <body>. A sheet opened from inside a card would otherwise be
   * positioned against that card: any ancestor with a transform (including a
   * filling CSS animation) becomes the containing block for position: fixed,
   * which cropped the sheet to the card's bounds.
   */
  return createPortal(
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <header className="sheet-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
