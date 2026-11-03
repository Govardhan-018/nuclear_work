import { App as CapApp } from "@capacitor/app"
import { Browser } from "@capacitor/browser"
import { SplashScreen } from "@capacitor/splash-screen"
import { StatusBar, Style } from "@capacitor/status-bar"
import { isNative } from "./services/platform"
import { exchangeCodeForToken, extractAuthCode, extractAuthError, syncStravaActivities } from "./services/strava"

export type DeepLinkResult =
  | { kind: "strava"; ok: true; message: string }
  | { kind: "strava"; ok: false; message: string }

/**
 * Registers the Android back button. Returns a teardown function.
 * Back pops the app's own history; at the root it minimises rather than
 * exiting, which is what Android users expect.
 */
export function registerBackButton(onBack: () => boolean): () => void {
  if (!isNative()) return () => {}
  const handle = CapApp.addListener("backButton", () => {
    const handled = onBack()
    if (!handled) void CapApp.minimizeApp()
  })
  return () => {
    void handle.then((h) => h.remove())
  }
}

/**
 * Handles the `lifeos://lifeos.app/strava-callback?code=…` redirect that
 * Strava sends back after the user approves access.
 */
export function registerDeepLinks(onResult: (result: DeepLinkResult) => void): () => void {
  if (!isNative()) return () => {}
  const handle = CapApp.addListener("appUrlOpen", async ({ url }) => {
    if (!url.includes("strava-callback")) return
    // Close the in-app browser the consent screen opened in.
    try {
      await Browser.close()
    } catch {
      /* Already closed. */
    }

    const error = extractAuthError(url)
    if (error) {
      onResult({ kind: "strava", ok: false, message: `Strava sign-in was cancelled (${error}).` })
      return
    }
    const code = extractAuthCode(url)
    if (!code) {
      onResult({ kind: "strava", ok: false, message: "Strava did not return an authorization code." })
      return
    }
    try {
      await exchangeCodeForToken(code)
      const sync = await syncStravaActivities({ full: true })
      onResult({ kind: "strava", ok: true, message: `Strava connected. ${sync.message}` })
    } catch (err) {
      onResult({
        kind: "strava",
        ok: false,
        message: err instanceof Error ? err.message : "Could not finish connecting to Strava.",
      })
    }
  })
  return () => {
    void handle.then((h) => h.remove())
  }
}

/** Matches the system bars to the app theme. */
export async function applyNativeTheme(theme: "light" | "dark"): Promise<void> {
  if (!isNative()) return
  try {
    await StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light })
    await StatusBar.setBackgroundColor({ color: theme === "dark" ? "#111311" : "#eceeea" })
  } catch {
    /* Not fatal; some devices disallow changing the status bar. */
  }
}

export async function hideSplash(): Promise<void> {
  if (!isNative()) return
  try {
    await SplashScreen.hide()
  } catch {
    /* Already hidden. */
  }
}

/** Fires when the app returns to the foreground, for opportunistic refreshes. */
export function registerResume(onResume: () => void): () => void {
  if (!isNative()) {
    const handler = () => {
      if (document.visibilityState === "visible") onResume()
    }
    document.addEventListener("visibilitychange", handler)
    return () => document.removeEventListener("visibilitychange", handler)
  }
  const handle = CapApp.addListener("resume", onResume)
  return () => {
    void handle.then((h) => h.remove())
  }
}
