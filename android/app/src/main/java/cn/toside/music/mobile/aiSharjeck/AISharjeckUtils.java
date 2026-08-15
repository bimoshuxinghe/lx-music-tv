package cn.toside.music.mobile.aiSharjeck;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Log;

/**
 * 夏杰语音 AI Open 注册工具
 */
public class AISharjeckUtils {
  private static final String TAG = "AISharjeckUtils";

  private static AISharjeckReceiver dynamicReceiver;

  private AISharjeckUtils() {}

  /**
   * 向夏杰语音注册本应用为音乐应用
   */
  public static void registerApp(Context context) {
    try {
      Intent localIntent = new Intent();
      localIntent.setAction(AISharjeckConstant.AI_OPEN_ACTION_APP_REGISTER);
      android.os.Bundle data = new android.os.Bundle();
      data.putString("package_name", context.getPackageName());
      data.putString("api_package", context.getPackageName());
      data.putLong("category", AISharjeckConstant.SEMANTIC_MUSIC);
      localIntent.putExtras(data);

      String pkg = isSpeechAppInstalled(context, AISharjeckConstant.AI_SPEECH_PACKAGE_CN)
        ? AISharjeckConstant.AI_SPEECH_PACKAGE_CN
        : AISharjeckConstant.AI_SPEECH_PACKAGE_GLOBAL;
      localIntent.setPackage(pkg);

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(localIntent);
      } else {
        context.startService(localIntent);
      }
      Log.d(TAG, "register music app to " + pkg);
    } catch (Exception e) {
      Log.e(TAG, "register app failed", e);
    }
  }

  /**
   * 动态注册广播接收器，确保应用运行时能收到 register.require 与音乐指令。
   * 返回同一实例（防止重复注册），调用前请先确认未注册过。
   */
  public static AISharjeckReceiver registerDynamicReceiver(Context context) {
    if (dynamicReceiver != null) return dynamicReceiver;
    dynamicReceiver = new AISharjeckReceiver();
    IntentFilter filter = new IntentFilter();
    filter.addAction(AISharjeckConstant.AI_OPEN_ACTION_APP_REGISTER_REQUIRE);
    context.registerReceiver(dynamicReceiver, filter);
    Log.d(TAG, "dynamic receiver registered");
    return dynamicReceiver;
  }

  /**
   * 反注册动态广播接收器
   */
  public static void unregisterDynamicReceiver(Context context) {
    if (dynamicReceiver == null) return;
    try {
      context.unregisterReceiver(dynamicReceiver);
    } catch (Exception e) {
      Log.e(TAG, "unregister receiver failed", e);
    }
    dynamicReceiver = null;
  }

  /**
   * 检查指定包名的语音应用是否已安装
   */
  public static boolean isSpeechAppInstalled(Context context, String packageName) {
    try {
      context.getPackageManager().getPackageInfo(packageName, 0);
      return true;
    } catch (Exception e) {
      return false;
    }
  }
}

