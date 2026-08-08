import { memo, useCallback, useEffect, useRef } from 'react'
import { View } from 'react-native'

import Slider, { type SliderProps as _SliderProps } from '@react-native-community/slider'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'

const KEYCODE_DPAD_LEFT = 21
const KEYCODE_DPAD_RIGHT = 22

export type SliderProps = Pick<_SliderProps,
'value'
| 'minimumValue'
| 'maximumValue'
| 'onSlidingStart'
| 'onSlidingComplete'
| 'onValueChange'
| 'step'
>

export default memo(({ value, minimumValue, maximumValue, onSlidingStart, onSlidingComplete, onValueChange, step }: SliderProps) => {
  const theme = useTheme()

  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])

  const handleValueChange = (value: number) => {
    // 修复当value小于等于minimumValue时，首次调用会传入0的问题
    if (onValueChange && minimumValue != null) onValueChange(Math.max(value, minimumValue))
  }

  // TV 遥控器：左右方向键按 step 步进滑块
  const handleKeyDown = useCallback((e: { nativeEvent: { keyCode: number } }) => {
    const keyCode = e.nativeEvent.keyCode
    if (keyCode != KEYCODE_DPAD_LEFT && keyCode != KEYCODE_DPAD_RIGHT) return false
    const min = minimumValue ?? 0
    const max = maximumValue ?? 1
    const stepValue = step ?? 1
    let newValue = valueRef.current
    newValue += keyCode == KEYCODE_DPAD_RIGHT ? stepValue : -stepValue
    newValue = Math.min(max, Math.max(min, newValue))
    if (newValue == valueRef.current) return true
    valueRef.current = newValue
    onSlidingStart?.(newValue)
    onValueChange?.(newValue)
    onSlidingComplete?.(newValue)
    return true
  }, [minimumValue, maximumValue, step, onSlidingStart, onValueChange, onSlidingComplete])

  return (
    <View focusable={true} onKeyDown={handleKeyDown as any} style={styles.focusArea}>
      <Slider
        value={value}
        style={styles.slider}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        minimumTrackTintColor={theme['c-primary-alpha-500']}
        maximumTrackTintColor={theme['c-primary-alpha-500']}
        thumbTintColor={theme['c-primary']}
        onSlidingStart={onSlidingStart}
        onSlidingComplete={onSlidingComplete}
        onValueChange={handleValueChange}
        step={step}
        focusable={false}
      />
    </View>
  )
})


const styles = createStyle({
  focusArea: {
    flexShrink: 0,
    flexGrow: 1,
    justifyContent: 'center',
  },
  slider: {
    flexShrink: 0,
    flexGrow: 1,
    // width: '100%',
    // maxWidth: 300,
    height: 40,
    // backgroundColor: '#eee',
  },
})
