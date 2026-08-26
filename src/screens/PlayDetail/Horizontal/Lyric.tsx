import { memo, useMemo, useEffect, useRef, useCallback, useState } from 'react'
import { View, FlatList, Animated, Easing, type FlatListProps, type NativeSyntheticEvent, type NativeScrollEvent, type LayoutChangeEvent } from 'react-native'
// import { useLayout } from '@/utils/hooks'
import { type Line, type Word, useLrcPlay, useLrcSet, useLrcWords } from '@/plugins/lyric'
import { getPosition } from '@/plugins/player'
import { createStyle } from '@/utils/tools'
// import { useComponentIds } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { AnimatedColorText } from '@/components/common/Text'
import LrcWord from '../components/LrcWord'
import { setSpText } from '@/utils/pixelRatio'
import playerState from '@/store/player/state'
import { scrollTo } from '@/utils/scroll'
import PlayLine, { type PlayLineType } from '../components/PlayLine'
import { LRC_ACTIVE_COLORS } from '../components/lrcColor'
// import { screenkeepAwake } from '@/utils/nativeModules/utils'
// import { log } from '@/utils/log'
// import { toast } from '@/utils/tools'

type FlatListType = FlatListProps<Line>

type LrcAnimatedStyle = LX.AppSetting['playDetail.style.lrcAnimatedStyle']

const RANDOM_ANIMATED_STYLES: Array<Exclude<LrcAnimatedStyle, 'none' | 'random'>> = ['zoom', 'bounce', 'fade']

