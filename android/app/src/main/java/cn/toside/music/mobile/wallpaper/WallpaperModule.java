package cn.toside.music.mobile.wallpaper;

import android.util.Base64;
import android.util.Log;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class WallpaperModule extends ReactContextBaseJavaModule {
  private static final String TAG = "WallpaperModule";
  private static final String EVENT_WALLPAPER_UPLOADED = "wallpaper-uploaded";

  private static final long MAX_BODY_LENGTH = 30 * 1024 * 1024;
  private static final String[] ALLOWED_EXTENSIONS = { "jpg", "jpeg", "png", "webp", "bmp" };

  private final ReactApplicationContext reactContext;
  private ServerSocket serverSocket;
  private Thread acceptThread;
  private volatile boolean running = false;

  WallpaperModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "WallpaperModule";
  }

  @ReactMethod
  public void addListener(String eventName) {}

  @ReactMethod
  public void removeListeners(Integer count) {}

  @ReactMethod
  public void start(String dir, final Promise promise) {
    stop();
    try {
      final File dirFile = new File(dir);
      if (!dirFile.exists() && !dirFile.mkdirs()) {
        promise.reject("mkdir_failed", "Unable to create directory: " + dir);
        return;
      }
      serverSocket = new ServerSocket(0);
      final int port = serverSocket.getLocalPort();
      running = true;
      acceptThread = new Thread(() -> acceptLoop(dirFile));
      acceptThread.start();
      promise.resolve(port);
    } catch (Exception e) {
      Log.e(TAG, "start server failed", e);
      running = false;
      if (serverSocket != null) {
        try {
          serverSocket.close();
        } catch (IOException ignored) {}
        serverSocket = null;
      }
      promise.reject("start_failed", e.getMessage());
    }
  }

  @ReactMethod
  public void stop() {
    running = false;
    if (serverSocket != null) {
      try {
        serverSocket.close();
      } catch (IOException ignored) {}
      serverSocket = null;
    }
    if (acceptThread != null) {
      try {
        acceptThread.join(500);
      } catch (InterruptedException ignored) {
        Thread.currentThread().interrupt();
      }
      acceptThread = null;
    }
  }

  private void acceptLoop(File dirFile) {
    while (running) {
      try {
        Socket socket = serverSocket.accept();
        Thread thread = new Thread(() -> handleClient(socket, dirFile));
        thread.start();
      } catch (IOException e) {
        if (running) Log.e(TAG, "accept failed", e);
        break;
      }
    }
  }

  private void handleClient(Socket socket, File dirFile) {
    try {
      socket.setSoTimeout(60000);
      InputStream in = socket.getInputStream();
      OutputStream out = socket.getOutputStream();

      String requestLine = readLine(in);
      if (requestLine == null || requestLine.isEmpty()) {
        closeSocket(socket);
        return;
      }
      String[] parts = requestLine.split(" ");
      String method = parts.length > 0 ? parts[0].toUpperCase(Locale.US) : "GET";
      String path = parts.length > 1 ? parts[1] : "/";

      long contentLength = 0;
      String headerLine;
      while ((headerLine = readLine(in)) != null && !headerLine.isEmpty()) {
        if (headerLine.toLowerCase(Locale.US).startsWith("content-length:")) {
          try {
            contentLength = Long.parseLong(headerLine.substring("content-length:".length()).trim());
          } catch (NumberFormatException ignored) {}
        }
      }

      if (contentLength > MAX_BODY_LENGTH) {
        writeResponse(out, "application/json", "{\"status\":\"error\",\"message\":\"file too large\"}");
        closeSocket(socket);
        return;
      }

      if ("GET".equals(method)) {
        writeResponse(out, "text/html; charset=utf-8", UPLOAD_PAGE);
      } else if ("POST".equals(method) && "/upload".equals(path)) {
        byte[] body = readBody(in, (int) contentLength);
        handleUpload(body, dirFile, out);
      } else {
        writeResponse(out, "application/json", "{\"status\":\"error\",\"message\":\"not found\"}");
      }
      closeSocket(socket);
    } catch (Exception e) {
      Log.e(TAG, "handle client failed", e);
      closeSocket(socket);
    }
  }

  private void handleUpload(byte[] body, File dirFile, OutputStream out) {
    try {
      if (body == null || body.length == 0) {
        writeResponse(out, "application/json", "{\"status\":\"error\",\"message\":\"empty body\"}");
        return;
      }
      JSONObject json = new JSONObject(new String(body, StandardCharsets.UTF_8));
      String name = json.optString("name", "");
      String data = json.optString("data", "");
      if (data.isEmpty()) {
        writeResponse(out, "application/json", "{\"status\":\"error\",\"message\":\"empty data\"}");
        return;
      }
      String ext = getExtension(name);
      if (ext == null) {
        writeResponse(out, "application/json", "{\"status\":\"error\",\"message\":\"unsupported file type\"}");
        return;
      }
      byte[] fileBytes = Base64.decode(data, Base64.DEFAULT);
      String fileName = System.currentTimeMillis() + "." + ext;
      File target = new File(dirFile, fileName);
      java.io.FileOutputStream fos = new java.io.FileOutputStream(target);
      try {
        fos.write(fileBytes);
      } finally {
        fos.close();
      }
      writeResponse(out, "application/json", "{\"status\":\"ok\"}");
      sendWallpaperUploadedEvent(target.getAbsolutePath());
    } catch (JSONException e) {
      Log.e(TAG, "parse body failed", e);
      writeResponse(out, "application/json", "{\"status\":\"error\",\"message\":\"invalid body\"}");
    } catch (Exception e) {
      Log.e(TAG, "save file failed", e);
      writeResponse(out, "application/json", "{\"status\":\"error\",\"message\":\"save failed\"}");
    }
  }

  private void sendWallpaperUploadedEvent(String path) {
    WritableMap params = Arguments.createMap();
    params.putString("path", path);
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(EVENT_WALLPAPER_UPLOADED, params);
  }

  private void writeResponse(OutputStream out, String contentType, String body) throws IOException {
    byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
    StringBuilder head = new StringBuilder();
    head.append("HTTP/1.1 200 OK\r\n");
    head.append("Content-Type: ").append(contentType).append("\r\n");
    head.append("Content-Length: ").append(bodyBytes.length).append("\r\n");
    head.append("Connection: close\r\n");
    head.append("\r\n");
    out.write(head.toString().getBytes(StandardCharsets.UTF_8));
    out.write(bodyBytes);
    out.flush();
  }

  private void closeSocket(Socket socket) {
    try {
      socket.close();
    } catch (IOException ignored) {}
  }

  private String readLine(InputStream in) throws IOException {
    StringBuilder sb = new StringBuilder();
    int b;
    while ((b = in.read()) != -1) {
      if (b == '\n') break;
      if (b != '\r') sb.append((char) b);
      if (sb.length() > 8192) throw new IOException("header too long");
    }
    return sb.length() == 0 && b == -1 ? null : sb.toString();
  }

  private byte[] readBody(InputStream in, int contentLength) throws IOException {
    if (contentLength <= 0) return new byte[0];
    byte[] buffer = new byte[contentLength];
    int offset = 0;
    while (offset < contentLength) {
      int read = in.read(buffer, offset, contentLength - offset);
      if (read == -1) break;
      offset += read;
    }
    return buffer;
  }

  @Nullable
  private String getExtension(String name) {
    int idx = name.lastIndexOf('.');
    if (idx < 0 || idx == name.length() - 1) return null;
    String ext = name.substring(idx + 1).toLowerCase(Locale.US);
    for (String allowed : ALLOWED_EXTENSIONS) {
      if (allowed.equals(ext)) return ext;
    }
    return null;
  }

  private static final String UPLOAD_PAGE =
    "<!DOCTYPE html><html lang=\"zh\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>推送壁纸</title><style>" +
    "body{font-family:sans-serif;background:#f5f5f5;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px}" +
    "h1{font-size:20px;color:#333}.box{background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.1);max-width:420px;width:100%;text-align:center}" +
    "#fileInput{width:100%;padding:14px;border:2px dashed #bbb;border-radius:8px;box-sizing:border-box;background:#fafafa;font-size:15px}" +
    "#status{margin-top:16px;font-size:15px;color:#666;min-height:22px;word-break:break-all}" +
    "#btn{display:none;margin-top:16px;width:100%;padding:12px;border:none;border-radius:8px;background:#4a90d9;color:#fff;font-size:16px;cursor:pointer}" +
    "</style></head><body><div class=\"box\"><h1>推送壁纸到电视</h1>" +
    "<input type=\"file\" id=\"fileInput\" accept=\"image/jpeg,image/png,image/webp,image/bmp\">" +
    "<button id=\"btn\">确认上传</button><div id=\"status\"></div></div><script>" +
    "var file=null,reader=new FileReader();var fileInput=document.getElementById('fileInput');" +
    "var btn=document.getElementById('btn');var statusEl=document.getElementById('status');" +
    "fileInput.addEventListener('change',function(e){" +
    "file=e.target.files[0];if(!file){return;}if(file.size>20*1024*1024){statusEl.textContent='图片不能超过 20MB';return;}" +
    "reader.onload=function(ev){btn.style.display='block';statusEl.textContent='已选择: '+file.name;};" +
    "reader.readAsDataURL(file);});" +
    "btn.addEventListener('click',function(){" +
    "if(!file){return;}var data=reader.result.split(',')[1];btn.disabled=true;statusEl.textContent='上传中...';" +
    "fetch('/upload',{method:'POST',headers:{'Content-Type':'application/json'}," +
    "body:JSON.stringify({name:file.name,data:data})}).then(function(r){return r.json();}).then(function(res){" +
    "if(res.status==='ok'){statusEl.textContent='上传成功, 电视已应用壁纸';btn.disabled=false;}else{statusEl.textContent='上传失败: '+(res.message||'未知错误');btn.disabled=false;}" +
    "}).catch(function(err){statusEl.textContent='上传失败, 请检查网络';btn.disabled=false;});});" +
    "</script></body></html>";
}
