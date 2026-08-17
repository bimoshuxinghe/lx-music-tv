package cn.toside.music.mobile.sourcePush;

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

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class SourcePushModule extends ReactContextBaseJavaModule {
  private static final String TAG = "SourcePushModule";
  private static final String EVENT_SOURCE_PUSHED = "source-pushed";

  private static final long MAX_BODY_LENGTH = 15 * 1024 * 1024;

  private final ReactApplicationContext reactContext;
  private ServerSocket serverSocket;
  private Thread acceptThread;
  private volatile boolean running = false;

  SourcePushModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "SourcePushModule";
  }

  @ReactMethod
  public void addListener(String eventName) {}

  @ReactMethod
  public void removeListeners(Integer count) {}

  @ReactMethod
  public void start(final Promise promise) {
    stop();
    try {
      serverSocket = new ServerSocket(0);
      final int port = serverSocket.getLocalPort();
      running = true;
      acceptThread = new Thread(this::acceptLoop);
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

  private void acceptLoop() {
    while (running) {
      try {
        Socket socket = serverSocket.accept();
        Thread thread = new Thread(() -> handleClient(socket));
        thread.start();
      } catch (IOException e) {
        if (running) Log.e(TAG, "accept failed", e);
        break;
      }
    }
  }

  private void handleClient(Socket socket) {
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
        writeResponse(out, "application/json", "{\"status\":\"error\",\"message\":\"script too large\"}");
        closeSocket(socket);
        return;
      }

      if ("GET".equals(method)) {
        writeResponse(out, "text/html; charset=utf-8", PUSH_PAGE);
      } else if ("POST".equals(method) && "/push".equals(path)) {
        byte[] body = readBody(in, (int) contentLength);
        handlePush(body, out);
      } else {
        writeResponse(out, "application/json", "{\"status\":\"error\",\"message\":\"not found\"}");
      }
      closeSocket(socket);
    } catch (Exception e) {
      Log.e(TAG, "handle client failed", e);
      closeSocket(socket);
    }
  }

  private void handlePush(byte[] body, OutputStream out) {
    try {
      if (body == null || body.length == 0) {
        writeResponse(out, "application/json", "{\"status\":\"error\",\"message\":\"empty body\"}");
        return;
      }
      JSONObject json = new JSONObject(new String(body, StandardCharsets.UTF_8));
      String url = json.optString("url", "").trim();
      if (!url.isEmpty()) {
        if (!(url.startsWith("http://") || url.startsWith("https://"))) {
          writeResponse(out, "application/json", "{\"status\":\"error\",\"message\":\"invalid url\"}");
          return;
        }
        writeResponse(out, "application/json", "{\"status\":\"ok\"}");
        sendSourcePushedEvent("", url);
        return;
      }
      String script = json.optString("script", "");
      if (script.isEmpty()) {
        writeResponse(out, "application/json", "{\"status\":\"error\",\"message\":\"empty script\"}");
        return;
      }
      writeResponse(out, "application/json", "{\"status\":\"ok\"}");
      sendSourcePushedEvent(script, "");
    } catch (JSONException e) {
      Log.e(TAG, "parse body failed", e);
      try {
        writeResponse(out, "application/json", "{\"status\":\"error\",\"message\":\"invalid body\"}");
      } catch (IOException ignored) {}
    } catch (Exception e) {
      Log.e(TAG, "push source failed", e);
      try {
        writeResponse(out, "application/json", "{\"status\":\"error\",\"message\":\"push failed\"}");
      } catch (IOException ignored) {}
    }
  }

  private void sendSourcePushedEvent(String script, String url) {
    WritableMap params = Arguments.createMap();
    params.putString("script", script);
    params.putString("url", url);
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(EVENT_SOURCE_PUSHED, params);
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

  private static final String PUSH_PAGE =
    "<!DOCTYPE html><html lang=\"zh\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>推送音源文件</title><style>" +
    "body{font-family:sans-serif;background:#f5f5f5;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px}" +
    "h1{font-size:20px;color:#333;margin:0 0 4px}.box{background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.1);max-width:440px;width:100%;text-align:center}" +
    ".tip{font-size:14px;color:#888;margin:4px 0 16px}" +
    "#fileInput{width:100%;padding:14px;border:2px dashed #bbb;border-radius:8px;box-sizing:border-box;background:#fafafa;font-size:14px}" +
    "#status{margin-top:14px;font-size:15px;color:#666;min-height:22px;word-break:break-all}" +
    "#btn{display:none;margin-top:16px;width:100%;padding:12px;border:none;border-radius:8px;background:#4a90d9;color:#fff;font-size:16px;cursor:pointer}" +
    "#btn:disabled{background:#bbb}" +
    "#urlArea{margin-top:20px;border-top:1px dashed #ccc;padding-top:14px}" +
    "#urlLabel{font-size:13px;color:#666;margin:0 0 8px}" +
    "#urlInput{width:100%;padding:12px;border:1px solid #bbb;border-radius:8px;box-sizing:border-box;font-size:14px}" +
    "#urlBtn{width:100%;margin-top:10px;padding:12px;border:none;border-radius:8px;background:#48b06f;color:#fff;font-size:16px;cursor:pointer}" +
    "#urlBtn:disabled{background:#bbb}" +
    "</style></head><body><div class=\"box\"><h1>推送音源文件到电视</h1>" +
    "<p class=\"tip\">选择要导入的音源脚本文件（.js），推送后电视将自动导入并应用</p>" +
    "<input type=\"file\" id=\"fileInput\">" +
    "<button id=\"btn\">确认推送</button>" +
    "<div id=\"urlArea\"><label id=\"urlLabel\">或者输入在线音源网址推送</label>" +
    "<input type=\"text\" id=\"urlInput\" placeholder=\"https://example.com/api.js\">" +
    "<button id=\"urlBtn\">推送网址</button></div>" +
    "<div id=\"status\"></div></div><script>" +
    "var file=null,reader=new FileReader();var fileInput=document.getElementById('fileInput');" +
    "var btn=document.getElementById('btn');var statusEl=document.getElementById('status');" +
    "fileInput.addEventListener('change',function(e){" +
    "file=e.target.files[0];if(!file){return;}if(file.size>9*1024*1024){statusEl.textContent='文件不能超过 9MB';return;}" +
    "if(!/\\.(js|lxmc)$/i.test(file.name)){fileInput.value='';statusEl.textContent='请选择 .js 或 .lxmc 音源文件';return;}" +
    "reader.onload=function(ev){btn.style.display='block';statusEl.textContent='已选择: '+file.name;};" +
    "reader.readAsText(file);});" +
    "btn.addEventListener('click',function(){" +
    "if(!file){return;}var script=reader.result;if(!script||!script.trim()){statusEl.textContent='文件内容为空';return;}" +
    "btn.disabled=true;statusEl.textContent='推送中...';" +
    "fetch('/push',{method:'POST',headers:{'Content-Type':'application/json'}," +
    "body:JSON.stringify({script:script})}).then(function(r){return r.json();}).then(function(res){" +
    "if(res.status==='ok'){statusEl.textContent='推送成功，电视已自动导入并应用音源';btn.disabled=false;}else{statusEl.textContent='推送失败: '+(res.message||'未知错误');btn.disabled=false;}" +
    "}).catch(function(err){statusEl.textContent='推送失败，请检查网络';btn.disabled=false;});});" +
    "var urlInput=document.getElementById('urlInput');var urlBtn=document.getElementById('urlBtn');" +
    "urlBtn.addEventListener('click',function(){" +
    "var url=urlInput.value.trim();if(!url){statusEl.textContent='请输入在线音源网址';return;}" +
    "urlBtn.disabled=true;statusEl.textContent='推送中...';" +
    "fetch('/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})}).then(function(r){return r.json();}).then(function(res){" +
    "if(res.status==='ok'){statusEl.textContent='推送成功，电视已自动导入并应用音源';urlBtn.disabled=false;}else{statusEl.textContent='推送失败: '+(res.message||'未知错误');urlBtn.disabled=false;}" +
    "}).catch(function(err){statusEl.textContent='推送失败，请检查网络';urlBtn.disabled=false;});});" +
    "</script></body></html>";
}
