package com.budgetassistant.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.Gravity;
import android.view.PixelCopy;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "BA-ResumeOverlay";
    private static final String PREFS_NAME = "NativeThemePrefs";
    private static final String KEY_BG_COLOR = "bg_color";
    private static final String KEY_STATUS_BAR_COLOR = "status_bar_color";
    private static final String KEY_NAV_BAR_COLOR = "nav_bar_color";
    private static final String KEY_IS_LIGHT = "is_light";
    private static final String KEY_SECURE_MODE = "secure_mode";

    // INSTANT-RESUME OVERLAY: Instead of showing a plain solid color (which the
    // user perceives as a "flash"), we capture a bitmap snapshot of the WebView
    // in onPause() and set it as the overlay's background. When the user returns,
    // the overlay shows the EXACT last frame of the app — identical to what they
    // saw before backgrounding. The overlay then fades out smoothly once the
    // WebView has recomposited the real content, making the resume feel instant.
    //
    // We add the overlay as a SEPARATE WINDOW via WindowManager
    // (TYPE_APPLICATION_PANEL) so it is composited ABOVE the WebView surface by
    // the system compositor, regardless of hardware acceleration quirks.
    private View resumeOverlay;
    private Bitmap lastSnapshot;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // Fallback: hides overlay if JS content-painted signal never arrives.
    private static final long RESUME_OVERLAY_HIDE_DELAY_MS = 2000;
    // Minimum time the overlay stays visible after resume. With
    // setRendererPriorityPolicy() keeping the renderer alive, the surface
    // recompositing gap is much shorter, so we can use a smaller value.
    private static final long MIN_RESUME_OVERLAY_VISIBLE_MS = 350;
    // Smooth fade-out duration. Short enough to feel instant, long enough to
    // mask any sub-frame rendering differences between snapshot and live content.
    private static final long OVERLAY_FADE_OUT_MS = 180;
    private long resumeTimestamp = 0;

    // DIAGNOSTIC MODE: When true, the overlay uses bright magenta so you can
    // VISUALLY confirm whether the overlay is covering the WebView on resume.
    // Set to false for production.
    private static final boolean DIAGNOSTIC_OVERLAY_COLOR = false;
    private static final String DIAGNOSTIC_COLOR = "#FF00FF";

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
            // INSTANT-RESUME: Keep the WebView renderer process alive when the app
            // is backgrounded. This prevents the surface recreation gap that causes
            // blank frames on resume — the renderer stays in memory so the content
            // is ready immediately when the user returns (like native apps).
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                bridge.getWebView().setRendererPriorityPolicy(
                        WebView.RENDERER_PRIORITY_IMPORTANT, false);
            }

            // Pre-set WebView background to the saved theme color BEFORE HTML loads
            // so the WebView surface never shows the default white background during
            // cold start.
            SharedPreferences earlyPrefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String earlyBg = earlyPrefs.getString(KEY_BG_COLOR, "#181b22");
            try {
                bridge.getWebView().setBackgroundColor(Color.parseColor(earlyBg));
            } catch (Exception e) {
                bridge.getWebView().setBackgroundColor(Color.parseColor("#181b22"));
            }

            // Expose a JS→Native bridge so JS can hide the overlay as soon as the
            // WebView has painted its first frame after resume (faster than any timer).
            bridge.getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void onFirstPaint() {
                    Log.d(TAG, "JS onFirstPaint signal received");
                    // Enforce a minimum visible time so the WebView surface has
                    // fully recomposited and painted the real content before we
                    // reveal it. If the signal arrived too early, defer the hide
                    // until the minimum window has elapsed.
                    long elapsed = SystemClock.uptimeMillis() - resumeTimestamp;
                    long remaining = MIN_RESUME_OVERLAY_VISIBLE_MS - elapsed;
                    if (remaining > 0) {
                        Log.d(TAG, "onFirstPaint too early (" + elapsed + "ms), deferring " + remaining + "ms");
                        mainHandler.removeCallbacks(hideResumeOverlayRunnable);
                        mainHandler.postDelayed(hideResumeOverlayRunnable, remaining);
                    } else {
                        mainHandler.post(MainActivity.this::hideResumeOverlay);
                    }
                }
            }, "NativeApp");
        }

        // Apply saved theme colors immediately on create
        applySavedTheme();

        // Apply secure mode flags
        applySecureMode();

        // Create the native resume overlay as a top-level window. Deferred until the
        // decor view is attached so the window token is valid for TYPE_APPLICATION_PANEL.
        // On cold start, the overlay starts GONE so it NEVER blocks or covers the
        // branded HTML splash screen (splash.html).
        // It is only shown on onPause() -> onResume() with the captured bitmap snapshot.
        getWindow().getDecorView().post(() -> {
            createResumeOverlay();
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        Log.d(TAG, "onResume");
        // Record when this resume started so onFirstPaint() can enforce the
        // minimum visible time for the overlay.
        resumeTimestamp = SystemClock.uptimeMillis();
        // Apply secure mode flags on resume.
        applySecureMode();
        // Re-apply the saved theme background on every resume.
        applySavedTheme();

        // The overlay was shown (with bitmap snapshot) in onPause() and is already
        // covering the WebView. Start the fallback timer. The JS onFirstPaint
        // signal normally hides it much sooner.
        mainHandler.removeCallbacks(hideResumeOverlayRunnable);
        mainHandler.postDelayed(hideResumeOverlayRunnable, RESUME_OVERLAY_HIDE_DELAY_MS);
    }

    @Override
    public void onPause() {
        super.onPause();
        Log.d(TAG, "onPause — capturing snapshot and showing overlay");
        // Capture a bitmap snapshot of the WebView BEFORE showing the overlay.
        // This snapshot becomes the overlay's background, making the resume
        // transition seamless because the overlay shows the exact last frame
        // the user saw — regardless of what theme/colors the app uses.
        captureWebViewSnapshot();
        showResumeOverlay();
    }

    private final Runnable hideResumeOverlayRunnable = () -> {
        Log.d(TAG, "Fallback timer fired — hiding overlay");
        hideResumeOverlay();
    };

    // =========================================================================
    // BITMAP SNAPSHOT CAPTURE
    // =========================================================================
    // Captures the current WebView content and sets it as the overlay's
    // background. Uses PixelCopy (API 26+) for accurate hardware-accelerated
    // capture, with Canvas fallback for older devices.
    // =========================================================================

    /**
     * Capture the current screen content and set it as the overlay's background.
     * Uses PixelCopy (API 26+) for the most accurate capture of hardware-
     * accelerated content. Falls back to Canvas draw for older APIs.
     * If all capture methods fail, the solid theme color remains as fallback.
     */
    private void captureWebViewSnapshot() {
        if (DIAGNOSTIC_OVERLAY_COLOR)
            return;

        // Try PixelCopy first (API 26+): captures the Window's Surface directly,
        // including status bar and nav bar backgrounds, for a pixel-perfect match
        // with what the user sees. PixelCopy is async but completes within 1 frame
        // (~16ms), well before the app is fully backgrounded.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                if (bridge != null && bridge.getWebView() != null) {
                    WebView wv = bridge.getWebView();
                    int w = wv.getWidth();
                    int h = wv.getHeight();
                    if (w > 0 && h > 0) {
                        recycleSnapshot();
                        lastSnapshot = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);

                        int[] location = new int[2];
                        wv.getLocationInWindow(location);
                        Rect rect = new Rect(
                                location[0],
                                location[1],
                                location[0] + w,
                                location[1] + h);

                        PixelCopy.request(getWindow(), rect, lastSnapshot, (result) -> {
                            if (result == PixelCopy.SUCCESS && resumeOverlay != null) {
                                BitmapDrawable bd = new BitmapDrawable(getResources(), lastSnapshot);
                                resumeOverlay.setBackground(bd);
                                Log.d(TAG, "Snapshot captured via PixelCopy (" + w + "x" + h + " at " + location[0]
                                        + "," + location[1] + ")");
                            } else {
                                Log.w(TAG, "PixelCopy failed (result=" + result + "), trying Canvas");
                                captureViaCanvas();
                            }
                        }, mainHandler);
                        return;
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "PixelCopy exception, trying Canvas fallback", e);
            }
        }
        // Fallback for API < 26 or PixelCopy failure
        captureViaCanvas();
    }

    /**
     * Fallback capture method: draws the WebView content to a software Canvas.
     * Works on all API levels but may produce partial results on some devices
     * with hardware-accelerated WebViews.
     */
    private void captureViaCanvas() {
        if (bridge == null || bridge.getWebView() == null)
            return;

        WebView wv = bridge.getWebView();
        int w = wv.getWidth();
        int h = wv.getHeight();
        if (w <= 0 || h <= 0)
            return;

        try {
            recycleSnapshot();
            lastSnapshot = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(lastSnapshot);
            wv.draw(canvas);

            if (resumeOverlay != null) {
                BitmapDrawable bd = new BitmapDrawable(getResources(), lastSnapshot);
                resumeOverlay.setBackground(bd);
                Log.d(TAG, "Snapshot captured via Canvas (" + w + "x" + h + ")");
            }
        } catch (OutOfMemoryError | Exception e) {
            Log.w(TAG, "Canvas capture failed, keeping solid color fallback", e);
            recycleSnapshot();
        }
    }

    /** Safely recycle the previous snapshot bitmap to prevent memory leaks. */
    private void recycleSnapshot() {
        if (lastSnapshot != null && !lastSnapshot.isRecycled()) {
            lastSnapshot.recycle();
        }
        lastSnapshot = null;
    }

    // =========================================================================
    // OVERLAY LIFECYCLE
    // =========================================================================

    private void createResumeOverlay() {
        try {
            resumeOverlay = new View(this);
            resumeOverlay.setLayoutParams(new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT));

            // Set initial background to the splash drawable (glow background) for cold start.
            try {
                resumeOverlay.setBackground(androidx.core.content.ContextCompat.getDrawable(this, R.drawable.splash));
            } catch (Exception e) {
                resumeOverlay.setBackgroundColor(Color.parseColor("#171B26"));
            }

            // TRANSLUCENT pixel format ensures the overlay is ALWAYS composited
            // above the WebView surface by the system compositor. PixelFormat.OPAQUE
            // can cause z-ordering races on Samsung OneUI where the hardware
            // compositor re-orders surfaces, making the overlay invisible behind
            // the WebView — this is the root cause of the flickering on Samsung.
            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.TYPE_APPLICATION_PANEL,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                            | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                            | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT);
            params.gravity = Gravity.TOP | Gravity.START;
            params.token = getWindow().getDecorView().getWindowToken();
            params.setTitle("ResumeOverlay");

            WindowManager wm = getWindowManager();
            wm.addView(resumeOverlay, params);
            // Start GONE for cold start so it NEVER blocks or covers the HTML splash screen (splash.html).
            // It is only shown on onPause() -> onResume() with the captured bitmap snapshot.
            resumeOverlay.setVisibility(View.GONE);
            Log.d(TAG, "Resume overlay created (GONE for cold start)");
        } catch (Exception e) {
            Log.e(TAG, "Failed to create resume overlay window", e);
            resumeOverlay = null;
        }
    }

    private void showResumeOverlay() {
        if (resumeOverlay != null) {
            Log.d(TAG, "showResumeOverlay()");
            // Cancel any in-progress fade-out animation from a previous hide
            resumeOverlay.animate().cancel();
            resumeOverlay.setAlpha(1f);
            resumeOverlay.setVisibility(View.VISIBLE);
            resumeOverlay.bringToFront();
        }
    }

    private void hideResumeOverlay() {
        if (resumeOverlay == null || resumeOverlay.getVisibility() != View.VISIBLE)
            return;
        Log.d(TAG, "hideResumeOverlay() — fading out");

        // Cancel any existing animation to prevent conflicts (e.g. if both the
        // JS signal and fallback timer try to hide simultaneously).
        resumeOverlay.animate().cancel();

        // Smooth fade-out: the bitmap snapshot matches the real content, so the
        // fade is barely perceptible — it just smooths over any sub-pixel
        // rendering differences between the snapshot and the live WebView.
        resumeOverlay.animate()
                .alpha(0f)
                .setDuration(OVERLAY_FADE_OUT_MS)
                .withEndAction(() -> {
                    resumeOverlay.setVisibility(View.GONE);
                    resumeOverlay.setAlpha(1f); // Reset for next showResumeOverlay()

                    // Restore solid color background (for next cold-start-like
                    // scenario) and recycle the bitmap to free memory.
                    restoreOverlaySolidColor();
                    recycleSnapshot();
                    Log.d(TAG, "Overlay hidden and snapshot recycled");
                })
                .start();
    }

    /** Reset the overlay background to the splash drawable. */
    private void restoreOverlaySolidColor() {
        if (resumeOverlay == null)
            return;
        try {
            resumeOverlay.setBackground(androidx.core.content.ContextCompat.getDrawable(this, R.drawable.splash));
        } catch (Exception e) {
            resumeOverlay.setBackgroundColor(Color.parseColor("#171B26"));
        }
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
            window.setBackgroundDrawable(new ColorDrawable(bgVal));

            // Apply WebView background if initialized
            if (bridge != null && bridge.getWebView() != null) {
                bridge.getWebView().setBackgroundColor(bgVal);
            }

            // Only update the overlay's solid-color background when no bitmap
            // snapshot is set. When a bitmap IS set (resume in progress), we
            // keep it because it shows the exact app state — overwriting with
            // a solid color would cause the very flash we're trying to prevent.
            if (resumeOverlay != null && !DIAGNOSTIC_OVERLAY_COLOR && lastSnapshot == null) {
                resumeOverlay.setBackgroundColor(bgVal);
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
            // After Samsung Pass or any overlay dismisses and focus returns,
            // force-reset the WebView zoom to 100% via JavaScript.
            resetWebViewZoom();
        }
    }

    private void lockWebViewSettings() {
        try {
            if (bridge != null && bridge.getWebView() != null) {
                android.webkit.WebView wv = bridge.getWebView();
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
                // Force initial scale to 100% — prevents Samsung Pass autofill zoom
                wv.setInitialScale(100);
                // SAMSUNG PASS FIX: Disable the Android AutofillManager for
                // this WebView. Samsung Pass (and other autofill providers)
                // trigger an unwanted zoom when the AutofillManager focuses
                // input fields. This is the ROOT CAUSE that CSS/JS/viewport
                // meta cannot fix — the zoom happens at the native framework
                // level before any web code runs. Samsung Pass still works
                // via keyboard integration (Samsung Keyboard suggestions).
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    wv.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not lock WebView settings", e);
        }
    }

    /**
     * Force-resets the WebView zoom/scale back to 1.0 after Samsung Pass
     * or any system overlay that may have caused an unwanted zoom.
     * Uses both WebView.zoomOut() calls and JavaScript meta-viewport reset.
     */
    private void resetWebViewZoom() {
        try {
            if (bridge != null && bridge.getWebView() != null) {
                android.webkit.WebView wv = bridge.getWebView();
                // Force scale back to 100%
                wv.setInitialScale(100);
                // Use JS to forcefully reset the viewport meta tag and scroll position
                wv.evaluateJavascript(
                    "(function(){" +
                    "  var vp = document.querySelector('meta[name=viewport]');" +
                    "  if(vp){" +
                    "    vp.setAttribute('content','width=device-width,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no,shrink-to-fit=no,viewport-fit=cover');" +
                    "  }" +
                    "  window.scrollTo(0,0);" +
                    "  document.body.scrollTop=0;" +
                    "  document.documentElement.scrollTop=0;" +
                    "  if(window.visualViewport && window.visualViewport.scale !== 1){" +
                    "    document.body.style.zoom='1';" +
                    "  }" +
                    "})();",
                    null
                );
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not reset WebView zoom", e);
        }
    }
}
