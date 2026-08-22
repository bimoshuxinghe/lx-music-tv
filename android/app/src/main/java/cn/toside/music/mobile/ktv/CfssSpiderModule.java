package cn.toside.music.mobile.ktv;

import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * 初心娱乐 MV 站桥接模块（纯 Java 实现）。
 *
 * JS 接口：
 *   singers(gender, promise)        歌手列表（1=男 2=女）
 *   songs(keyword, page, promise)   MV 列表（歌手名/歌曲单id/空=热门）
 *   search(keyword, promise)        搜索提示
 *   player(id, promise)             播放地址（跟随 302 返回直链）
 */
public class CfssSpiderModule extends ReactContextBaseJavaModule {
  private static final String TAG = "CfssSpiderModule";

  public CfssSpiderModule(ReactApplicationContext context) {
    super(context);
  }

  @Override
  public String getName() {
    return "CfssSpider";
  }

  @ReactMethod
  public void addListener(String eventName) {
  }

  @ReactMethod
  public void removeListeners(Integer count) {
  }

  @ReactMethod
  public void singers(int gender, Promise promise) {
    try {
      promise.resolve(CfssSpider.singers(gender));
    } catch (Throwable e) {
      Log.e(TAG, "singers failed", e);
      promise.reject("SINGERS_FAILED", String.valueOf(e.getMessage()), e);
    }
  }

  @ReactMethod
  public void songs(String keyword, int page, Promise promise) {
    try {
      promise.resolve(CfssSpider.songs(keyword, page));
    } catch (Throwable e) {
      Log.e(TAG, "songs failed", e);
      promise.reject("SONGS_FAILED", String.valueOf(e.getMessage()), e);
    }
  }

  @ReactMethod
  public void search(String keyword, Promise promise) {
    try {
      promise.resolve(CfssSpider.search(keyword));
    } catch (Throwable e) {
      Log.e(TAG, "search failed", e);
      promise.reject("SEARCH_FAILED", String.valueOf(e.getMessage()), e);
    }
  }

  @ReactMethod
  public void player(String id, Promise promise) {
    try {
      promise.resolve(CfssSpider.player(id));
    } catch (Throwable e) {
      Log.e(TAG, "player failed", e);
      promise.reject("PLAYER_FAILED", String.valueOf(e.getMessage()), e);
    }
  }
}
