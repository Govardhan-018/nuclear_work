import { registerPlugin } from "@capacitor/core"
import { isNative } from "./platform"

export type SessionAction = "pause" | "resume" | "stop"

type StartOptions = {
  title: string
  subject: string
  running: boolean
  /** True for a countdown, false for a stopwatch. */
  countDown: boolean
  /** Epoch ms the chronometer counts to, or counts up from. */
  base: number
  /** Shown while paused, when the chronometer is switched off. */
  staticTime: string
}

type SessionNotificationPlugin = {
  isAvailable(): Promise<{ available: boolean; granted: boolean }>
  requestPermission(): Promise<{ granted: boolean }>
  start(options: StartOptions): Promise<{ shown: boolean; reason?: string }>
  stop(): Promise<void>
  addListener(
    event: "sessionAction",
    handler: (payload: { action: SessionAction }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

const plugin = registerPlugin<SessionNotificationPlugin>("SessionNotification")

/**
 * Ongoing notification for a running session, backed by an Android foreground
 * service. No-ops on the web, where there is no equivalent: a Notification
 * cannot host live-updating time or transport controls, so the app simply
 * goes without rather than faking one.
 */
export const sessionNotification = {
  supported: () => isNative(),

  async requestPermission(): Promise<boolean> {
    if (!isNative()) return false
    try {
      const { granted } = await plugin.requestPermission()
      return granted
    } catch {
      return false
    }
  },

  async granted(): Promise<boolean> {
    if (!isNative()) return false
    try {
      const { granted } = await plugin.isAvailable()
      return granted
    } catch {
      return false
    }
  },

  async show(options: StartOptions): Promise<void> {
    if (!isNative()) return
    try {
      await plugin.start(options)
    } catch {
      /* The session is unaffected if the notification cannot be shown. */
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

  /** Subscribes to the notification's Pause / Resume / Stop buttons. */
  onAction(handler: (action: SessionAction) => void): () => void {
    if (!isNative()) return () => {}
    const pending = plugin.addListener("sessionAction", ({ action }) => handler(action))
    return () => {
      void pending.then((listener) => listener.remove()).catch(() => {})
    }
  },
}
