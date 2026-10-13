import { forwardRef, useState, useMemo, useRef, useEffect } from 'react'
import {
  TouchableOpacity,
  Animated,
  type TouchableOpacityProps,
  type ViewStyle,
  StyleSheet,
} from 'react-native'
import { useTheme } from '@/store/theme/hook'

export interface FocusableTouchableOpacityProps extends TouchableOpacityProps {
  /** 是否在屏幕出现时自动获取焦点（Android TV 专用） */
  hasTVPreferredFocus?: boolean
  /** 聚焦时附加的样式（覆盖默认高亮；其中 transform scale 会被并入缩放动画） */
  focusStyle?: ViewStyle
  /** 是否允许通过 D-pad 导航聚焦（默认 true） */
  focusable?: boolean
  /** 原生视图 ID（TouchableOpacityProps 未声明，这里补充以支持 tv_no_focus_highlight_ 前缀） */
  nativeID?: string
}

const DEFAULT_SCALE = 1.06

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity)

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
 * TV 遥控器可聚焦的 TouchableOpacity（焦点背景高亮）
 *
 * - 默认 focusable，D-pad 可导航，OK 键触发 onPress
 * - 聚焦时：弹性放大 + 背景高亮填充（不再绘制边框描线）
 * - 背景色：focusStyle 指定则用之，未指定用主题色淡填充；
 *   显式传 'transparent' 表示该元素无需任何高亮（如全屏透明焦点锚点）
 * - 完全兼容 TouchableOpacity 的 API（onPress/onLongPress/activeOpacity/ref 等）
 * - ref 支持 measure（与原生 TouchableOpacity 一致）
 */
const FocusableTouchableOpacity = forwardRef<TouchableOpacity, FocusableTouchableOpacityProps>(({
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
    const fs = stripScale(focusStyle) ?? {}
    // 焦点 = 背景高亮（不是边框）：focusStyle 未给背景时用主题色淡填充
    const background = fs.backgroundColor === 'transparent'
      ? 'transparent'
      : (fs.backgroundColor ?? theme['c-primary-light-100-alpha-800'])
    return {
      elevation: 6,
      zIndex: 100,
      ...fs,
      backgroundColor: background,
      borderWidth: 0,
    }
  }, [isFocused, theme, focusStyle])

  const Comp = AnimatedTouchableOpacity as any
  return (
    <Comp
      ref={ref}
      hasTVPreferredFocus={hasTVPreferredFocus}
      nativeID={nativeID}
      style={StyleSheet.compose(style, [
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

FocusableTouchableOpacity.displayName = 'FocusableTouchableOpacity'

export { FocusableTouchableOpacity }
export default FocusableTouchableOpacity
