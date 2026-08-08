import { memo, useMemo } from 'react'
import { Text, Animated, type TextStyle } from 'react-native'
import { setSpText } from '@/utils/pixelRatio'

/**
 * 卡拉OK 逐字歌词组件
 *
 * 将文本拆为单字符，用嵌套 Animated.Text 逐字插值颜色：
 * - 字符 i 在进度 [i/n, (i+1)/n] 区间内从 inactiveColor 渐变到 activeColor
 * - 采用父 Text 嵌套子 Text 的写法，保留原生文本流的换行/居中/字距排版
 */
export interface KaraokeTextProps {
  /** 歌词文本 */
  text: string
  /** 行内点亮进度 0~1 */
  progress: Animated.Value
  /** 字号 */
  size: number
  /** 行高 */
  lineHeight?: number
  /** 对齐方式 */
  textAlign?: TextStyle['textAlign']
  /** 字体粗细 */
  fontWeight?: TextStyle['fontWeight']
  /** 未点亮颜色 */
  inactiveColor: string
  /** 点亮颜色 */
  activeColor: string
  /** 整行透明度 */
  opacity?: number
  /** 额外样式 */
  style?: TextStyle
}

const KaraokeText = ({ text, progress, size, lineHeight, textAlign, fontWeight, inactiveColor, activeColor, opacity, style }: KaraokeTextProps) => {
  const chars = useMemo(() => Array.from(text), [text])
  const n = chars.length

  const interpolations = useMemo(() => {
    if (n == 0) return []
    return chars.map((_, i) => {
      const start = i / n
      const end = (i + 1) / n
      return progress.interpolate({
        inputRange: [start, end],
        outputRange: [inactiveColor, activeColor],
        extrapolate: 'clamp',
      })
    })
  }, [chars, n, progress, inactiveColor, activeColor])

  if (n == 0) return null

  return (
    <Text
      textBreakStrategy="simple"
      style={{
        ...style,
        fontSize: setSpText(size),
        lineHeight,
        textAlign,
        fontWeight,
        opacity,
      }}
    >
      {chars.map((c, i) => (
        <Animated.Text
          key={i}
          textBreakStrategy="simple"
          style={{ color: interpolations[i] }}
        >
          {c}
        </Animated.Text>
      ))}
    </Text>
  )
}

export default memo(KaraokeText)
