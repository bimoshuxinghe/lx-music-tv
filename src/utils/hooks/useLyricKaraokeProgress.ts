import { useEffect, useRef } from 'react'
import { Animated } from 'react-native'
import type { Lines } from 'lrc-file-parser'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'

/**
 * 卡拉OK 逐字歌词进度 hook
 *
 * 基于播放器实时进度（nowPlayTime，秒）与本地时钟做平滑推算，
 * 通过 requestAnimationFrame 每帧更新，返回 0~1 的 Animated.Value，
 * 表示当前歌词行内的逐字点亮进度。
 *
 * @param lines 歌词行数组
 * @param line 当前激活的行号
 */
export const useLyricKaraokeProgress = (lines: Lines, line: number) => {
  const progress = useRef(new Animated.Value(0)).current
  const infoRef = useRef({ startTime: 0, duration: 4000 })

  // 行切换时更新起止时间信息（time 单位：毫秒）
  useEffect(() => {
    const startTime = lines[line]?.time ?? 0
    const nextTime = lines[line + 1]?.time
    const duration = nextTime && nextTime > startTime ? nextTime - startTime : 4000
    infoRef.current = { startTime, duration }
    progress.setValue(0)
  }, [lines, line, progress])

  useEffect(() => {
    let rafId = 0
    let lastWall = Date.now()
    let basePos = playerState.progress.nowPlayTime
    let lastP = -1

    const loop = () => {
      const now = Date.now()
      if (playerState.isPlay) {
        const rate = settingState.setting['player.playbackRate']
        basePos += ((now - lastWall) / 1000) * rate
      }
      lastWall = now
      // 与播放器真实进度对齐，防止长时间漂移
      if (Math.abs(basePos - playerState.progress.nowPlayTime) > 0.3) {
        basePos = playerState.progress.nowPlayTime
      }

      const { startTime, duration } = infoRef.current
      let p = 0
      if (duration > 0) {
        p = Math.min(1, Math.max(0, (basePos * 1000 - startTime) / duration))
      }
      if (Math.abs(p - lastP) > 0.0001) {
        lastP = p
        progress.setValue(p)
      }
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [progress])

  return progress
}
