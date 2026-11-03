package app.lifeos.tracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * Keeps an ongoing notification alive for a running focus or reading session.
 *
 * The elapsed time is not counted here. The web layer derives it from
 * wall-clock timestamps, and the notification uses Android's own chronometer,
 * which ticks in the system UI. That means no periodic wake-ups and no drift:
 * the service only redraws when the session actually changes state.
 */
public class SessionService extends Service {

    public static final String CHANNEL_ID = "life-os-session";
    private static final int NOTIFICATION_ID = 4711;

    public static final String ACTION_START = "app.lifeos.tracker.SESSION_START";
    public static final String ACTION_STOP_SERVICE = "app.lifeos.tracker.SESSION_STOP_SERVICE";
    public static final String ACTION_PAUSE = "app.lifeos.tracker.SESSION_PAUSE";
    public static final String ACTION_RESUME = "app.lifeos.tracker.SESSION_RESUME";
    public static final String ACTION_STOP = "app.lifeos.tracker.SESSION_STOP";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_SUBJECT = "subject";
    public static final String EXTRA_RUNNING = "running";
    public static final String EXTRA_COUNT_DOWN = "countDown";
    /** Epoch ms the chronometer counts to (timer) or from (stopwatch). */
    public static final String EXTRA_BASE = "base";
    /** Human-readable time, used while paused when the chronometer is off. */
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

        // Button taps arrive here, are forwarded to the web layer, and the web
        // layer sends back a fresh START with the new state. The service never
        // owns session state itself.
        if (ACTION_PAUSE.equals(action) || ACTION_RESUME.equals(action) || ACTION_STOP.equals(action)) {
            SessionNotificationPlugin.emitAction(action);
            if (ACTION_STOP.equals(action)) {
                stopForegroundCompat();
                stopSelf();
                return START_NOT_STICKY;
            }
            return START_STICKY;
        }

        final Notification notification = buildNotification(
            intent.getStringExtra(EXTRA_TITLE),
            intent.getStringExtra(EXTRA_SUBJECT),
            intent.getBooleanExtra(EXTRA_RUNNING, true),
            intent.getBooleanExtra(EXTRA_COUNT_DOWN, true),
            intent.getLongExtra(EXTRA_BASE, System.currentTimeMillis()),
            intent.getStringExtra(EXTRA_STATIC_TIME)
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        return START_STICKY;
    }

    private Notification buildNotification(
        String title, String subject, boolean running,
        boolean countDown, long base, String staticTime
    ) {
        createChannel();

        // Tapping the notification reopens the app on the session screen.
        final Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        final PendingIntent openIntent = PendingIntent.getActivity(
            this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        final NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title == null ? "Focus session" : title)
            .setContentText(subject == null ? "" : subject)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setSilent(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        if (running) {
            // Android redraws this itself, once a second, with no work from us.
            builder.setUsesChronometer(true);
            builder.setWhen(base);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                builder.setChronometerCountDown(countDown);
            }
            builder.addAction(0, "Pause", actionIntent(ACTION_PAUSE, 1));
        } else {
            builder.setUsesChronometer(false);
            builder.setSubText(staticTime == null ? "Paused" : staticTime + " · paused");
            builder.addAction(0, "Resume", actionIntent(ACTION_RESUME, 2));
        }

        builder.addAction(0, "Stop", actionIntent(ACTION_STOP, 3));
        return builder.build();
    }

    private PendingIntent actionIntent(String action, int requestCode) {
        final Intent intent = new Intent(this, SessionService.class).setAction(action);
        return PendingIntent.getService(
            this, requestCode, intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        final NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;

        final NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "Focus sessions", NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Shows the timer while a study or reading session is running.");
        channel.setShowBadge(false);
        channel.setSound(null, null);
        channel.enableVibration(false);
        manager.createNotificationChannel(channel);
    }

    private void stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }

    /** Convenience for the plugin: fire-and-forget a command at the service. */
    public static void send(Context context, Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
