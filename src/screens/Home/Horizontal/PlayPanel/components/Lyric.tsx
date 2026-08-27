import { memo, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useLrcPlay, useLrcSet, useLrcWords } from '@/plugins/lyric'
import { getPosition } from '@/plugins/player'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import Text from '@/components/common/Text'
import LrcWord from '@/screens/PlayDetail/components/LrcWord'
import { LRC_ACTIVE_COLORS } from '@/screens/PlayDetail/components/lrcColor'
import { createStyle } from '@/utils/tools'

const getFontInfo = (len: number) => {
  if (len <= 8) return { fontSize: 21, lines: 2 }
  if (len <= 16) return { fontSize: 18, lines: 3 }
  if (len <= 26) return { fontSize: 16, lines: 4 }
  return { fontSize: 14, lines: 4 }
}

export default memo(() => {
  const theme = useTheme()
  const { line: activeLine, text } = useLrcPlay()
  const lines = useLrcSet()
  const wordLinesMap = useLrcWords()
  const musicInfo = usePlayerMusicInfo()
  const lrcColor = useSettingValue('playDetail.style.lrcColor')

  const lyricText = text || (musicInfo.id ? musicInfo.name : '')

  const fontInfo = useMemo(() => getFontInfo(lyricText.length), [lyricText])

  // 逐字歌词：与全屏播放歌词一致，按当前行时间取逐字数据
  const currentLine = lines[activeLine]
  const words = text && currentLine ? wordLinesMap.get(currentLine.time) : undefined

  // 行内播放进度轮询，与全屏逐字歌词完全一致（50ms）
  const [wordProgress, setWordProgress] = useState(0)
  useEffect(() => {
    if (!words?.length) return
    const lineTime = currentLine.time
    let cancelled = false
    const update = async() => {
      try {
        const pos = await getPosition()
        if (cancelled || pos == null) return
        setWordProgress(Math.max(pos * 1000 - lineTime, 0))
      } catch {}
    }
    void update()
    const timer = setInterval(update, 50)
    return () => { cancelled = true; clearInterval(timer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, currentLine])

  // 高亮颜色沿用全屏播放歌词（设置里的逐字歌词颜色）
  const highlightColor = LRC_ACTIVE_COLORS[lrcColor] ?? theme['c-primary']

  return (
    <View style={styles.container}>
      {words?.length ? (
        <View style={styles.wordLine}>
          {words.map((w, i) => (
            <LrcWord key={i} word={w} active={wordProgress >= w.time} size={fontInfo.fontSize} color={highlightColor} lineHeight={Math.round(fontInfo.fontSize * 1.4)} />
          ))}
        </View>
      ) : (
        <Text
          style={styles.text}
          size={fontInfo.fontSize}
          numberOfLines={fontInfo.lines}
          color={theme['c-font']}
          textBreakStrategy="simple"
        >
          {lyricText}
        </Text>
      )}
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
    fontWeight: 'bold',
  },
  wordLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    fontWeight: 'bold',
  },
})
