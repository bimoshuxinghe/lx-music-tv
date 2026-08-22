package cn.toside.music.mobile.ktv;

import android.util.Base64;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Random;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;

/**
 * 咪咕爱唱（tv.ising.migu.cn）TV 版爬虫的纯 Java 实现。
 *
 * 协议来源：TVBox 的咪咕 JS 爬虫（不依赖 wexguard，不依赖 TVBox 运行时），
 * 由 Python 端实测验证可用（能取到真实 mv720 mp4 播放地址）。
 *
 * 请求格式（POST multipart/form-data 到 /do）：
 *   salt    随机 6 位数字
 *   data    JSON body 经 TripleDES/ECB/Pkcs7 加密，key = md5(salt+SECRET)[0..24)
 *   service 方法名（tvGetRecommendSongs / tvGetSongsByClm / tvGetColumnByNo /
 *          tvGetSongsByMuliType / tvGetSongInfoById）
 *   time    unix 秒
 *   version 固定 "2.0"（WAF 对带 .0 的值偶发 403，频控后恢复，属服务端问题）
 *   token   md5(service + time + data + salt + version + SECRET)
 *
 * 响应：{status:200, body: <TripleDES/ECB/Pkcs7 密文>, salt: <新salt>}
 *   解密 key = md5(resp_salt + SECRET)[0..24)
 */
public class MiguSpider {
  private static final String TAG = "MiguSpider";
  private static final String API = "http://tv.ising.migu.cn/do";
  private static final String SECRET = "9HkocpYLeG1LNi5m";
  private static final String UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  private static final Random RANDOM = new Random();

  // ---------- 加密工具 ----------

