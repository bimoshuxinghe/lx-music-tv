package cn.toside.music.mobile.ktv;

import android.content.Context;
import android.content.res.AssetManager;
import android.os.Build;
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
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
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

    // wexguard so 库只加载一次
    private static volatile boolean wexguardLoaded = false;
    private static final Object loadLock = new Object();

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
     * 加载 wexguard native 库。wexguard 的 so（wexguard_v7.so / wexguard_v8.so）是打包在
     * spider.jar 内部的 assets/ 下的，需要先 System.load 进进程，jar 内的 DexNative 才能用
     * native 方法 wexguard_ 解密 .guard。这里直接从 jar 内部把对应 ABI 的 so 抽出来加载。
     */
    private void ensureWexguardLoaded() throws Exception {
        if (wexguardLoaded) return;
        synchronized (loadLock) {
            if (wexguardLoaded) return;
            File soDir = new File(reactContext.getFilesDir(), "wexguard");
            if (!soDir.exists()) soDir.mkdirs();

            // 按当前设备 ABI 选择对应的 so（电视多为 armeabi-v7a，手机多为 arm64-v8a）
            String abi;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                String[] abis = Build.SUPPORTED_ABIS;
                abi = (abis != null && abis.length > 0) ? abis[0] : Build.CPU_ABI;
            } else {
                abi = Build.CPU_ABI;
            }
            String soName = "wexguard_v8.so";
            if (abi != null && abi.contains("armeabi-v7a")) {
                soName = "wexguard_v7.so";
            }
            Log.i(TAG, "wexguard abi=" + abi + " so=" + soName);

            File soFile = new File(soDir, soName);
            if (!soFile.exists() || soFile.length() == 0) {
                // so 在 spider.jar 内部的 assets/ 目录下，从 jar 里抽取
                File jarFile = ensureSpiderJar();
                try (ZipFile zf = new ZipFile(jarFile)) {
                    ZipEntry ze = zf.getEntry("assets/" + soName);
                    if (ze == null) {
                        throw new IllegalStateException("spider.jar 内找不到 " + soName);
                    }
                    try (InputStream in = zf.getInputStream(ze);
                         OutputStream out = new FileOutputStream(soFile)) {
                        byte[] buf = new byte[8192];
                        int len;
                        while ((len = in.read(buf)) > 0) out.write(buf, 0, len);
                    }
                }
            }
            System.load(soFile.getAbsolutePath());
            wexguardLoaded = true;
            Log.i(TAG, "wexguard loaded: " + soFile.getAbsolutePath());
        }
    }

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
            // 1) 先加载 native 库（必须第一步，否则解密失败）
            ensureWexguardLoaded();

            // 2) 拷贝 jar 并由 DexClassLoader 加载，nativeLibraryDir 指向 so 目录
            File spiderJar = ensureSpiderJar();
            File optDir = new File(reactContext.getCacheDir(), "spider_opt");
            if (!optDir.exists()) optDir.mkdirs();
            File soDir = new File(reactContext.getFilesDir(), "wexguard");
            ClassLoader parent = getClass().getClassLoader();
            spiderClassLoader = new DexClassLoader(
                    spiderJar.getAbsolutePath(),
                    optDir.getAbsolutePath(),
                    soDir.getAbsolutePath(),
                    parent);

            // 3) 对齐 TVBox：Init.init(context) 初始化，再 Init.getSpider("MusicAiIKtvGuard")
            //    拿到真实爬虫实例（内部由 wexguard 解密 .guard 后实例化）
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
