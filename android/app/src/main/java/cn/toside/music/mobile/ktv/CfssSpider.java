package cn.toside.music.mobile.ktv;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

/**
 * 初心娱乐 MV 站（cfss.cc/mv）的纯 Java 实现。
 *
 * 已验证的接口（2026-08-22）：
 *   歌手列表   GET  /mv/gs.php?id=1(男)/2(女)   -> HTML：post('/mv/',{ss:'歌手名'})
 *   MV 列表    POST /mv/ {ss:歌手名或歌曲单id或空, p:页码} -> HTML：id/title/封面/时长，每页300首
 *   搜索       GET  /mv/s.php?s=20&ss=关键词(带Referer)   -> JSON：Datas[].HintInfo
 *   播放       GET  /api/kg/{id}.mp4 (带Referer)         -> 302 跳到 kugou 直链，无防盗链
 *
 * 所有接口走 cfss.cc，需带桌面 UA；列表/播放接口需带 Referer: https://cfss.cc/mv/。
 */
public class CfssSpider {
  private static final String TAG = "CfssSpider";
  private static final String BASE = "https://cfss.cc";
  private static final String UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  private static final String REFERER = "https://cfss.cc/mv/";

  // 歌曲列表项：<p class='jc' title='歌手 - 歌名' id='117613'><a ...><img src='封面'/><br/>歌手 - 歌名🕘05:17</a></p>
  private static final Pattern ITEM_PATTERN = Pattern.compile(
      "<p[^>]*class='jc'[^>]*title='([^<]*)'[^>]*id='(\\d+)'[^>]*><a[^>]*><img[^>]*src='([^']*)'[^>]*/><br/>[^<]*🕘(\\d{2}:\\d{2})</a></p>");
  // 歌手列表项：<a onClick="post('/mv/',{ss:'周杰伦'})">📯周杰伦</a>
  private static final Pattern SINGER_PATTERN = Pattern.compile(
      "post\\('/mv/',\\{ss:'([^']+)'\\}\\)\">[^<]*</a>");

  private static String http(String method, String url, String body) throws Exception {
    HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
    applySsl(conn);
    try {
      conn.setRequestMethod(method);
      conn.setConnectTimeout(10000);
      conn.setReadTimeout(20000);
      conn.setInstanceFollowRedirects(false);
      conn.setRequestProperty("User-Agent", UA);
      conn.setRequestProperty("Referer", REFERER);
      if ("POST".equals(method)) {
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        OutputStream os = conn.getOutputStream();
        os.write(body.getBytes(StandardCharsets.UTF_8));
        os.flush();
        os.close();
      }
      int code = conn.getResponseCode();
      InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
      if (in != null) {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int len;
        while ((len = in.read(buf)) > 0) bos.write(buf, 0, len);
        in.close();
        return new String(bos.toByteArray(), StandardCharsets.UTF_8);
      }
      return "";
    } finally {
      conn.disconnect();
    }
  }

  /** 歌手列表。gender: 1=男 2=女。返回 catvod list JSON。 */
  public static String singers(int gender) throws Exception {
    String html = http("GET", BASE + "/mv/gs.php?id=" + gender, null);
    JSONArray list = new JSONArray();
    Matcher m = SINGER_PATTERN.matcher(html);
    while (m.find()) {
      String name = m.group(1);
      if (name.isEmpty()) continue;
      JSONObject v = new JSONObject();
      v.put("vod_id", name);
      v.put("vod_name", name);
      v.put("vod_pic", "");
      v.put("vod_remarks", "");
      list.put(v);
    }
    JSONObject result = new JSONObject();
    result.put("list", list);
    result.put("page", 1);
    result.put("pagecount", 1);
    return result.toString();
  }

  /**
   * MV 列表。keyword: 歌手名/歌曲单id/空(热门)。page 从 1 开始。
   * 返回 catvod list JSON（每页 300 首）。
   *
   * 注意：cfss.cc 的 ss 搜索对含空格的字符串匹配失败（如 "MC 张天赋"/"G.E.M. 邓紫棋"
   * 均返回空列表，而去空格后 "MC张天赋"/"G.E.M.邓紫棋" 正常），
   * 因此发送前需去除关键词中的全部空格。
   */
  public static String songs(String keyword, int page) throws Exception {
    int p = Math.max(0, page - 1);
    StringBuilder body = new StringBuilder();
    if (keyword != null && !keyword.isEmpty()) {
      String kw = keyword.replace(" ", "").replace("\u3000", "");
      body.append("ss=").append(encode(kw));
      body.append('&');
    }
    body.append("p=").append(p);
    String html = http("POST", BASE + "/mv/", body.toString());
    JSONArray list = new JSONArray();
    Matcher m = ITEM_PATTERN.matcher(html);
    while (m.find()) {
      String title = m.group(1);   // 歌手 - 歌名
      String id = m.group(2);
      String pic = m.group(3);
      String duration = m.group(4);
      JSONObject v = new JSONObject();
      v.put("vod_id", id);
      v.put("vod_name", title);
      v.put("vod_pic", pic);
      v.put("vod_remarks", duration);
      list.put(v);
    }
    JSONObject result = new JSONObject();
    result.put("list", list);
    result.put("page", page);
    result.put("pagecount", 100);
    return result.toString();
  }

