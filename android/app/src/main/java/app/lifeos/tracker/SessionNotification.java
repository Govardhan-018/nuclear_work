package app.lifeos.tracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

/**
 * Builds the ongoing session notification.
 *
 * Shared by the plugin, which posts it immediately, and the service, which
 * adopts the same notification id to keep the process alive. Keeping the
 * builder in one place means the two paths cannot drift apart.
 */
final class SessionNotification {

    static final String CHANNEL_ID = "maya-session";
    static final int ID = 4711;

    private SessionNotification() {}

    static Notification build(
        Context context,
        String title,
        String subject,
        boolean running,
        boolean countDown,
        long base,
        String staticTime
    ) {
        ensureChannel(context);

        final Intent open = new Intent(context, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        final PendingIntent openIntent = PendingIntent.getActivity(
            context, 0, open,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        final NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_session)
            .setContentTitle(title == null || title.isEmpty() ? "Focus session" : title)
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
            // Android redraws the chronometer itself, once a second.
            builder.setUsesChronometer(true);
            builder.setWhen(base);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                builder.setChronometerCountDown(countDown);
            }
            builder.addAction(0, "Pause", action(context, SessionService.ACTION_PAUSE, 1));
        } else {
            builder.setUsesChronometer(false);
            builder.setSubText(
                staticTime == null || staticTime.isEmpty() ? "Paused" : staticTime + " · paused"
            );
            builder.addAction(0, "Resume", action(context, SessionService.ACTION_RESUME, 2));
        }

        builder.addAction(0, "Stop", action(context, SessionService.ACTION_STOP, 3));
        return builder.build();
    }

    private static PendingIntent action(Context context, String name, int requestCode) {
        final Intent intent = new Intent(context, SessionService.class).setAction(name);
        return PendingIntent.getService(
            context, requestCode, intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        final NotificationManager manager = context.getSystemService(NotificationManager.class);
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
}
