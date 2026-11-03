import { registerPlugin } from "@capacitor/core"
import { isNative } from "./platform"

export type SessionAction = "pause" | "resume" | "stop"

export type NotificationStatus = {
  available: boolean
  /** POST_NOTIFICATIONS granted (or pre-Android-13 with notifications on). */
  granted: boolean
  /** The channel can still be switched off after the permission is granted. */
  channelEnabled: boolean
  notificationsEnabled: boolean
}

type StartOptions = {
  title: string
  subject: string
  running: boolean
  /** True for a countdown, false for a stopwatch. */
  countDown: boolean
  /** Epoch ms the chronometer counts to, or up from. */
  base: number
  /** Shown while paused, when the chronometer is off. */
  staticTime: string
}

type Native = {
  checkStatus(): Promise<NotificationStatus>
  requestPermission(): Promise<{ granted: boolean }>
  start(options: Omit<StartOptions, "base"> & { base: string }): Promise<{
    shown: boolean
    serviceStarted: boolean
  }>
  stop(): Promise<void>
  openSettings(): Promise<void>
  addListener(
    event: "sessionAction",
    handler: (payload: { action: SessionAction }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

const plugin = registerPlugin<Native>("SessionNotification")

const UNAVAILABLE: NotificationStatus = {
  available: false,
  granted: false,
  channelEnabled: false,
  notificationsEnabled: false,
}

/**
 * Ongoing notification for a running session.
 *
 * No-ops on the web: a web Notification cannot host live-updating time or
 * transport controls, so the app goes without rather than faking one.
 */
export const sessionNotification = {
  supported: () => isNative(),

  async status(): Promise<NotificationStatus> {
    if (!isNative()) return UNAVAILABLE
    try {
      return await plugin.checkStatus()
    } catch {
      return UNAVAILABLE
    }
  },

  /** Prompts if needed. Resolves to the permission state afterwards. */
  async ensurePermission(): Promise<boolean> {
    if (!isNative()) return false
    try {
      const current = await plugin.checkStatus()
      if (current.granted) return true
      const { granted } = await plugin.requestPermission()
      return granted
    } catch {
      return false
    }
  },

  /**
   * Shows or refreshes the notification. Returns why it failed rather than
   * swallowing it, so the caller can prompt or tell the user.
   */
  async show(
    options: StartOptions,
  ): Promise<{ ok: true } | { ok: false; reason: "permission" | "failed" }> {
    if (!isNative()) return { ok: false, reason: "failed" }
    try {
      // base exceeds the precision the bridge guarantees for a JSON number.
      await plugin.start({ ...options, base: String(Math.round(options.base)) })
      return { ok: true }
    } catch (error) {
      const code = (error as { code?: string } | undefined)?.code
      const message = (error as { message?: string } | undefined)?.message ?? ""
      const permission = code === "permission-denied" || message.includes("notification-permission")
      return { ok: false, reason: permission ? "permission" : "failed" }
    }
  },

  async hide(): Promise<void> {
    if (!isNative()) return
    try {
      await plugin.stop()
    } catch {
      /* Already gone. */
    }
  },

  async openSettings(): Promise<void> {
    if (!isNative()) return
    try {
      await plugin.openSettings()
    } catch {
      /* Nothing useful to do if the settings screen will not open. */
    }
  },

  /** Subscribes to the notification's Pause / Resume / Stop buttons. */
  onAction(handler: (action: SessionAction) => void): () => void {
    if (!isNative()) return () => {}
    const pending = plugin.addListener("sessionAction", ({ action }) => handler(action))
    return () => {
      void pending.then((listener) => listener.remove()).catch(() => {})
    }
  },
}
