package com.budgetassistant.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Set;

@CapacitorPlugin(name = "BankNotification")
public class BankNotificationPlugin extends Plugin {

    private static final String TAG = "BA-BankNotifPlugin";

    private BroadcastReceiver liveReceiver;

    @Override
    public void load() {
        super.load();
        registerLiveBroadcastReceiver();
    }

    private void registerLiveBroadcastReceiver() {
        try {
            liveReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (intent == null || !BankNotificationListenerService.ACTION_BANK_NOTIFICATION_RECEIVED.equals(intent.getAction())) {
                        return;
                    }
                    String raw = intent.getStringExtra(BankNotificationListenerService.EXTRA_NOTIFICATION_PAYLOAD);
                    if (raw == null || raw.isEmpty()) {
                        return;
                    }
                    try {
                        JSONObject json = new JSONObject(raw);
                        JSObject jsObj = new JSObject();
                        jsObj.put("packageName", json.optString("packageName", ""));
                        jsObj.put("title", json.optString("title", ""));
                        jsObj.put("text", json.optString("text", ""));
                        jsObj.put("bigText", json.optString("bigText", ""));
                        jsObj.put("timestamp", json.optLong("timestamp", System.currentTimeMillis()));

                        Log.i(TAG, "Notifying JS listeners of new bank notification");
                        notifyListeners("bankNotificationReceived", jsObj);
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to parse broadcast payload", e);
                    }
                }
            };

            IntentFilter filter = new IntentFilter(BankNotificationListenerService.ACTION_BANK_NOTIFICATION_RECEIVED);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(liveReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(liveReceiver, filter);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to register live broadcast receiver", e);
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (liveReceiver != null) {
            try {
                getContext().unregisterReceiver(liveReceiver);
            } catch (Exception e) {
                // Ignore
            }
            liveReceiver = null;
        }
    }

    @PluginMethod
    public void isNotificationAccessGranted(PluginCall call) {
        try {
            Context context = getContext();
            Set<String> packageNames = NotificationManagerCompat.getEnabledListenerPackages(context);
            boolean isGranted = packageNames.contains(context.getPackageName());
            JSObject ret = new JSObject();
            ret.put("granted", isGranted);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to check notification access", e);
        }
    }

    @PluginMethod
    public void requestNotificationAccess(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open notification settings", e);
        }
    }

    @PluginMethod
    public void getPendingBankNotifications(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(BankNotificationListenerService.PREFS_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString(BankNotificationListenerService.KEY_PENDING_QUEUE, "[]");

            JSONArray arr = new JSONArray(raw);
            JSArray jsArr = new JSArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject item = arr.getJSONObject(i);
                JSObject obj = new JSObject();
                obj.put("packageName", item.optString("packageName", ""));
                obj.put("title", item.optString("title", ""));
                obj.put("text", item.optString("text", ""));
                obj.put("bigText", item.optString("bigText", ""));
                obj.put("timestamp", item.optLong("timestamp", System.currentTimeMillis()));
                jsArr.put(obj);
            }

            // Clear pending queue after retrieving
            prefs.edit().putString(BankNotificationListenerService.KEY_PENDING_QUEUE, "[]").apply();

            JSObject ret = new JSObject();
            ret.put("notifications", jsArr);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get pending notifications", e);
        }
    }

    @PluginMethod
    public void clearPendingBankNotifications(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(BankNotificationListenerService.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(BankNotificationListenerService.KEY_PENDING_QUEUE, "[]").apply();

            JSObject ret = new JSObject();
            ret.put("cleared", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to clear pending notifications", e);
        }
    }

    @PluginMethod
    public void setBankNotificationEnabled(PluginCall call) {
        try {
            boolean enabled = call.getBoolean("enabled", true);
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(BankNotificationListenerService.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean(BankNotificationListenerService.KEY_ENABLED, enabled).apply();

            JSObject ret = new JSObject();
            ret.put("enabled", enabled);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to set bank notification enabled", e);
        }
    }

    @PluginMethod
    public void isBankNotificationEnabled(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(BankNotificationListenerService.PREFS_NAME, Context.MODE_PRIVATE);
            boolean enabled = prefs.getBoolean(BankNotificationListenerService.KEY_ENABLED, true);

            JSObject ret = new JSObject();
            ret.put("enabled", enabled);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to check bank notification enabled", e);
        }
    }
}
