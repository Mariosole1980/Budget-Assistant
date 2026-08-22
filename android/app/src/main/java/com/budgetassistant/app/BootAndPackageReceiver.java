package com.budgetassistant.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

public class BootAndPackageReceiver extends BroadcastReceiver {

    private static final String TAG = "BA-BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        Log.d(TAG, "onReceive triggered with action: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {

            try {
                SharedPreferences prefs = context.getSharedPreferences(
                        ReliableAlarmReceiver.PREFS_NAME,
                        Context.MODE_PRIVATE
                );
                boolean enabled = prefs.getBoolean(ReliableAlarmReceiver.KEY_ENABLED, false);
                int hour = prefs.getInt(ReliableAlarmReceiver.KEY_HOUR, 21);
                int minute = prefs.getInt(ReliableAlarmReceiver.KEY_MINUTE, 0);

                if (enabled) {
                    Log.d(TAG, "Re-arming daily alarm after " + action + " for " + hour + ":" + minute);
                    ReliableAlarmReceiver.scheduleNextAlarm(context, hour, minute);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error re-scheduling alarm on boot/update", e);
            }
        }
    }
}
