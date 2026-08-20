# KTV 功能接入说明

在 `lx-music-tv`（React Native 安卓电视音乐 App）顶部导航栏的 **排行榜** 与 **设置** 之间，新增了 **KTV** 入口。进入后是结合开源 **麦动 KTV** 界面范式、底层数据走你提供的 `MusicAiIKtv`（`spider.zip` 内的 catvod 爬虫）的点歌机。

---

## 一、功能概览

- **导航入口**：`nav_ktv` 按钮，位于排行榜与设置之间（`NavBar` 按 `NAV_MENUS` 自动渲染）。
- **点歌机界面（麦动范式）**：左列实时视频小窗 + 进度条 + 当前歌名/歌手，右列分类 Tab + 歌单，顶部「搜索框 + 已点(N)」。
- **已点队列**：点歌自动入队（去重），角标实时计数；播完自动下一首；`上一首 / 下一首` 在队列内跳转；`已点` 面板可跳转播放或移除。
- **播放（ExoPlayer / react-native-video）**：KTV 资源是 **视频（MV）**，使用 ExoPlayer 播放。
  - **原唱 / 伴唱切换**：视频自带两条独立音轨时，通过 `selectedAudioTrack` 在 ExoPlayer 音轨组间切换（`原唱` ↔ `伴唱`）。
  - **字幕**：视频**自带内嵌字幕轨**，由 ExoPlayer 自动渲染，**未移植麦动那套独立 LyricLine 歌词逻辑**（按你的要求）。
  - 控制条：上一首 / 原伴唱 / 重唱 / 下一首 / 全屏 / 播放暂停。

---

## 二、核心改动文件

| 文件 | 作用 |
|------|------|
| `src/config/constant.ts` | `NAV_MENUS` 插入 `{ id: 'nav_ktv', icon: 'add-music' }` |
| `src/lang/zh-cn.json` / `src/lang/en-us.json` | 新增 `nav_ktv: "KTV"` |
| `src/screens/Home/Horizontal/Main.tsx` | 导航切换 `case 'nav_ktv': return <Ktv />` |
| `src/screens/Home/Views/Ktv/` | KTV 页面（`index` / `Horizontal` / `Vertical`） |
| `src/utils/nativeModules/ktvSpider.ts` | JS 桥接，调用原生模块 |
| `android/app/src/main/java/cn/toside/music/mobile/ktv/KtvSpiderModule.java` | 原生桥接：加载 `spider.zip`（DexClassLoader + wexguard 解密），暴露 catvod 标准方法 |
| `android/app/src/main/java/cn/toside/music/mobile/ktv/KtvSpiderPackage.java` | 原生模块注册包 |
| `android/app/src/main/java/cn/toside/music/mobile/MainApplication.java` | 注册 `KtvSpiderPackage` |
| `android/app/src/main/assets/spider/spider.zip` | 你提供的爬虫（含 `MusicAiIKtv`、wexguard 的 `.so` 与 `.guard`） |
| `package.json` | 新增 `react-native-video: 6.4.1`（安卓底层即 ExoPlayer） |

---

## 三、如何编译

```bash
# 1. 安装依赖（务必重新安装，已新增 react-native-video）
npm install
#   或：yarn install

# 2. Android 构建（会自动 autolink 把 ExoPlayer 打进 APK）
cd android
./gradlew assembleRelease        # 出 release 包
#   或 ./gradlew installDebug     # 直连设备调试

# 3. 生成 JS bundle 的方式取决于本仓库的打包脚本，常见：
npm run pack:android            # 若有该脚本
```

> 拉取本仓库源码时若网络受限，可走 SOCKS5 代理：
> `git config --global http.proxy socks5h://tudou:aa950310@153.75.235.153:10080`
> （仅影响 git 拉取，可随时 `git config --global --unset http.proxy` 取消。）

---

## 四、数据链路（catvod 标准）

原生模块 `KtvSpiderModule` 调用顺序：

1. `Init.init(appContext)` —— `DexNative` 静态块自动加载 `assets/wexguard_v8.so`（或 v7）解密，再由 `getLoader` 解密 `.guard` 得到可实例化类。
2. `Init.getSpider("MusicAiIKtv")` —— 拿到 `MusicAiIKtvGuard` 实例。
3. JS 侧调用标准方法（`src/utils/nativeModules/ktvSpider.ts`）：
   - `ktvHome()` → 首页（分类 + 推荐）
   - `ktvCategory(tid, page)` → 分类列表
   - `ktvSearch(keyword)` → 搜索
   - `ktvDetail([vod_id])` → 详情（含 `vod_play_from` / `vod_play_url`）
   - `ktvPlayer(flag, id, urls)` → 取真实播放地址

`vod_play_url` 按 catvod 多源格式解析：源名用 `$$$` 分隔、源内多集用 `#` 分隔；`playerContent(flag, id, vodUrls)` 的 `id` 取**选中那集的播放地址**（已修复，之前误传了 vod_id）。

播放取到 `url` 后，带 `playerContent` 返回的 `header`（防盗链 Referer/UA，若有）一起交给 ExoPlayer。

---

## 五、已知问题与排查

- **`INIT_FAILED`**：wexguard 需要在真机上加载那两个 `.so`（64 位用 v8、32 位用 v7）并解密 `.guard`。若初始化失败，先看设备日志确认 so 是否匹配设备 ABI、`.guard` 是否随 `spider.zip` 一起被 `DexClassLoader` 加载。
- **视频 403 / 播放不出**：多是防盗链。已把 `playerContent` 的 `header` 解析后传给 ExoPlayer；若仍 403，可能是该 spider 还需额外 `init(extend)` 配置。
- **原伴唱切换不生效**：`selectedAudioTrack` prop 在 react-native-video 6.x 改值即生效。若你设备上点了没切，可改为「带 `key` 重挂 `<Video>`」的降级方案（代价是切歌时进度归零，KTV 场景可接受）。
- **字幕不显示**：视频自带内嵌字幕轨时 ExoPlayer 默认渲染；若你的视频把字幕做成外挂地址，需要再补 `textTracks`，但按你提供的库，字幕是视频自带的，无需额外处理。

---

## 六、待你在真机验证

沙箱环境无 Android SDK，无法真机编译运行，以下需你本地验证：

1. `npm install` 后能否正常打包（react-native-video 是否成功 autolink）；
2. 打开 KTV → 首页/搜索/分类能否出歌；
3. 点歌能否出视频（ExoPlayer）；
4. 原伴唱按钮能否切换音轨；
5. 视频自带字幕是否如预期显示。
