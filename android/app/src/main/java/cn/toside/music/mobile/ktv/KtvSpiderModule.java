package cn.toside.music.mobile.ktv;

import android.content.Context;
import android.content.res.AssetManager;
import android.util.Log;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import dalvik.system.DexClassLoader;

/**
 * KTV 桥接模块
 *
 * 通过 catvod 框架（你提供的 spider.jar，内含 wexguard 保护）加载
 * com.github.catvod.spider.MusicAiIKtv，并把其标准方法暴露给 JS：
 *   initSpider / homeContent / categoryContent / searchContent / detailContent / playerContent / destroy
 *
 * spider.jar 放在 android/app/src/main/assets/spider/spider.jar，
 * 运行时拷贝到缓存目录后由 DexClassLoader 加载。DexNative 静态块会自动从
 * assets/wexguard_v8.so（或 v7）解密并 System.load，getLoader 再解密 .guard 得到可实例化类。
 */
public class KtvSpiderModule extends ReactContextBaseJavaModule {
    private static final String TAG = "KtvSpiderModule";
    private static final String SPIDER_ASSET = "spider/spider.jar";
    // 对齐 TVBox 用法：csp_MusicAiIKtvGuard -> com.github.catvod.spider.MusicAiIKtvGuard
    private static final String SPIDER_ID = "com.github.catvod.spider.MusicAiIKtvGuard";

    private final ReactApplicationContext reactContext;
    private volatile DexClassLoader spiderClassLoader;
    private volatile Object spider; // com.github.catvod.crawler.Spider 实例

