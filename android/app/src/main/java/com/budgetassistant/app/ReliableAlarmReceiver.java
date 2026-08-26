package com.budgetassistant.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class ReliableAlarmReceiver extends BroadcastReceiver {

    public static final String TAG = "BA-ReliableAlarm";
    public static final String CHANNEL_ID = "budget_assistant_daily_reminders_v2";
    public static final int NOTIFICATION_ID = 9999;
    public static final String PREFS_NAME = "ReliableNotificationPrefs";
    public static final String KEY_ENABLED = "reminder_enabled";
    public static final String KEY_HOUR = "reminder_hour";
    public static final String KEY_MINUTE = "reminder_minute";
    public static final String KEY_TITLE = "reminder_title";
    public static final String KEY_BODY = "reminder_body";
    public static final String KEY_LAST_DISPATCH_DATE = "last_dispatch_date";
    public static final String KEY_LAST_DISPATCH_TIME = "last_dispatch_timestamp";
    public static final String KEY_LAST_DISPATCH_SOURCE = "last_dispatch_source";
    public static final String KEY_TOTAL_DISPATCHES = "total_dispatches";
    public static final String KEY_NEXT_TRIGGER_MILLIS = "next_trigger_millis";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "onReceive triggered at " + System.currentTimeMillis());

        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "budgetassistant:reliable_alarm_wakelock");
            wakeLock.acquire(10 * 1000L); // Hold for 10 seconds max
        }

        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean enabled = prefs.getBoolean(KEY_ENABLED, false);
            int hour = prefs.getInt(KEY_HOUR, 21);
            int minute = prefs.getInt(KEY_MINUTE, 0);
            String title = prefs.getString(KEY_TITLE, "Καταγραφή Εξόδων");
            String body = prefs.getString(KEY_BODY, "Έχεις καταγράψει τα σημερινά έξοδά σου;");

            if (enabled) {
                String todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
                String lastDispatchedDate = prefs.getString(KEY_LAST_DISPATCH_DATE, "");

                // Idempotent Check: Prevent duplicate notification on the same calendar day
                if (!todayDate.equals(lastDispatchedDate)) {
                    // 1. Show the notification
                    showNotification(context, title, body);

                    // Update diagnostic tracking
                    prefs.edit()
                            .putString(KEY_LAST_DISPATCH_DATE, todayDate)
                            .putLong(KEY_LAST_DISPATCH_TIME, System.currentTimeMillis())
                            .putString(KEY_LAST_DISPATCH_SOURCE, "AlarmManager")
                            .putInt(KEY_TOTAL_DISPATCHES, prefs.getInt(KEY_TOTAL_DISPATCHES, 0) + 1)
                            .apply();
                } else {
                    Log.d(TAG, "Notification already dispatched today (" + todayDate + "). Skipping duplicate.");
                }

                // 2. Self-Healing: reschedule next alarm for tomorrow
                scheduleNextAlarm(context, hour, minute);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing alarm broadcast", e);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                try {
                    wakeLock.release();
                } catch (Exception ignored) {}
            }
        }
    }

    public static void showNotification(Context context, String title, String body) {
        createNotificationChannel(context);

        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openAppIntent.putExtra("from_notification", true);
        openAppIntent.putExtra("notification_type", "daily_reminder");

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                NOTIFICATION_ID,
                openAppIntent,
                flags
        );

        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        int smallIconRes = context.getResources().getIdentifier(
                "ic_stat_icon_config_sample",
                "drawable",
                context.getPackageName()
        );
        if (smallIconRes == 0) {
            smallIconRes = context.getApplicationInfo().icon;
        }

        // Load large icon (full color app logo)
        android.graphics.Bitmap largeIcon = null;
        try {
            int largeIconRes = context.getResources().getIdentifier("ic_launcher", "mipmap", context.getPackageName());
            if (largeIconRes != 0) {
                largeIcon = android.graphics.BitmapFactory.decodeResource(context.getResources(), largeIconRes);
            }
        } catch (Exception ignored) {}

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(smallIconRes)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setSound(soundUri)
                .setColor(Color.parseColor("#7c6af7"))
                .setContentIntent(pendingIntent)
                .setDefaults(NotificationCompat.DEFAULT_ALL);

        if (largeIcon != null) {
            builder.setLargeIcon(largeIcon);
        }

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
        try {
            notificationManager.notify(NOTIFICATION_ID, builder.build());
            Log.d(TAG, "Notification successfully dispatched");
        } catch (SecurityException se) {
            Log.w(TAG, "POST_NOTIFICATIONS permission missing", se);
        } catch (Exception e) {
            Log.e(TAG, "Failed to display notification", e);
        }
    }

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                NotificationChannel channel = notificationManager.getNotificationChannel(CHANNEL_ID);
                if (channel == null) {
                    channel = new NotificationChannel(
                            CHANNEL_ID,
                            "Budget Assistant Reminders",
                            NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("Daily expense logging reminders and budget alerts");
                    channel.enableLights(true);
                    channel.setLightColor(Color.parseColor("#7c6af7"));
                    channel.enableVibration(true);
                    channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                    Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                            .build();
                    channel.setSound(soundUri, audioAttributes);

                    notificationManager.createNotificationChannel(channel);
                    Log.d(TAG, "Notification channel created: " + CHANNEL_ID);
                }
            }
        }
    }

    public static void scheduleNextAlarm(Context context, int hour, int minute) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(System.currentTimeMillis());
        calendar.set(Calendar.HOUR_OF_DAY, hour);
        calendar.set(Calendar.MINUTE, minute);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);

        // If target time has already passed today, advance to tomorrow
        if (calendar.getTimeInMillis() <= System.currentTimeMillis()) {
            calendar.add(Calendar.DAY_OF_YEAR, 1);
        }

        long triggerAtMillis = calendar.getTimeInMillis();

        // Persist next trigger for diagnostics
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putLong(KEY_NEXT_TRIGGER_MILLIS, triggerAtMillis).apply();

        Intent intent = new Intent(context, ReliableAlarmReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                NOTIFICATION_ID,
                intent,
                flags
        );

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                // setAlarmClock provides highest real-time CPU priority in Android kernel,
                // firing on the exact second (:00.000) and bypassing all OEM battery batching windows.
                AlarmManager.AlarmClockInfo alarmClockInfo = new AlarmManager.AlarmClockInfo(triggerAtMillis, pendingIntent);
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent);
                Log.d(TAG, "Armed setAlarmClock for exact time: " + calendar.getTime().toString());
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }

            // Ensure the WorkManager fallback watchdog is also active
            ReliableNotificationWorker.enqueueWatchdog(context);

        } catch (Exception e) {
            Log.e(TAG, "Error scheduling alarm with setAlarmClock, falling back to setExactAndAllowWhileIdle", e);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                }
            } catch (Exception ignored) {}
        }
    }

    public static void cancelAlarm(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            Intent intent = new Intent(context, ReliableAlarmReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    NOTIFICATION_ID,
                    intent,
                    flags
            );
            alarmManager.cancel(pendingIntent);
            Log.d(TAG, "Alarm cancelled.");
        }

        // Cancel WorkManager watchdog
        ReliableNotificationWorker.cancelWatchdog(context);

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putLong(KEY_NEXT_TRIGGER_MILLIS, 0).apply();
    }
}
