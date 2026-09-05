package com.budgetassistant.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "QuickAddNotification")
public class QuickAddNotificationPlugin extends Plugin {

    private static final String TAG = "BA-QuickAddPlugin";

    public static final String PREFS_NAME = "QuickAddPrefs";
    public static final String KEY_ENABLED = "quick_add_enabled";
    public static final String CHANNEL_ID = "ba_quick_add_channel";
    public static final int NOTIFICATION_ID = 2001;

    public static final String ACTION_QUICK_ADD = "com.budgetassistant.app.ACTION_QUICK_ADD";
    public static final String EXTRA_QUICK_ACTION = "EXTRA_QUICK_ACTION";

    public static final String ACTION_VOICE_AI = "VOICE_AI";
    public static final String ACTION_ADD_EXPENSE = "ADD_EXPENSE";
    public static final String ACTION_ADD_INCOME = "ADD_INCOME";
    public static final String ACTION_SCAN_RECEIPT = "SCAN_RECEIPT";

    private static String pendingAction = null;

    public static void setPendingAction(String action) {
        pendingAction = action;
    }

    public static String getAndClearPendingAction() {
        String act = pendingAction;
        pendingAction = null;
        return act;
    }

    @PluginMethod
    public void enableQuickAdd(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean(KEY_ENABLED, true).apply();

            showNotification(context);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("enabled", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to enable quick add notification", e);
            call.reject("Failed to enable quick add notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void disableQuickAdd(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean(KEY_ENABLED, false).apply();

            cancelNotification(context);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("enabled", false);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to disable quick add notification", e);
            call.reject("Failed to disable quick add notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isQuickAddEnabled(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean enabled = prefs.getBoolean(KEY_ENABLED, false);

            JSObject ret = new JSObject();
            ret.put("enabled", enabled);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to check quick add status: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingAction(PluginCall call) {
        try {
            String act = getAndClearPendingAction();
            JSObject ret = new JSObject();
            ret.put("action", act);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get pending action: " + e.getMessage());
        }
    }

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                NotificationChannel channel = nm.getNotificationChannel(CHANNEL_ID);
                if (channel == null) {
                    channel = new NotificationChannel(
                            CHANNEL_ID,
                            "Γρήγορη Καταχώρηση",
                            NotificationManager.IMPORTANCE_LOW
                    );
                    channel.setDescription("Εργαλεία γρήγορης καταχώρησης Budget Assistant");
                    channel.setShowBadge(false);
                    channel.enableVibration(false);
                    channel.enableLights(false);
                    channel.setSound(null, null);
                    channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                    nm.createNotificationChannel(channel);
                }
            }
        }
    }

    public static void showNotification(Context context) {
        try {
            createNotificationChannel(context);

            // Content intent (tap notification body -> opens app normally)
            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.setAction(Intent.ACTION_MAIN);
            openIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);

            int baseFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                    : PendingIntent.FLAG_UPDATE_CURRENT;

            PendingIntent contentPendingIntent = PendingIntent.getActivity(
                    context,
                    100,
                    openIntent,
                    baseFlags
            );

            // Action 1: VOICE_AI
            Intent voiceIntent = new Intent(context, MainActivity.class);
            voiceIntent.setAction(ACTION_QUICK_ADD);
            voiceIntent.putExtra(EXTRA_QUICK_ACTION, ACTION_VOICE_AI);
            voiceIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent voicePendingIntent = PendingIntent.getActivity(
                    context,
                    101,
                    voiceIntent,
                    baseFlags
            );

            // Action 2: ADD_EXPENSE
            Intent expenseIntent = new Intent(context, MainActivity.class);
            expenseIntent.setAction(ACTION_QUICK_ADD);
            expenseIntent.putExtra(EXTRA_QUICK_ACTION, ACTION_ADD_EXPENSE);
            expenseIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent expensePendingIntent = PendingIntent.getActivity(
                    context,
                    102,
                    expenseIntent,
                    baseFlags
            );

            // Action 3: ADD_INCOME
            Intent incomeIntent = new Intent(context, MainActivity.class);
            incomeIntent.setAction(ACTION_QUICK_ADD);
            incomeIntent.putExtra(EXTRA_QUICK_ACTION, ACTION_ADD_INCOME);
            incomeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent incomePendingIntent = PendingIntent.getActivity(
                    context,
                    103,
                    incomeIntent,
                    baseFlags
            );

            // Action 4: SCAN_RECEIPT
            Intent scanIntent = new Intent(context, MainActivity.class);
            scanIntent.setAction(ACTION_QUICK_ADD);
            scanIntent.putExtra(EXTRA_QUICK_ACTION, ACTION_SCAN_RECEIPT);
            scanIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent scanPendingIntent = PendingIntent.getActivity(
                    context,
                    104,
                    scanIntent,
                    baseFlags
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("Budget Assistant")
                    .setContentText("Γρήγορη καταχώρηση")
                    .setContentIntent(contentPendingIntent)
                    .setOngoing(true)
                    .setAutoCancel(false)
                    .setShowWhen(false)
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .setCategory(NotificationCompat.CATEGORY_SERVICE)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .addAction(0, "🎙️ Βοηθός", voicePendingIntent)
                    .addAction(0, "➕ Έξοδο", expensePendingIntent)
                    .addAction(0, "💰 Έσοδο", incomePendingIntent)
                    .addAction(0, "📷 Scan", scanPendingIntent);

            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(NOTIFICATION_ID, builder.build());
                Log.d(TAG, "Quick Add persistent notification displayed successfully");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to show quick add notification", e);
        }
    }

    public static void cancelNotification(Context context) {
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(NOTIFICATION_ID);
                Log.d(TAG, "Quick Add persistent notification cancelled");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to cancel quick add notification", e);
        }
    }
}
