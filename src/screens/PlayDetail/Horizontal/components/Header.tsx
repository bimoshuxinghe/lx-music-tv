import { FocusableTouchableOpacity as TouchableOpacity } from '@/components/tv/FocusableTouchableOpacity'
import { memo } from 'react'

import {View, StyleSheet} from 'react-native'

import { Icon } from '@/components/common/Icon'
import { pop } from '@/navigation'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import Text from '@/components/common/Text'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import commonState from '@/store/common/state'

export const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)

const Title = () => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()

  return (
    <View style={styles.titleContent}>
      <Text numberOfLines={1} style={styles.title} size={17}>{musicInfo.name}</Text>
      <Text numberOfLines={1} style={styles.subTitle} size={12} color={theme['c-font-label']}>{musicInfo.singer}</Text>
    </View>
  )
}

export default memo(() => {
  const back = () => {
    void pop(commonState.componentIds.playDetail!)
  }

  return (
    <View style={{ height: HEADER_HEIGHT }} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_header}>
      <View style={styles.container}>
        <TouchableOpacity onPress={back} style={{ ...styles.button, width: HEADER_HEIGHT }} focusStyle={styles.buttonFocus}>
          <Icon name="chevron-left" size={18} />
        </TouchableOpacity>
        <Title />
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
    borderRadius: 18,
  },
  buttonFocus: {
    borderWidth: 0,
    transform: [{ scale: 1.08 }],
  },
  titleContent: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontWeight: 'bold',
  },
  subTitle: {
    marginTop: 2,
  },
  icon: {
    paddingLeft: 4,
    paddingRight: 4,
  },
})
