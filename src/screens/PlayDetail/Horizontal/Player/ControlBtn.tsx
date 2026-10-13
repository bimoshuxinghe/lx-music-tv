import { FocusableTouchableOpacity as TouchableOpacity } from '@/components/tv/FocusableTouchableOpacity'
import { StyleSheet, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useIsPlay } from '@/store/player/hook'
import { useLayout } from '@/utils/hooks'
import { marginLeft } from '../constant'
import { BTN_WIDTH } from '../MoreBtn/Btn'

/**
 * 圆形控制按钮：淡底圆钮 + 主题色实心播放键，聚焦为背景高亮
 */
const CtrlBtn = ({ size, icon, primary, onPress }: {
  size: number
  icon: 'prevMusic' | 'play' | 'pause' | 'nextMusic'
  primary?: boolean
  onPress: () => void
}) => {
  const theme = useTheme()
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      onPress={onPress}
      style={{
        ...styles.btn,
        width: size,
        height: size,
        borderRadius: size / 2,
        ...(primary ? { backgroundColor: theme['c-primary'] } : {}),
      }}
      focusStyle={styles.btnFocus}
    >
      <Icon
        name={icon}
        color={primary ? '#FFFFFF' : theme['c-button-font']}
        rawSize={size * (primary ? 0.5 : 0.46)}
      />
    </TouchableOpacity>
  )
}

const MIN_SIZE = BTN_WIDTH * 1.35
export default () => {
  const { onLayout, height, width } = useLayout()
  const isPlay = useIsPlay()
  const size = Math.max(Math.min(height * 0.72, (width - marginLeft) * 0.52 * 0.32) * global.lx.fontSize, MIN_SIZE)
  return (
    <View style={{ ...styles.content, gap: size * 0.45 }} onLayout={onLayout}>
      <CtrlBtn size={size} icon="prevMusic" onPress={() => { void playPrev() }} />
      <CtrlBtn size={size * 1.22} icon={isPlay ? 'pause' : 'play'} primary onPress={() => { void togglePlay() }} />
      <CtrlBtn size={size} icon="nextMusic" onPress={() => { void playNext() }} />
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(127,127,127,0.14)',
  },
  btnFocus: {
    borderWidth: 0,
    transform: [{ scale: 1.1 }],
  },
})
