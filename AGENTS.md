# Life OS

React + Vite + Tailwind CSS, packaged as a standalone Android app with
Capacitor. Local-first: everything works offline except Strava sync and the AI
coach.

## Development Server

A Vite development server runs on `$PORT` (default 8443). In Figma Make it is
already running; elsewhere start it with `pnpm dev`.

## Project Structure

This is the canonical project structure. Start with task-relevant files below.
Only follow imports or inspect other files when required, when a documented
path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; mounts `src/App.tsx`, registers the
  service worker for the web build only
- `src/App.tsx` - Shell: routing by hash, theme, Android back button, Strava
  deep links, quick add, command palette
- `src/index.css` - Global CSS, self-hosted `@font-face` rules, Tailwind v4
  import, and the whole design system
- `index.html` - Vite HTML shell
- `capacitor.config.ts` - Native app id, splash, status bar, CapacitorHttp
- `vite.config.ts` - Vite + React + Tailwind + PWA + the Figma Make plugins,
  with `@` aliased to `src`
- `android/` - Capacitor Android project (committed; build outputs are not)
- `assets/` - Icon and splash sources for `pnpm assets`

### `src/db/` - the data layer

- `types.ts` - Entity types. Every record carries `createdAt`, `updatedAt`, a
  `deleted` tombstone and an unused `remoteId`, so a sync backend can be added
  later without migrating data.
- `db.ts` - Dexie schema. Bump `version(n)` to change it.
- `repo.ts` - All writes. UI components call these, never Dexie directly.
- `stats.ts` - Reactive hooks deriving every figure the UI shows. **No page
  should contain a hardcoded statistic**; if a number is needed, derive it
  here.
- `settings.ts` - Reactive key/value settings, including API keys.
- `seed.ts` - Deterministic 90-day demo dataset. Demo rows use `demo:` id
  prefixes so re-seeding cannot duplicate them and removal leaves user data.

### `src/services/`

- `platform.ts` - The single HTTP entry point. Uses CapacitorHttp natively so
  requests are not subject to the WebView's CORS policy.
- `strava.ts` - OAuth, token refresh, incremental activity import.
- `openrouter.ts` - Chat completions against free models.
- `coach.ts` - Builds the factual digest sent to the model, plus the on-device
  rule-based brief used when offline or without a key.
- `backup.ts` - JSON export/import; credentials are excluded.

### `src/pages/` - one file per screen

`TodayPage`, `CalendarPage`, `FocusPage`, `ReadingPage`, `FoodPage`,
`TasksPage`, `HabitsPage`, `FitnessPage`, `InsightsPage`, `LibraryPage`,
`SettingsPage`, plus `AiCoach` and shared helpers in `shared.ts`.

### `src/components/` and `src/lib/`

`Icon`, `UI` (Button, Card, Modal, Badge, Progress, …), `Visuals` (charts),
and `lib/date.ts`, `lib/polyline.ts`.

## Dependencies

- Runtime: React 19, Dexie 4, Capacitor 8
- Styling: Tailwind CSS v4 via `@tailwindcss/vite`
- Build: Vite 8, TypeScript 5, `@vitejs/plugin-react`, `vite-plugin-pwa`
- Formatting: oxfmt

## Styling

Tailwind CSS v4 through the `@tailwindcss/vite` plugin. `src/index.css` imports
Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes in JSX and
put global CSS or theme customization in `src/index.css`. No Tailwind config or
PostCSS config file is needed.

Fonts are **self-hosted** in `public/fonts` so the app renders with no network.
Keep CSS `@import` statements first, then `@font-face` rules.

Tailwind emits utilities in `@layer utilities`, and CSS outside any cascade
layer overrides every layer regardless of specificity. Put global element
styles (resets, defaults for `body`, headings, `button`, `input`) inside
`@layer base { ... }` so utility classes still apply. Preflight already sets
`box-sizing: border-box`, removes default margins and sets `font: inherit` on
form controls, so do not repeat those.

Most of the design system predates Tailwind usage here and lives as plain CSS
classes in `src/index.css`. Match the existing class names when extending a
screen rather than introducing a parallel utility-based style.

## Conventions

- **Never hardcode a statistic in a page.** Derive it in `src/db/stats.ts`.
- **Writes go through `src/db/repo.ts`**, which keeps sync metadata correct.
- **Deletes are soft** (`deleted: 1`), except Settings → Clear all data.
- **Charts must survive empty and all-zero data.** Weekday initials repeat
  ("T", "S"), so list keys need the index, not just the label.
- **Offline is the default.** Anything needing the network must degrade with a
  clear message rather than failing silently.

## Commands

```
pnpm dev              # web dev server
pnpm typecheck        # tsc --noEmit
pnpm build            # web build
pnpm sync             # build + copy into the Android project
pnpm android:debug    # build a debug APK
pnpm android:release  # build a signed release APK
pnpm assets           # regenerate icons and splash screens
```
