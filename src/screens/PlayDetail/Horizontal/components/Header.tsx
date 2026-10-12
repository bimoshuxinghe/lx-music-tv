import { FocusableTouchableOpacity as TouchableOpacity } from '@/components/tv/FocusableTouchableOpacity'
import { memo } from 'react'

import { View, StyleSheet } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { pop } from '@/navigation'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import commonState from '@/store/common/state'

export const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)

/** 顶栏：仅保留返回键（歌名/歌手已在右侧标题区展示） */
export default memo(() => {
  const back = () => {
    void pop(commonState.componentIds.playDetail!)
  }

  return (
    <View style={{ height: HEADER_HEIGHT }} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_header}>
      <View style={styles.container}>
        <TouchableOpacity onPress={back} style={{ ...styles.button, width: HEADER_HEIGHT }} focusStyle={styles.buttonFocus}>
          <Icon name="chevron-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 0,
    flexDirection: 'row',
    height: '100%',
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    flex: 0,
    borderRadius: 20,
  },
  buttonFocus: {
    borderWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ scale: 1.08 }],
  },
})