const playActiveAnimated = (style: LrcAnimatedStyle, animScale: Animated.Value, animOpacity: Animated.Value, animTranslateY: Animated.Value) => {
  if (style === 'none') return
  let activeStyle: Exclude<LrcAnimatedStyle, 'none' | 'random'> = style as Exclude<LrcAnimatedStyle, 'none' | 'random'>
  if (style === 'random') {
    activeStyle = RANDOM_ANIMATED_STYLES[Math.floor(Math.random() * RANDOM_ANIMATED_STYLES.length)]
  }
  animScale.setValue(1)
  animOpacity.setValue(1)
  animTranslateY.setValue(0)
  switch (activeStyle) {
    case 'zoom':
      animScale.setValue(0.6)
      animOpacity.setValue(0.2)
      Animated.parallel([
        Animated.timing(animScale, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
        Animated.timing(animOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]).start()
      break
    case 'bounce':
      animScale.setValue(0.3)
      animOpacity.setValue(0.4)
      Animated.parallel([
        Animated.spring(animScale, { toValue: 1, friction: 3, tension: 140, useNativeDriver: true }),
        Animated.timing(animOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start()
      break
    case 'fade':
      animOpacity.setValue(0)
      animTranslateY.setValue(24)
      Animated.parallel([
        Animated.timing(animOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(animTranslateY, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start()
      break
  }
}

interface LineProps {
  line: Line
  lineNum: number
  activeLine: number
  fullScreen?: boolean
  words?: Word[]
  onLayout: (lineNum: number, height: number, width: number) => void
}
const ACTIVE_FONT_SCALE = 1.4
const INACTIVE_FONT_SCALE = 0.55
const LrcLine = memo(({ line, lineNum, activeLine, fullScreen = false, words, onLayout }: LineProps) => {
  const theme = useTheme()
  const lrcFontSize = useSettingValue('playDetail.horizontal.style.lrcFontSize')
  const textAlign = useSettingValue('playDetail.style.align')
  const animatedStyle = useSettingValue('playDetail.style.lrcAnimatedStyle')
  const lrcColor = useSettingValue('playDetail.style.lrcColor')
  // 全屏歌词：逐字歌词保持原字号，其他歌词（普通歌词、翻译）放大
  const fsScale = fullScreen ? 1.6 : 1
  const activeScale = fullScreen ? 1.6 : ACTIVE_FONT_SCALE
  const inactiveScale = fullScreen ? 1.5 : INACTIVE_FONT_SCALE
  const baseSize = (lrcFontSize / 10) * fsScale

  const isActiveLine = activeLine == lineNum
  const wordSize = (lrcFontSize / 10) * ACTIVE_FONT_SCALE
  const normalSize = baseSize * (isActiveLine ? activeScale : inactiveScale)
  const wordLineHeight = setSpText(wordSize) * (fullScreen ? 1.5 : 1.3)
  const normalLineHeight = setSpText(normalSize) * (fullScreen ? 1.5 : 1.3)

  // 逐字歌词：激活行按播放进度逐字高亮
  const wordAlign = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center'
  const [wordProgress, setWordProgress] = useState(0)
  useEffect(() => {
    if (!isActiveLine || !words?.length) {
      setWordProgress(0)
      return
    }
    let cancelled = false
    const update = async() => {
      try {
        const pos = await getPosition()
        if (cancelled || pos == null) return
        setWordProgress(Math.max(pos * 1000 - line.time, 0))
      } catch {}
    }
    void update()
    const timer = setInterval(update, 50)
    return () => { cancelled = true; clearInterval(timer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveLine, words, line.time])

  const colors = useMemo(() => {
    return isActiveLine ? [
      LRC_ACTIVE_COLORS[lrcColor],
      theme['c-primary-alpha-200'],
      1,
    ] as const : [
      theme['c-350'],
      theme['c-300'],
      0.5,
    ] as const
  }, [isActiveLine, theme, lrcColor])

  const animScale = useRef(new Animated.Value(1)).current
  const animOpacity = useRef(new Animated.Value(1)).current
  const animTranslateY = useRef(new Animated.Value(0)).current
  const prevActiveRef = useRef(false)
  const isFirstRenderRef = useRef(true)

  useEffect(() => {
    const prevActive = prevActiveRef.current
    prevActiveRef.current = isActiveLine
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }
    if (!isActiveLine || prevActive) {
      animScale.setValue(1)
      animOpacity.setValue(1)
      animTranslateY.setValue(0)
      return
    }
    playActiveAnimated(animatedStyle, animScale, animOpacity, animTranslateY)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveLine, animatedStyle])

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    onLayout(lineNum, nativeEvent.layout.height, nativeEvent.layout.width)
  }

  // textBreakStrategy="simple" 用于解决某些设备上字体被截断的问题
  // https://stackoverflow.com/a/72822360
  return (
    <View style={styles.line} onLayout={handleLayout}>
      <Animated.View style={{
        transform: [{ scale: animScale }, { translateY: animTranslateY }],
        opacity: animOpacity,
      }}>
        {isActiveLine && words?.length ? (
          <View style={[styles.wordLine, { justifyContent: wordAlign }]}>
            {words.map((w, i) => (
              <LrcWord key={i} word={w} active={wordProgress >= w.time} size={wordSize} color={colors[0]} lineHeight={wordLineHeight} />
            ))}
          </View>
        ) : (
          <AnimatedColorText style={{
            ...styles.lineText,
            textAlign,
            lineHeight: normalLineHeight,
          }} textBreakStrategy="simple" color={colors[0]} opacity={colors[2]} size={normalSize}>{line.text}</AnimatedColorText>
        )}
        {
          line.extendedLyrics.map((lrc, index) => {
            return (<AnimatedColorText style={{
              ...styles.lineTranslationText,
              textAlign,
              lineHeight: normalLineHeight * 0.8,
            }} textBreakStrategy="simple" key={index} color={colors[1]} opacity={colors[2]} size={normalSize * 0.8}>{lrc}</AnimatedColorText>)
          })
        }
      </Animated.View>
    </View>
  )
}, (prevProps, nextProps) => {
  return prevProps.line === nextProps.line &&
    prevProps.words === nextProps.words &&
    prevProps.activeLine != nextProps.lineNum &&
    nextProps.activeLine != nextProps.lineNum
})
const wait = async() => new Promise(resolve => setTimeout(resolve, 100))

export default ({ fullScreen = false }: { fullScreen?: boolean }) => {
  const lyricLines = useLrcSet()
  const wordLinesMap = useLrcWords()
  const { line } = useLrcPlay()
  const flatListRef = useRef<FlatList>(null)
  const playLineRef = useRef<PlayLineType>(null)
  const isPauseScrollRef = useRef(true)
  const scrollTimoutRef = useRef<NodeJS.Timeout | null>(null)
  const delayScrollTimeout = useRef<NodeJS.Timeout | null>(null)
  const lineRef = useRef({ line: 0, prevLine: 0 })
  const isFirstSetLrc = useRef(true)
  const scrollInfoRef = useRef<NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'] | null>(null)
  const listLayoutInfoRef = useRef<{ spaceHeight: number, lineHeights: number[] }>({ spaceHeight: 0, lineHeights: [] })
  const scrollCancelRef = useRef<(() => void) | null>(null)
  const isShowLyricProgressSetting = useSettingValue('playDetail.isShowLyricProgressSetting')
  // useLock()
  // const [imgUrl, setImgUrl] = useState(null)
  // const theme = useGetter('common', 'theme')
  // const { onLayout, ...layout } = useLayout()

  // useEffect(() => {
  //   const url = playMusicInfo ? playMusicInfo.musicInfo.img : null
  //   if (imgUrl == url) return
  //   setImgUrl(url)
  // // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [playMusicInfo])

  // const imgWidth = useMemo(() => layout.width * 0.75, [layout.width])
  const handleScrollToActive = (index = lineRef.current.line) => {
    if (index < 0) return
    if (flatListRef.current) {
      if (scrollInfoRef.current && lineRef.current.line - lineRef.current.prevLine == 1) {
        let offset = listLayoutInfoRef.current.spaceHeight
        for (let line = 0; line < index; line++) {
          offset += listLayoutInfoRef.current.lineHeights[line]
        }
        offset += (listLayoutInfoRef.current.lineHeights[line] ?? 0) / 2
        try {
          scrollCancelRef.current = scrollTo(flatListRef.current, scrollInfoRef.current, offset - scrollInfoRef.current.layoutMeasurement.height * 0.42, 600, () => {
            scrollCancelRef.current = null
          })
        } catch {}
      } else {
        if (scrollCancelRef.current) {
          scrollCancelRef.current()
          scrollCancelRef.current = null
        }
        try {
          flatListRef.current.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.42,
          })
        } catch {}
      }
    }
  }

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollInfoRef.current = nativeEvent
    if (isPauseScrollRef.current) {
      playLineRef.current?.updateScrollInfo(nativeEvent)
    }
  }
  const handleScrollBeginDrag = () => {
    isPauseScrollRef.current = true
    playLineRef.current?.setVisible(true)
    if (delayScrollTimeout.current) {
      clearTimeout(delayScrollTimeout.current)
      delayScrollTimeout.current = null
    }
    if (scrollTimoutRef.current) {
      clearTimeout(scrollTimoutRef.current)
      scrollTimoutRef.current = null
    }
    if (scrollCancelRef.current) {
      scrollCancelRef.current()
      scrollCancelRef.current = null
    }
  }

  const onScrollEndDrag = () => {
    if (!isPauseScrollRef.current) return
    if (scrollTimoutRef.current) clearTimeout(scrollTimoutRef.current)
    scrollTimoutRef.current = setTimeout(() => {
      playLineRef.current?.setVisible(false)
      scrollTimoutRef.current = null
      isPauseScrollRef.current = false
      if (!playerState.isPlay) return
      handleScrollToActive()
    }, 3000)
  }


  useEffect(() => {
    return () => {
      if (delayScrollTimeout.current) {
        clearTimeout(delayScrollTimeout.current)
        delayScrollTimeout.current = null
      }
      if (scrollTimoutRef.current) {
        clearTimeout(scrollTimoutRef.current)
        scrollTimoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    // linesRef.current = lyricLines
    listLayoutInfoRef.current.lineHeights = []
    lineRef.current.prevLine = 0
    lineRef.current.line = 0
    if (!flatListRef.current) return
    flatListRef.current.scrollToOffset({
      offset: 0,
      animated: false,
    })
    if (!lyricLines.length) return
    playLineRef.current?.updateLyricLines(lyricLines)
    requestAnimationFrame(() => {
      if (isFirstSetLrc.current) {
        isFirstSetLrc.current = false
        setTimeout(() => {
          isPauseScrollRef.current = false
          handleScrollToActive()
        }, 100)
      } else {
        if (delayScrollTimeout.current) clearTimeout(delayScrollTimeout.current)
        delayScrollTimeout.current = setTimeout(() => {
          handleScrollToActive(0)
        }, 100)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyricLines])

  useEffect(() => {
    if (line < 0) return
    lineRef.current.prevLine = lineRef.current.line
    lineRef.current.line = line
    if (!flatListRef.current || isPauseScrollRef.current) return

    if (line - lineRef.current.prevLine != 1) {
      handleScrollToActive()
      return
    }

    delayScrollTimeout.current = setTimeout(() => {
      delayScrollTimeout.current = null
      handleScrollToActive()
    }, 600)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line])

  useEffect(() => {
    requestAnimationFrame(() => {
      playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
      playLineRef.current?.updateLyricLines(lyricLines)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShowLyricProgressSetting])

  const handleScrollToIndexFailed: FlatListType['onScrollToIndexFailed'] = (info) => {
    void wait().then(() => {
      handleScrollToActive(info.index)
    })
  }

  const handleLineLayout = useCallback<LineProps['onLayout']>((lineNum, height) => {
    listLayoutInfoRef.current.lineHeights[lineNum] = height
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
  }, [])

  const handleSpaceLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    listLayoutInfoRef.current.spaceHeight = nativeEvent.layout.height
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
  }, [])

  const handlePlayLine = useCallback((time: number) => {
    playLineRef.current?.setVisible(false)
    global.app_event.setProgress(time)
  }, [])

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => {
    return (
      <LrcLine line={item} lineNum={index} activeLine={line} fullScreen={fullScreen} words={wordLinesMap.get(item.time)} onLayout={handleLineLayout} />
    )
  }
  const getkey: FlatListType['keyExtractor'] = (item, index) => `${index}${item.text}`

  const spaceComponent = useMemo(() => (
    <View style={styles.space} onLayout={handleSpaceLayout}></View>
  ), [handleSpaceLayout])

  return (
    <>
      <FlatList
        data={lyricLines}
        renderItem={renderItem}
        keyExtractor={getkey}
        style={[styles.container, fullScreen && styles.containerFullScreen]}
        ref={flatListRef}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={spaceComponent}
        ListFooterComponent={spaceComponent}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        fadingEdgeLength={100}
        initialNumToRender={Math.max(line + 10, 10)}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        onScroll={handleScroll}
      />
      { isShowLyricProgressSetting ? <PlayLine ref={playLineRef} onPlayLine={handlePlayLine} /> : null }
    </>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    paddingLeft: 20,
    paddingRight: 20,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  containerFullScreen: {
    paddingLeft: 60,
    paddingRight: 60,
    paddingTop: 40,
    paddingBottom: 40,
  },
  space: {
    paddingTop: '100%',
  },
  line: {
    paddingTop: 10,
    paddingBottom: 10,
    // opacity: 0,
  },
  lineText: {
    textAlign: 'center',
    // fontSize: 16,
    // lineHeight: 20,
    // paddingTop: 5,
    // paddingBottom: 5,
    // opacity: 0,
  },
  wordLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  lineTranslationText: {
    textAlign: 'center',
    // fontSize: 13,
    // lineHeight: 17,
    paddingTop: 5,
    // paddingBottom: 5,
  },
})
