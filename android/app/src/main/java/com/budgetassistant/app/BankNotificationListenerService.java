package com.budgetassistant.app;

import android.app.Notification;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
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
    public static final String BANK_CHANNEL_ID = "budget_assistant_bank_alerts_channel";

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

            // 3. Post notification so user can tap to record even when app is closed
            showBankTransactionNotification(context, title, text);

        } catch (Exception e) {
            Log.e(TAG, "Failed to process bank notification", e);
        }
    }

    private void showBankTransactionNotification(Context context, String bankTitle, String bankText) {
        try {
            createBankNotificationChannel(context);

            Intent openAppIntent = new Intent(context, MainActivity.class);
            openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            openAppIntent.putExtra("from_notification", true);
            openAppIntent.putExtra("notification_type", "bank_transaction");

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            int notifId = (int) (System.currentTimeMillis() & 0xfffffff);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    notifId,
                    openAppIntent,
                    flags
            );

            int smallIconRes = context.getResources().getIdentifier(
                    "ic_stat_icon_config_sample",
                    "drawable",
                    context.getPackageName()
            );
            if (smallIconRes == 0) {
                smallIconRes = context.getApplicationInfo().icon;
            }

            int largeIconRes = context.getResources().getIdentifier(
                    "ic_notification_large",
                    "drawable",
                    context.getPackageName()
            );
            Bitmap largeIcon = null;
            if (largeIconRes != 0) {
                try {
                    largeIcon = BitmapFactory.decodeResource(context.getResources(), largeIconRes);
                } catch (Exception ignored) {}
            }

            String notifTitle = "Budget Assistant • Νέα Συναλλαγή";
            String notifBody = (bankText != null && !bankText.trim().isEmpty())
                    ? bankText + "\nΠάτησε εδώ για καταγραφή"
                    : "Εντοπίστηκε νέα τραπεζική συναλλαγή. Πάτησε για καταγραφή.";

            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, BANK_CHANNEL_ID)
                    .setSmallIcon(smallIconRes)
                    .setContentTitle(notifTitle)
                    .setContentText(bankText != null ? bankText : "")
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(notifBody))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setCategory(NotificationCompat.CATEGORY_STATUS)
                    .setAutoCancel(true)
                    .setSound(soundUri)
                    .setColor(Color.parseColor("#0F1219"))
                    .setContentIntent(pendingIntent)
                    .setDefaults(NotificationCompat.DEFAULT_ALL);

            if (largeIcon != null) {
                builder.setLargeIcon(largeIcon);
            }

            NotificationManagerCompat nm = NotificationManagerCompat.from(context);
            nm.notify(notifId, builder.build());
            Log.i(TAG, "Dispatched user bank review notification (" + notifId + ")");
        } catch (Exception e) {
            Log.e(TAG, "Failed to dispatch bank review notification", e);
        }
    }

    private static void createBankNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(BANK_CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                        BANK_CHANNEL_ID,
                        "Αυτόματη Καταγραφή Τραπεζών",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Ειδοποιήσεις για άμεση επιβεβαίωση και καταγραφή συναλλαγών από τράπεζες");
                channel.enableLights(true);
                channel.setLightColor(Color.parseColor("#10B981"));
                channel.enableVibration(true);
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(channel);
            }
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
