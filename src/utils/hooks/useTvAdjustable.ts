import { useEffect, useRef } from 'react'
import { DeviceEventEmitter } from 'react-native'

const KEYCODE_DPAD_LEFT = 21
const KEYCODE_DPAD_RIGHT = 22

/** 原生侧（MainActivity.java）用于识别可调节控件的 nativeID 前缀 */
export const TV_ADJUSTABLE_PREFIX = 'tv_adjustable_'

let nativeIdCounter = 0

/**
 * TV 遥控器可调节控件 Hook（滑块 / 进度条）
 *
 * RN 0.73 的 View 组件不支持 onKeyDown，D-pad 按键由原生侧
 * （MainActivity.java）在 onKeyDown 中拦截：当焦点位于带
 * `tv_adjustable_` 前缀 nativeID 的 View 内时，消费事件并通过
 * "tvRemoteKey" DeviceEvent 转发到 JS。
 *
 * 本 Hook 生成唯一 nativeID 并监听 tvRemoteKey，仅当事件的
 * nativeId 与自身匹配时回调 onStep：
 * - 左方向键：onStep(-1)
 * - 右方向键：onStep(1)
 *
 * @param onStep 步进回调，参数为方向（-1 左 / 1 右）
 * @returns 唯一 nativeID，挂载到可聚焦 View 上
 */
export const useTvAdjustable = (onStep: (step: 1 | -1) => void) => {
  const nativeIDRef = useRef<string | null>(null)
  if (nativeIDRef.current === null) {
    nativeIDRef.current = `${TV_ADJUSTABLE_PREFIX}${++nativeIdCounter}`
  }
  const nativeID = nativeIDRef.current
  const onStepRef = useRef(onStep)
  onStepRef.current = onStep

  useEffect(() => {
    const listener = DeviceEventEmitter.addListener('tvRemoteKey', (event: { keyCode?: number, nativeId?: string } | null) => {
      if (!event || event.nativeId != nativeID) return
      if (event.keyCode == KEYCODE_DPAD_LEFT) {
        onStepRef.current(-1)
      } else if (event.keyCode == KEYCODE_DPAD_RIGHT) {
        onStepRef.current(1)
      }
    })
    return () => {
      listener.remove()
    }
  }, [nativeID])

  return nativeID
}
