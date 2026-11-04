import { useEffect, useState, type FormEvent } from "react"
import {
  isWebCloudConfigured, loadWebSession, signInWithPassword, signOutWeb, signUpWithPassword,
} from "../services/supabase"
import { syncCloudData } from "../services/cloudSync"
import { Badge, Button, Card, SectionTitle } from "./UI"

export function CloudSyncSection() {
  const [session, setSession] = useState(loadWebSession)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const refresh = () => setSession(loadWebSession())
    const synced = (event: Event) => {
      const detail = (event as CustomEvent<{ pushed: number; pulled: number }>).detail
      setMessage(`Synced. ${detail.pushed} changes uploaded, ${detail.pulled} downloaded.`)
      setError("")
      refresh()
    }
    window.addEventListener("maya:cloud-session-changed", refresh)
    window.addEventListener("maya:cloud-sync-complete", synced)
    return () => {
      window.removeEventListener("maya:cloud-session-changed", refresh)
      window.removeEventListener("maya:cloud-sync-complete", synced)
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setMessage("")
    try {
      if (creatingAccount) {
        const created = await signUpWithPassword(email.trim(), password)
        if (!created) {
          setMessage("Account request sent. Check your email to confirm, then sign in.")
          return
        }
        setSession(created)
      } else {
        const signedIn = await signInWithPassword(email.trim(), password)
        setSession(signedIn)
      }
      window.dispatchEvent(new Event("maya:cloud-session-changed"))
      const result = await syncCloudData()
      setMessage(`Connected. ${result.pushed} changes uploaded, ${result.pulled} downloaded.`)
      setPassword("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect to Maya cloud.")
    } finally {
      setBusy(false)
    }
  }

  async function syncNow() {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const result = await syncCloudData()
      setMessage(`Synced. ${result.pushed} changes uploaded, ${result.pulled} downloaded.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sync failed.")
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    setBusy(true)
    try {
      await signOutWeb()
      setSession(null)
      setMessage("Signed out. Your data remains on this device.")
      window.dispatchEvent(new Event("maya:cloud-session-changed"))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="settings-card">
      <SectionTitle title="Cloud sync" subtitle="Use the same account on web and Android. Your data also stays available offline." />
      {!isWebCloudConfigured() ? (
        <p className="settings-note">Cloud sync is not configured for this build.</p>
      ) : session ? (
        <div className="cloud-sync-account">
          <div className="section-title">
            <div><strong>{session.user.email || "Signed in"}</strong><p>Connected to Maya cloud</p></div>
            <Badge tone="teal">Connected</Badge>
          </div>
          <div className="header-actions">
            <Button variant="secondary" onClick={() => void syncNow()} disabled={busy}>
              {busy ? "Syncing…" : "Sync now"}
            </Button>
            <Button variant="ghost" onClick={() => void signOut()} disabled={busy}>Sign out</Button>
          </div>
        </div>
      ) : (
        <form className="cloud-sync-form" onSubmit={(event) => void submit(event)}>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={creatingAccount ? "new-password" : "current-password"} required />
          </label>
          <div className="header-actions">
            <Button type="submit" disabled={busy}>{busy ? "Connecting…" : creatingAccount ? "Create account & sync" : "Sign in & sync"}</Button>
            <Button type="button" variant="ghost" onClick={() => { setCreatingAccount(!creatingAccount); setMessage(""); setError("") }} disabled={busy}>
              {creatingAccount ? "I already have an account" : "Create account"}
            </Button>
          </div>
        </form>
      )}
      {message && <p className="settings-note" role="status">{message}</p>}
      {error && <p className="settings-note settings-error" role="alert">{error}</p>}
    </Card>
  )
}