package cn.toside.music.mobile.ktv;

import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 初心娱乐 MV 站桥接模块（纯 Java 实现）。
 *
 * JS 接口：
 *   singers(gender, promise)        歌手列表（1=男 2=女）
 *   songs(keyword, page, promise)   MV 列表（歌手名/歌曲单id/空=热门）
 *   search(keyword, promise)        搜索提示
 *   player(id, promise)             播放地址（跟随 302 返回直链）
 *
 * 注意：RN 的 @ReactMethod 默认在「原生模块线程」（单线程）上执行。
 * 若直接在这里同步做网络请求，单个慢请求（如头像接口最长 30s 超时）会
 * 阻塞该线程，导致 App 内所有其他 native 调用（播放器、存储、图片加载等）
 * 全部排队，表现为全界面卡顿。因此所有网络调用必须提交到独立线程池执行，
 * native 线程立即返回，Promise 在线程池完成后回调。
 */
public class CfssSpiderModule extends ReactContextBaseJavaModule {
  private static final String TAG = "CfssSpiderModule";

  /** 网络请求线程池：限制并发，避免同步阻塞占用 RN native 模块线程 */
  private static final ExecutorService pool = Executors.newFixedThreadPool(4);

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
    pool.execute(() -> {
      try {
        promise.resolve(CfssSpider.singers(gender));
      } catch (Throwable e) {
        Log.e(TAG, "singers failed", e);
        promise.reject("SINGERS_FAILED", String.valueOf(e.getMessage()), e);
      }
    });
  }

  @ReactMethod
  public void songs(String keyword, int page, Promise promise) {
    pool.execute(() -> {
      try {
        promise.resolve(CfssSpider.songs(keyword, page));
      } catch (Throwable e) {
        Log.e(TAG, "songs failed", e);
        promise.reject("SONGS_FAILED", String.valueOf(e.getMessage()), e);
      }
    });
  }

  @ReactMethod
  public void search(String keyword, Promise promise) {
    pool.execute(() -> {
      try {
        promise.resolve(CfssSpider.search(keyword));
      } catch (Throwable e) {
        Log.e(TAG, "search failed", e);
        promise.reject("SEARCH_FAILED", String.valueOf(e.getMessage()), e);
      }
    });
  }

  @ReactMethod
  public void player(String id, Promise promise) {
    pool.execute(() -> {
      try {
        promise.resolve(CfssSpider.player(id));
      } catch (Throwable e) {
        Log.e(TAG, "player failed", e);
        promise.reject("PLAYER_FAILED", String.valueOf(e.getMessage()), e);
      }
    });
  }

  @ReactMethod
  public void singerAvatar(String name, Promise promise) {
    pool.execute(() -> {
      try {
        promise.resolve(CfssSpider.singerAvatar(name));
      } catch (Throwable e) {
        Log.e(TAG, "singerAvatar failed", e);
        promise.reject("SINGER_AVATAR_FAILED", String.valueOf(e.getMessage()), e);
      }
    });
  }
}
