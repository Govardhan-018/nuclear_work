import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Icon } from "./Icon"

/** Past this many pixels the sheet is released rather than snapping back. */
const DISMISS_DISTANCE = 110
/** A fast flick dismisses regardless of distance (px per ms). */
const DISMISS_VELOCITY = 0.55

/**
 * A bottom sheet. On a phone this is the native-feeling way to present a
 * choice or a short form; above 760px it centres like a dialog.
 *
 * Drag the handle, or anywhere in the header, to dismiss. The gesture is
 * tracked on the sheet itself rather than the body so a scrollable list inside
 * still scrolls normally.
 */
export function BottomSheet({
  title,
  subtitle,
  children,
  onClose,
  footer,
  className = "",
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  className?: string
}) {
  const [drag, setDrag] = useState(0)
  const [closing, setClosing] = useState(false)
  const gesture = useRef<{ startY: number; startedAt: number } | null>(null)

  const dismiss = useCallback(() => {
    if (closing) return
    setClosing(true)
    // Let the exit transition play before unmounting.
    window.setTimeout(onClose, 180)
  }, [closing, onClose])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [dismiss])

  const onPointerDown = (event: React.PointerEvent) => {
    gesture.current = { startY: event.clientY, startedAt: performance.now() }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!gesture.current) return
    // Downward only; an upward drag should not lift the sheet off the edge.
    setDrag(Math.max(0, event.clientY - gesture.current.startY))
  }

  const onPointerUp = (event: React.PointerEvent) => {
    if (!gesture.current) return
    const travelled = Math.max(0, event.clientY - gesture.current.startY)
    const velocity = travelled / Math.max(1, performance.now() - gesture.current.startedAt)
    gesture.current = null
    if (travelled > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) dismiss()
    else setDrag(0)
  }

  return createPortal(
    /*
     * Rendered into <body>. A sheet opened from inside a card would otherwise
     * be positioned against that card: any ancestor with a transform —
     * including a filling CSS animation — becomes the containing block for
     * position: fixed, which cropped the sheet to the card's bounds.
     */
    <div
      className={`sheet-backdrop ${closing ? "is-closing" : ""}`}
      role="presentation"
      onMouseDown={dismiss}
      style={{ "--drag": `${drag}px` } as React.CSSProperties}
    >
      <div
        className={`sheet glass ${className} ${drag > 0 ? "is-dragging" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className="sheet-drag"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="sheet-grip" aria-hidden="true" />
          <header className="sheet-head">
            <div>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button className="sheet-close" onClick={dismiss} aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          </header>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
