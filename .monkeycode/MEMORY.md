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

[Project Knowledge Summary]
- Date: 2026-08-10
- Context: Discovered by Agent while fixing TV remote D-pad control for sliders/progress bar on lx-music-tv
- Category: Troubleshooting & Debugging
- Instructions:
  - RN 0.73's View component does NOT support onKeyDown/onKeyUp/onKeyPress props; D-pad handling for TV must be done in native MainActivity.onKeyDown interception + "tvRemoteKey" DeviceEvent forwarding to JS
  - View's `nativeID` prop maps to Android tag `com.facebook.react.R.id.view_tag_native_id`, letting native code locate JS controls via ancestor-chain tag lookup or ReactFindViewUtil.findView
  - RN's built-in Modal/Dialog only intercepts BACK/ESCAPE keys; other keys (D-pad/OK) propagate to the host Activity.onKeyDown, so Activity-level interception also covers controls inside Modals/Popups
  - react-native-navigation auto-cleans `componentIds` on pop via registerScreenPoppedListener, so Home backAction can read `commonState.componentIds.playDetail` to detect whether play detail is on top
  - Focus events (onFocus/onBlur) only exist at Touchable/Pressability level in RN 0.73, not on plain View

[Project Knowledge Summary]
- Date: 2026-08-10
- Context: Discovered by Agent while verifying build for the TV D-pad fixes on lx-music-tv
- Category: Build Methods
- Instructions:
  - Local environment has NO JDK/Android SDK; Java/native changes must be verified by GitHub Actions (gradle assembleRelease) after push, while JS changes can be locally verified with `npx react-native bundle --platform android --dev true --entry-file index.js --bundle-output index.android.bundle --assets-dest res`
  - CI only runs gradle assembleRelease (no eslint/tsc gate); eslint passes separately, and tsc has pre-existing errors in unrelated files
