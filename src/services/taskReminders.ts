import { LocalNotifications } from "@capacitor/local-notifications"
import { db } from "../db/db"
import { getAllSettings } from "../db/settings"
import { isNative } from "./platform"
import type { Task } from "../db/types"

/**
 * Reminders for tasks with a due time.
 *
 * Scheduled with the system alarm clock rather than a timer inside the app, so
 * they fire whether or not Maya is running. Android caps how many
 * notifications an app may have pending, so only the soonest are scheduled and
 * the set is rebuilt whenever tasks change or the app resumes.
 */

const CHANNEL_ID = "maya-tasks"
/** Comfortably under Android's ~50 pending-intent ceiling. */
const MAX_SCHEDULED = 32

/**
 * Notification ids must be 32-bit ints, but task ids are uuids. Hash to a
 * stable positive int, offset so they cannot collide with the session
 * notification's fixed id.
 */
function notificationId(taskId: string): number {
  let hash = 0
  for (let i = 0; i < taskId.length; i++) {
    hash = (hash * 31 + taskId.charCodeAt(i)) | 0
  }
  return 100_000 + (Math.abs(hash) % 1_000_000)
}

async function ensureChannel(): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Task reminders",
      description: "Tells you when a task is due.",
      importance: 4, // HIGH: heads-up, so a due task is not missed.
      visibility: 1,
      vibration: true,
    })
  } catch {
    /* Channels are Android-only and may already exist. */
  }
}

export async function remindersPermitted(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const current = await LocalNotifications.checkPermissions()
    return current.display === "granted"
  } catch {
    return false
  }
}

export async function ensureReminderPermission(): Promise<boolean> {
  if (!isNative()) return false
  try {
    if (await remindersPermitted()) return true
    const result = await LocalNotifications.requestPermissions()
    return result.display === "granted"
  } catch {
    return false
  }
}

/**
 * Android 12+ needs a separate grant to fire an alarm at an exact minute.
 * Without it the system may delay a reminder, so it is requested but not
 * required: an approximate reminder beats none.
 */
export async function ensureExactAlarms(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const supported = await LocalNotifications.checkExactNotificationSetting()
    if (supported.exact_alarm === "granted") return true
    const result = await LocalNotifications.changeExactNotificationSetting()
    return result.exact_alarm === "granted"
  } catch {
    // Older Androids have no such setting and schedule exactly anyway.
    return true
  }
}

function body(task: Task, leadMinutes: number): string {
  const due = task.dueAt === null ? "" : new Date(task.dueAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
  if (leadMinutes <= 0) return `Due now · ${task.category}`
  return `Due at ${due} · ${task.category}`
}

/**
 * Rebuilds the whole pending set from the current tasks. Cheaper and far more
 * reliable than tracking individual schedule and cancel calls, which drift out
 * of step the moment an edit or a device reboot is missed.
 */
export async function syncTaskReminders(): Promise<{ scheduled: number; reason?: string }> {
  if (!isNative()) return { scheduled: 0, reason: "not-native" }

  const settings = await getAllSettings()
  await ensureChannel()

  // Clear whatever we scheduled last time.
  try {
    const pending = await LocalNotifications.getPending()
    const ours = pending.notifications.filter((n) => n.id >= 100_000 && n.id < 1_100_000)
    if (ours.length > 0) {
      await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
    }
  } catch {
    /* Nothing pending. */
  }

  if (!settings.taskRemindersEnabled) return { scheduled: 0, reason: "disabled" }
  if (!(await remindersPermitted())) return { scheduled: 0, reason: "no-permission" }

  const lead = Math.max(0, settings.taskReminderLeadMinutes)
  const now = Date.now()

  const due = (await db.tasks.toArray())
    .filter((task) => task.deleted !== 1 && task.done !== 1 && task.dueAt !== null)
    .map((task) => ({ task, at: (task.dueAt as number) - lead * 60_000 }))
    // A reminder in the past would fire immediately; skip those.
    .filter((entry) => entry.at > now + 5_000)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_SCHEDULED)

  if (due.length === 0) return { scheduled: 0 }

  try {
    await LocalNotifications.schedule({
      notifications: due.map(({ task, at }) => ({
        id: notificationId(task.id),
        title: task.title,
        body: body(task, lead),
        channelId: CHANNEL_ID,
        schedule: { at: new Date(at), allowWhileIdle: true },
        smallIcon: "ic_stat_session",
        extra: { taskId: task.id },
      })),
    })
    return { scheduled: due.length }
  } catch (error) {
    return { scheduled: 0, reason: String((error as Error)?.message ?? error) }
  }
}

/** Pending reminders we own, for the Settings readout. */
export async function pendingReminderCount(): Promise<number> {
  if (!isNative()) return 0
  try {
    const pending = await LocalNotifications.getPending()
    return pending.notifications.filter((n) => n.id >= 100_000 && n.id < 1_100_000).length
  } catch {
    return 0
  }
}

/** Fires a reminder a few seconds out, so the user can confirm it works. */
export async function sendTestReminder(): Promise<boolean> {
  if (!isNative()) return false
  await ensureChannel()
  if (!(await ensureReminderPermission())) return false
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 99_999,
          title: "Maya reminders are working",
          body: "This is what a task reminder looks like.",
          channelId: CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 5_000), allowWhileIdle: true },
          smallIcon: "ic_stat_session",
        },
      ],
    })
    return true
  } catch {
    return false
  }
}

/** Opens the task the notification refers to. */
export function onReminderTapped(handler: (taskId: string) => void): () => void {
  if (!isNative()) return () => {}
  const pending = LocalNotifications.addListener(
    "localNotificationActionPerformed",
    (event) => {
      const taskId = event.notification.extra?.taskId
      if (typeof taskId === "string") handler(taskId)
    },
  )
  return () => {
    void pending.then((listener) => listener.remove()).catch(() => {})
  }
}
