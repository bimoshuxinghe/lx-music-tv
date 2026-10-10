import { forwardRef, useState, useMemo, useRef, useEffect } from 'react'
import {
  Pressable,
  Animated,
  type PressableProps,
  type ViewStyle,
  type View,
  StyleSheet,
} from 'react-native'
import { useTheme } from '@/store/theme/hook'

export interface FocusablePressableProps extends PressableProps {
  hasTVPreferredFocus?: boolean
  /** 聚焦时附加的样式（覆盖默认高亮；其中 transform scale 会被并入缩放动画） */
  focusStyle?: ViewStyle
  /** 是否允许通过 D-pad 导航聚焦（默认 true） */
  focusable?: boolean
  /** 原生视图 ID */
  nativeID?: string
}

const DEFAULT_SCALE = 1.06

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const extractScale = (style?: ViewStyle): number => {
  if (!style?.transform) return 1
  let scale = 1
  for (const t of style.transform as unknown as Array<Record<string, unknown>>) {
    if (typeof t.scale == 'number') scale = t.scale
  }
  return scale
}

const stripScale = (style?: ViewStyle): ViewStyle | undefined => {
  if (!style) return undefined
  if (!style.transform) return style
  const rest = (style.transform as unknown as Array<Record<string, unknown>>).filter(t => !('scale' in t))
  const next = { ...style }
  if (rest.length > 0) {
    next.transform = rest as unknown as ViewStyle['transform']
  } else {
    delete next.transform
  }
  return next
}

/**
 * TV 遥控器可聚焦的 Pressable（酷狗TV风格焦点效果）
 *
 * - 聚焦时：弹性放大 + 原生焦点前景框（tv_focus_selector 描边）+ 主题色淡填充
 * - 边框由原生前景选择器绘制，JS 侧只负责缩放与淡填充，避免焦点框消失/叠加
 * - 完全兼容 Pressable API
 */
const FocusablePressable = forwardRef<View, FocusablePressableProps>(({
  style,
  focusStyle,
  hasTVPreferredFocus,
  focusable = true,
  nativeID,
  onFocus,
  onBlur,
  children,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false)
  const theme = useTheme()
  const scale = useRef(new Animated.Value(1)).current

  const focusScale = useMemo(() => extractScale(focusStyle), [focusStyle])

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isFocused ? focusScale || DEFAULT_SCALE : 1,
      useNativeDriver: true,
      speed: 28,
      bounciness: 5,
    }).start()
  }, [isFocused, focusScale, scale])

  const handleFocus = (e: any) => {
    setIsFocused(true)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    onFocus?.(e)
  }
  const handleBlur = (e: any) => {
    setIsFocused(false)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    onBlur?.(e)
  }

  const focusedVisual = useMemo<ViewStyle | null>(() => {
    if (!isFocused) return null
    return {
      backgroundColor: theme['c-primary-light-100-alpha-800'],
      elevation: 6,
      zIndex: 100,
      ...stripScale(focusStyle),
    }
  }, [isFocused, theme, focusStyle])

  const Comp = AnimatedPressable as any
  // Pressable style 可以是函数，需要先解析
  const resolvedStyle = typeof style === 'function' ? style({pressed: false}) : style
  return (
    <Comp
      ref={ref}
      hasTVPreferredFocus={hasTVPreferredFocus}
      nativeID={nativeID}
      style={StyleSheet.compose(resolvedStyle, [
        { transform: [{ scale }] },
        focusedVisual,
      ])}
      onFocus={handleFocus as any}
      onBlur={handleBlur as any}
      {...props}
      focusable={focusable}
    >
      {children}
    </Comp>
  )
})

FocusablePressable.displayName = 'FocusablePressable'

export { FocusablePressable }
export default FocusablePressable
