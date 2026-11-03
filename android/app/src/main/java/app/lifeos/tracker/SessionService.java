package app.lifeos.tracker;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationManagerCompat;

/**
 * Keeps the app alive while a session runs, and hosts the notification's
 * action buttons.
 *
 * The notification itself is posted by the plugin, not here: starting a
 * foreground service can be refused by Android 14 and 15, and the timer must
 * still be visible when that happens. This service adopts the notification
 * that is already on screen, so a refusal costs longevity, not the
 * notification.
 *
 * Elapsed time is not counted here either. The web layer derives it from
 * wall-clock timestamps and the notification uses Android's own chronometer.
 */
public class SessionService extends Service {

    public static final String ACTION_START = "app.lifeos.tracker.SESSION_START";
    public static final String ACTION_STOP_SERVICE = "app.lifeos.tracker.SESSION_STOP_SERVICE";
    public static final String ACTION_PAUSE = "app.lifeos.tracker.SESSION_PAUSE";
    public static final String ACTION_RESUME = "app.lifeos.tracker.SESSION_RESUME";
    public static final String ACTION_STOP = "app.lifeos.tracker.SESSION_STOP";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_SUBJECT = "subject";
    public static final String EXTRA_RUNNING = "running";
    public static final String EXTRA_COUNT_DOWN = "countDown";
    public static final String EXTRA_BASE = "base";
    public static final String EXTRA_STATIC_TIME = "staticTime";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        final String action = intent.getAction();

        if (ACTION_STOP_SERVICE.equals(action)) {
            stopForegroundCompat();
            stopSelf();
            return START_NOT_STICKY;
        }

        // Button taps are forwarded to the web layer, which owns session state
        // and sends back a refreshed notification. The service never decides.
        if (ACTION_PAUSE.equals(action) || ACTION_RESUME.equals(action) || ACTION_STOP.equals(action)) {
            SessionNotificationPlugin.emitAction(action);
            if (ACTION_STOP.equals(action)) {
                NotificationManagerCompat.from(this).cancel(SessionNotification.ID);
                stopForegroundCompat();
                stopSelf();
            }
            return START_STICKY;
        }

        final Notification notification = SessionNotification.build(
            this,
            intent.getStringExtra(EXTRA_TITLE),
            intent.getStringExtra(EXTRA_SUBJECT),
            intent.getBooleanExtra(EXTRA_RUNNING, true),
            intent.getBooleanExtra(EXTRA_COUNT_DOWN, true),
            intent.getLongExtra(EXTRA_BASE, System.currentTimeMillis()),
            intent.getStringExtra(EXTRA_STATIC_TIME)
        );

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    SessionNotification.ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                );
            } else {
                startForeground(SessionNotification.ID, notification);
            }
        } catch (Exception denied) {
            // Android 14/15 can refuse a foreground service. The notification
            // the plugin already posted stays on screen; we simply do not get
            // the extra process priority.
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    static void send(Context context, Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    private void stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(Service.STOP_FOREGROUND_DETACH);
        } else {
            stopForeground(false);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
