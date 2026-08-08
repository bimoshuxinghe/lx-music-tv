import { useCallback, type NativeSyntheticEvent } from 'react'

const KEYCODE_DPAD_LEFT = 21
const KEYCODE_DPAD_RIGHT = 22

interface TvKeyEvent {
  keyCode: number
}

/**
 * TV 遥控器进度条 D-pad 支持
 *
 * 返回的 onKeyDown 挂载到可聚焦 View 上：
 * - 左/右方向键：步进 ±SEEK_STEP 秒，并消费事件（阻止焦点移动）
 * - 其他按键：返回 false，交还默认焦点导航
 *
 * @param durationRef 歌曲总时长 ref（保持最新）
 * @param progressRef 当前进度 ref（0~1）
 */
export const useTvSeek = (
  durationRef: React.RefObject<number>,
  progressRef: React.RefObject<number>,
  seekStep = 10,
) => {
  return useCallback((e: NativeSyntheticEvent<TvKeyEvent>) => {
    const keyCode = e.nativeEvent.keyCode
    if (keyCode != KEYCODE_DPAD_LEFT && keyCode != KEYCODE_DPAD_RIGHT) return false
    const duration = durationRef.current || 0
    const current = (progressRef.current || 0) * duration
    const target = keyCode == KEYCODE_DPAD_LEFT
      ? Math.max(0, current - seekStep)
      : Math.min(duration || current, current + seekStep)
    global.app_event.setProgress(target)
    return true
  }, [seekStep])
}
