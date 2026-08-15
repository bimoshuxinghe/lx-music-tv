# 需求文档：上传壁纸与文字颜色设置

Feature Name: wallpaper-and-font-color
Created: 2026-08-15

## Introduction

当前 App 的背景与文字颜色完全由内置主题决定。用户希望可以在设置中上传自定义壁纸作为全局应用背景，并可为软件主要文字单独选择颜色，以满足个性化需求。

## Glossary

- **系统（system）**：本音乐 App
- **全局背景**：所有页面统一使用的应用背景图片
- **主文字色（c-font）**：界面主要文字（标题、列表、菜单项等 `Text` 组件默认色）的颜色
- **预设色板**：一组由系统提供的可选颜色集合

## Requirements

### Requirement 1: 上传壁纸

**User Story:** AS 用户, I want 在设置中上传一张图片作为全局背景, so that 应用界面显示我选择的壁纸。

#### Acceptance Criteria

1. WHEN 用户在设置-主题界面点击"上传壁纸", 系统 SHALL 弹出文件选择器且仅允许选择图片类型文件。
2. WHEN 用户选择一个图片文件, 系统 SHALL 将所选图片复制到应用私有目录。
3. WHEN 图片复制成功, 系统 SHALL 将该图片设置为全局背景并立即生效。
4. WHEN 全局背景已设置, 系统 SHALL 在所有页面以 cover 模式展示该背景。
5. IF 用户取消文件选择或选择失败, 系统 SHALL 保持原有背景不变。

### Requirement 2: 文字颜色选择

**User Story:** AS 用户, I want 在设置中选择软件主文字颜色, so that 界面文字颜色符合我的偏好。

#### Acceptance Criteria

1. WHEN 用户在设置-主题界面进入文字颜色选择, 系统 SHALL 展示预设色板。
2. WHEN 用户选中一个颜色, 系统 SHALL 将该颜色作为主文字色并立即生效。
3. WHEN 文字颜色已设置, 系统 SHALL 将未显式指定颜色的文字渲染为该颜色。
4. WHILE 全局背景与文字颜色均被自定义, 系统 SHALL 同时应用两者。

### Requirement 3: 持久化

**User Story:** AS 用户, I want 壁纸与文字颜色设置被保存, so that 重启应用后设置仍然有效。

#### Acceptance Criteria

1. WHEN 用户设置壁纸或文字颜色, 系统 SHALL 将对应设置持久化保存。
2. WHEN 应用重启, 系统 SHALL 恢复已保存的壁纸与文字颜色设置。
