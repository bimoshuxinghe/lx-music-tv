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

[Project Knowledge Summary]
- Date: 2026-08-21
- Context: Discovered by Agent while reverse-engineering wexguard OLLVM-obfuscated shell (wexguard_v7.so in spider.jar) to decrypt .guard file
- Category: Troubleshooting & Debugging
- Instructions:
  - wexguard_v7.so data segment (0xbd9c, size 0x7ec) self-decrypts via `.datadiv_decode10638385061521549500` (Thumb entry 0x1bbd, odd addr = Thumb flag); emu_start MUST use odd Thumb address (0x1bbd), even address (0x1bbc) causes unicorn to misdecode push.w and write wrong SP
  - After unicorn emulation of datadiv_decode, dump mem 0xbd9c..0xc588 reveals JNI strings: full loader flow is getLoader -> read assets/wexshinidie.guard -> decrypt -> DexClassLoader; references classes Init/InitOrigin/ProxyOrigin/DexNative (all inside shell jar, not host deps)
  - Real host-class deps confirmed: only `com.github.catvod.crawler.Spider` (provided) plus shell-internal Init; ProxyOrigin/InitOrigin/DexNative belong to shell jar itself
  - .mytext (0x5960-0x95a4) holds the OLLVM-flattened getLoader/decrypt code; fully emulating the JNI call chain (GetMethodID on android classes etc.) is high-effort
  - guard file is strong-encrypted (entropy 7.99, no dex magic), offline decrypt infeasible without running the so
  - unicorn 2.1.4 installed globally (import unicorn), capstone 5.0.9 (CS_ARCH_ARM, CS_MODE_THUMB); map so ELF LOAD segments at vaddr==offset into mem 0x0..0x20000, stack at 0x30000000 with 0x10000 size
