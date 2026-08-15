package cn.toside.music.mobile.aiSharjeck;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.text.TextUtils;
import android.util.Log;

import cn.toside.music.mobile.MainActivity;

/**
 * 夏杰语音音乐指令接收服务
 *
 * 收到 com.peasun.aispeech.action.music 指令后：
 *  - 解析 search 指令（keyword / singerName / songName）
 *  - 通过 AISharjeckModule 转发给 JS 侧处理
 *  - 若应用处于后台，拉起 MainActivity 到前台
 */
public class AISharjeckService extends Service {
  private static final String TAG = "AISharjeckService";

  private Handler handler;

  @Override
  public void onCreate() {
    super.onCreate();
    handler = new Handler(getMainLooper());
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    startForegroundCompat();

    // 15 秒后自动停止，避免长时间占用前台服务
    handler.removeCallbacks(stopServiceTask);
    handler.postDelayed(stopServiceTask, 15_000);

    if (intent == null) {
      return super.onStartCommand(intent, flags, startId);
    }

    String action = intent.getAction();
    if (AISharjeckConstant.AI_OPEN_ACTION_MUSIC.equals(action)) {
      handleMusicAction(intent.getExtras());
    }

    return super.onStartCommand(intent, flags, startId);
  }

  private void handleMusicAction(Bundle data) {
    if (data == null) return;
    String command = data.getString("common");
    if (TextUtils.isEmpty(command)) return;
    Log.d(TAG, "receive command: " + command);

    if ("search".equals(command)) {
      String keyword = data.getString("keyword");
      String singerName = data.getString("singerName");
      String songName = data.getString("songName");
      Log.d(TAG, "search: keyword=" + keyword + ", singer=" + singerName + ", song=" + songName);

      // 转发给 JS 侧处理
      AISharjeckModule.handleSearchCommand(keyword, singerName, songName);

      // 若应用处于后台，拉起 MainActivity 到前台
      bringAppToForeground();
    }
    // control 指令暂不支持
  }

  /**
   * 将应用带到前台（若已在栈顶则复用，否则重新拉起）
   */
  private void bringAppToForeground() {
    try {
      Intent intent = new Intent(this, MainActivity.class);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
      startActivity(intent);
    } catch (Exception e) {
      Log.e(TAG, "bring app to foreground failed", e);
    }
  }

  /**
   * Android 8.0+ 前台服务要求展示通知，这里使用低优先级通知并随服务自动停止
   */
  private void startForegroundCompat() {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        startForeground(AISharjeckConstant.NOTIFICATION_ID, buildNotification());
        return;
      }
      NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
      NotificationChannel channel = new NotificationChannel(
        AISharjeckConstant.NOTIFICATION_CHANNEL_ID,
        "AI Open Service",
        NotificationManager.IMPORTANCE_LOW
      );
      channel.setShowBadge(false);
      manager.createNotificationChannel(channel);
      Notification notification = buildNotification();
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(AISharjeckConstant.NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE);
      } else {
        startForeground(AISharjeckConstant.NOTIFICATION_ID, notification);
      }
    } catch (Exception e) {
      Log.e(TAG, "start foreground failed", e);
    }
  }

  private Notification buildNotification() {
    Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
      ? new Notification.Builder(this, AISharjeckConstant.NOTIFICATION_CHANNEL_ID)
      : new Notification.Builder(this);
    builder.setContentTitle("AI 语音点歌服务")
      .setContentText("已连接夏杰语音")
      .setSmallIcon(cn.toside.music.mobile.R.mipmap.ic_launcher)
      .setOngoing(false)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setPriority(Notification.PRIORITY_MIN);
    return builder.build();
  }

  private final Runnable stopServiceTask = () -> stopSelf();

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
