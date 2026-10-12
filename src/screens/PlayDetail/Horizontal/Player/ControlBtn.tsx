import { FocusableTouchableOpacity as TouchableOpacity } from '@/components/tv/FocusableTouchableOpacity'
import { StyleSheet, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useIsPlay } from '@/store/player/hook'
import { useLayout } from '@/utils/hooks'
import { marginLeft } from '../constant'
import { BTN_WIDTH } from '../MoreBtn/Btn'

/**
 * 底部播控按钮：白色裸图标（参考主流播放器），播放键更大；
 * 聚焦时为圆角胶囊背景高亮
 */
const CtrlBtn = ({ size, icon, onPress }: {
  size: number
  icon: 'prevMusic' | 'play' | 'pause' | 'nextMusic'
  onPress: () => void
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      onPress={onPress}
      style={{ ...styles.btn, width: size * 1.3, height: size, borderRadius: size * 0.5 }}
      focusStyle={styles.btnFocus}
    >
      <Icon name={icon} color="#FFFFFF" rawSize={size * 0.62} />
    </TouchableOpacity>
  )
}

const MIN_SIZE = BTN_WIDTH * 1.5
export default () => {
  const { onLayout, height, width } = useLayout()
  const isPlay = useIsPlay()
  const size = Math.max(Math.min(height * 0.9, (width - marginLeft) * 0.5) * global.lx.fontSize, MIN_SIZE)
  return (
    <View style={{ ...styles.content, gap: size * 0.35 }} onLayout={onLayout}>
      <CtrlBtn size={size} icon="prevMusic" onPress={() => { void playPrev() }} />
      <CtrlBtn size={size * 1.35} icon={isPlay ? 'pause' : 'play'} onPress={() => { void togglePlay() }} />
      <CtrlBtn size={size} icon="nextMusic" onPress={() => { void playNext() }} />
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnFocus: {
    borderWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
    transform: [{ scale: 1.08 }],
  },
})
