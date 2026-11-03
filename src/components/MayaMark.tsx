/**
 * The app mark. Inlined rather than loaded as a file so it renders instantly,
 * works offline and scales cleanly at every size the UI needs.
 */
export function MayaMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      role="img"
      aria-label="Maya"
      className="maya-mark"
    >
      <defs>
        <radialGradient id="maya-sheen">
          <stop stopColor="#FFF" />
          <stop offset="1" stopColor="#333" />
        </radialGradient>
        <linearGradient id="maya-body" x1=".5" x2=".5" y2="1">
          <stop stopColor="#5A5A5A" />
          <stop offset=".3" stopColor="#202020" />
          <stop offset=".64" stopColor="#050505" />
          <stop offset="1" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="230" fill="#000" />
      <rect
        x="48"
        y="48"
        width="928"
        height="928"
        rx="204"
        fill="url(#maya-sheen)"
        stroke="#E7E7E7"
        strokeWidth="24"
      />
      <path
        d="M512 224c-164 0-264 94-264 248v197c0 72 24 112 66 130 31 13 72 7 115-17 28 22 56 33 83 33s55-11 83-33c43 24 84 30 115 17 42-18 66-58 66-130V472c0-154-100-248-264-248Z"
        fill="url(#maya-body)"
      />
      <g fill="#FFF">
        <ellipse cx="412" cy="474" rx="50" ry="68" />
        <ellipse cx="612" cy="474" rx="50" ry="68" />
      </g>
    </svg>
  )
}
