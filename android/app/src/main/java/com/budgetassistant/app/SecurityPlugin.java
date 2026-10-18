package com.budgetassistant.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.view.Window;
import android.view.WindowManager;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executor;

@CapacitorPlugin(name = "Security")
public class SecurityPlugin extends Plugin {

    private static final String PREFS_NAME = "NativeThemePrefs";
    private static final String KEY_SECURE_MODE = "secure_mode";

    @PluginMethod
    public void getBiometricsStatus(PluginCall call) {
        try {
            boolean available = false;
            boolean enrolled = false;
            List<String> types = new ArrayList<>();
            String securityLevel = "none";

            BiometricManager biometricManager = BiometricManager.from(getContext());
            int canAuthCombined = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK);
            if (canAuthCombined == BiometricManager.BIOMETRIC_SUCCESS) {
                available = true;
                enrolled = true;
                securityLevel = "strong";
            } else if (canAuthCombined == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
                available = true;
                enrolled = false;
                securityLevel = "strong";
            } else {
                int canStrong = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
                int canWeak = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK);
                if (canStrong == BiometricManager.BIOMETRIC_SUCCESS || canWeak == BiometricManager.BIOMETRIC_SUCCESS) {
                    available = true;
                    enrolled = true;
                    securityLevel = (canStrong == BiometricManager.BIOMETRIC_SUCCESS) ? "strong" : "weak";
                } else if (canStrong == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED || canWeak == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
                    available = true;
                    enrolled = false;
                    securityLevel = (canStrong == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) ? "strong" : "weak";
                }
            }

            android.content.pm.PackageManager pm = getContext().getPackageManager();
            if (pm.hasSystemFeature(android.content.pm.PackageManager.FEATURE_FINGERPRINT)) {
                types.add("fingerprint");
            }
            if (android.os.Build.VERSION.SDK_INT >= 29 && pm.hasSystemFeature(android.content.pm.PackageManager.FEATURE_FACE)) {
                types.add("face");
            }
            if (android.os.Build.VERSION.SDK_INT >= 29 && pm.hasSystemFeature(android.content.pm.PackageManager.FEATURE_IRIS)) {
                types.add("iris");
            }
            if (available && types.isEmpty()) {
                types.add("fingerprint");
            }

            JSObject ret = new JSObject();
            ret.put("available", available);
            ret.put("enrolled", enrolled);
            ret.put("securityLevel", securityLevel);