    public KtvSpiderModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "KtvSpider";
    }

    @ReactMethod
    public void addListener(String eventName) {
    }

    @ReactMethod
    public void removeListeners(Integer count) {
    }

    private File ensureSpiderJar() throws Exception {
        File outDir = new File(reactContext.getCacheDir(), "spider");
        if (!outDir.exists()) outDir.mkdirs();
        File outFile = new File(outDir, "spider.jar");
        if (outFile.exists() && outFile.length() > 0) return outFile;
        AssetManager am = reactContext.getAssets();
        InputStream in = am.open(SPIDER_ASSET);
        OutputStream out = new FileOutputStream(outFile);
        byte[] buf = new byte[8192];
        int len;
        while ((len = in.read(buf)) > 0) out.write(buf, 0, len);
        in.close();
        out.close();
        return outFile;
    }

    @ReactMethod
    public void initSpider(Promise promise) {
        try {
            if (spider != null) {
                promise.resolve("already");
                return;
            }
            File spiderJar = ensureSpiderJar();
            File optDir = new File(reactContext.getCacheDir(), "spider_opt");
            if (!optDir.exists()) optDir.mkdirs();
            ClassLoader parent = getClass().getClassLoader();
            spiderClassLoader = new DexClassLoader(
                    spiderJar.getAbsolutePath(),
                    optDir.getAbsolutePath(),
                    null,
                    parent);

            Class<?> initClass = spiderClassLoader.loadClass("com.github.catvod.spider.Init");
            Context appContext = reactContext.getApplicationContext();
            Method initMethod = initClass.getMethod("init", Context.class);
            initMethod.invoke(null, appContext);

            // 对齐 TVBox 标准用法：实例化 MusicAiIKtvGuard 类，
            // 其构造（BaseSpiderGuard）内部会以完整类名调用 Init.getSpider(...)，
            // 由 wexguard 解密 .guard 后拿到真正的 MusicAiIKtv 实例并绑定
            Class<?> guardClass = spiderClassLoader.loadClass(SPIDER_ID);
            spider = guardClass.getDeclaredConstructor().newInstance();

            // 部分 spider 需要 init(ctx, extend)，失败可忽略
            try {
                Method spiderInit = spiderClass().getMethod("init", Context.class, String.class);
                spiderInit.invoke(spider, appContext, "");
            } catch (Throwable ignore) {
                Log.w(TAG, "spider.init(extend) skipped: " + ignore.getMessage());
            }

            promise.resolve("ok");
        } catch (Throwable e) {
            Log.e(TAG, "initSpider failed", e);
            promise.reject("INIT_FAILED", e.getMessage() == null ? e.toString() : e.getMessage(), e);
        }
    }

    private Object getSpider() throws Exception {
        if (spider == null) throw new IllegalStateException("spider 未初始化，请先调用 initSpider()");
        return spider;
    }

    private Class<?> spiderClass() throws Exception {
        if (spider == null) throw new IllegalStateException("spider 未初始化");
        // 直接用 wexguard 解密后返回的真实实例类反射方法，比 loadClass 框架基类更稳
        return spider.getClass();
    }

    @ReactMethod
    public void homeContent(Promise promise) {
        try {
            Object sp = getSpider();
            Method m = spiderClass().getMethod("homeContent", boolean.class);
            String result = (String) m.invoke(sp, false);
            promise.resolve(result);
        } catch (Throwable e) {
            promise.reject("HOME_FAILED", e.getMessage() == null ? e.toString() : e.getMessage(), e);
        }
    }

    @ReactMethod
    public void categoryContent(String tid, String page, Promise promise) {
        try {
            Object sp = getSpider();
            Method m = spiderClass().getMethod("categoryContent",
                    String.class, String.class, boolean.class, Class.forName("java.util.HashMap"));
            String result = (String) m.invoke(sp, tid, page, false, new HashMap<String, String>());
            promise.resolve(result);
        } catch (Throwable e) {
            promise.reject("CATEGORY_FAILED", e.getMessage() == null ? e.toString() : e.getMessage(), e);
        }
    }

    @ReactMethod
    public void searchContent(String keyword, Promise promise) {
        try {
            Object sp = getSpider();
            Method m = spiderClass().getMethod("searchContent", String.class, boolean.class);
            String result = (String) m.invoke(sp, keyword, false);
            promise.resolve(result);
        } catch (Throwable e) {
            promise.reject("SEARCH_FAILED", e.getMessage() == null ? e.toString() : e.getMessage(), e);
        }
    }

    @ReactMethod
    public void detailContent(ReadableArray ids, Promise promise) {
        try {
            Object sp = getSpider();
            List<String> list = new ArrayList<>();
            if (ids != null) {
                for (int i = 0; i < ids.size(); i++) list.add(ids.getString(i));
            }
            Method m = spiderClass().getMethod("detailContent", Class.forName("java.util.List"));
            String result = (String) m.invoke(sp, list);
            promise.resolve(result);
        } catch (Throwable e) {
            promise.reject("DETAIL_FAILED", e.getMessage() == null ? e.toString() : e.getMessage(), e);
        }
    }

    @ReactMethod
    public void playerContent(String flag, String id, ReadableArray urls, Promise promise) {
        try {
            Object sp = getSpider();
            List<String> list = new ArrayList<>();
            if (urls != null) {
                for (int i = 0; i < urls.size(); i++) list.add(urls.getString(i));
            }
            Method m = spiderClass().getMethod("playerContent",
                    String.class, String.class, Class.forName("java.util.List"));
            String result = (String) m.invoke(sp, flag, id, list);
            promise.resolve(result);
        } catch (Throwable e) {
            promise.reject("PLAYER_FAILED", e.getMessage() == null ? e.toString() : e.getMessage(), e);
        }
    }

    @ReactMethod
    public void destroy(Promise promise) {
        try {
            if (spider != null) {
                Method m = spiderClass().getMethod("destroy");
                m.invoke(spider);
            }
            spider = null;
            spiderClassLoader = null;
            promise.resolve("ok");
        } catch (Throwable e) {
            promise.reject("DESTROY_FAILED", e.getMessage() == null ? e.toString() : e.getMessage(), e);
        }
    }
}
