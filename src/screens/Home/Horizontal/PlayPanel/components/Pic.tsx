import { memo, useCallback } from 'react'
import { View } from 'react-native'
import { FocusableTouchableOpacity as TouchableOpacity } from '@/components/tv/FocusableTouchableOpacity'
import { navigations } from '@/navigation'
import { usePlayerMusicInfo } from '@/store/player/hook'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'
import { LIST_IDS } from '@/config/constant'
import Image from '@/components/common/Image'
import { setLoadErrorPicUrl, setMusicInfo } from '@/core/player/playInfo'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'

const PIC_MARGIN = 4

export default memo(({ panelWidth }: { panelWidth: number }) => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()

  const imgWidth = panelWidth > 0 ? Math.round(panelWidth * 0.86) : 0

  const handlePress = () => {
    if (!musicInfo.id) return
    navigations.pushPlayDetailScreen(commonState.componentIds.home!)
  }

  const handleLongPress = () => {
    const listId = playerState.playMusicInfo.listId
    if (!listId || listId == LIST_IDS.DOWNLOAD) return
    global.app_event.jumpListPosition()
  }

  const handleError = useCallback((url: string | number) => {
    setLoadErrorPicUrl(url as string)
    setMusicInfo({ pic: null })
  }, [])

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={{ ...styles.imageWrap, borderColor: theme['c-primary-light-200-alpha-400'] }}
        onLongPress={handleLongPress}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {
          imgWidth > 0
            ? (
                <Image
                  url={musicInfo.pic}
                  style={{ width: imgWidth, height: imgWidth, borderRadius: 4 }}
                  onError={handleError}
                />
              )
            : null
        }
      </TouchableOpacity>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexShrink: 0,
    flexGrow: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: PIC_MARGIN,
  },
  imageWrap: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 4,
  },
})
