import { useCallback, useEffect, useRef, useState } from "react"
import { Icon } from "../components/Icon"
import { Badge, Button, Card, Modal, PageHeader, SectionTitle } from "../components/UI"
import { clearAllData } from "../db/repo"
import { setSetting, setSettings, useSettings } from "../db/settings"
import { removeDemoData, seedDemoData } from "../db/seed"
import { exportBackup, importBackup, readFileAsText } from "../services/backup"
import {
  beginStravaAuth, callbackDomain, disconnectStrava, exchangeCodeForToken,
  extractAuthCode, redirectUri, syncStravaActivities,
} from "../services/strava"
import {
  FALLBACK_MODELS, fetchModels, hasBuildTimeKey, prettyModelName, resolveApiKey, testApiKey,
} from "../services/groq"
import { Select, type SelectOption } from "../components/Select"
import { isNative, isOnline, platformName } from "../services/platform"
import { sessionNotification, type NotificationStatus } from "../services/sessionNotification"
import {
  ensureExactAlarms, ensureReminderPermission, pendingReminderCount,
  sendTestReminder, syncTaskReminders,
} from "../services/taskReminders"
import { formatRelative } from "../lib/date"
import { useActivities, useBooks, useFocusSessions, useHabits, useTasks } from "../db/stats"
import type { PageProps } from "./shared"

const APP_VERSION = "1.0.0"

