import { memo, useMemo } from 'react'
import { View } from 'react-native'
import { useLrcPlay } from '@/plugins/lyric'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'

const getFontInfo = (len: number) => {
  if (len <= 8) return { fontSize: 21, lines: 2 }
  if (len <= 16) return { fontSize: 18, lines: 3 }
  if (len <= 26) return { fontSize: 16, lines: 4 }
  return { fontSize: 14, lines: 4 }
}

export default memo(() => {
  const theme = useTheme()
  const { text } = useLrcPlay()
  const musicInfo = usePlayerMusicInfo()

  const lyricText = text || (musicInfo.id ? musicInfo.name : '')

  const fontInfo = useMemo(() => getFontInfo(lyricText.length), [lyricText])

  return (
    <View style={styles.container}>
      <Text
        style={styles.text}
        size={fontInfo.fontSize}
        numberOfLines={fontInfo.lines}
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
    overflow: 'hidden',
  },
  text: {
    textAlign: 'center',
  },
})
