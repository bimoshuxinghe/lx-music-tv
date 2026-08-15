# 实施任务清单：上传壁纸与文字颜色设置

Feature Name: 2026-08-15-wallpaper-and-font-color

## Task 1: 设置项定义

- [x] 在 `src/config/defaultSetting.ts` 增加 `theme.customBgImage`、`theme.fontColor` 默认值
- [x] 在 `src/types/app_setting.d.ts` 增加类型声明
- [x] 修改 `src/theme/themes/index.ts` 的 `buildActiveThemeColors`，根据设置覆盖 `c-font` 与 `bg-image`

## Task 2: 上传壁纸组件

- [x] 新建 `src/screens/Home/Views/Setting/settings/Theme/UploadWallpaper.tsx`
  - 复用 `selectFile` 选择图片（jpg/jpeg/png/webp/bmp）
  - 复制到 `privateStorageDirectoryPath + '/theme_images/'`（目录不存在则 mkdir）
  - `updateSetting({ 'theme.customBgImage': 路径 })`
  - 提供"清除壁纸"操作
- [x] 挂载到 `Theme/index.tsx`

## Task 3: 文字颜色组件

- [x] 新建 `src/screens/Home/Views/Setting/settings/Theme/FontColor.tsx`，预设色板选择
  - 选择后 `updateSetting({ 'theme.fontColor': 颜色 })`
- [x] 挂载到 `Theme/index.tsx`

## Task 4: 多语言文案

- [x] 在 `src/lang/zh-cn.json` 与 `src/lang/en-us.json` 新增壁纸与文字颜色相关词条

## Task 5: 验证

- [x] 语法/类型检查（如项目支持 tsc）
- [x] 回顾 requirements.md 验收标准逐项核对
