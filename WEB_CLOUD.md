# Web and Android cloud sync

The web build and Android app use the same Maya API hosted on Render. The clients never connect directly to Supabase.

Set this public API base URL in Vercel for the web build:

```text
VITE_MAYA_API_URL=https://nuclear-work.onrender.com
```

The same value is supplied as a build-time environment variable when building Android. It is a public API URL; it is not a Supabase secret.

Users can sign in or create an account from Settings → Cloud sync. Maya keeps records in local IndexedDB so the app remains usable offline. After sign-in, the shared client synchronizes local and cloud records through the Render API. The first sync preserves local records and uploads them to the signed-in user's account.

Keep `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` only in Render's environment settings. Do not add Supabase keys to Vercel or the Android build.

Render must deploy the `backend` branch with `backend/` as its root directory. Set `CORS_ORIGINS` to the exact production Vercel origin. Android uses Capacitor's native HTTP transport.

Apply the SQL migration in `supabase/migrations/` to the Supabase project before enabling sync.

Cloud sync excludes settings that contain Strava or AI credentials. Those remain on the device.