  private static String md5(String s) {
    try {
      MessageDigest md = MessageDigest.getInstance("MD5");
      byte[] d = md.digest(s.getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder();
      for (byte b : d) {
        String h = Integer.toHexString(b & 0xff);
        if (h.length() == 1) sb.append('0');
        sb.append(h);
      }
      return sb.toString();
    } catch (Exception e) {
      throw new RuntimeException("md5 fail", e);
    }
  }

  private static String des3Key(String salt) {
    return md5(salt + SECRET).substring(0, 24);
  }

  private static String des3Encrypt(String plain, String key) {
    try {
      byte[] k = key.getBytes(StandardCharsets.UTF_8);
      SecretKeySpec spec = new SecretKeySpec(k, "DESede");
      Cipher c = Cipher.getInstance("DESede/ECB/PKCS5Padding");
      c.init(Cipher.ENCRYPT_MODE, spec);
      byte[] enc = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
      return Base64.encodeToString(enc, Base64.NO_WRAP);
    } catch (Exception e) {
      throw new RuntimeException("3des encrypt fail", e);
    }
  }

  private static String des3Decrypt(String b64, String key) {
    try {
      byte[] k = key.getBytes(StandardCharsets.UTF_8);
      SecretKeySpec spec = new SecretKeySpec(k, "DESede");
      Cipher c = Cipher.getInstance("DESede/ECB/PKCS5Padding");
      c.init(Cipher.DECRYPT_MODE, spec);
      byte[] dec = c.doFinal(Base64.decode(b64, Base64.DEFAULT));
      return new String(dec, StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new RuntimeException("3des decrypt fail", e);
    }
  }

  // ---------- HTTP ----------

  private static JSONObject postMultipart(byte[] body, String boundary) throws Exception {
    URL url = new URL(API);
    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
    try {
      conn.setRequestMethod("POST");
      conn.setConnectTimeout(10000);
      conn.setReadTimeout(15000);
      conn.setDoOutput(true);
      conn.setRequestProperty("User-Agent", UA);
      conn.setRequestProperty("Referer", "http://tv.ising.migu.cn/");
      conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
      OutputStream os = conn.getOutputStream();
      os.write(body);
      os.flush();
      os.close();
      int code = conn.getResponseCode();
      InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
      ByteArrayOutputStream bos = new ByteArrayOutputStream();
      byte[] buf = new byte[4096];
      int len;
      while ((len = in.read(buf)) > 0) bos.write(buf, 0, len);
      in.close();
      String text = new String(bos.toByteArray(), StandardCharsets.UTF_8);
      if (code != 200) {
        throw new RuntimeException("HTTP " + code + ": " + (text.length() > 200 ? text.substring(0, 200) : text));
      }
      return new JSONObject(text);
    } finally {
      conn.disconnect();
    }
  }

  /** 调用咪咕 API，返回解密后的 JSON。 */
  private static JSONObject call(String service, JSONObject params) throws Exception {
    String salt = String.format("%06d", RANDOM.nextInt(1000000));
    String key = des3Key(salt);

    JSONObject body = new JSONObject();
    body.put("count", params.optInt("count", 20));
    body.put("start", params.optInt("start", 1));
    body.put("apn", "");
    body.put("channel", "014BD23");
    body.put("imei", "");
    body.put("imsi", "");
    body.put("osid", "Android-TV");
    body.put("protocolver", "2.0.0");
    body.put("stbid", "5f8b29c0e3d1a4f6");
    body.put("stbserial", "");
    body.put("version", "9.9.012");
    body.put("accountid", "");
    body.put("hwlevel", "0");
    body.put("ip", "|10.0.2.15");
    body.put("mac", "|C2E3A4B5D6F7");
    body.put("mobilephone", "");
    body.put("ua", "SM-S9260");
    if (params.has("toplist")) body.put("toplist", params.get("toplist"));
    if (params.has("programno")) body.put("programno", params.getString("programno"));
    if (params.has("resourceno")) body.put("resourceno", params.getString("resourceno"));
    if (params.has("signinfo")) body.put("signinfo", params.getString("signinfo"));
    if (params.has("signtype")) body.put("signtype", params.getString("signtype"));

    String bodyJson = body.toString();
    String data = des3Encrypt(bodyJson, key);
    String ts = String.valueOf(System.currentTimeMillis() / 1000);
    String version = "2.0";
    String token = md5(service + ts + data + salt + version + SECRET);

    String boundary = "----WebKitFormBoundary" + randomAlnum(16);
    StringBuilder form = new StringBuilder();
    String[] keys = {"salt", "data", "service", "time", "version", "token"};
    String[] vals = {salt, data, service, ts, version, token};
    for (int i = 0; i < keys.length; i++) {
      form.append("--").append(boundary).append("\r\n");
      form.append("Content-Disposition: form-data; name=\"").append(keys[i]).append("\"\r\n\r\n");
      form.append(vals[i]).append("\r\n");
    }
    form.append("--").append(boundary).append("--\r\n");

    JSONObject resp = postMultipart(form.toString().getBytes(StandardCharsets.UTF_8), boundary);
    int status = resp.optInt("status");
    if (status != 200 || !resp.has("body")) {
      throw new RuntimeException("migu status=" + status + " msg=" + resp.optString("message"));
    }
    String respSalt = resp.getString("salt");
    String inner = des3Decrypt(resp.getString("body"), des3Key(respSalt));
    return new JSONObject(inner);
  }

  private static String randomAlnum(int n) {
    String chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < n; i++) sb.append(chars.charAt(RANDOM.nextInt(chars.length())));
    return sb.toString();
  }

  // ---------- 业务：TVBox catvod JSON ----------

  /** 从歌曲对象里挑一个可播放的 path（优先 mv 高码率，其次 resourcepath）。 */
  private static String pickPath(JSONObject song) {
    JSONArray infos = song.optJSONArray("resourceinfos");
    String best = null;
    int bestRank = -1;
    if (infos != null) {
      for (int i = 0; i < infos.length(); i++) {
        JSONObject ri = infos.optJSONObject(i);
        if (ri == null) continue;
        String path = ri.optString("path", "");
        if (path.isEmpty()) continue;
        String type = ri.optString("type", "");
        int rank = -1;
        if (type.startsWith("mv")) {
          try { rank = Integer.parseInt(type.substring(2)); } catch (Exception ignored) { rank = 0; }
        } else if ("mp3".equals(type)) {
          rank = -1;
        }
        if (rank > bestRank) { bestRank = rank; best = path; }
      }
    }
    if (best != null) return best;
    if (!song.optString("mv720", "").isEmpty()) return song.optString("mv720");
    return song.optString("resourcepath", "");
  }

  private static JSONObject toVod(JSONObject song) throws JSONException {
    JSONObject v = new JSONObject();
    v.put("vod_id", song.optString("resourceno") + "@@" + song.optString("resourcename") + "@@" + pickPath(song) + "@@" + song.optString("encryptlyricspath"));
    v.put("vod_name", song.optString("resourcename"));
    v.put("vod_pic", song.optString("picpath"));
    v.put("vod_remarks", song.optString("singername"));
    return v;
  }

  /** 首页：返回分类（榜单/歌单）+ 推荐列表。 */
  public static String home() throws Exception {
    JSONObject result = new JSONObject();
    JSONArray classes = new JSONArray();
    JSONObject c1 = new JSONObject();
    c1.put("type_id", "recommend");
    c1.put("type_name", "推荐歌曲");
    classes.put(c1);
    JSONObject c2 = new JSONObject();
    c2.put("type_id", "rank");
    c2.put("type_name", "榜单");
    classes.put(c2);
    JSONObject c3 = new JSONObject();
    c3.put("type_id", "songlist");
    c3.put("type_name", "歌单推荐");
    classes.put(c3);
    result.put("class", classes);

    JSONArray list = new JSONArray();
    try {
      JSONObject params = new JSONObject();
      params.put("toplist", new JSONArray());
      params.put("start", 1);
      params.put("count", 30);
      JSONObject r = call("tvGetRecommendSongs", params);
      JSONArray arr = r.optJSONArray("list");
      if (arr != null) {
        for (int i = 0; i < arr.length(); i++) list.put(toVod(arr.getJSONObject(i)));
      }
    } catch (Exception e) {
      Log.w(TAG, "home recommend failed", e);
    }
    result.put("list", list);
    return result.toString();
  }

  /** 分类列表。tid: recommend=推荐 / rank=榜单 / songlist=歌单 / 其他当作榜单列 programno。 */
  public static String category(String tid, String page) throws Exception {
    int p = 1;
    try { p = Integer.parseInt(page); } catch (Exception ignored) {}
    int start = (p - 1) * 20 + 1;
    JSONArray list = new JSONArray();
    int pagecount = 1;

    JSONObject params = new JSONObject();
    params.put("start", start);
    try {
      if ("recommend".equals(tid)) {
        params.put("count", 20);
        JSONObject r = call("tvGetRecommendSongs", params);
        JSONArray arr = r.optJSONArray("list");
        if (arr != null) {
          for (int i = 0; i < arr.length(); i++) list.put(toVod(arr.getJSONObject(i)));
          pagecount = Math.max(1, (int) Math.ceil(r.optInt("total", 0) / 20.0));
        }
      } else if ("songlist".equals(tid)) {
        params.put("programno", "0");
        params.put("count", 20);
        JSONObject r = call("tvGetColumnByNo", params);
        JSONArray arr = r.optJSONArray("list");
        if (arr != null) {
          for (int i = 0; i < arr.length(); i++) {
            JSONObject col = arr.getJSONObject(i);
            JSONObject v = new JSONObject();
            v.put("vod_id", "songlist$" + col.optString("columnno") + "$$" + col.optString("columnname"));
            v.put("vod_name", col.optString("columnname"));
            v.put("vod_pic", col.optString("tvsmallpic", col.optString("tvbigpic")));
            v.put("vod_remarks", "");
            list.put(v);
          }
          pagecount = Math.max(1, (int) Math.ceil(r.optInt("total", 0) / 20.0));
        }
      } else {
        // rank 或其他：当作榜单列
        String programno = "22495f10dc0248daa6ec0159ced4bee3";
        params.put("programno", programno);
        params.put("count", 20);
        JSONObject r = call("tvGetSongsByClm", params);
        JSONArray arr = r.optJSONArray("list");
        if (arr != null) {
          for (int i = 0; i < arr.length(); i++) list.put(toVod(arr.getJSONObject(i)));
          pagecount = Math.max(1, (int) Math.ceil(r.optInt("total", 0) / 20.0));
        }
      }
    } catch (Exception e) {
      Log.w(TAG, "category failed tid=" + tid, e);
      throw e;
    }
    JSONObject result = new JSONObject();
    result.put("list", list);
    result.put("page", p);
    result.put("pagecount", pagecount);
    return result.toString();
  }

  /** 搜索。 */
  public static String search(String keyword) throws Exception {
    JSONObject params = new JSONObject();
    params.put("signinfo", keyword);
    params.put("signtype", "1");
    params.put("start", 1);
    params.put("count", 20);
    JSONObject r = call("tvGetSongsByMuliType", params);
    JSONArray list = new JSONArray();
    JSONArray arr = r.optJSONArray("list");
    if (arr != null) {
      for (int i = 0; i < arr.length(); i++) list.put(toVod(arr.getJSONObject(i)));
    }
    JSONObject result = new JSONObject();
    result.put("list", list);
    result.put("page", 1);
    result.put("pagecount", 1);
    return result.toString();
  }

  /**
   * 详情。支持两种 id：
   *  - resourceno@@name@@path@@lrc：直接带上播放地址
   *  - resourceno：通过 tvGetSongInfoById 实时获取
   * 返回 catvod detail JSON。
   */
  public static String detail(String id) throws Exception {
    JSONObject c = new JSONObject();
    c.put("vod_id", id);
    c.put("vod_name", "");
    c.put("vod_pic", "");
    c.put("vod_remarks", "");
    c.put("vod_play_from", "咪咕");
    String playUrl = "";
    String lrcUrl = "";

    String[] parts = id.split("@@");
    String resourceno = parts[0];
    String name = parts.length > 1 ? parts[1] : "";
    String path = parts.length > 2 ? parts[2] : "";
    String lrc = parts.length > 3 ? parts[3] : "";
    if (!name.isEmpty()) c.put("vod_name", name);
    if (!path.isEmpty()) {
      playUrl = path;
      lrcUrl = lrc;
    } else {
      JSONObject params = new JSONObject();
      params.put("resourceno", resourceno);
      JSONObject r = call("tvGetSongInfoById", params);
      JSONObject sr = r.optJSONObject("singresource");
      if (sr != null) {
        if (name.isEmpty()) c.put("vod_name", sr.optString("resourcename"));
        playUrl = pickPath(sr);
        String elp = sr.optString("encryptlyricspath");
        if (lrcUrl.isEmpty() && !elp.isEmpty()) lrcUrl = elp;
      }
    }
    if (!playUrl.isEmpty()) {
      c.put("vod_play_url", "播放$" + playUrl + "@@" + lrcUrl);
    }

    JSONArray list = new JSONArray();
    if (c.has("vod_play_url")) list.put(c);
    JSONObject result = new JSONObject();
    result.put("list", list);
    return result.toString();
  }

  /** playerContent：直接返回播放地址。 */
  public static String player(String flag, String id) throws Exception {
    String[] parts = id.split("@@");
    JSONObject a = new JSONObject();
    a.put("parse", 0);
    a.put("url", parts[0]);
    a.put("header", "User-Agent: " + UA);
    return a.toString();
  }
}
