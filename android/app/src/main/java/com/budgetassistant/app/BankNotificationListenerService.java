package com.budgetassistant.app;

import android.app.Notification;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * BankNotificationListenerService
 *
 * Background Android NotificationListenerService that captures incoming push notifications
 * from Greek banking apps and Revolut:
 * - Eurobank (gr.eurobank.ebanking)
 * - Piraeus Winbank (com.winbank.mobile)
 * - Alpha Bank (gr.alphabank.mobilebanking)
 * - National Bank of Greece / NBG (gr.nbg.mobilebanking)
 * - Revolut (com.revolut.revolut)
 */
public class BankNotificationListenerService extends NotificationListenerService {

    private static final String TAG = "BA-BankNotifService";

    public static final String ACTION_BANK_NOTIFICATION_RECEIVED = "com.budgetassistant.app.ACTION_BANK_NOTIFICATION_RECEIVED";
    public static final String EXTRA_NOTIFICATION_PAYLOAD = "EXTRA_NOTIFICATION_PAYLOAD";

    public static final String PREFS_NAME = "BankNotificationPrefs";
    public static final String KEY_ENABLED = "bank_notifications_enabled";
    public static final String KEY_PENDING_QUEUE = "pending_bank_notifications_queue";

    private static final Set<String> SUPPORTED_PACKAGES = new HashSet<>(Arrays.asList(
        "gr.eurobank.ebanking",
        "com.winbank.mobile",
        "gr.alphabank.mobilebanking",
        "gr.nbg.mobilebanking",
        "com.revolut.revolut"
    ));

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        Log.i(TAG, "BankNotificationListenerService connected and active");
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        Log.w(TAG, "BankNotificationListenerService disconnected");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) {
            return;
        }

        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean isEnabled = prefs.getBoolean(KEY_ENABLED, true);
        if (!isEnabled) {
            return;
        }

        String packageName = sbn.getPackageName();
        if (packageName == null) {
            return;
        }

        Notification notification = sbn.getNotification();
        Bundle extras = notification.extras;
        if (extras == null) {
            return;
        }

        CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigTextCs = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

        String title = titleCs != null ? titleCs.toString() : "";
        String text = textCs != null ? textCs.toString() : "";
        String bigText = bigTextCs != null ? bigTextCs.toString() : "";

        // Check if package is explicitly supported or title/text indicates a bank
        boolean isSupported = SUPPORTED_PACKAGES.contains(packageName);
        if (!isSupported) {
            String combined = (title + " " + text + " " + bigText).toLowerCase();
            if (combined.contains("eurobank") || combined.contains("winbank") ||
                combined.contains("alpha bank") || combined.contains("nbg") ||
                combined.contains("εθνική") || combined.contains("πειραιώς") ||
                combined.contains("revolut")) {
                isSupported = true;
            }
        }

        if (!isSupported) {
            return;
        }

        try {
            JSONObject notifObj = new JSONObject();
            notifObj.put("id", sbn.getId());
            notifObj.put("key", sbn.getKey());
            notifObj.put("packageName", packageName);
            notifObj.put("title", title);
            notifObj.put("text", text);
            notifObj.put("bigText", bigText);
            notifObj.put("postTime", sbn.getPostTime());
            notifObj.put("timestamp", System.currentTimeMillis());

            Log.i(TAG, "Captured bank notification from [" + packageName + "]: " + title + " - " + text);

            // 1. Enqueue in persistent queue (so it's available on startup/resume)
            enqueueNotification(context, notifObj);

            // 2. Broadcast to active activity / plugin
            Intent broadcast = new Intent(ACTION_BANK_NOTIFICATION_RECEIVED);
            broadcast.setPackage(getPackageName());
            broadcast.putExtra(EXTRA_NOTIFICATION_PAYLOAD, notifObj.toString());
            sendBroadcast(broadcast);

        } catch (Exception e) {
            Log.e(TAG, "Failed to process bank notification", e);
        }
    }

    private static synchronized void enqueueNotification(Context context, JSONObject obj) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String rawQueue = prefs.getString(KEY_PENDING_QUEUE, "[]");
            JSONArray queue = new JSONArray(rawQueue);

            // Cap queue at 20 items
            if (queue.length() >= 20) {
                JSONArray newQueue = new JSONArray();
                for (int i = 1; i < queue.length(); i++) {
                    newQueue.put(queue.get(i));
                }
                queue = newQueue;
            }

            queue.put(obj);
            prefs.edit().putString(KEY_PENDING_QUEUE, queue.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Failed to enqueue notification", e);
        }
    }
}