export function SettingsPage(_props: PageProps) {
  const [toast, setToast] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  /* Auto-dismiss feedback so the page does not accumulate stale banners. */
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(id)
  }, [toast])

  const notify = (kind: "ok" | "error", text: string) => setToast({ kind, text })

  return (
    <div className="page settings-page">
      <PageHeader
        eyebrow="Settings"
        title="Make it yours."
        description="Your data stays on this device. Connect Strava and an AI model only if you want them."
      />

      {toast && (
        <div className={`settings-toast ${toast.kind}`}>
          <Icon name={toast.kind === "ok" ? "check" : "alert"} size={16} />
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      <ProfileSection />
      <TargetsSection />
      <NotificationsSection onNotify={notify} />
      <StravaSection onNotify={notify} />
      <AiSection onNotify={notify} />
      <DataSection onNotify={notify} />
      <AboutSection />
    </div>
  )
}

/* ---------------------------------------------------------------- profile */

function ProfileSection() {
  const settings = useSettings()
  const [name, setName] = useState(settings.profileName)

  useEffect(() => setName(settings.profileName), [settings.profileName])

  return (
    <Card className="settings-card">
      <SectionTitle title="Profile" subtitle="Used for the greeting on Today" />
      <label className="field">
        <span>Your name</span>
        <input
          value={name}
          placeholder="Alex"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void setSetting("profileName", name.trim())}
        />
      </label>
      <div className="field">
        <span>Appearance</span>
        <div className="answer-pills">
          {(["light", "dark"] as const).map((theme) => (
            <button
              key={theme}
              className={settings.theme === theme ? "active" : ""}
              onClick={() => void setSetting("theme", theme)}
            >
              <Icon name={theme === "light" ? "sun" : "moon"} size={15} />
              {theme === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}

/* ---------------------------------------------------------------- targets */

function TargetsSection() {
  const settings = useSettings()
  return (
    <Card className="settings-card">
      <SectionTitle title="Daily targets" subtitle="These drive the rings and progress bars" />
      <div className="field-row">
        <label className="field">
          <span>Focus target (minutes)</span>
          <input
            type="number"
            inputMode="numeric"
            min={15}
            max={960}
            value={settings.focusDailyTargetMinutes}
            onChange={(e) =>
              void setSetting("focusDailyTargetMinutes", Math.max(15, Number(e.target.value) || 15))
            }
          />
        </label>
        <label className="field">
          <span>Water target (glasses)</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            value={settings.waterDailyTarget}
            onChange={(e) =>
              void setSetting("waterDailyTarget", Math.min(20, Math.max(1, Number(e.target.value) || 1)))
            }
          />
        </label>
      </div>
      <label className="field">
        <span>Reading target (minutes)</span>
        <input
          type="number"
          inputMode="numeric"
          min={5}
          max={480}
          value={settings.readingDailyTargetMinutes}
          onChange={(e) =>
            void setSetting("readingDailyTargetMinutes", Math.max(5, Number(e.target.value) || 5))
          }
        />
      </label>
    </Card>
  )
}

function NotificationsSection({
  onNotify,
}: {
  onNotify: (k: "ok" | "error", t: string) => void
}) {
  const settings = useSettings()
  const [status, setStatus] = useState<NotificationStatus | null>(null)
  const [pending, setPending] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setStatus(await sessionNotification.status())
    setPending(await pendingReminderCount())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!sessionNotification.supported()) {
    return (
      <Card className="settings-card">
        <SectionTitle
          title="Notifications"
          subtitle="Available in the Android app"
        />
        <p className="soft-note">
          The browser cannot show a live timer or schedule a reminder that
          survives the tab closing, so notifications only run on the installed
          app.
        </p>
      </Card>
    )
  }

  const granted = status?.granted ?? false
  const muted = granted && status?.channelEnabled === false

  return (
    <Card className="settings-card">
      <SectionTitle
        title="Notifications"
        subtitle="The running timer, and reminders when a task is due"
        action={
          <Badge tone={granted && !muted ? "sage" : "coral"}>
            {!granted ? "Off" : muted ? "Muted" : "On"}
          </Badge>
        }
      />

      {!granted && (
        <div className="settings-help">
          <Icon name="alert" size={16} />
          <div>
            <p>
              Android has not granted notification permission, so neither the
              session timer nor task reminders can appear.
            </p>
          </div>
        </div>
      )}

      {muted && (
        <div className="settings-help">
          <Icon name="alert" size={16} />
          <div>
            <p>
              Permission is granted but the channel is switched off in Android
              settings, so nothing will show.
            </p>
          </div>
        </div>
      )}

      <div className="settings-row">
        <div>
          <strong>Task reminders</strong>
          <small>Notify when a task with a due time is about to be due.</small>
        </div>
        <button
          className={`switch ${settings.taskRemindersEnabled ? "on" : ""}`}
          role="switch"
          aria-checked={settings.taskRemindersEnabled}
          aria-label="Task reminders"
          onClick={async () => {
            const next = !settings.taskRemindersEnabled
            await setSetting("taskRemindersEnabled", next)
            if (next) {
              await ensureReminderPermission()
              await ensureExactAlarms()
            }
            const result = await syncTaskReminders()
            await refresh()
            onNotify(
              "ok",
              next
                ? `Reminders on. ${result.scheduled} scheduled.`
                : "Reminders off.",
            )
          }}
        >
          <i />
        </button>
      </div>

      <label className="field">
        <span>Remind me this many minutes before</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={1440}
          value={settings.taskReminderLeadMinutes}
          onChange={(e) =>
            void setSetting(
              "taskReminderLeadMinutes",
              Math.min(1440, Math.max(0, Number(e.target.value) || 0)),
            )
          }
          onBlur={() => void syncTaskReminders().then(refresh)}
        />
      </label>

      <div className="settings-counts">
        <div>
          <strong>{pending}</strong>
          <span>scheduled</span>
        </div>
        <div>
          <strong>{settings.taskReminderLeadMinutes}m</strong>
          <span>lead time</span>
        </div>
      </div>

      <div className="settings-actions">
        <Button
          variant="secondary"
          icon="alert"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("test")
            const ok = await sendTestReminder()
            await refresh()
            setBusy(null)
            onNotify(
              ok ? "ok" : "error",
              ok
                ? "A test reminder will arrive in about five seconds."
                : "Could not schedule a test. Check the permission below.",
            )
          }}
        >
          {busy === "test" ? "Sending…" : "Send a test"}
        </Button>
        <Button
          variant="secondary"
          icon="sync"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("sync")
            const result = await syncTaskReminders()
            await refresh()
            setBusy(null)
            onNotify("ok", `${result.scheduled} reminder(s) scheduled.`)
          }}
        >
          {busy === "sync" ? "Rescheduling…" : "Reschedule"}
        </Button>
        <Button
          icon="settings"
          onClick={() => void sessionNotification.openSettings()}
        >
          Android settings
        </Button>
      </div>
    </Card>
  )
}

