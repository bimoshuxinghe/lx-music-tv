# 实施任务清单：扫码推送壁纸与文字颜色设置

Feature Name: 2026-08-15-wallpaper-and-font-color

## Task 1: 设置项定义

- [x] 在 `src/config/defaultSetting.ts` 增加 `theme.customBgImage`、`theme.fontColor` 默认值
- [x] 在 `src/types/app_setting.d.ts` 增加类型声明
- [x] 修改 `src/theme/themes/index.ts` 的 `buildActiveThemeColors`，根据设置覆盖 `c-font` 与 `bg-image`

## Task 2: 原生本地 HTTP 服务（WallpaperModule）

- [ ] 新建 `android/app/src/main/java/cn/toside/music/mobile/wallpaper/`：
  - [ ] `WallpaperModule.java`：`start(port, dir)` / `stop()` / 事件 `wallpaper-uploaded`
  - [ ] `WallpaperPackage.java` 注册模块
  - [ ] 内嵌 HTML 上传页（图片选择 + base64 编码 + POST /upload）
  - [ ] POST /upload 接收 JSON `{ name, data }`，base64 解码写入 `dir`
- [ ] 注册到 `MainApplication.java` 的 `getPackages()`

## Task 3: 二维码生成与展示

- [ ] 添加依赖 `qrcode-generator` 到 `package.json`
- [ ] 改造 `src/screens/Home/Views/Setting/settings/Theme/UploadWallpaper.tsx`：
  - [ ] 点击"推送壁纸"获取 `getWIFIIPV4Address` + 调用原生 `start` 获得端口
  - [ ] 生成二维码并渲染为黑白格子 View，展示弹层与同网提示
  - [ ] 监听 `wallpaper-uploaded` 事件，`updateSetting({ 'theme.customBgImage': path })`
  - [ ] 关闭弹层时调用 `stop()` 释放端口
  - [ ] 提供"清除壁纸"操作
- [ ] 挂载/更新 `Theme/index.tsx`

## Task 4: 文字颜色组件

- [x] 新建 `src/screens/Home/Views/Setting/settings/Theme/FontColor.tsx`，预设色板选择
  - [x] 选择后 `updateSetting({ 'theme.fontColor': 颜色 })`
- [x] 挂载到 `Theme/index.tsx`

## Task 5: 多语言文案

- [ ] 在 `src/lang/zh-cn.json`、`zh-tw.json`、`en-us.json` 新增扫码推送壁纸相关词条（三语言 key 一致）

## Task 6: 验证

- [ ] 语法/类型检查（如项目支持 tsc）
- [ ] 回顾 requirements.md 验收标准逐项核对
