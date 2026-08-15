package cn.toside.music.mobile.aiSharjeck;

import android.util.Log;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * 夏杰语音桥接模块
 *
 * JS 侧通过 NativeModules.AISharjeck 访问：
 *  - register()：向夏杰语音注册
 *  - getPendingCommand()：获取应用被杀后恢复时的待处理指令（获取后清空）
 *
 * 原生侧通过 handleSearchCommand() 将语音指令转发给 JS：
 *  - 应用存活时：通过事件 ais-search 实时下发
 *  - 应用被杀死后由 Service 拉起：指令暂存，JS 初始化时 getPendingCommand() 拉取
 */
public class AISharjeckModule extends ReactContextBaseJavaModule {
  private static final String TAG = "AISharjeckModule";
  private static final String EVENT_SEARCH = "ais-search";

  private static ReactApplicationContext reactContext;

  /** 待处理指令缓存（应用被杀后重启时由 JS 拉取） */
  private static String pendingKeyword;
  private static String pendingSingerName;
  private static String pendingSongName;

  public AISharjeckModule(ReactApplicationContext context) {
    super(context);
    reactContext = context;
  }

  @Override
  public String getName() {
    return "AISharjeck";
  }

  @ReactMethod
  public void addListener(String eventName) {}

  @ReactMethod
  public void removeListeners(Integer count) {}

  /**
   * 向夏杰语音注册本应用
   */
  @ReactMethod
  public void register() {
    AISharjeckUtils.registerApp(getReactApplicationContext());
  }

  /**
   * 获取待处理的语音搜索指令（获取后清空缓存）
   */
  @ReactMethod
  public void getPendingCommand(Promise promise) {
    if (pendingSongName == null && pendingKeyword == null) {
      promise.resolve(null);
      return;
    }
    WritableMap map = Arguments.createMap();
    map.putString("keyword", pendingKeyword == null ? "" : pendingKeyword);
    map.putString("singerName", pendingSingerName == null ? "" : pendingSingerName);
    map.putString("songName", pendingSongName == null ? "" : pendingSongName);
    clearPending();
    promise.resolve(map);
  }

  /**
   * 原生 Service 收到 search 指令后调用：
   * 缓存指令，若 React 上下文可用则实时通过事件下发 JS
   */
  public static void handleSearchCommand(String keyword, String singerName, String songName) {
    pendingKeyword = keyword;
    pendingSingerName = singerName;
    pendingSongName = songName;
    emitSearchEvent(keyword, singerName, songName);
  }

  private static void emitSearchEvent(String keyword, String singerName, String songName) {
    try {
      if (reactContext == null || !reactContext.hasActiveReactInstance()) return;
      WritableMap map = Arguments.createMap();
      map.putString("keyword", keyword == null ? "" : keyword);
      map.putString("singerName", singerName == null ? "" : singerName);
      map.putString("songName", songName == null ? "" : songName);
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit(EVENT_SEARCH, map);
    } catch (Exception e) {
      Log.e(TAG, "emit search event failed", e);
    }
  }

  private static void clearPending() {
    pendingKeyword = null;
    pendingSingerName = null;
    pendingSongName = null;
  }
}
