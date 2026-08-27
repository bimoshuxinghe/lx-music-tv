import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, View } from 'react-native'
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

// 逐字卡拉OK填充（酷狗/QQ音乐式渐变扫色）：
// 双层文字叠加，底层为暗色（低透明度），顶层为亮色文字、被一个 overflow:hidden 的
// 裁切容器包裹。容器宽度随字时长从 0 → 字宽线性展开，视觉上形成从左到右的
// 颜色扫过效果。宽度是布局属性，仅支持 JS 驱动动画；同一时刻只有一个字在播放
// 动画，性能开销可忽略。
const LrcWord = memo(({ word, active, size, color, lineHeight }: LrcWordProps) => {
  const anim = useRef(new Animated.Value(0)).current
  const startedRef = useRef(false)
  const [wordWidth, setWordWidth] = useState(0)

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
        useNativeDriver: false, // width 布局属性仅支持 JS 驱动
      }).start()
    } else {
      startedRef.current = false
      anim.setValue(0)
    }
  }, [active, anim, word.duration])

  const clipWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, wordWidth],
  })

  return (
    <View style={styles.wordBox}>
      <AnimatedText
        size={size}
        color={color}
        style={{ lineHeight, opacity: INACTIVE_OPACITY }}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width
          if (w > 0 && Math.abs(w - wordWidth) > 0.5) setWordWidth(w)
        }}
      >{word.text}</AnimatedText>
      {wordWidth > 0 && (
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: clipWidth, overflow: 'hidden' }}>
          <AnimatedText size={size} color={color} style={{ lineHeight }}>{word.text}</AnimatedText>
        </Animated.View>
      )}
    </View>
  )
})

const styles = {
  wordBox: {
    height: 'auto',
  },
} as const

export default LrcWord
