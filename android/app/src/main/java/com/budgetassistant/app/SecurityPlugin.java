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

        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean(KEY_SECURE_MODE, enabled).apply();

            applySecureMode(enabled);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to set secure mode: " + e.getMessage());
        }
    }

    public void applySecureMode(final boolean enabled) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Window window = getActivity().getWindow();
                    if (enabled) {
                        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
                    } else {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    }
                } catch (Exception e) {
                    // Fail silently
                }
            }
        });
    }
}
