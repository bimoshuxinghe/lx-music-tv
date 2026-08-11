import { memo, useCallback, useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'

import Pic from './components/Pic'
import Lyric from './components/Lyric'
import Controls from './components/Controls'
import Progress from './components/Progress'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useKeyboard } from '@/utils/hooks'

export default memo(() => {
  const theme = useTheme()
  const { keyboardShown } = useKeyboard()
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const [panelWidth, setPanelWidth] = useState(0)

  const handleLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    setPanelWidth(nativeEvent.layout.width)
  }, [])

  if (autoHidePlayBar && keyboardShown) return null

  return (
    <View
      style={{ ...styles.container, backgroundColor: theme['c-content-background'] }}
      onLayout={handleLayout}
    >
      <Pic panelWidth={panelWidth} />
      <Lyric />
      <Controls />
      <Progress />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexGrow: 0,
    flexShrink: 0,
    width: '33.33%',
    paddingTop: 10,
    paddingHorizontal: 10,
    borderRightWidth: 0,
  },
})