/* ----------------------------------------------------------------- strava */

function StravaSection({ onNotify }: { onNotify: (k: "ok" | "error", t: string) => void }) {
  const settings = useSettings()
  const [clientId, setClientId] = useState(settings.stravaClientId)
  const [clientSecret, setClientSecret] = useState(settings.stravaClientSecret)
  const [showSecret, setShowSecret] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasted, setPasted] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const activities = useActivities()
  const stravaCount = activities.filter((a) => a.source === "strava").length

  useEffect(() => {
    setClientId(settings.stravaClientId)
    setClientSecret(settings.stravaClientSecret)
  }, [settings.stravaClientId, settings.stravaClientSecret])

  const configured = settings.stravaClientId !== "" && settings.stravaClientSecret !== ""
  const connected = settings.stravaRefreshToken !== ""

  const saveCredentials = async () => {
    await setSettings({
      stravaClientId: clientId.trim(),
      stravaClientSecret: clientSecret.trim(),
    })
    onNotify("ok", "Strava credentials saved.")
  }

  const connect = async () => {
    setBusy("connect")
    try {
      await saveCredentials()
      await beginStravaAuth()
      // On device the app is backgrounded here and resumes via the deep link.
      setPasteOpen(true)
    } catch (error) {
      onNotify("error", error instanceof Error ? error.message : "Could not start Strava sign-in.")
    } finally {
      setBusy(null)
    }
  }

  const completeWithCode = async () => {
    const code = extractAuthCode(pasted)
    if (!code) {
      onNotify("error", "No authorization code found in that text.")
      return
    }
    setBusy("exchange")
    try {
      await exchangeCodeForToken(code)
      setPasteOpen(false)
      setPasted("")
      onNotify("ok", "Strava connected. Running a first sync…")
      const result = await syncStravaActivities({ full: true })
      onNotify("ok", result.message)
    } catch (error) {
      onNotify("error", error instanceof Error ? error.message : "Could not complete sign-in.")
    } finally {
      setBusy(null)
    }
  }

  const sync = async (full: boolean) => {
    setBusy(full ? "full" : "sync")
    try {
      const result = await syncStravaActivities({ full })
      onNotify(result.skipped ? "error" : "ok", result.message)
    } catch (error) {
      onNotify("error", error instanceof Error ? error.message : "Sync failed.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="settings-card">
      <SectionTitle
        title="Strava"
        subtitle="Imports your activities. Needs a connection; everything else works offline."
        action={
          <Badge tone={connected ? "sage" : "neutral"}>
            {connected ? "Connected" : configured ? "Not connected" : "Not set up"}
          </Badge>
        }
      />

      <div className="settings-help">
        <Icon name="info" size={16} />
        <div>
          <p>
            Create an API application at <strong>strava.com/settings/api</strong>, then copy its
            Client ID and Client Secret here.
          </p>
          <p>
            Set the <strong>Authorization Callback Domain</strong> to{" "}
            <code>{callbackDomain()}</code>.
          </p>
        </div>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Client ID</span>
          <input
            value={clientId}
            inputMode="numeric"
            placeholder="123456"
            onChange={(e) => setClientId(e.target.value)}
            onBlur={() => void saveCredentials()}
          />
        </label>
        <label className="field">
          <span>Client Secret</span>
          <div className="input-with-action">
            <input
              type={showSecret ? "text" : "password"}
              value={clientSecret}
              placeholder="••••••••••••"
              autoComplete="off"
              onChange={(e) => setClientSecret(e.target.value)}
              onBlur={() => void saveCredentials()}
            />
            <button type="button" onClick={() => setShowSecret((v) => !v)}>
              {showSecret ? "Hide" : "Show"}
            </button>
          </div>
        </label>
      </div>

      {connected && (
        <div className="settings-status">
          <div>
            <strong>{settings.stravaAthleteName || "Connected athlete"}</strong>
            <small>
              {stravaCount} activities imported ·{" "}
              {settings.stravaLastSyncAt > 0
                ? `last synced ${formatRelative(settings.stravaLastSyncAt)}`
                : "never synced"}
            </small>
          </div>
        </div>
      )}

      <div className="settings-actions">
        {!connected ? (
          <Button icon="link" disabled={!configured || busy !== null} onClick={() => void connect()}>
            {busy === "connect" ? "Opening Strava…" : "Connect Strava"}
          </Button>
        ) : (
          <>
            <Button icon="sync" disabled={busy !== null} onClick={() => void sync(false)}>
              {busy === "sync" ? "Syncing…" : "Sync now"}
            </Button>
            <Button variant="secondary" disabled={busy !== null} onClick={() => void sync(true)}>
              {busy === "full" ? "Importing…" : "Re-import everything"}
            </Button>
            <Button variant="danger" icon="logout" onClick={() => setConfirmDisconnect(true)}>
              Disconnect
            </Button>
          </>
        )}
        {configured && !connected && (
          <Button variant="secondary" onClick={() => setPasteOpen(true)}>
            Paste code manually
          </Button>
        )}
      </div>

      {!isOnline() && (
        <p className="soft-note">You are offline. Strava actions will work once you reconnect.</p>
      )}

      {pasteOpen && (
        <Modal title="Finish connecting Strava" onClose={() => setPasteOpen(false)}>
          <p className="modal-intro">
            If the app did not return automatically, copy the whole address Strava redirected to
            and paste it below. It looks like{" "}
            <code>{redirectUri()}?state=&amp;code=…</code>
          </p>
          <label className="field">
            <span>Redirect URL or code</span>
            <input
              autoFocus
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Paste here"
            />
          </label>
          <div className="modal-actions">
            <Button variant="secondary" type="button" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!pasted.trim() || busy === "exchange"}
              onClick={() => void completeWithCode()}
            >
              {busy === "exchange" ? "Connecting…" : "Connect"}
            </Button>
          </div>
        </Modal>
      )}

      {confirmDisconnect && (
        <Modal title="Disconnect Strava?" onClose={() => setConfirmDisconnect(false)}>
          <p className="modal-intro">
            Your tokens will be removed from this device. Choose whether to keep the{" "}
            {stravaCount} imported activities.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setConfirmDisconnect(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                await disconnectStrava({ removeActivities: false })
                setConfirmDisconnect(false)
                onNotify("ok", "Strava disconnected. Activities kept.")
              }}
            >
              Keep activities
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await disconnectStrava({ removeActivities: true })
                setConfirmDisconnect(false)
                onNotify("ok", "Strava disconnected and activities removed.")
              }}
            >
              Remove activities
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  )
}

