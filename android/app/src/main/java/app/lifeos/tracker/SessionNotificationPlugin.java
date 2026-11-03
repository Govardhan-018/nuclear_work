package app.lifeos.tracker;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Bridges the web timer to an Android foreground-service notification.
 *
 * The web layer stays the single source of truth for session state: it tells
 * this plugin what to display, and notification buttons are forwarded back as
 * `sessionAction` events rather than being handled natively. That keeps one
 * implementation of pause/resume/stop instead of two that can disagree.
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
        final JSObject payload = new JSObject();
        payload.put("action", name);
        instance.notifyListeners("sessionAction", payload);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        final JSObject result = new JSObject();
        result.put("available", true);
        result.put("granted", hasNotificationPermission());
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (hasNotificationPermission()) {
            final JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("notifications", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        final JSObject result = new JSObject();
        result.put("granted", hasNotificationPermission());
        call.resolve(result);
    }

    /**
     * Shows or refreshes the notification. `base` is the epoch millisecond the
     * chronometer counts to (a countdown) or from (a stopwatch).
     */
    @PluginMethod
    public void start(PluginCall call) {
        if (!hasNotificationPermission()) {
            // Not fatal: the session still runs, it just has no notification.
            call.resolve(new JSObject().put("shown", false));
            return;
        }

        final Intent intent = new Intent(getContext(), SessionService.class)
            .setAction(SessionService.ACTION_START)
            .putExtra(SessionService.EXTRA_TITLE, call.getString("title", "Focus session"))
            .putExtra(SessionService.EXTRA_SUBJECT, call.getString("subject", ""))
            .putExtra(SessionService.EXTRA_RUNNING, Boolean.TRUE.equals(call.getBoolean("running", true)))
            .putExtra(SessionService.EXTRA_COUNT_DOWN, Boolean.TRUE.equals(call.getBoolean("countDown", true)))
            .putExtra(SessionService.EXTRA_BASE, call.getLong("base", System.currentTimeMillis()))
            .putExtra(SessionService.EXTRA_STATIC_TIME, call.getString("staticTime", ""));

        try {
            SessionService.send(getContext(), intent);
            call.resolve(new JSObject().put("shown", true));
        } catch (Exception error) {
            // Android refuses to start a foreground service from the
            // background in some states; the session is unaffected.
            call.resolve(new JSObject().put("shown", false).put("reason", String.valueOf(error.getMessage())));
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        final Intent intent = new Intent(getContext(), SessionService.class)
            .setAction(SessionService.ACTION_STOP_SERVICE);
        try {
            getContext().startService(intent);
        } catch (Exception ignored) {
            // Already gone.
        }
        call.resolve();
    }

    private boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(
            getContext(), Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED;
    }
}
