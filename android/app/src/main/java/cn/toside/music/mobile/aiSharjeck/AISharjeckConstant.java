package cn.toside.music.mobile.aiSharjeck;

/**
 * 夏杰语音 AI Open 协议常量（音乐技能）
 * 参考官方 MusicDemo：https://github.com/SHARJECK/MusicDemo
 */
public class AISharjeckConstant {
  /** 对接所需权限：由夏杰语音声明，本应用声明后即可接收其指令 */
  public static final String AI_OPEN_ACTION_PERMISSION = "com.peasun.aispeech.aiopen.control";
  /** 注册请求：夏杰语音广播查询已注册的音乐应用 */
  public static final String AI_OPEN_ACTION_APP_REGISTER_REQUIRE = "com.peasun.aispeech.action.app.register.require";
  /** 注册：向夏杰语音注册本应用为音乐应用 */
  public static final String AI_OPEN_ACTION_APP_REGISTER = "com.peasun.aispeech.action.app.register";
  /** 音乐指令 action */
  public static final String AI_OPEN_ACTION_MUSIC = "com.peasun.aispeech.action.music";

  /** 音乐技能分类 */
  public static final long SEMANTIC_MUSIC = 0x1L << 5;

  /** 大陆版夏杰语音包名 */
  public static final String AI_SPEECH_PACKAGE_CN = "com.peasun.aispeech";
  /** 国际版夏杰语音包名 */
  public static final String AI_SPEECH_PACKAGE_GLOBAL = "com.peasun.aispeechgl";

  /** 前台服务通知渠道 */
  public static final String NOTIFICATION_CHANNEL_ID = "ai_open_music_service";
  /** 前台服务通知 ID */
  public static final int NOTIFICATION_ID = 1001;
}
