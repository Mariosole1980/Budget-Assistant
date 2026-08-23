package com.budgetassistant.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "BA-MainActivity";
    private static final String PREFS_NAME = "NativeThemePrefs";
    private static final String KEY_BG_COLOR = "bg_color";
    private static final String KEY_STATUS_BAR_COLOR = "status_bar_color";
    private static final String KEY_NAV_BAR_COLOR = "nav_bar_color";
    private static final String KEY_IS_LIGHT = "is_light";
    private static final String KEY_SECURE_MODE = "secure_mode";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        androidx.core.splashscreen.SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        registerPlugin(NativeThemePlugin.class);
        registerPlugin(SecurityPlugin.class);
        registerPlugin(com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth.class);
        registerPlugin(de.carstenklaffke.billing.BillingPlugin.class);
        registerPlugin(ReliableNotificationPlugin.class);

        // Lock WebView text zoom and prevent Android autofill/system font scaling issues
        lockWebViewSettings();

        if (bridge != null && bridge.getWebView() != null) {
            // Keep the WebView renderer process alive when backgrounded
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                bridge.getWebView().setRendererPriorityPolicy(
                        WebView.RENDERER_PRIORITY_IMPORTANT, false);
            }

            // Pre-set WebView background to the theme color BEFORE HTML loads
            SharedPreferences earlyPrefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String earlyBg = earlyPrefs.getString(KEY_BG_COLOR, "#171B26");
            try {
                bridge.getWebView().setBackgroundColor(Color.parseColor(earlyBg));
            } catch (Exception e) {
                bridge.getWebView().setBackgroundColor(Color.parseColor("#171B26"));
            }
        }

        // Apply saved theme colors immediately on create
        applySavedTheme();

        // Apply secure mode flags
        applySecureMode();
    }

    @Override
    public void onResume() {
        super.onResume();
        applySecureMode();
    }

    // =========================================================================
    // SECURITY & THEME
    // =========================================================================

    private void applySecureMode() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean secureMode = prefs.getBoolean(KEY_SECURE_MODE, false);
            Window window = getWindow();
            if (window != null) {
                if (secureMode) {
                    window.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                } else {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                }
            }
        } catch (Exception e) {
            // Fail silently
        }
    }

    private void applySavedTheme() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String bgColor = prefs.getString(KEY_BG_COLOR, "#171B26");
        String statusBarColor = prefs.getString(KEY_STATUS_BAR_COLOR, "#171B26");
        String navBarColor = prefs.getString(KEY_NAV_BAR_COLOR, "#171B26");
        boolean isLight = prefs.getBoolean(KEY_IS_LIGHT, false);

        try {
            Window window = getWindow();
            View decorView = window.getDecorView();
            int bgVal = Color.parseColor(bgColor);
            int statusVal = Color.parseColor(statusBarColor);
            int navVal = Color.parseColor(navBarColor);

            // Apply window background using ColorDrawable
            window.setBackgroundDrawable(new ColorDrawable(bgVal));

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

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            lockWebViewSettings();
        }
    }

    private void lockWebViewSettings() {
        try {
            if (bridge != null && bridge.getWebView() != null) {
                WebView wv = bridge.getWebView();
                WebSettings settings = wv.getSettings();
                settings.setTextZoom(100);
                settings.setSupportZoom(false);
                settings.setBuiltInZoomControls(false);
                settings.setDisplayZoomControls(false);
                settings.setUseWideViewPort(true);
                settings.setLoadWithOverviewMode(true);
                settings.setDefaultFontSize(16);
                settings.setMinimumFontSize(1);
                settings.setMinimumLogicalFontSize(1);
                wv.setInitialScale(100);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    wv.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not lock WebView settings", e);
        }
    }
}
