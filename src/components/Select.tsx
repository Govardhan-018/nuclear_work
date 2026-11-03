import { useState } from "react"
import { Icon } from "./Icon"
import { BottomSheet } from "./Sheet"

export type SelectOption = {
  value: string
  label: string
  /** Optional dot colour, used by the subject picker. */
  tone?: string
  hint?: string
}

/**
 * Replaces the native <select>, which renders as an unstyled system dialog on
 * Android and cannot carry colour swatches or a "manage" action.
 */
export function Select({
  value,
  options,
  onChange,
  label,
  placeholder = "Select…",
  sheetTitle,
  footer,
  disabled,
  className = "",
}: {
  value: string | null
  options: SelectOption[]
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  sheetTitle?: string
  footer?: React.ReactNode
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value) ?? null

  return (
    <>
      <button
        type="button"
        className={`select-trigger ${className}`}
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-label={label ?? sheetTitle ?? "Select an option"}
      >
        {selected?.tone && <i className={`swatch tone-${selected.tone}`} aria-hidden="true" />}
        <span className={selected ? "" : "placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <Icon name="chevronRight" size={16} />
      </button>

      {open && (
        <BottomSheet
          title={sheetTitle ?? label ?? "Choose"}
          onClose={() => setOpen(false)}
          footer={footer}
        >
          <div className="option-list" role="listbox">
            {options.length === 0 && (
              <p className="soft-note">Nothing to choose from yet.</p>
            )}
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? "option selected" : "option"}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                {option.tone && <i className={`swatch tone-${option.tone}`} aria-hidden="true" />}
                <span>
                  <strong>{option.label}</strong>
                  {option.hint && <small>{option.hint}</small>}
                </span>
                {option.value === value && <Icon name="check" size={17} />}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </>
  )
}
