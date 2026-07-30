package com.budgetassistant.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeTheme")
public class NativeThemePlugin extends Plugin {

    private static final String PREFS_NAME = "NativeThemePrefs";
    private static final String KEY_BG_COLOR = "bg_color";
    private static final String KEY_STATUS_BAR_COLOR = "status_bar_color";
    private static final String KEY_NAV_BAR_COLOR = "nav_bar_color";
    private static final String KEY_IS_LIGHT = "is_light";

    @PluginMethod
    public void setThemeState(PluginCall call) {
        String bgColor = call.getString("bgColor");
        String statusBarColor = call.getString("statusBarColor");
        String navBarColor = call.getString("navBarColor");
        Boolean isLight = call.getBoolean("isLight", false);

        if (bgColor == null || statusBarColor == null || navBarColor == null) {
            call.reject("Missing required parameters");
            return;
        }

        try {
            // Save to SharedPreferences so MainActivity can read it synchronously on boot/resume
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                 .putString(KEY_BG_COLOR, bgColor)
                 .putString(KEY_STATUS_BAR_COLOR, statusBarColor)
                 .putString(KEY_NAV_BAR_COLOR, navBarColor)
                 .putBoolean(KEY_IS_LIGHT, isLight)
                 .apply();

            // Apply immediately on the UI thread
            applyThemeState(bgColor, statusBarColor, navBarColor, isLight);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to save and apply native theme state: " + e.getMessage());
        }
    }

    public void applyThemeState(final String bgColor, final String statusBarColor, final String navBarColor, final boolean isLight) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Window window = getActivity().getWindow();
                    View decorView = window.getDecorView();
                    
                    int bgVal = Color.parseColor(bgColor);
                    int statusVal = Color.parseColor(statusBarColor);
                    int navVal = Color.parseColor(navBarColor);

                    // 1. WebView Background
                    if (bridge != null && bridge.getWebView() != null) {
                        bridge.getWebView().setBackgroundColor(bgVal);
                    }

                    // 2. Window Background using ColorDrawable
                    window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(bgVal));

                    // 3. Status Bar
                    window.setStatusBarColor(statusVal);

                    // 4. Navigation Bar
                    window.setNavigationBarColor(navVal);

                    // 5. System Bar Icons appearance (light or dark icons)
                    WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, decorView);
                    controller.setAppearanceLightStatusBars(isLight);
                    controller.setAppearanceLightNavigationBars(isLight);

                } catch (Exception e) {
                    // Fail silently in background
                }
            }
        });
    }
}
