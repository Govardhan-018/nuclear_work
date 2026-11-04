import { useState, type FormEvent } from "react"
import { MayaMark } from "./MayaMark"
import { Button } from "./UI"
import {
  isWebCloudConfigured, resendConfirmationEmail, signInWithPassword, signUpWithPassword,
} from "../services/supabase"

export function AuthGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const configured = isWebCloudConfigured()

  const clearFeedback = () => {
    setError("")
    setMessage("")
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    clearFeedback()
    setNeedsConfirmation(false)
    try {
      if (creating) {
        const session = await signUpWithPassword(email.trim(), password)
        if (!session) {
          setNeedsConfirmation(true)
          setMessage("We sent a confirmation link to your email. Open it, then return here and sign in.")
          return
        }
      } else {
        await signInWithPassword(email.trim(), password)
      }
      window.dispatchEvent(new Event("maya:cloud-session-changed"))
      onAuthenticated()
    } catch (cause) {
      const nextError = cause instanceof Error ? cause.message : "Could not sign in."
      setError(nextError)
      setNeedsConfirmation(nextError.toLowerCase().includes("email not confirmed"))
    } finally {
      setBusy(false)
    }
  }

  async function resendConfirmation() {
    if (!email.trim()) {
      setError("Enter the email address used to create your account.")
      return
    }
    setBusy(true)
    clearFeedback()
    try {
      await resendConfirmationEmail(email.trim())
      setMessage("A fresh confirmation link has been sent. Check your inbox and spam folder.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send a confirmation email.")
    } finally {
      setBusy(false)
    }
  }

  function switchMode() {
    setCreating((current) => !current)
    setNeedsConfirmation(false)
    clearFeedback()
  }

  return (
    <main className="auth-gate">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-topline">
          <div className="auth-brand"><MayaMark size={38} /><span>MAYA</span></div>
          <span className="auth-private">Private sync</span>
        </div>
        <div className="auth-intro">
          <p className="eyebrow">YOUR PERSONAL SPACE</p>
          <h1 id="auth-title">{creating ? "Create your Maya account" : "Welcome back."}</h1>
          <p>Use one account to keep your Maya data available on both web and Android.</p>
        </div>
        {!configured ? (
          <p className="auth-feedback error" role="alert">Cloud sign-in is not configured for this build. Set VITE_MAYA_API_URL to your Maya API address.</p>
        ) : (
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <label className="field">
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required />
            </label>
            <label className="field">
              <span>Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={creating ? "new-password" : "current-password"} placeholder={creating ? "At least 8 characters" : "Your password"} minLength={creating ? 8 : undefined} required />
            </label>
            <Button type="submit" className="wide" disabled={busy}>{busy ? "Please wait…" : creating ? "Create account" : "Sign in"}</Button>
          </form>
        )}
        {message && <p className="auth-feedback success" role="status">{message}</p>}
        {error && <p className="auth-feedback error" role="alert">{error}</p>}
        {needsConfirmation && configured && (
          <Button type="button" variant="secondary" className="wide" disabled={busy} onClick={() => void resendConfirmation()}>
            {busy ? "Sending…" : "Resend confirmation email"}
          </Button>
        )}
        <div className="auth-footer">
          <span>{creating ? "Already have an account?" : "New to Maya?"}</span>
          <button className="auth-switch" type="button" onClick={switchMode} disabled={busy || !configured}>
            {creating ? "Sign in" : "Create an account"}
          </button>
        </div>
      </section>
    </main>
  )
}
