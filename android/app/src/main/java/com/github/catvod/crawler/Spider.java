package com.github.catvod.crawler;

import android.content.Context;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import okhttp3.Dns;

/**
 * 宿主 App 提供的 Spider 基类（与 TVBox / 蜂蜜影视主工程的 com.github.catvod.crawler.Spider 同签名）。
 *
 * 你提供的 spider.jar 中的 classes.dex 只引用了 com.github.catvod.crawler.Spider 这个类
 * （type_ids 有、class_defs 没有），真实定义必须由加载 jar 的宿主进程提供。
 * 之前加载报 "Didn't find class com.github.catvod.spider.MusicAiIKtvGuard" 正是因为
 * 父类链 MusicAiIKtvGuard -> BaseSpiderGuard -> Spider 中 Spider 在本 App 里不存在，
 * ART 在解析类时父类缺失，于是把整条链上的类都视为加载失败。
 *
 * 方法签名与 dex 中 method_ids 引用的完全一致，不要改动任何方法名/参数/返回类型，
 * 否则继承链校验会再次失败。本类被 jar 动态加载，必须用 -keep 防止 R8 混淆。
 *
 * 同时补全 takagen99/Box 宿主 Spider 的其余方法（manualVideoCheck/isVideoFormat/
 * proxyLocal/cancelByTag/liveContent/safeDns），确保 wexguard 解密后的真实爬虫
 * 代码按 TVBox 宿主 API 调用父类方法时签名一致。safeDns 原版返回
 * OkGoHelper.dnsOverHttps，本 App 未引入 OkGoHelper，改返回 Dns.SYSTEM（行为等价）。
 */
public class Spider {

    public void init(Context context) throws Exception {
    }

    public void init(Context context, String extend) throws Exception {
        init(context);
    }

    public String homeContent(boolean filter) throws Exception {
        return "";
    }

    public String homeVideoContent() throws Exception {
        return "";
    }

    public String categoryContent(String tid, String pg, boolean filter, HashMap<String, String> extend) throws Exception {
        return "";
    }

    public String detailContent(List<String> ids) throws Exception {
        return "";
    }

    public String searchContent(String key, boolean quick) throws Exception {
        return "";
    }

    public String searchContent(String key, boolean quick, String pg) throws Exception {
        return "";
    }

    public String playerContent(String flag, String id, List<String> vipFlags) throws Exception {
        return "";
    }

    public String action(String action) throws Exception {
        return "";
    }

    public boolean manualVideoCheck() throws Exception {
        return false;
    }

    public boolean isVideoFormat(String url) throws Exception {
        return false;
    }

    public Object[] proxyLocal(Map<String, String> params) throws Exception {
        return null;
    }

    public Object[] proxy(Map<String, String> params) throws Exception {
        return null;
    }

    public void cancelByTag() {
    }

    public String liveContent(String url) {
        return "";
    }

    public static Dns safeDns() {
        return Dns.SYSTEM;
    }

    public void destroy() {
    }
}
