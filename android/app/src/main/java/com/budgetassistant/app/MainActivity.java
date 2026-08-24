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
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

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
    private FrameLayout resumeOverlay;
    private ImageView snapshotImageView;
    private Bitmap lastSnapshot;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // Fallback: hides overlay if JS content-painted signal never arrives.
    private static final long RESUME_OVERLAY_HIDE_DELAY_MS = 1000;
    // Minimum time the overlay stays visible after resume. With
    // setRendererPriorityPolicy() keeping the renderer alive, the surface
    // recompositing gap is minimal, so 80ms is enough to avoid blank flicker.
    private static final long MIN_RESUME_OVERLAY_VISIBLE_MS = 80;
    // Smooth fade-out duration. Short enough to feel instant.
    private static final long OVERLAY_FADE_OUT_MS = 100;
    private long resumeTimestamp = 0;

    // COLD-START LAUNCH WINDOW GUARD:
    // While true, applySavedTheme() must NOT replace the branded splash PNG
    // (android:windowBackground = @drawable/splash) with a solid color. If it
    // did, the user would see a flat color instead of the glow during the whole
    // launch window (the time between the native splash dismissal and the
    // WebView first paint). It is flipped to false after the first real draw of
    // the decor view, i.e. once the WebView content is on screen.
    private volatile boolean coldStartInProgress = true;

    // LAUNCH-DONE SIGNAL GUARD: Sent exactly once from the first
    // onWindowFocusChanged(true) so the web layer can anchor the HTML splash
    // countdown to when the launch window is actually gone and the splash is
    // visible to the user (instead of the iframe onload, which fires while the
    // native window still covers the screen).
    private volatile boolean launchSignalSent = false;

    // DIAGNOSTIC MODE: When true, the overlay uses bright magenta so you can
    // VISUALLY confirm whether the overlay is covering the WebView on resume.
    // Set to false for production.
    private static final boolean DIAGNOSTIC_OVERLAY_COLOR = false;
    private static final String DIAGNOSTIC_COLOR = "#FF00FF";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        try {
            androidx.core.splashscreen.SplashScreen.installSplashScreen(this);
        } catch (Throwable t) {
            Log.w(TAG, "SplashScreen.installSplashScreen failed, falling back to standard theme", t);
        }
        super.onCreate(savedInstanceState);
        SharedPreferences earlyPrefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String earlyBg = earlyPrefs.getString(KEY_BG_COLOR, "#181b22");
        int initialBgColor = Color.parseColor("#181b22");
        try {
            initialBgColor = Color.parseColor(earlyBg);
        } catch (Exception e) {
            // Ignore
        }
        try {
            getWindow().setBackgroundDrawable(new ColorDrawable(initialBgColor));
        } catch (Exception e) {
            // Ignore
        }
        registerPlugin(NativeThemePlugin.class);
        registerPlugin(SecurityPlugin.class);
        registerPlugin(ReliableNotificationPlugin.class);

        // Lock WebView text zoom and prevent Android autofill/system font scaling issues
        lockWebViewSettings();

        if (bridge != null) {
            bridge.addWebViewListener(new WebViewListener() {
                @Override
                public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                    Log.e(TAG, "WebView renderer process gone (" + detail + ") — recovering without crash");
                    try {
                        if (webView != null) {
                            webView.post(() -> {
                                try {
                                    webView.loadUrl("https://localhost");
                                } catch (Exception e) {
                                    Log.e(TAG, "Failed to reload webview after renderer crash", e);
                                }
                            });
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error in onRenderProcessGone recovery", e);
                    }
                    return true; // Prevents the OS from killing the host app process!
                }
            });
        }

        if (bridge != null && bridge.getWebView() != null) {
            // INSTANT-RESUME: Keep the WebView renderer process alive when the app
            // is backgrounded. This prevents the surface recreation gap that causes
            // blank frames on resume — the renderer stays in memory so the content
            // is ready immediately when the user returns (like native apps).
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                bridge.getWebView().setRendererPriorityPolicy(
                        WebView.RENDERER_PRIORITY_IMPORTANT, false);
            }

            try {
                bridge.getWebView().setBackground(null);
                bridge.getWebView().setBackgroundColor(initialBgColor);
            } catch (Exception e) {
                // Ignore
            }

            // Expose a JS→Native bridge so JS can hide the overlay as soon as the
            // WebView has painted its first frame after resume (faster than any timer).
            bridge.getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void onFirstPaint() {
                    Log.d(TAG, "JS onFirstPaint signal received");
                    mainHandler.post(() -> {
                        coldStartInProgress = false;
                        applySavedTheme();
                    });
                    // Enforce a minimum visible time so the WebView surface has
                    // fully recomposited and painted the real content before we
                    // reveal it. If the signal arrived too early, defer the hide
                    // until the minimum window has elapsed.
                    long elapsed = SystemClock.uptimeMillis() - resumeTimestamp;
                    if (elapsed < MIN_RESUME_OVERLAY_VISIBLE_MS) {
                        long remaining = MIN_RESUME_OVERLAY_VISIBLE_MS - elapsed;
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

        // NOTE: The launch-window-done signal that anchors the web-side HTML
        // splash countdown (window._markLaunchWindowGone) is sent from the first
        // onWindowFocusChanged(true) below — a safe, well-established callback —
        // instead of a ViewTreeObserver.OnDrawListener, which is unnecessary and
        // adds a risky extra lifecycle hook on some OEM builds.
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
        // using exact WebView bounds and window coordinates for a pixel-perfect match.
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
                        final int posX = location[0];
                        final int posY = location[1];
                        Rect rect = new Rect(
                                posX,
                                posY,
                                posX + w,
                                posY + h);

                        PixelCopy.request(getWindow(), rect, lastSnapshot, (result) -> {
                            if (result == PixelCopy.SUCCESS && snapshotImageView != null) {
                                FrameLayout.LayoutParams imgLp = new FrameLayout.LayoutParams(w, h);
                                imgLp.leftMargin = posX;
                                imgLp.topMargin = posY;
                                snapshotImageView.setLayoutParams(imgLp);
                                snapshotImageView.setImageBitmap(lastSnapshot);
                                snapshotImageView.setVisibility(View.VISIBLE);
                                Log.d(TAG, "Snapshot captured via PixelCopy (" + w + "x" + h + " at " + posX
                                        + "," + posY + ")");
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

        int[] location = new int[2];
        wv.getLocationInWindow(location);
        final int posX = location[0];
        final int posY = location[1];

        try {
            recycleSnapshot();
            lastSnapshot = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(lastSnapshot);
            wv.draw(canvas);

            if (snapshotImageView != null) {
                FrameLayout.LayoutParams imgLp = new FrameLayout.LayoutParams(w, h);
                imgLp.leftMargin = posX;
                imgLp.topMargin = posY;
                snapshotImageView.setLayoutParams(imgLp);
                snapshotImageView.setImageBitmap(lastSnapshot);
                snapshotImageView.setVisibility(View.VISIBLE);
                Log.d(TAG, "Snapshot captured via Canvas (" + w + "x" + h + " at " + posX + "," + posY + ")");
            }
        } catch (OutOfMemoryError | Exception e) {
            Log.w(TAG, "Canvas capture failed, keeping solid color fallback", e);
            recycleSnapshot();
        }
    }

    /** Safely recycle the previous snapshot bitmap to prevent memory leaks. */
    private void recycleSnapshot() {
        if (snapshotImageView != null) {
            snapshotImageView.setImageDrawable(null);
            snapshotImageView.setVisibility(View.GONE);
        }
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
            resumeOverlay = new FrameLayout(this);
            ViewGroup.LayoutParams lp = new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT);
            resumeOverlay.setLayoutParams(lp);

            // Set initial solid background matching the saved theme (prevents any splash glow leakage)
            SharedPreferences earlyPrefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String earlyBg = earlyPrefs.getString(KEY_BG_COLOR, "#181b22");
            int initialBgColor = Color.parseColor("#181b22");
            try {
                initialBgColor = Color.parseColor(earlyBg);
            } catch (Exception e) {
                // Fallback to default dark
            }
            resumeOverlay.setBackgroundColor(initialBgColor);

            // Dedicated snapshot image view positioned with exact WebView bounds (x, y, w, h)
            snapshotImageView = new ImageView(this);
            snapshotImageView.setScaleType(ImageView.ScaleType.FIT_XY);
            snapshotImageView.setVisibility(View.GONE);
            resumeOverlay.addView(snapshotImageView);

            // Start GONE for cold start so it NEVER blocks or covers the HTML splash screen (splash.html).
            // It is only shown on onPause() -> onResume() with the captured bitmap snapshot.
            resumeOverlay.setVisibility(View.GONE);

            // Add overlay directly to the activity's DecorView hierarchy (safe on ALL Android OEMs including Xiaomi/HyperOS)
            ViewGroup decor = (ViewGroup) getWindow().getDecorView();
            if (decor != null) {
                decor.addView(resumeOverlay);
                Log.d(TAG, "Resume overlay added to DecorView (GONE for cold start)");
            }
        } catch (Throwable t) {
            Log.e(TAG, "Failed to create resume overlay", t);
            resumeOverlay = null;
            snapshotImageView = null;
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

    /** Reset the overlay background to the solid theme color. Never use R.drawable.splash. */
    private void restoreOverlaySolidColor() {
        if (snapshotImageView != null) {
            snapshotImageView.setImageDrawable(null);
            snapshotImageView.setVisibility(View.GONE);
        }
        if (resumeOverlay == null)
            return;
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String bgColor = prefs.getString(KEY_BG_COLOR, "#181b22");
        int bgVal = Color.parseColor("#181b22");
        try {
            bgVal = Color.parseColor(bgColor);
        } catch (Exception e) {
            // Fallback to default dark
        }
        resumeOverlay.setBackgroundColor(bgVal);
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

            // Apply window background using ColorDrawable — but ONLY after the
            // cold-start launch window is over. During cold start the window
            // keeps the branded splash PNG (theme android:windowBackground =
            // @drawable/splash) so the glow is visible while the WebView loads;
            // replacing it here would show a flat color instead of the PNG.
            window.setBackgroundDrawable(new ColorDrawable(bgVal));

            if (bridge != null && bridge.getWebView() != null) {
                bridge.getWebView().setBackground(null);
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

            // LAUNCH-WINDOW-DONE SIGNAL (fixes the HTML splash being cut short):
            // The first time the window gains focus, the native launch window
            // (system splash on Android 12+ / launch window on older APIs) is
            // gone and the user can actually SEE the WebView. Tell the web layer
            // so the HTML splash countdown (fadeOutColdStartOverlay) starts from
            // when the splash is really visible — not from the iframe onload,
            // which fires while the native window still covers the screen. The
            // same moment ends the cold-start phase so applySavedTheme() may
            // re-apply the solid theme color on subsequent resumes.
            if (!launchSignalSent) {
                launchSignalSent = true;
                coldStartInProgress = false;
                applySavedTheme();
                mainHandler.post(() -> {
                    try {
                        if (bridge != null && bridge.getWebView() != null) {
                            bridge.getWebView().evaluateJavascript(
                                    "window._markLaunchWindowGone&&window._markLaunchWindowGone()", null);
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Could not signal launch window done to JS", e);
                    }
                });
            }
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

    @Override
    public void onDestroy() {
        super.onDestroy();
        try {
            if (resumeOverlay != null) {
                ViewGroup decor = (ViewGroup) getWindow().getDecorView();
                if (decor != null) {
                    decor.removeView(resumeOverlay);
                }
                resumeOverlay = null;
                snapshotImageView = null;
            }
            recycleSnapshot();
        } catch (Throwable t) {
            Log.w(TAG, "Error cleaning up resume overlay in onDestroy", t);
        }
    }
}
