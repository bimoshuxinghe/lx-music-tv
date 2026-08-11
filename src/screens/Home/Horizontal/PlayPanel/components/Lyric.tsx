import { memo } from 'react'
import { View } from 'react-native'
import { useLrcPlay } from '@/plugins/lyric'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'

export default memo(() => {
  const theme = useTheme()
  const { text } = useLrcPlay()
  const musicInfo = usePlayerMusicInfo()

  const lyricText = text || (musicInfo.id ? musicInfo.name : '')

  return (
    <View style={styles.container}>
      <Text
        style={styles.text}
        size={24}
        numberOfLines={3}
        color={theme['c-font-label']}
        textBreakStrategy="simple"
      >
        {lyricText}
      </Text>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexShrink: 1,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  text: {
    textAlign: 'center',
    lineHeight: 34,
  },
})
