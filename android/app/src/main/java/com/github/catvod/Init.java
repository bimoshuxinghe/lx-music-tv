package com.github.catvod;

import android.content.Context;

import java.lang.ref.WeakReference;

/**
 * 宿主 App 提供的 catvod 全局上下文持有者（与 takagen99/Box 宿主同签名）。
 *
 * wexguard 解密后的真实爬虫代码以及宿主 catvod 工具类（utils/Path、utils/Util 等）
 * 都依赖 Init.context() 获取 Context。wexguard 的 DexNative 加载真实 dex 后，
 * 其代码可能通过 com.github.catvod.Init 访问应用上下文，因此宿主必须提供本类。
 */
public class Init {

    private WeakReference<Context> context;

    private static class Loader {
        static volatile Init INSTANCE = new Init();
    }

    private static Init get() {
        return Loader.INSTANCE;
    }

    public static void set(Context context) {
        get().context = new WeakReference<>(context);
    }

    public static Context context() {
        return get().context.get();
    }
}
