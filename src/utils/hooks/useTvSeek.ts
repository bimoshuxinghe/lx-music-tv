import { useCallback } from 'react'
import { useTvAdjustable } from './useTvAdjustable'

/**
 * TV 遥控器进度条 D-pad 支持
 *
 * 返回唯一 nativeID，挂载到可聚焦 View（进度条区域）上：
 * - 原生侧拦截 D-pad 左右方向键，聚焦时消费事件并转发到 JS
 * - 收到左/右方向键：步进 ±SEEK_STEP 秒（基于最新的进度与总时长 ref）
 *
 * @param durationRef 歌曲总时长 ref（保持最新）
 * @param progressRef 当前进度 ref（0~1）
 */
export const useTvSeek = (
  durationRef: React.RefObject<number>,
  progressRef: React.RefObject<number>,
  seekStep = 10,
) => {
  const handleStep = useCallback((step: 1 | -1) => {
    const duration = durationRef.current ?? 0
    const current = (progressRef.current ?? 0) * duration
    const target = step < 0
      ? Math.max(0, current - seekStep)
      : Math.min(duration || current, current + seekStep)
    global.app_event.setProgress(target)
  }, [durationRef, progressRef, seekStep])

  return useTvAdjustable(handleStep)
}
