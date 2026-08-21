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
