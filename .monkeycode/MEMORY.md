# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[User Instruction: 推送前等待用户确认]
- Date: 2026-08-26
- Context: 用户反馈代码修改后自动推送和触发CI太频繁
- Instructions:
  - 代码改完后只提交到本地git，不自动push
  - 等待用户明确确认后再推送和触发CI构建
  - 避免过度积极的自动推送行为

[Project Knowledge: Android 6 MultiDex 修复]
- Date: 2026-09-12
- Context: 发现 android.graphics.ColorSpace NoClassDefFoundError 崩溃并修复
- Category: Troubleshooting & Debugging
- Instructions:
  - androidx.multidex:multidex:2.0.1 依赖已加入 android/app/build.gradle
  - MainApplication.java 需重写 attachBaseContext() 调用 MultiDex.install(this)
  - 原因：react-native-navigation 传递依赖 Fresco，Fresco 2.x 使用 ColorSpace（API 26+），Android 6/7 崩溃
  - 修复后需重新构建 APK 验证