            JSArray typesArray = new JSArray();
            for (String t : types) {
                typesArray.put(t);
            }
            ret.put("types", typesArray);

            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to check biometrics status: " + e.getMessage());
        }
    }

    @PluginMethod
    public void authenticateBiometrics(final PluginCall call) {
        final String title = call.getString("title", "Biometric Unlock");
        final String subtitle = call.getString("subtitle", "Authenticate to continue");
        final String cancelButtonText = call.getString("cancelButtonText", "Cancel");

        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Executor executor = ContextCompat.getMainExecutor(getContext());

                    BiometricPrompt.AuthenticationCallback callback = new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                            super.onAuthenticationError(errorCode, errString);
                            JSObject ret = new JSObject();
                            ret.put("success", false);
                            ret.put("error", errString.toString());
                            ret.put("errorCode", errorCode);
                            call.resolve(ret);
                        }

                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            super.onAuthenticationSucceeded(result);
                            JSObject ret = new JSObject();
                            ret.put("success", true);
                            call.resolve(ret);
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            super.onAuthenticationFailed();
                            // Handled by System UI prompt automatically.
                        }
                    };

                    BiometricPrompt biometricPrompt = new BiometricPrompt(getActivity(), executor, callback);

                    BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title)
                        .setSubtitle(subtitle)
                        .setNegativeButtonText(cancelButtonText)
                        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK)
                        .build();

                    try {
                        biometricPrompt.authenticate(promptInfo);
                    } catch (Exception e) {
                        try {
                            BiometricPrompt.PromptInfo promptInfoStrong = new BiometricPrompt.PromptInfo.Builder()
                                .setTitle(title)
                                .setSubtitle(subtitle)
                                .setNegativeButtonText(cancelButtonText)
                                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                                .build();
                            biometricPrompt.authenticate(promptInfoStrong);
                        } catch (Exception ex) {
                            JSObject ret = new JSObject();
                            ret.put("success", false);
                            ret.put("error", ex.getMessage());
                            call.resolve(ret);
                        }
                    }
                } catch (Exception e) {
                    JSObject ret = new JSObject();
                    ret.put("success", false);
                    ret.put("error", e.getMessage());
                    call.resolve(ret);
                }
            }
        });
    }

    @PluginMethod
    public void setSecureMode(final PluginCall call) {
        final Boolean enabled = call.getBoolean("enabled", false);
        final boolean isEnabled = (enabled != null && enabled);

        // Persist first: this preference is what MainActivity reads on cold
        // start, before the WebView (and therefore this plugin) exists.
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean(KEY_SECURE_MODE, isEnabled).commit();
        } catch (Exception e) {
            call.reject("Failed to persist secure mode: " + e.getMessage());
            return;
        }

        final android.app.Activity activity = getActivity() != null ? getActivity() : (getBridge() != null ? getBridge().getActivity() : null);
        if (activity == null) {
            android.util.Log.w("SecurityPlugin", "setSecureMode: no activity attached yet");
            call.resolve(buildSecureModeState());
            return;
        }

        // Apply on the UI thread and answer AFTER the window flags changed, so
        // the JS layer can trust the returned state when it verifies FLAG_SECURE.
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    applySecureMode(isEnabled);
                    call.resolve(buildSecureModeState());
                } catch (Exception e) {
                    call.reject("Failed to set secure mode: " + e.getMessage());
                }
            }
        });
    }

    @PluginMethod
    public void getSecureMode(PluginCall call) {
        call.resolve(buildSecureModeState());
    }

    /**
     * enabled      → persisted native preference (applied on cold start)
     * windowSecure → the real FLAG_SECURE bit on the activity window
     */
    private JSObject buildSecureModeState() {
        boolean prefEnabled = false;
        try {
            Context context = getContext();
            if (context != null) {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefEnabled = prefs.getBoolean(KEY_SECURE_MODE, false);
            }
        } catch (Exception e) {
            android.util.Log.e("SecurityPlugin", "Failed to read secure mode pref", e);
        }

        JSObject ret = new JSObject();
        ret.put("enabled", prefEnabled);
        ret.put("windowSecure", isWindowSecure());
        return ret;
    }

    private boolean isWindowSecure() {
        try {
            android.app.Activity activity = getActivity() != null ? getActivity() : (getBridge() != null ? getBridge().getActivity() : null);
            if (activity == null) return false;
            Window window = activity.getWindow();
            return window != null && (window.getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE) != 0;
        } catch (Exception e) {
            return false;
        }
    }

    public boolean applySecureMode(final boolean enabled) {
        final android.app.Activity activity = getActivity() != null ? getActivity() : (getBridge() != null ? getBridge().getActivity() : null);
        if (activity == null) {
            android.util.Log.w("SecurityPlugin", "applySecureMode: no activity attached");
            return false;
        }

        Runnable apply = new Runnable() {
            @Override
            public void run() {
                try {
                    Window window = activity.getWindow();
                    if (window != null) {
                        if (enabled) {
                            window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
                            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                            if ((window.getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE) == 0) {
                                // Retry once: a few OEM ROMs ignore the first request
                                // while the window is still being attached.
                                window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
                                android.util.Log.w("SecurityPlugin", "FLAG_SECURE did not stick on first attempt - re-applied");
                            }
                        } else {
                            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                        }
                    }
                } catch (Exception e) {
                    android.util.Log.e("SecurityPlugin", "Failed to apply FLAG_SECURE", e);
                }
            }
        };

        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
            apply.run();
        } else {
            activity.runOnUiThread(apply);
        }

        return enabled ? isWindowSecure() : true;
    }
}
