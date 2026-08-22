package com.budgetassistant.app;

import android.app.AlarmManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ReliableNotification")
public class ReliableNotificationPlugin extends Plugin {

    private static final String TAG = "BA-ReliablePlugin";

    @PluginMethod
    public void scheduleDailyReminder(PluginCall call) {
        int hour = call.getInt("hour", 21);
        int minute = call.getInt("minute", 0);
        String title = call.getString("title", "Καταγραφή Εξόδων");
        String body = call.getString("body", "Έχεις καταγράψει τα σημερινά έξοδά σου;");
        boolean enabled = call.getBoolean("enabled", true);

        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(
                    ReliableAlarmReceiver.PREFS_NAME,
                    Context.MODE_PRIVATE
            );
            prefs.edit()
                    .putBoolean(ReliableAlarmReceiver.KEY_ENABLED, enabled)
                    .putInt(ReliableAlarmReceiver.KEY_HOUR, hour)
                    .putInt(ReliableAlarmReceiver.KEY_MINUTE, minute)
                    .putString(ReliableAlarmReceiver.KEY_TITLE, title)
                    .putString(ReliableAlarmReceiver.KEY_BODY, body)
                    .apply();

            ReliableAlarmReceiver.createNotificationChannel(context);

            if (enabled) {
                ReliableAlarmReceiver.scheduleNextAlarm(context, hour, minute);
            } else {
                ReliableAlarmReceiver.cancelAlarm(context);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("enabled", enabled);
            ret.put("hour", hour);
            ret.put("minute", minute);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule daily reminder", e);
            call.reject("Failed to schedule daily reminder: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelDailyReminder(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(
                    ReliableAlarmReceiver.PREFS_NAME,
                    Context.MODE_PRIVATE
            );
            prefs.edit().putBoolean(ReliableAlarmReceiver.KEY_ENABLED, false).apply();
            ReliableAlarmReceiver.cancelAlarm(context);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to cancel reminder: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getDailyReminderStatus(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(
                    ReliableAlarmReceiver.PREFS_NAME,
                    Context.MODE_PRIVATE
            );

            boolean enabled = prefs.getBoolean(ReliableAlarmReceiver.KEY_ENABLED, false);
            int hour = prefs.getInt(ReliableAlarmReceiver.KEY_HOUR, 21);
            int minute = prefs.getInt(ReliableAlarmReceiver.KEY_MINUTE, 0);
            String title = prefs.getString(ReliableAlarmReceiver.KEY_TITLE, "Καταγραφή Εξόδων");
            String body = prefs.getString(ReliableAlarmReceiver.KEY_BODY, "Έχεις καταγράψει τα σημερινά έξοδά σου;");

            boolean isBatteryIgnored = isBatteryOptimizationIgnored(context);
            boolean isExactAllowed = isExactAlarmAllowed(context);

            JSObject ret = new JSObject();
            ret.put("enabled", enabled);
            ret.put("hour", hour);
            ret.put("minute", minute);
            ret.put("title", title);
            ret.put("body", body);
            ret.put("isBatteryIgnored", isBatteryIgnored);
            ret.put("isExactAllowed", isExactAllowed);
            ret.put("manufacturer", Build.MANUFACTURER);
            ret.put("model", Build.MODEL);
            ret.put("sdkInt", Build.VERSION.SDK_INT);

            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get status: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        try {
            Context context = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                String packageName = context.getPackageName();
                if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + packageName));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                }
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.w(TAG, "Could not open request ignore battery optimizations", e);
            try {
                // Fallback to general battery settings
                Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Could not open battery settings: " + ex.getMessage());
            }
        }
    }

    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
                if (alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                }
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open exact alarm settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        Context context = getContext();
        String manufacturer = Build.MANUFACTURER.toLowerCase();
        boolean opened = false;

        Intent[] intents = new Intent[] {
            // Xiaomi / Redmi / POCO (MIUI & HyperOS)
            new Intent().setComponent(new ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")),
            new Intent().setComponent(new ComponentName("com.miui.securitycenter", "com.miui.powercenter.PowerSettings")),
            // Huawei / Honor
            new Intent().setComponent(new ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity")),
            new Intent().setComponent(new ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")),
            // Samsung
            new Intent().setComponent(new ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity")),
            new Intent().setComponent(new ComponentName("com.samsung.android.sm", "com.samsung.android.sm.ui.battery.BatteryActivity")),
            // Oppo / Realme
            new Intent().setComponent(new ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")),
            new Intent().setComponent(new ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity")),
            // Vivo
            new Intent().setComponent(new ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity")),
            new Intent().setComponent(new ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")),
            // Generic App Details fallback
            new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(Uri.parse("package:" + context.getPackageName()))
        };

        for (Intent intent : intents) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                opened = true;
                break;
            } catch (Exception ignored) {}
        }

        JSObject ret = new JSObject();
        ret.put("success", opened);
        ret.put("manufacturer", manufacturer);
        call.resolve(ret);
    }

    @PluginMethod
    public void testNotification(PluginCall call) {
        String title = call.getString("title", "Δοκιμαστική Ειδοποίηση");
        String body = call.getString("body", "Η ειδοποίηση λειτουργεί άψογα!");
        try {
            ReliableAlarmReceiver.showNotification(getContext(), title, body);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to trigger test notification: " + e.getMessage());
        }
    }

    private boolean isBatteryOptimizationIgnored(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                return pm.isIgnoringBatteryOptimizations(context.getPackageName());
            }
        }
        return true;
    }

    private boolean isExactAlarmAllowed(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                return am.canScheduleExactAlarms();
            }
        }
        return true;
    }
}
