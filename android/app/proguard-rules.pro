# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

-keep class com.reactnativenavigation.views.element.animators.** { *; }
# -keepclassmembers class com.reactnativenavigation.views.element.animators.** { *; }


-keep class org.jaudiotagger.tag.** { *; }


-keep public class com.dylanvann.fastimage.* {*;}
-keep public class com.dylanvann.fastimage.** {*;}
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep public class * extends com.bumptech.glide.module.AppGlideModule
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
  **[] $VALUES;
  public *;
}

# ZXing (二维码生成)
-keep class com.google.zxing.** { *; }
-keepclassmembers class com.google.zxing.** { *; }

# KTV 专区：宿主 Spider 基类，spider.jar 中的 dex 通过 parent 类加载器引用，
# 必须保持类名与方法签名不被 R8 混淆，否则继承链解析失败
-keep class com.github.catvod.crawler.Spider { *; }
-keepclassmembers class com.github.catvod.crawler.Spider { *; }

# KTV 专区：wexguard 解密后的真实爬虫代码运行时需要 okhttp/okio。
# RN 自带 okhttp 4.9.2，但 release 构建的 R8 会把 App 未直接引用的类
# （如 okhttp3.EventListener$Factory）裁掉，导致 "Failed resolution of"。
# 与 TVBox 宿主一致，保留整个 okhttp3/okio 供解密后代码使用。
-keep class okhttp3.** { *; }
-keepclassmembers class okhttp3.** { *; }
-dontwarn okhttp3.**
-keep class okio.** { *; }
-keepclassmembers class okio.** { *; }
-dontwarn okio.**

# KTV 专区：wexguard 解密后的真实爬虫 dex 是独立构建的，引用原始未混淆的
# kotlin-stdlib 类名（如 kotlin.jvm.internal.Intrinsics、kotlin.Unit）。
# RN release 构建的 R8 会把 kotlin 类混淆重命名（实测 Intrinsics->l6/a 等），
# 导致解密代码 FindClass 失败，JNI 报 "Class not found using the boot class loader"。
# 与 TVBox 宿主一致，必须保持 kotlin 原始类名，供解密后代码按原名解析。
-keep class kotlin.** { *; }
-keepclassmembers class kotlin.** { *; }
-dontwarn kotlin.**
-keep class kotlinx.** { *; }
-keepclassmembers class kotlinx.** { *; }
-dontwarn kotlinx.**

# KTV 专区：与 TVBox 宿主一致，保留整个 com.github.catvod 包，
# 解密后的真实爬虫代码若引用宿主 catvod 工具类（utils/net 等）需能按原名找到
-keep class com.github.catvod.** { *; }
-keepclassmembers class com.github.catvod.** { *; }
-dontwarn com.github.catvod.**

# KTV 专区：真实爬虫代码解密后按 TVBox 宿主 API 引用 gson/jsoup。
# R8 编译时看不到解密后 dex 的引用，若不 keep 会被裁剪/混淆，
# 运行时 FindClass 失败。与 TVBox 宿主 gson 2.10.1 / jsoup 1.16.1 对齐。
-keep class com.google.gson.** { *; }
-keepclassmembers class com.google.gson.** { *; }
-dontwarn com.google.gson.**
-keep class org.jsoup.** { *; }
-keepclassmembers class org.jsoup.** { *; }
-dontwarn org.jsoup.**

# KTV 专区：真实爬虫代码可能直接 import com.google.common.net.HttpHeaders（guava 头常量）。
# 本 App 提供同包同名简化常量类，keep 防止混淆
-keep class com.google.common.net.HttpHeaders { *; }
-keepclassmembers class com.google.common.net.HttpHeaders { *; }
-dontwarn com.google.common.**

# KTV 专区：壳 dex 的 mergeguard 代码引用了 com.whl.quickjs.*（RN 已有
# wang.harlon.quickjs:wrapper-android 依赖），真实爬虫解密后也可能调用 JS 脚本。
# keep 住 quickjs 类，避免 R8 裁剪导致解密代码 FindClass 失败。
-keep class com.whl.quickjs.** { *; }
-keepclassmembers class com.whl.quickjs.** { *; }
-dontwarn com.whl.quickjs.**

# KTV 专区：真实爬虫代码可能引用 TVBox 纯工具类（MD5 签名、AES 参数加密、StringUtils）。
# 与 TVBox 宿主 com.github.tvbox.osc.util 一致，keep 防止 R8 裁剪/混淆
-keep class com.github.tvbox.osc.util.** { *; }
-keepclassmembers class com.github.tvbox.osc.util.** { *; }
-dontwarn com.github.tvbox.osc.**

# KTV 专区：androidx.collection ArrayMap 被宿主 catvod/net/OkHttp 方法签名使用
-keep class androidx.collection.** { *; }
-keepclassmembers class androidx.collection.** { *; }
-dontwarn androidx.collection.**
