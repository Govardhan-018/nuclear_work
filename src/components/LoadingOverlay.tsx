import { MayaMark } from "./MayaMark"

export function LoadingOverlay({
  label = "Loading Maya",
  fullScreen = true,
}: {
  label?: string
  fullScreen?: boolean
}) {
  return (
    <div className={fullScreen ? "loading-overlay" : "loading-overlay loading-inline"} role="status" aria-live="polite">
      <div className="loading-mark">
        <MayaMark size={fullScreen ? 54 : 30} />
        <span className="loading-orbit loading-orbit-one" />
        <span className="loading-orbit loading-orbit-two" />
      </div>
      <strong>{label}</strong>
      <div className="loading-progress" aria-hidden="true"><i /></div>
    </div>
  )
}