/* --------------------------------------------------------------------- ai */

function AiSection({ onNotify }: { onNotify: (k: "ok" | "error", t: string) => void }) {
  const settings = useSettings()
  const [apiKey, setApiKey] = useState(settings.groqApiKey)
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState(FALLBACK_MODELS)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => setApiKey(settings.groqApiKey), [settings.groqApiKey])

  const saveKey = async () => {
    await setSetting("groqApiKey", apiKey.trim())
  }

  const refreshModels = async () => {
    setBusy("models")
    try {
      await saveKey()
      const key = apiKey.trim() || (hasBuildTimeKey() ? await resolveApiKey() : "")
      if (!key) throw new Error("Add a key first.")
      const list = await fetchModels(key)
      setModels(list)
      onNotify("ok", `Found ${list.length} models on your account.`)
    } catch (error) {
      onNotify("error", error instanceof Error ? error.message : "Could not load models.")
    } finally {
      setBusy(null)
    }
  }

  const test = async () => {
    setBusy("test")
    try {
      await saveKey()
      const key = await resolveApiKey()
      await testApiKey(key, settings.groqModel)
      onNotify("ok", "The model replied. Your key works.")
    } catch (error) {
      onNotify("error", error instanceof Error ? error.message : "The test failed.")
    } finally {
      setBusy(null)
    }
  }

  const configured = settings.groqApiKey.trim().length > 0 || hasBuildTimeKey()
  const options: SelectOption[] = models.map((model) => ({
    value: model.id,
    label: model.name,
    hint: model.id,
  }))
  const known = models.some((model) => model.id === settings.groqModel)

  return (
    <Card className="settings-card">
      <SectionTitle
        title="AI coach"
        subtitle="Powered by Groq. Optional, and the only feature that needs a connection."
        action={
          <Badge tone={configured ? "sage" : "neutral"}>
            {configured ? "Key set" : "No key"}
          </Badge>
        }
      />

      <div className="settings-help">
        <Icon name="info" size={16} />
        <div>
          <p>
            Create a free key at <strong>console.groq.com/keys</strong>. The free tier is
            generous but rate limited per minute.
          </p>
          <p>
            The coach is sent a summary of your logged data. Nothing leaves the device
            until you ask it a question.
          </p>
          {hasBuildTimeKey() && (
            <p>A key was built into this app; anything entered here overrides it.</p>
          )}
        </div>
      </div>

      <label className="field">
        <span>Groq API key</span>
        <div className="input-with-action">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            placeholder="gsk_…"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setApiKey(e.target.value)}
            onBlur={() => void saveKey()}
          />
          <button type="button" onClick={() => setShowKey((v) => !v)}>
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      <div className="field">
        <span>Model</span>
        <Select
          value={settings.groqModel}
          options={
            known
              ? options
              : [...options, { value: settings.groqModel, label: prettyModelName(settings.groqModel), hint: "custom" }]
          }
          onChange={(value) => void setSetting("groqModel", value)}
          sheetTitle="Groq model"
          placeholder="Choose a model"
        />
      </div>

      <div className="settings-actions">
        <Button
          variant="secondary"
          icon="sync"
          disabled={busy !== null}
          onClick={() => void refreshModels()}
        >
          {busy === "models" ? "Loading…" : "Refresh models"}
        </Button>
        <Button
          icon="sparkle"
          disabled={!configured || busy !== null}
          onClick={() => void test()}
        >
          {busy === "test" ? "Testing…" : "Test key"}
        </Button>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------- data */

