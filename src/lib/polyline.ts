/**
 * Decoder for Google's encoded polyline format, which is what Strava returns
 * in `map.summary_polyline`. Implemented here rather than pulled in as a
 * dependency because it is a dozen lines and the app ships offline.
 */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const factor = Math.pow(10, precision)
  const coordinates: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let result = 1
    let shift = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63 - 1
      result += byte << shift
      shift += 5
    } while (byte >= 0x1f && index < encoded.length)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    result = 1
    shift = 0
    do {
      byte = encoded.charCodeAt(index++) - 63 - 1
      result += byte << shift
      shift += 5
    } while (byte >= 0x1f && index < encoded.length)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    coordinates.push([lat / factor, lng / factor])
  }
  return coordinates
}

/**
 * Projects decoded coordinates into an SVG path that fills a viewBox, keeping
 * the aspect ratio of the route. Longitude is scaled by cos(latitude) so the
 * shape is not stretched at higher latitudes.
 */
export function polylineToSvgPath(
  encoded: string,
  width: number,
  height: number,
  padding = 16,
): string | null {
  const points = decodePolyline(encoded)
  if (points.length < 2) return null

  const midLat = (points[0][0] + points[points.length - 1][0]) / 2
  const lngScale = Math.cos((midLat * Math.PI) / 180) || 1

  const xs = points.map((p) => p[1] * lngScale)
  const ys = points.map((p) => -p[0])

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const spanX = maxX - minX || 1e-6
  const spanY = maxY - minY || 1e-6
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY)

  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2

  return points
    .map((_, i) => {
      const x = (xs[i] - minX) * scale + offsetX
      const y = (ys[i] - minY) * scale + offsetY
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(" ")
}

/** Start and end markers for a decoded route, in the same projected space. */
export function polylineEndpoints(
  encoded: string,
  width: number,
  height: number,
  padding = 16,
): { start: [number, number]; end: [number, number] } | null {
  const path = polylineToSvgPath(encoded, width, height, padding)
  if (!path) return null
  const commands = path.split("L")
  const first = commands[0].replace("M", "").trim().split(" ").map(Number)
  const last = commands[commands.length - 1].trim().split(" ").map(Number)
  return { start: [first[0], first[1]], end: [last[0], last[1]] }
}
