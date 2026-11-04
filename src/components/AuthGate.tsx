import { useState, type FormEvent } from "react"
import { MayaMark } from "./MayaMark"
import { Button } from "./UI"
import { isWebCloudConfigured, signInWithPassword, signUpWithPassword } from "../services/supabase"

export function AuthGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const configured = isWebCloudConfigured()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setMessage("")
    try {
      if (creating) {
        const session = await signUpWithPassword(email.trim(), password)
        if (!session) {
          setMessage("Account created. Check your email to confirm it, then sign in.")
          return
        }
      } else {
        await signInWithPassword(email.trim(), password)
      }
      window.dispatchEvent(new Event("maya:cloud-session-changed"))
      onAuthenticated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-gate">
      <section className="auth-card">
        <div className="auth-brand"><MayaMark size={42} /><span>MAYA</span></div>
        <p className="eyebrow">YOUR PERSONAL SPACE</p>
        <h1>{creating ? "Create your account" : "Welcome back."}</h1>
        <p className="auth-copy">Sign in to use Maya and sync your data across web and Android.</p>
        {!configured ? (
          <p className="settings-note settings-error" role="alert">Cloud sign-in is not configured for this build. Set VITE_MAYA_API_URL to your Maya API address.</p>
        ) : (
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <label className="field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <label className="field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={creating ? "new-password" : "current-password"} required /></label>
            <Button type="submit" className="wide" disabled={busy}>{busy ? "Please wait…" : creating ? "Create account" : "Sign in"}</Button>
          </form>
        )}
        {message && <p className="settings-note" role="status">{message}</p>}
        {error && <p className="settings-note settings-error" role="alert">{error}</p>}
        <button className="auth-switch" type="button" onClick={() => { setCreating(!creating); setError(""); setMessage("") }} disabled={busy || !configured}>
          {creating ? "Already have an account? Sign in" : "New to Maya? Create an account"}
        </button>
      </section>
    </main>
  )
}