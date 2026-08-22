package cn.toside.music.mobile.ktv;

import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;

import java.util.ArrayList;
import java.util.List;

/**
 * 咪咕爱唱 KTV 桥接模块（纯 Java 实现，替代 wexguard spider.jar 方案）。
 *
 * 与旧 KtvSpiderModule 的 JS 接口完全一致：
 *   initSpider / homeContent / categoryContent / searchContent /
 *   detailContent / playerContent / destroy
 * 内部走 MiguSpider 直连 tv.ising.migu.cn，不加载任何 jar / so / dex。
 */
public class MiguSpiderModule extends ReactContextBaseJavaModule {
  private static final String TAG = "MiguSpiderModule";
  private volatile boolean inited = false;

  public MiguSpiderModule(ReactApplicationContext context) {
    super(context);
  }

  @Override
  public String getName() {
    return "MiguSpider";
  }

  @ReactMethod
  public void addListener(String eventName) {
  }

  @ReactMethod
  public void removeListeners(Integer count) {
  }

  @ReactMethod
  public void initSpider(Promise promise) {
    inited = true;
    promise.resolve("ok");
  }

  @ReactMethod
  public void homeContent(Promise promise) {
    try {
      promise.resolve(MiguSpider.home());
    } catch (Throwable e) {
      Log.e(TAG, "homeContent failed", e);
      promise.reject("HOME_FAILED", String.valueOf(e.getMessage()), e);
    }
  }

  @ReactMethod
  public void categoryContent(String tid, String page, Promise promise) {
    try {
      promise.resolve(MiguSpider.category(tid, page));
    } catch (Throwable e) {
      Log.e(TAG, "categoryContent failed", e);
      promise.reject("CATEGORY_FAILED", String.valueOf(e.getMessage()), e);
    }
  }

  @ReactMethod
  public void searchContent(String keyword, Promise promise) {
    try {
      promise.resolve(MiguSpider.search(keyword));
    } catch (Throwable e) {
      Log.e(TAG, "searchContent failed", e);
      promise.reject("SEARCH_FAILED", String.valueOf(e.getMessage()), e);
    }
  }

  @ReactMethod
  public void detailContent(ReadableArray ids, Promise promise) {
    try {
      String id = "";
      if (ids != null && ids.size() > 0) id = ids.getString(0);
      promise.resolve(MiguSpider.detail(id));
    } catch (Throwable e) {
      Log.e(TAG, "detailContent failed", e);
      promise.reject("DETAIL_FAILED", String.valueOf(e.getMessage()), e);
    }
  }

  @ReactMethod
  public void playerContent(String flag, String id, ReadableArray urls, Promise promise) {
    try {
      String playId = id;
      if (urls != null && urls.size() > 0) playId = urls.getString(0);
      promise.resolve(MiguSpider.player(flag, playId));
    } catch (Throwable e) {
      Log.e(TAG, "playerContent failed", e);
      promise.reject("PLAYER_FAILED", String.valueOf(e.getMessage()), e);
    }
  }

  @ReactMethod
  public void destroy(Promise promise) {
    inited = false;
    promise.resolve("ok");
  }
}
