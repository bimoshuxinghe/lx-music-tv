package cn.toside.music.mobile.aiSharjeck;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;

/**
 * 夏杰语音注册请求接收器
 *
 * 响应 com.peasun.aispeech.action.app.register.require：
 * 当夏杰语音要求本应用重新注册（category == SEMANTIC_MUSIC）时，
 * 重新执行注册，确保应用重启后仍能被语音识别。
 */
public class AISharjeckReceiver extends BroadcastReceiver {
  private static final String TAG = "AISharjeckReceiver";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null) return;
    String action = intent.getAction();
    if (TextUtils.isEmpty(action)) return;

    if (AISharjeckConstant.AI_OPEN_ACTION_APP_REGISTER_REQUIRE.equals(action)) {
      Bundle data = intent.getExtras();
      if (data != null) {
        long category = data.getLong("category", -1);
        if (category == AISharjeckConstant.SEMANTIC_MUSIC) {
          Log.d(TAG, "register require, category=" + category);
          AISharjeckUtils.registerApp(context);
        }
      }
    }
  }
}
