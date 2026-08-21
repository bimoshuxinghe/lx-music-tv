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
 * 完全对齐 TVBox 的加载流程来使用你提供的 spider.jar（参考 takagen99/Box 的 JarLoader）：
 *   - jar 内含 classes.dex（代码）+ assets/wexguard_v7.so / wexguard_v8.so
 *     + assets/wexshinidie.guard（被 wexguard native 库加密保护的资源）
 *   - DexClassLoader(jar, cacheDir, null, parent) 加载 jar（nativeLibraryDir 传 null，
 *     wexguard 由 DexNative 静态块自己写 cache 并 System.load）
 *   - Init.init(app) 完成 native 初始化后，直接 newInstance() MusicAiIKtvGuard
 *     （其构造经 BaseSpiderGuard 调 Init.getSpider 解密 .guard 并绑定真实爬虫）
 *
 * 这些类本身在 jar 的 classes.dex 里（不是 .class 目录），
 * 所以其完整类名是 com.github.catvod.spider.MusicAiIKtvGuard。
 */
public class KtvSpiderModule extends ReactContextBaseJavaModule {
    private static final String TAG = "KtvSpiderModule";
    private static final String SPIDER_ASSET = "spider/spider.jar";
    // TVBox 里 api="csp_MusicAiIKtvGuard"，去掉 csp_ 前缀后即为要实例化的 Guard 类名
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

            // 2) 完全照搬 TVBox JarLoader.loadClassLoader：
            //    new DexClassLoader(jar, cacheDir, null, parent)  ← nativeLibraryDir 必须为 null，
            //    DexNative 静态块会自己把 wexguard_*.so 写到 getCacheDir() 并 System.load。
            ClassLoader parent = getClass().getClassLoader();
            spiderClassLoader = new DexClassLoader(
                    spiderJar.getAbsolutePath(),
                    optDir.getAbsolutePath(),
                    null,
                    parent);

            // 3) 对齐 TVBox：先 Init.init(app)，再直接 newInstance() Guard 类。
            //    MusicAiIKtvGuard 继承 BaseSpiderGuard，其构造里会调
            //    Init.getSpider(getClass().getName()) 由 wexguard 解密 .guard 并绑定真实实例。
            Context appContext = reactContext.getApplicationContext();
            Class<?> initClass = spiderClassLoader.loadClass("com.github.catvod.spider.Init");
            Method initMethod = initClass.getMethod("init", Context.class);
            initMethod.invoke(null, appContext);

            // 4) 宿主 com.github.catvod.Init 也需要设置 context：
            //    解密后的真实爬虫代码会调用宿主工具类（Path.cache()/Util.getDeviceId() 等），
            //    这些类依赖 com.github.catvod.Init.context() 拿 Context。
            try {
                Class<?> hostInit = getClass().getClassLoader().loadClass("com.github.catvod.Init");
                Method hostSet = hostInit.getMethod("set", Context.class);
                hostSet.invoke(null, appContext);
            } catch (Throwable ignore) {
                Log.w(TAG, "host Init.set skipped: " + ignore.getMessage());
            }

            Class<?> guardClass = spiderClassLoader.loadClass(SPIDER_CLASS);
            spider = guardClass.getConstructor().newInstance();

            if (spider == null) {
                throw new IllegalStateException("newInstance " + SPIDER_CLASS + " 返回 null");
            }
            Log.i(TAG, "spider 实例类型: " + spider.getClass().getName());

            // TVBox 调 sp.init(app, ext)。Guard 继承 Spider，init(ctx, extend) 会转发到内部真实实例。
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
        // 追加完整堆栈，方便定位 "Class not found using the boot class loader" 这类
        // 无具体类名的 JNI 错误（wexguard native 解密后真实爬虫运行时的类解析失败）
        java.io.StringWriter sw = new java.io.StringWriter();
        u.printStackTrace(new java.io.PrintWriter(sw));
        return m + "\n" + sw;
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
