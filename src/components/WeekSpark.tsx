/**
 * Seven-day activity strip. Each bar is one day, the last being today, so the
 * week reads at a glance without a full chart.
 */
export function WeekSpark({
  values,
  labels,
  todayIndex,
  unit = "",
}: {
  values: number[]
  labels: string[]
  todayIndex: number
  unit?: string
}) {
  const max = Math.max(...values, 0)
  const scale = max > 0 ? max : 1

  return (
    <div className="week-spark" role="img" aria-label={`Activity over ${values.length} days`}>
      {values.map((value, index) => {
        const height = value > 0 ? Math.max(12, (value / scale) * 100) : 4
        return (
          <div
            key={`${labels[index]}-${index}`}
            className={`spark-col ${index === todayIndex ? "is-today" : ""} ${value === 0 ? "is-empty" : ""}`}
            title={`${labels[index]}: ${value > 0 ? `${Math.round(value * 10) / 10}${unit}` : "nothing logged"}`}
          >
            <div className="spark-track">
              <div className="spark-fill" style={{ height: `${height}%` }} />
            </div>
            <small>{labels[index]}</small>
          </div>
        )
      })}
    </div>
  )
}
