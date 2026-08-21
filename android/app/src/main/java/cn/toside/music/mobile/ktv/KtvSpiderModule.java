package cn.toside.music.mobile.ktv;

import android.content.Context;
import android.content.res.AssetManager;
import android.text.TextUtils;
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
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import dalvik.system.DexClassLoader;

/**
 * KTV 桥接模块
 *
 * 完全对齐 TVBox 的加载流程来使用你提供的 spider.jar：
 *   - jar 内含 classes.dex（代码）+ assets/wexguard_v7.so / wexguard_v8.so
 *     + assets/wexshinidie.guard（被 wexguard native 库加密保护的资源）
 *   - 必须先把 wexguard 的 so 库 System.load 进进程，native 方法 wexguard_ 才能解密 .guard
 *   - 然后 DexClassLoader 加载 jar（nativeLibraryDir 指到 so 目录）
 *   - 最后通过 com.github.catvod.spider.Init.getSpider("MusicAiIKtvGuard")
 *     拿到 TVBox 里 api=csp_MusicAiIKtvGuard 对应的真实爬虫实例
 *
 * 这些类本身在 jar 的 classes.dex 里（不是 .class 目录），
 * 所以其完整类名是 com.github.catvod.spider.MusicAiIKtvGuard。
 */
public class KtvSpiderModule extends ReactContextBaseJavaModule {
    private static final String TAG = "KtvSpiderModule";
    private static final String SPIDER_ASSET = "spider/spider.jar";
    // TVBox 里 api="csp_MusicAiIKtvGuard"，去掉 csp_ 前缀后传给 Init.getSpider 的名字
    private static final String SPIDER_NAME = "MusicAiIKtvGuard";
    // 完整类名（用于日志/校验）
    private static final String SPIDER_CLASS = "com.github.catvod.spider." + SPIDER_NAME;

    private final ReactApplicationContext reactContext;
    private volatile DexClassLoader spiderClassLoader;
    private volatile Object spider; // 真实爬虫实例（Spider 子类）

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

    /** 把 assets 里的文件拷贝到本地（同名且非空则跳过） */
    private File extractAsset(String assetPath, File outFile) throws Exception {
        if (outFile.exists() && outFile.length() > 0) return outFile;
        if (outFile.getParentFile() != null && !outFile.getParentFile().exists()) {
            outFile.getParentFile().mkdirs();
        }
        AssetManager am = reactContext.getAssets();
        InputStream in = am.open(assetPath);
        OutputStream out = new FileOutputStream(outFile);
        byte[] buf = new byte[8192];
        int len;
        while ((len = in.read(buf)) > 0) out.write(buf, 0, len);
        in.close();
        out.close();
        return outFile;
    }

    /**
     * 注意：wexguard 的 so 绝不由我们手动 System.load。
     * 反编译确认 spider.jar 内的 com.github.catvod.spider.DexNative 的静态块会自己：
     *   1) 按 Build.CPU_ABI 是否含 "64" 选 wexguard_v8.so / wexguard_v7.so
     *   2) 通过 Init.classLoader().getResourceAsStream("assets/wexguard_*.so") 从 jar 读 so
     *   3) 写到 getCacheDir() 随机名文件并 System.load
     * 所以我们只需要把 spider.jar 交给 DexClassLoader 加载（让 Init/DexNative 类可用），
     * 然后调 Init.init(applicationContext)，native 会自动完成 so 加载与 .guard 解密。
     * 自己提前 System.load 反而会触发 "JNI_OnLoad failed on a previous attempt"。
     */
    private File ensureSpiderJar() throws Exception {
        File outDir = new File(reactContext.getCacheDir(), "spider");
        if (!outDir.exists()) outDir.mkdirs();
        File outFile = new File(outDir, "spider.jar");
        return extractAsset(SPIDER_ASSET, outFile);
    }

    @ReactMethod
    public void initSpider(Promise promise) {
        try {
            if (spider != null) {
                promise.resolve("already");
                return;
            }
            // 1) 拷贝 spider.jar 到缓存目录
            File spiderJar = ensureSpiderJar();
            File optDir = new File(reactContext.getCacheDir(), "spider_opt");
            if (!optDir.exists()) optDir.mkdirs();

            // 2) 用 DexClassLoader 加载 jar，让 com.github.catvod.spider.Init / DexNative 类可用。
            //    nativeLibraryDir 指向缓存目录（DexNative 会把 wexguard_*.so 写到 getCacheDir() 并 System.load）。
            ClassLoader parent = getClass().getClassLoader();
            spiderClassLoader = new DexClassLoader(
                    spiderJar.getAbsolutePath(),
                    optDir.getAbsolutePath(),
                    reactContext.getCacheDir().getAbsolutePath(),
                    parent);

            // 3) 完全对齐 TVBox：
            //    Init.init(applicationContext) 内部由 DexNative 静态块加载 wexguard so、
            //    并调用 native getLoader 创建真正的 DexClassLoader（解密 .guard）；
            //    Init.getSpider("MusicAiIKtvGuard") 返回真实爬虫实例。
            Context appContext = reactContext.getApplicationContext();
            Class<?> initClass = spiderClassLoader.loadClass("com.github.catvod.spider.Init");
            Method initMethod = initClass.getMethod("init", Context.class);
            initMethod.invoke(null, appContext);

            Method getSpiderMethod = initClass.getMethod("getSpider", String.class);
            spider = getSpiderMethod.invoke(null, SPIDER_NAME);

            if (spider == null) {
                throw new IllegalStateException("Init.getSpider(\"" + SPIDER_NAME + "\") 返回 null");
            }
            Log.i(TAG, "spider 实例类型: " + spider.getClass().getName());

            // 部分爬虫需要 init(ctx, extend)，失败可忽略
            try {
                Method spiderInit = spiderClass().getMethod("init", Context.class, String.class);
                spiderInit.invoke(spider, appContext, "");
            } catch (Throwable ignore) {
                Log.w(TAG, "spider.init(extend) skipped: " + ignore.getMessage());
            }

            promise.resolve("ok");
        } catch (Throwable e) {
            Log.e(TAG, "initSpider failed", e);
            promise.reject("INIT_FAILED", errMsg(e), unwrap(e));
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

    // 解包反射 InvocationTargetException，取真正的 cause，否则给 JS 看到的就是
    // "java.lang.reflect.InvocationTargetException" 这串字，看不到真实错误。
    private static Throwable unwrap(Throwable t) {
        Throwable cur = t;
        while (cur instanceof InvocationTargetException && cur.getCause() != null && cur.getCause() != cur) {
            cur = cur.getCause();
        }
        return cur;
    }
    private static String errMsg(Throwable t) {
        Throwable u = unwrap(t);
        String m = u.getMessage();
        if (TextUtils.isEmpty(m)) m = u.getClass().getName();
        return m;
    }

    @ReactMethod
    public void homeContent(Promise promise) {
        try {
            Object sp = getSpider();
            Method m = spiderClass().getMethod("homeContent", boolean.class);
            String result = (String) m.invoke(sp, false);
            promise.resolve(result);
        } catch (Throwable e) {
            promise.reject("HOME_FAILED", errMsg(e), unwrap(e));
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
            promise.reject("CATEGORY_FAILED", errMsg(e), unwrap(e));
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
            promise.reject("SEARCH_FAILED", errMsg(e), unwrap(e));
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
            promise.reject("DETAIL_FAILED", errMsg(e), unwrap(e));
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
            promise.reject("PLAYER_FAILED", errMsg(e), unwrap(e));
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
            promise.reject("DESTROY_FAILED", errMsg(e), unwrap(e));
        }
    }
}
