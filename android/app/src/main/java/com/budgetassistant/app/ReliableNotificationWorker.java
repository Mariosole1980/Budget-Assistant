package com.budgetassistant.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * Production-grade Fallback & Watchdog Worker using Android Jetpack WorkManager.
 * Runs periodically in background to ensure:
 * 1. AlarmManager remains armed (Self-Healing).
 * 2. If AlarmManager was suppressed by aggressive OEM Doze/Killers, detects missed
 *    daily reminder and dispatches it idempotently (maximum once per calendar day).
 */
public class ReliableNotificationWorker extends Worker {

    public static final String TAG = "BA-ReliableWorker";
    public static final String WORK_NAME = "budget_assistant_reminder_watchdog";

    public ReliableNotificationWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        Log.d(TAG, "Watchdog doWork executing at " + new Date().toString());

        try {
            SharedPreferences prefs = context.getSharedPreferences(
                    ReliableAlarmReceiver.PREFS_NAME,
                    Context.MODE_PRIVATE
            );

            boolean enabled = prefs.getBoolean(ReliableAlarmReceiver.KEY_ENABLED, false);
            if (!enabled) {
                Log.d(TAG, "Daily reminder is disabled. Watchdog exiting.");
                return Result.success();
            }

            int targetHour = prefs.getInt(ReliableAlarmReceiver.KEY_HOUR, 21);
            int targetMinute = prefs.getInt(ReliableAlarmReceiver.KEY_MINUTE, 0);
            String title = prefs.getString(ReliableAlarmReceiver.KEY_TITLE, "Καταγραφή Εξόδων");
            String body = prefs.getString(ReliableAlarmReceiver.KEY_BODY, "Έχεις καταγράψει τα σημερινά έξοδά σου;");

            String todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            String lastDispatchedDate = prefs.getString(ReliableAlarmReceiver.KEY_LAST_DISPATCH_DATE, "");

            Calendar now = Calendar.getInstance();
            Calendar targetToday = Calendar.getInstance();
            targetToday.set(Calendar.HOUR_OF_DAY, targetHour);
            targetToday.set(Calendar.MINUTE, targetMinute);
            targetToday.set(Calendar.SECOND, 0);
            targetToday.set(Calendar.MILLISECOND, 0);

            // 1. Check if AlarmManager missed today's notification
            // Condition: current time is PAST target time today, but today has NOT been dispatched yet
            if (now.after(targetToday) && !todayDate.equals(lastDispatchedDate)) {
                Log.w(TAG, "AlarmManager appears to have missed today's reminder! Watchdog triggering fallback dispatch.");
                
                // Idempotent dispatch
                ReliableAlarmReceiver.showNotification(context, title, body);

                prefs.edit()
                        .putString(ReliableAlarmReceiver.KEY_LAST_DISPATCH_DATE, todayDate)
                        .putLong(ReliableAlarmReceiver.KEY_LAST_DISPATCH_TIME, System.currentTimeMillis())
                        .putString(ReliableAlarmReceiver.KEY_LAST_DISPATCH_SOURCE, "WorkManager_Watchdog")
                        .putInt(ReliableAlarmReceiver.KEY_TOTAL_DISPATCHES, prefs.getInt(ReliableAlarmReceiver.KEY_TOTAL_DISPATCHES, 0) + 1)
                        .apply();
            }

            // 2. Self-Healing: Always verify and ensure AlarmManager is scheduled for the next cycle
            ReliableAlarmReceiver.scheduleNextAlarm(context, targetHour, targetMinute);

        } catch (Exception e) {
            Log.e(TAG, "Error in ReliableNotificationWorker execution", e);
            return Result.retry();
        }

        return Result.success();
    }

    /**
     * Enqueues the periodic WorkManager watchdog (runs every 1 hour minimum).
     */
    public static void enqueueWatchdog(Context context) {
        try {
            Constraints constraints = new Constraints.Builder()
                    .setRequiresBatteryNotLow(false)
                    .build();

            PeriodicWorkRequest watchdogRequest = new PeriodicWorkRequest.Builder(
                    ReliableNotificationWorker.class,
                    1, TimeUnit.HOURS,
                    15, TimeUnit.MINUTES // 15 min flex window
            )
                    .setConstraints(constraints)
                    .build();

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.KEEP,
                    watchdogRequest
            );
            Log.d(TAG, "WorkManager watchdog enqueued successfully.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to enqueue WorkManager watchdog", e);
        }
    }

    /**
     * Cancels the periodic WorkManager watchdog when reminders are disabled.
     */
    public static void cancelWatchdog(Context context) {
        try {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME);
            Log.d(TAG, "WorkManager watchdog cancelled.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to cancel WorkManager watchdog", e);
        }
    }
}