function DataSection({ onNotify }: { onNotify: (k: "ok" | "error", t: string) => void }) {
  const settings = useSettings()
  const tasks = useTasks()
  const habits = useHabits()
  const books = useBooks()
  const focusSessions = useFocusSessions()
  const activities = useActivities()

  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDemoOff, setConfirmDemoOff] = useState(false)

  const toggleDemo = async (next: boolean) => {
    setBusy("demo")
    try {
      if (next) {
        await seedDemoData()
        await setSetting("demoData", true)
        onNotify("ok", "Demo data added.")
      } else {
        await removeDemoData()
        await setSetting("demoData", false)
        onNotify("ok", "Demo data removed.")
      }
    } finally {
      setBusy(null)
      setConfirmDemoOff(false)
    }
  }

  const doExport = async (includeSecrets: boolean) => {
    setBusy("export")
    try {
      const result = await exportBackup(includeSecrets)
      onNotify(
        "ok",
        result.method === "file"
          ? `Saved to ${result.location}.`
          : `Downloaded ${result.location}.`,
      )
    } catch (error) {
      onNotify("error", error instanceof Error ? error.message : "Export failed.")
    } finally {
      setBusy(null)
    }
  }

  const doImport = async (file: File) => {
    setBusy("import")
    try {
      const text = await readFileAsText(file)
      const result = await importBackup(text)
      onNotify("ok", `Imported ${result.imported} records across ${result.tables.length} tables.`)
    } catch (error) {
      onNotify("error", error instanceof Error ? error.message : "Import failed.")
    } finally {
      setBusy(null)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  return (
    <Card className="settings-card">
      <SectionTitle
        title="Your data"
        subtitle="Everything lives in this app's private storage on this device."
      />

      <div className="settings-counts">
        {[
          [tasks.length, "tasks"],
          [habits.length, "habits"],
          [books.length, "books"],
          [focusSessions.length, "sessions"],
          [activities.length, "activities"],
        ].map(([count, label]) => (
          <div key={String(label)}>
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="settings-row">
        <div>
          <strong>Demo data</strong>
          <small>
            A seeded 90 day history so charts and streaks have something to show while you try
            the app.
          </small>
        </div>
        <button
          className={`switch ${settings.demoData ? "on" : ""}`}
          role="switch"
          aria-checked={settings.demoData}
          aria-label="Demo data"
          disabled={busy !== null}
          onClick={() => (settings.demoData ? setConfirmDemoOff(true) : void toggleDemo(true))}
        >
          <i />
        </button>
      </div>

      <div className="settings-actions">
        <Button
          variant="secondary"
          icon="download"
          disabled={busy !== null}
          onClick={() => void doExport(false)}
        >
          {busy === "export" ? "Exporting…" : "Export backup"}
        </Button>
        <Button
          variant="secondary"
          icon="upload"
          disabled={busy !== null}
          onClick={() => fileInput.current?.click()}
        >
          {busy === "import" ? "Importing…" : "Import backup"}
        </Button>
        <Button variant="danger" icon="trash" onClick={() => setConfirmClear(true)}>
          Clear all data
        </Button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void doImport(file)
        }}
      />

      <p className="soft-note">
        Backups leave out your API keys. Import merges by record id, so restoring the same file
        twice is safe.
      </p>

      {confirmDemoOff && (
        <Modal title="Remove demo data?" onClose={() => setConfirmDemoOff(false)}>
          <p className="modal-intro">
            This clears tasks, habits, books, sessions, meals and events — including anything you
            added yourself. Imported Strava activities are kept. Export a backup first if you are
            unsure.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setConfirmDemoOff(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void toggleDemo(false)}>
              Remove demo data
            </Button>
          </div>
        </Modal>
      )}

      {confirmClear && (
        <Modal title="Clear everything?" onClose={() => setConfirmClear(false)}>
          <p className="modal-intro">
            This permanently deletes every record on this device. Your Strava and Groq keys
            are kept so you do not have to re-enter them. This cannot be undone.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await clearAllData()
                await setSetting("demoData", false)
                setConfirmClear(false)
                onNotify("ok", "All records deleted.")
              }}
            >
              Delete everything
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ about */

function AboutSection() {
  return (
    <Card className="settings-card">
      <SectionTitle title="About" />
      <div className="settings-counts">
        <div>
          <strong>{APP_VERSION}</strong>
          <span>version</span>
        </div>
        <div>
          <strong>{isNative() ? platformName() : "web"}</strong>
          <span>platform</span>
        </div>
        <div>
          <strong>{isOnline() ? "online" : "offline"}</strong>
          <span>network</span>
        </div>
      </div>
      <p className="soft-note">
        Maya keeps everything on device. Strava sync and the AI coach are the only features
        that reach the network, and both are off until you add your own keys.
      </p>
    </Card>
  )
}
