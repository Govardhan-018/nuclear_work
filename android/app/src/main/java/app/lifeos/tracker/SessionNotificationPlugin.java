package app.lifeos.tracker;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Bridges the web timer to an ongoing Android notification.
 *
 * The notification is posted directly here rather than by the foreground
 * service. Android 14 and 15 can refuse to start a service, and the timer
 * still has to be visible when that happens; the service is started
 * afterwards purely for process priority and adopts the same notification.
 *
 * Session state stays in the web layer: notification buttons are forwarded
 * back as `sessionAction` events, so pause/resume/stop have one
 * implementation rather than two that can disagree.
 */
@CapacitorPlugin(
    name = "SessionNotification",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class SessionNotificationPlugin extends Plugin {

    private static SessionNotificationPlugin instance;

    @Override
    public void load() {
        instance = this;
        SessionNotification.ensureChannel(getContext());
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
        super.handleOnDestroy();
    }

    /** Called from the service when a notification button is tapped. */
    static void emitAction(String action) {
        if (instance == null) return;
        final String name;
        switch (action) {
            case SessionService.ACTION_PAUSE: name = "pause"; break;
            case SessionService.ACTION_RESUME: name = "resume"; break;
            case SessionService.ACTION_STOP: name = "stop"; break;
            default: return;
        }
        instance.notifyListeners("sessionAction", new JSObject().put("action", name));
    }

    @PluginMethod
    public void checkStatus(PluginCall call) {
        final JSObject result = new JSObject();
        result.put("available", true);
        result.put("granted", hasPermission());
        result.put("channelEnabled", isChannelEnabled());
        result.put("notificationsEnabled", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (hasPermission()) {
            call.resolve(new JSObject().put("granted", true));
            return;
        }
        requestPermissionForAlias("notifications", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        call.resolve(new JSObject().put("granted", hasPermission()));
    }

    /**
     * Shows or refreshes the notification. `base` is the epoch millisecond the
     * chronometer counts to (a countdown) or from (a stopwatch), passed as a
     * string because it exceeds the precision the bridge guarantees for a
     * JSON number.
     */
    @PluginMethod
    public void start(PluginCall call) {
        if (!hasPermission()) {
            // Reported rather than swallowed, so the UI can prompt.
            call.reject("permission-denied", "notification-permission");
            return;
        }

        final String title = call.getString("title", "Focus session");
        final String subject = call.getString("subject", "");
        final boolean running = Boolean.TRUE.equals(call.getBoolean("running", true));
        final boolean countDown = Boolean.TRUE.equals(call.getBoolean("countDown", true));
        final String staticTime = call.getString("staticTime", "");
        long base;
        try {
            base = Long.parseLong(call.getString("base", String.valueOf(System.currentTimeMillis())));
        } catch (NumberFormatException invalid) {
            base = System.currentTimeMillis();
        }

        try {
            // Post first: this is what the user actually sees, and it works
            // even when a foreground service would be refused.
            NotificationManagerCompat.from(getContext())
                .notify(SessionNotification.ID, SessionNotification.build(
                    getContext(), title, subject, running, countDown, base, staticTime
                ));
        } catch (SecurityException denied) {
            call.reject("permission-denied", "notification-permission");
            return;
        } catch (Exception error) {
            call.reject("notify-failed", String.valueOf(error.getMessage()));
            return;
        }

        // Then ask for the service. A refusal only costs process priority.
        boolean serviceStarted = true;
        try {
            SessionService.send(getContext(), new Intent(getContext(), SessionService.class)
                .setAction(SessionService.ACTION_START)
                .putExtra(SessionService.EXTRA_TITLE, title)
                .putExtra(SessionService.EXTRA_SUBJECT, subject)
                .putExtra(SessionService.EXTRA_RUNNING, running)
                .putExtra(SessionService.EXTRA_COUNT_DOWN, countDown)
                .putExtra(SessionService.EXTRA_BASE, base)
                .putExtra(SessionService.EXTRA_STATIC_TIME, staticTime));
        } catch (Exception refused) {
            serviceStarted = false;
        }

        call.resolve(new JSObject().put("shown", true).put("serviceStarted", serviceStarted));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            NotificationManagerCompat.from(getContext()).cancel(SessionNotification.ID);
        } catch (Exception ignored) {
            // Already gone.
        }
        try {
            getContext().startService(new Intent(getContext(), SessionService.class)
                .setAction(SessionService.ACTION_STOP_SERVICE));
        } catch (Exception ignored) {
            // Service was never running.
        }
        call.resolve();
    }

    /** Opens the system settings page for this app's notifications. */
    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            final Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent.setAction(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("cannot-open-settings", String.valueOf(error.getMessage()));
        }
    }

    private boolean hasPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        }
        return ContextCompat.checkSelfPermission(
            getContext(), Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED;
    }

    /** A granted permission still shows nothing if the channel is switched off. */
    private boolean isChannelEnabled() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        final NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        if (manager == null) return true;
        final android.app.NotificationChannel channel =
            manager.getNotificationChannel(SessionNotification.CHANNEL_ID);
        return channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }
}
