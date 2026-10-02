# R8 rules for the release build (minifyEnabled true).
#
# What follows is only what R8 cannot work out for itself: code that is reached
# by NAME — from a string, a manifest, a config file or the WebView — rather
# than by a call it can trace. Everything else is shrunk and renamed, which is
# the point. Capacitor's own consumer rules already keep every class that
# extends com.getcapacitor.Plugin and every @PluginMethod, and Firebase,
# AdMob, Play Billing and Media3 ship theirs; these are the gaps.

# Stack traces in Play Console are deobfuscated with the mapping.txt that the
# AAB carries, but only if line numbers survive. Without these two lines every
# frame reads "Unknown Source" and a crash cluster is unreadable.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Reflection, generics and annotations that the plugins read at runtime.
-keepattributes Signature,InnerClasses,EnclosingMethod,*Annotation*

# Capacitor's bridge is called from JavaScript through the WebView.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# In-app purchase. cordova-plugin-purchase is not a Capacitor plugin: cordova's
# PluginManager builds it with Class.forName from the name in res/xml/config.xml
# (feature "InAppBillingPlugin" -> cc.fovea.PurchasePlugin). Nothing in the code
# refers to that class, so R8 would delete it as unused and every purchase call
# would fail with "Plugin not found" — only in a release build, only at runtime.
-keep class cc.fovea.** { *; }
-keep class org.apache.cordova.** { *; }

# Our patched @capgo/native-audio. NativeAudio.java creates StreamAudioAsset and
# probes HLS support with Class.forName on a string, and the plugin's own
# foreground service, queue and speech-text classes are the audio path the
# lock screen, the notification and the device-voice fallback all depend on.
# Small enough that keeping the package whole costs nothing worth saving.
-keep class ee.forgr.audio.** { *; }

# The Firebase Authentication plugin ships a Facebook sign-in handler that
# refers to the Facebook SDK, which is an optional dependency this app does not
# include — sign-in here is Google and Apple only (src/services/sync/auth.js).
# R8 stops the build on classes it cannot find; the handler is never reached,
# so telling it not to worry is correct, and is the only way this is safe: if
# Facebook sign-in were ever added, this line must go along with the SDK.
-dontwarn com.facebook.**
