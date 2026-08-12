import { memo, useMemo } from 'react'
import { View } from 'react-native'
import { FocusableTouchableOpacity as TouchableOpacity } from '@/components/tv/FocusableTouchableOpacity'
import { IconMaterial as Icon } from '@/components/common/Icon'
import { useIsPlay } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { toast, createStyle } from '@/utils/tools'
import { MUSIC_TOGGLE_MODE, MUSIC_TOGGLE_MODE_LIST } from '@/config/constant'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'

const BTN_SIZE = 30
const BTN_WH = 52

const PlayPrevBtn = () => {
  const theme = useTheme()
  return (
    <TouchableOpacity style={styles.cotrolBtn} activeOpacity={0.5} onPress={() => { void playPrev() }}>
      <Icon name="skip-previous" color={theme['c-button-font']} size={BTN_SIZE} />
    </TouchableOpacity>
  )
}

const PlayNextBtn = () => {
  const theme = useTheme()
  return (
    <TouchableOpacity style={styles.cotrolBtn} activeOpacity={0.5} onPress={() => { void playNext() }}>
      <Icon name="skip-next" color={theme['c-button-font']} size={BTN_SIZE} />
    </TouchableOpacity>
  )
}

const TogglePlayBtn = () => {
  const isPlay = useIsPlay()
  const theme = useTheme()
  return (
    <TouchableOpacity style={styles.cotrolBtn} activeOpacity={0.5} onPress={togglePlay}>
      <Icon name={isPlay ? 'pause-circle-filled' : 'play-circle-filled'} color={theme['c-button-font']} size={BTN_SIZE + 8} />
    </TouchableOpacity>
  )
}

const PlayModeBtn = memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const togglePlayMethod = useSettingValue('player.togglePlayMethod')

  const handlePress = () => {
    let index = MUSIC_TOGGLE_MODE_LIST.indexOf(togglePlayMethod)
    if (++index >= MUSIC_TOGGLE_MODE_LIST.length) index = 0
    const mode = MUSIC_TOGGLE_MODE_LIST[index]
    updateSetting({ 'player.togglePlayMethod': mode })
    let modeName: 'play_list_loop' | 'play_list_random' | 'play_list_order' | 'play_single_loop' | 'play_single'
    switch (mode) {
      case MUSIC_TOGGLE_MODE.listLoop:
        modeName = 'play_list_loop'
        break
      case MUSIC_TOGGLE_MODE.random:
        modeName = 'play_list_random'
        break
      case MUSIC_TOGGLE_MODE.list:
        modeName = 'play_list_order'
        break
      case MUSIC_TOGGLE_MODE.singleLoop:
        modeName = 'play_single_loop'
        break
      default:
        modeName = 'play_single'
        break
    }
    toast(t(modeName))
  }

  const playModeIcon = useMemo(() => {
    switch (togglePlayMethod) {
      case MUSIC_TOGGLE_MODE.listLoop:
        return 'repeat'
      case MUSIC_TOGGLE_MODE.random:
        return 'shuffle'
      case MUSIC_TOGGLE_MODE.list:
        return 'format-list-numbered'
      case MUSIC_TOGGLE_MODE.singleLoop:
        return 'repeat-one'
      default:
        return 'music-note'
    }
  }, [togglePlayMethod])

  return (
    <TouchableOpacity style={styles.cotrolBtn} activeOpacity={0.5} onPress={handlePress}>
      <Icon name={playModeIcon} color={theme['c-button-font']} size={BTN_SIZE - 2} />
    </TouchableOpacity>
  )
})

export default memo(() => {
  return (
    <View style={styles.container}>
      <PlayPrevBtn />
      <TogglePlayBtn />
      <PlayNextBtn />
      <PlayModeBtn />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexShrink: 0,
    flexGrow: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 12,
  },
  cotrolBtn: {
    width: BTN_WH,
    height: BTN_WH,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
})
