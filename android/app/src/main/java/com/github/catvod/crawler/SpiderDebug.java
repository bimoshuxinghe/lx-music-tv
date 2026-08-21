package com.github.catvod.crawler;

/**
 * 与 takagen99/Box 宿主 com.github.catvod.crawler.SpiderDebug 同签名。
 * 真实爬虫代码调试日志工具。
 */
public class SpiderDebug {
    public static void log(Throwable th) {
        try {
            android.util.Log.d("SpiderLog", th.getMessage(), th);
        } catch (Throwable th1) {
        }
    }

    public static void log(String msg) {
        try {
            android.util.Log.d("SpiderLog", msg);
        } catch (Throwable th1) {
        }
    }

    public static String ec(int i) {
        return "";
    }
}