  /** 搜索提示。返回 {list:[{vod_id,name}]}。 */
  public static String search(String keyword) throws Exception {
    JSONArray list = new JSONArray();
    String url = BASE + "/mv/s.php?s=20&ss=" + encode(keyword);
    String text = http("GET", url, null);
    try {
      JSONObject json = new JSONObject(text);
      JSONArray datas = json.optJSONArray("Datas");
      if (datas != null) {
        for (int i = 0; i < datas.length(); i++) {
          JSONObject d = datas.optJSONObject(i);
          if (d == null) continue;
          String hint = d.optString("HintInfo");
          if (hint.isEmpty()) continue;
          JSONObject v = new JSONObject();
          v.put("vod_id", hint);
          v.put("vod_name", hint);
          v.put("vod_remarks", "搜索");
          list.put(v);
        }
      }
    } catch (Exception e) {
      Log.w(TAG, "search parse fail: " + text, e);
    }
    JSONObject result = new JSONObject();
    result.put("list", list);
    result.put("page", 1);
    result.put("pagecount", 1);
    return result.toString();
  }

  /** 播放：跟随 302 拿 kugou 直链。返回 {url}。 */
  public static String player(String id) throws Exception {
    String url = BASE + "/api/kg/" + id + ".mp4";
    HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
    applySsl(conn);
    try {
      conn.setRequestMethod("GET");
      conn.setConnectTimeout(10000);
      conn.setReadTimeout(15000);
      conn.setInstanceFollowRedirects(false);
      conn.setRequestProperty("User-Agent", UA);
      conn.setRequestProperty("Referer", REFERER);
      int code = conn.getResponseCode();
      String finalUrl = url;
      if (code >= 300 && code < 400) {
        String loc = conn.getHeaderField("Location");
        if (loc != null && !loc.isEmpty()) finalUrl = loc;
      }
      JSONObject a = new JSONObject();
      a.put("parse", 0);
      a.put("url", finalUrl);
      return a.toString();
    } finally {
      conn.disconnect();
    }
  }

  // 酷我搜索接口（宽松 JSON，含 hts_PICPATH 完整头像 URL）：all=歌手名&ft=artist
  private static final String KUWO_SEARCH = "https://search.kuwo.cn/r.s";
  // hts_PICPATH':'https://img3.kuwo.cn/star/starheads/240/xxx.jpg
  private static final Pattern KUWO_PIC_PATTERN = Pattern.compile("hts_PICPATH':'([^']+)'");

  /** 歌手头像：调用酷我搜索接口取该歌手头像 URL。找不到返回空字符串。 */
  public static String singerAvatar(String name) throws Exception {
    if (name == null || name.trim().isEmpty()) return "";
    String url = KUWO_SEARCH + "?all=" + encode(name.trim()) + "&ft=artist&itemset=web_2013&client=kt&pn=0&rn=3&rformat=json&encoding=utf8";
    String body = http("GET", url, null);
    if (body == null || body.isEmpty()) return "";
    Matcher m = KUWO_PIC_PATTERN.matcher(body);
    if (m.find()) return m.group(1);
    return "";
  }

  private static volatile SSLContext sslContext = null;

  private static SSLContext getSslContext() {
    if (sslContext != null) return sslContext;
    try {
      TrustManager[] trustAll = new TrustManager[]{ new X509TrustManager() {
        public void checkClientTrusted(X509Certificate[] chain, String authType) {}
        public void checkServerTrusted(X509Certificate[] chain, String authType) {}
        public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
      } };
      SSLContext sc = SSLContext.getInstance("TLS");
      sc.init(null, trustAll, new SecureRandom());
      sslContext = sc;
    } catch (Exception e) {
      Log.w(TAG, "ssl init fail", e);
      sslContext = null;
    }
    return sslContext;
  }

  private static void applySsl(HttpURLConnection conn) {
    SSLContext sc = getSslContext();
    if (sc == null || !(conn instanceof HttpsURLConnection)) return;
    HttpsURLConnection h = (HttpsURLConnection) conn;
    h.setSSLSocketFactory(sc.getSocketFactory());
    h.setHostnameVerifier(new HostnameVerifier() {
      public boolean verify(String hostname, SSLSession session) { return true; }
    });
  }

  /** 放宽 HTTPS 证书验证（cfss.cc 使用 Let's Encrypt，个别设备系统证书库可能缺失中间证书）。 */
  private static void relaxSsl() {
  }

  private static String encode(String s) throws Exception {
    StringBuilder sb = new StringBuilder();
    byte[] b = s.getBytes(StandardCharsets.UTF_8);
    for (byte x : b) sb.append('%').append(String.format("%02X", x & 0xff));
    return sb.toString();
  }
}
