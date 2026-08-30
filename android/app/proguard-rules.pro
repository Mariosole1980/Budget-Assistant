# Capacitor & WebView JavascriptInterface rules
-keep public class * extends com.getcapacitor.Plugin
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve line numbers and source files for Google Play deobfuscation crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Preserve Annotations
-keepattributes *Annotation*

# Google Play Billing Library
-keep class com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

# Google Play Services & Guava
-dontwarn com.google.android.gms.**
-dontwarn com.google.common.**
-dontwarn java.lang.invoke.**
-dontwarn javax.annotation.**
