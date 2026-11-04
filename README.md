# Maya

A personal tracker for study, reading, food, tasks, habits and fitness, available on web and Android.

Sign in is required to use Maya. Records sync between web and Android through the Maya API on Render, with a local IndexedDB copy available offline. The clients do not connect directly to Supabase.

- **Local-first.** Data stays available on this device; when signed in, it syncs through your Maya account.

- **Strava import.** Pulls your activities in and keeps them.
- **AI coach.** Optional, runs on Groq, and is only ever sent a summary of
  data you have logged yourself.
- **Backups.** Export and import a JSON file at any time.

---

## Getting the app on your phone

### Install

1. Go to the repository's **Releases** page and download the latest
   `maya-*.apk` on your phone.
2. Open it. Android will ask you to allow installs from your browser or file
   manager the first time; allow it, then install.
3. Updates install straight over the top. Your data is kept.

If you'd rather build it yourself, see *Building locally* below.

### First run

The app starts with 90 days of demo data so the charts and streaks have
something to show. When you're ready to use it for real, go to
**Settings → Your data** and turn **Demo data** off. That removes only the
seeded rows; anything you have added yourself stays.

---

## Cloud sync and web setup

The web client and Android app use the same Render API. Set `VITE_MAYA_API_URL` to the Render API origin when building the web app or APK. In Vercel, use the repository root, Vite preset, `pnpm build`, and `dist` output.

Create an account or sign in when Maya opens. Use **Settings → Cloud sync** to manage your account. The first sync merges the device's local records with the account data, using the latest record timestamp. Data remains available offline; edits sync when online, when the app returns to the foreground, and periodically while open.

Render runs from the `backend/` directory on the `backend` branch. Keep Supabase credentials in Render environment variables only. Apply [the initial schema migration](https://github.com/Govardhan-018/nuclear_work/blob/backend/supabase/migrations/0001_initial_schema.sql) before enabling account sync. See [WEB_CLOUD.md](WEB_CLOUD.md) for deployment configuration.

## Setting up Strava

Strava sync needs an API application of your own. It takes about two minutes.

1. Go to <https://www.strava.com/settings/api> and create an application.
   - **Application Name:** anything, e.g. `Maya`
   - **Category:** `Data Importer`
   - **Website:** anything, e.g. `https://example.com`
   - **Authorization Callback Domain:** `lifeos.app`

   > The callback domain must be exactly `lifeos.app`. That is the host in the
   > app's deep link (`lifeos://lifeos.app/strava-callback`), which is how
   > Strava hands the authorization back to the app.

2. Strava shows you a **Client ID** and a **Client Secret**.
3. In the app, go to **Settings → Strava**, paste both in, and tap
   **Connect Strava**.
4. Approve the request in the browser that opens. The app takes over again and
   runs a first full import.

After that, **Sync now** on the Fitness page pulls anything new. Sync is
incremental, so it only fetches activities since the last run.

**Notes**

- The Client Secret is stored on your device only. It is needed because the
  app talks to Strava directly, with no server in between. It is left out of
  exported backups.
- If the browser does not hand control back automatically, use
  **Paste code manually** in Settings: copy the whole address the browser
  ended up on and paste it in.
- Strava rate-limits to 100 requests per 15 minutes. A large history may need
  a second run; the app tells you when that happens.
- Disconnecting lets you choose whether to keep the imported activities.

---

## Setting up the AI coach

1. Create a free account at <https://console.groq.com> and generate a key at
   <https://console.groq.com/keys>.
2. In the app, go to **Settings → AI coach** and paste the key in.
3. Tap **Refresh models** to pull the list available on your account, pick one,
   then **Test key** to confirm it works.

Groq's free tier is generous but rate limited per minute. If a model starts
returning errors, wait a moment or pick a smaller one such as
`llama-3.1-8b-instant`.

### A note on where the key lives

The Groq key you enter is stored on the device, in the app's private storage, and coach requests go directly from your device to Groq. Maya's backend handles account data sync; it does not proxy Groq requests. The key is excluded from exported backups.

You can instead compile a key in at build time with `VITE_GROQ_API_KEY` (see
`.env.example`), but that key ships inside the APK and can be extracted from
it, so it is no more private. The in-app setting is preferred and overrides
the build-time value. Keys are excluded from exported backups either way.

The coach card on the Today page and the four analysis cards behind **More**
are computed on your device and work with no key and no connection. Only the
question box needs the API.

---

## Building locally

Requires Node 22, pnpm 10, JDK 21 and the Android SDK.

```bash
pnpm install
```

Run the web version with hot reload:

```bash
pnpm dev
```

Build a debug APK:

```bash
pnpm android:debug
```

It lands at `android/app/build/outputs/apk/debug/app-debug.apk`.

Open the project in Android Studio instead:

```bash
pnpm android
```

### Signed release builds

Create a keystore once:

```bash
keytool -genkey -v -keystore maya.keystore -alias maya -keyalg RSA -keysize 2048 -validity 10000
```

Then create `android/keystore.properties` (it is gitignored):

```properties
storeFile=/absolute/path/to/maya.keystore
storePassword=your-store-password
keyAlias=maya
keyPassword=your-key-password
```

```bash
pnpm android:release
```

**Keep that keystore safe.** Android only lets you update an app with the
same signing key it was installed with. Lose it and you have to uninstall
before you can install a new build, which wipes the app's data.

---

## Releasing updates

The GitHub Actions workflow in `.github/workflows/android.yml` builds the APK
for you.

- **Every push** to `main` or a `claude/**` branch builds a debug APK and
  attaches it to the run as an artifact.
- **Pushing a tag** like `v1.0.1` builds a signed release APK and publishes a
  GitHub Release with it attached, ready to download on your phone.

To enable signed builds, add four repository secrets under
*Settings → Secrets and variables → Actions*:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 maya.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | Your store password |
| `ANDROID_KEY_ALIAS` | `maya` |
| `ANDROID_KEY_PASSWORD` | Your key password |

Then cut a release:

```bash
git tag v1.0.1 && git push origin v1.0.1
```

Without those secrets the workflow still runs and still produces a debug APK;
it just skips the signed build.

---

## Project layout

```
src/
  db/          Dexie schema, repositories, derived statistics, demo seed
  services/    Strava, Groq, HTTP, backup
  pages/       One file per screen
  components/  Icons, primitives, charts
  lib/         Dates, polyline decoding
android/       Capacitor Android project
assets/        Icon and splash sources
```

### Data model

Every record carries `createdAt`, `updatedAt`, a `deleted` tombstone and an
unused `remoteId`. Deletes are soft. That is deliberate: a sync backend can be
added later without migrating any existing data, which is why the app is
described as local-first rather than local-only.

### Where your data lives

IndexedDB, in the app's private storage on the device. Other apps cannot read
it. It is not encrypted at rest beyond Android's own full-disk encryption, so
treat the device passcode as the thing protecting it. API keys live in the
same place and are excluded from exported backups.

Uninstalling the app deletes everything. Export a backup first.
