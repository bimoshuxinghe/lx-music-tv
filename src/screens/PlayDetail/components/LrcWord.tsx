import { memo, useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import { type Word } from '@/plugins/lyric'
import { AnimatedText } from '@/components/common/Text'

interface LrcWordProps {
  word: Word
  active: boolean
  size: number
  color: string
  lineHeight: number
}

const INACTIVE_OPACITY = 0.35
const MIN_DURATION = 120
const MAX_DURATION = 800

// 逐字高亮：每个字独立动画，opacity 由原生 UI 线程驱动（useNativeDriver），
// 点亮时长跟随字时长（短字快、长字慢），实现卡拉OK式平滑渐亮，不占用 JS 帧。
const LrcWord = memo(({ word, active, size, color, lineHeight }: LrcWordProps) => {
  const anim = useRef(new Animated.Value(0)).current
  const startedRef = useRef(false)

  useEffect(() => {
    if (active) {
      if (startedRef.current) return
      startedRef.current = true
      const duration = word.duration > 0
        ? Math.min(Math.max(word.duration, MIN_DURATION), MAX_DURATION)
        : 300
      Animated.timing(anim, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start()
    } else {
      startedRef.current = false
      anim.setValue(0)
    }
  }, [active, anim, word.duration])

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [INACTIVE_OPACITY, 1],
  })

  return (
    <AnimatedText size={size} color={color} style={{ lineHeight, opacity }}>{word.text}</AnimatedText>
  )
})

export default LrcWord
