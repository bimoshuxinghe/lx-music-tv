import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { PanResponder, View } from 'react-native'
import { useProgress } from '@/store/player/hook'
import { useBufferProgress } from '@/plugins/player'
import { useTvSeek } from '@/utils/hooks/useTvSeek'
import { createStyle } from '@/utils/tools'

/**
 * 波形进度条（播放页底部）
 *
 * - 波形高度是固定装饰纹理（伪随机），已播/缓冲/未播三态严格跟随真实进度
 * - 触摸拖动定位（PanResponder）、TV 遥控器左右键 ±10s（useTvSeek）
 * - 进度滑块跟随进度移动，聚焦时整条高亮
 */

const BAR_COUNT = 76

const BAR_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const v = Math.sin(i * 0.55) * 0.5 + Math.sin(i * 1.73 + 1.3) * 0.32 + Math.sin(i * 3.11 + 0.7) * 0.18
  return Math.min(1, Math.max(0.2, 0.56 + v * 0.4))
})

const COLOR_FILLED = '#FFFFFF'
const COLOR_BUFFERED = 'rgba(255,255,255,0.5)'
const COLOR_REST = 'rgba(255,255,255,0.22)'

export default memo(() => {
  const { progress, maxPlayTime } = useProgress()
  const buffered = useBufferProgress()
  const [focused, setFocused] = useState(false)
  const durationRef = useRef(maxPlayTime)
  durationRef.current = maxPlayTime
  const progressRef = useRef(progress)
  progressRef.current = progress
  const widthRef = useRef(1)

  const nativeID = useTvSeek(durationRef, progressRef)

  const onSetProgress = useCallback((ratio: number) => {
    const r = Math.max(0, Math.min(1, ratio))
    global.app_event.setProgress(r * durationRef.current)
  }, [])

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: (evt) => {
      onSetProgress(evt.nativeEvent.locationX / widthRef.current)
    },
    onPanResponderMove: (evt) => {
      onSetProgress(evt.nativeEvent.locationX / widthRef.current)
    },
  })).current

  // 三态分界（用下标缓存，避免每次进度变化重建 76 个样式对象）
  const filledIdx = Math.floor(progress * BAR_COUNT)
  const bufferedIdx = Math.floor(buffered * BAR_COUNT)
  const barColors = useMemo(() => BAR_HEIGHTS.map((_, i) => (
    i <= filledIdx ? COLOR_FILLED : i <= bufferedIdx ? COLOR_BUFFERED : COLOR_REST
  )), [filledIdx, bufferedIdx])

  return (
    <View
      style={[styles.wrap, focused && styles.wrapFocus]}
      onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width || 1 }}
      {...panResponder.panHandlers}
    >
      <View style={styles.bars}>
        {BAR_HEIGHTS.map((h, i) => (
          <View key={i} style={{ flex: 1, height: `${h * 100}%`, marginHorizontal: 1, borderRadius: 1.5, backgroundColor: barColors[i] }} />
        ))}
      </View>
      <View style={[styles.knob, { left: `${progress * 100}%` }]} pointerEvents="none" />
      {/* TV 遥控器：进度条可聚焦，左右方向键步进 */}
      <View
        nativeID={nativeID}
        focusable={true}
        onFocus={() => { setFocused(true) }}
        onBlur={() => { setFocused(false) }}
        style={styles.keyArea}
      />
    </View>
  )
})

const styles = createStyle({
  wrap: {
    height: 40,
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  wrapFocus: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  bars: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  knob: {
    position: 'absolute',
    top: '50%',
    width: 13,
    height: 13,
    marginLeft: -6.5,
    marginTop: -6.5,
    borderRadius: 6.5,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  keyArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
})
