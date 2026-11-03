/** Placeholder blocks shown while a view is still resolving its data. */
export function Skeleton({
  lines = 3,
  className = "",
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={`skeleton-group ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="skeleton skeleton-line"
          style={{ width: `${100 - index * 12}%` }}
        />
      ))}
    </div>
  )
}
