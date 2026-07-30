package com.budgetassistant.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String PREFS_NAME = "NativeThemePrefs";
    private static final String KEY_BG_COLOR = "bg_color";
    private static final String KEY_STATUS_BAR_COLOR = "status_bar_color";
    private static final String KEY_NAV_BAR_COLOR = "nav_bar_color";
    private static final String KEY_IS_LIGHT = "is_light";
    private static final String KEY_SECURE_MODE = "secure_mode";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(NativeThemePlugin.class);
        registerPlugin(SecurityPlugin.class);

        // Lock WebView text zoom to 100% — prevents Android system "Font Size" setting
        // from scaling the WebView content and causing the intermittent zoom/large-text bug.
        if (bridge != null && bridge.getWebView() != null) {
            WebSettings settings = bridge.getWebView().getSettings();
            settings.setTextZoom(100);
        }

        // Apply saved theme colors immediately on create
        applySavedTheme();
        
        // Apply secure mode flags
        applySecureMode();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Apply secure mode flags on resume (skip re-applying background color on every resume to avoid Android surface flicker)
        applySecureMode();
    }

    private void applySecureMode() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean secureMode = prefs.getBoolean(KEY_SECURE_MODE, false);
            Window window = getWindow();
            if (secureMode) {
                window.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
        } catch (Exception e) {
            // Fail silently
        }
    }

    private void applySavedTheme() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String bgColor = prefs.getString(KEY_BG_COLOR, "#181b22"); // default dark
        String statusBarColor = prefs.getString(KEY_STATUS_BAR_COLOR, "#222731");
        String navBarColor = prefs.getString(KEY_NAV_BAR_COLOR, "#181b22");
        boolean isLight = prefs.getBoolean(KEY_IS_LIGHT, false);

        try {
            Window window = getWindow();
            View decorView = window.getDecorView();
            int bgVal = Color.parseColor(bgColor);
            int statusVal = Color.parseColor(statusBarColor);
            int navVal = Color.parseColor(navBarColor);

            // Apply window background using ColorDrawable
            window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(bgVal));

            // Apply WebView background if initialized
            if (bridge != null && bridge.getWebView() != null) {
                bridge.getWebView().setBackgroundColor(bgVal);
            }

            // Apply Status bar & Nav bar colors
            window.setStatusBarColor(statusVal);
            window.setNavigationBarColor(navVal);

            // Apply system bar icon appearance
            WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, decorView);
            controller.setAppearanceLightStatusBars(isLight);
            controller.setAppearanceLightNavigationBars(isLight);

        } catch (Exception e) {
            // Ignore color parsing errors
        }
    }
}
