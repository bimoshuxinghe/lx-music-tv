import { memo, useEffect, useMemo, useState } from 'react'
import { View, AppState, StyleSheet } from 'react-native'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import StatusBar from '@/components/common/StatusBar'
import MoreBtn from './MoreBtn'

import Header from './components/Header'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'

import Pic from './Pic'
import Lyric from './Lyric'
import ControlBtn from './Player/ControlBtn'
import Status from './Player/Status'
import Text from '@/components/common/Text'
import WaveProgress from './WaveProgress'
import { createStyle } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'
import { usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { useWindowSize } from '@/utils/hooks'
import { deriveGradient, getCoverGradient, mixHex } from '@/utils/coverColor'

const GRADIENT_STEPS = 16

/**
 * 背景渐变：RN 无内置渐变组件，用 16 层平滑过渡的横向色带模拟线性渐变
 */
const GradientBg = memo(({ colors }: { colors: [string, string] }) => {
  const bands = useMemo(() => Array.from({ length: GRADIENT_STEPS }, (_, i) => ({
    top: `${(i / GRADIENT_STEPS) * 100}%`,
    height: `${100 / GRADIENT_STEPS + 0.5}%`,
    color: mixHex(colors[0], colors[1], i / (GRADIENT_STEPS - 1)),
  })), [colors])
  return (
    <View style={styles.gradient} pointerEvents="none">
      {bands.map((band, i) => (
        <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: band.top as any, height: band.height as any, backgroundColor: band.color }} />
      ))}
    </View>
  )
})

export default memo(({ componentId }: { componentId: string }) => {
  const statusBarHeight = useStatusbarHeight()
  const isLyricFullScreen = useSettingValue('playDetail.style.lyricFullScreen')
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const { nowPlayTimeStr, maxPlayTimeStr } = useProgress()
  const { height: winHeight } = useWindowSize()
  // 左栏封面区实测尺寸：封面严格按实测值取正方形，杜绝溢出/塌陷
  const [coverBox, setCoverBox] = useState({ width: 0, height: 0 })

  // 背景渐变：优先取封面主色，失败回退主题色
  const [gradient, setGradient] = useState<[string, string]>(() => deriveGradient(theme['c-primary'] ?? '#1B4B63'))
  useEffect(() => {
    let alive = true
    const fallback = () => setGradient(deriveGradient(theme['c-primary'] ?? '#1B4B63'))
    if (!musicInfo.pic) { fallback(); return }
    void getCoverGradient(musicInfo.pic).then((colors) => {
      if (!alive) return
      if (colors) setGradient(colors)
      else fallback()
    })
    return () => { alive = false }
  }, [musicInfo.pic, theme])

  useEffect(() => {
    setComponentId(COMPONENT_IDS.playDetail, componentId)
    screenkeepAwake()
    let appstateListener = AppState.addEventListener('change', (state) => {
      switch (state) {
        case 'active':
          screenkeepAwake()
          break
        case 'background':
          screenUnkeepAwake()
          break
      }
    })

    return () => {
      appstateListener.remove()
      screenUnkeepAwake()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const coverSize = Math.floor(Math.min(coverBox.width * 0.94, coverBox.height * 0.94, winHeight * 0.52))

  return (
    <>
      <StatusBar />
      <View style={[styles.container, { paddingTop: statusBarHeight }]}>
        <GradientBg colors={gradient} />

        {!isLyricFullScreen && (
          /* 左栏：顶栏（返回/更多）+ 封面 + 波形进度 */
          <View style={styles.left}>
            <View style={styles.topBar}>
              <Header />
              <View style={styles.spacer} />
              <MoreBtn />
            </View>
            <View
              style={styles.coverWrap}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout
                setCoverBox(prev => (prev.width == width && prev.height == height) ? prev : { width, height })
              }}
            >
              <Pic size={coverSize} />
            </View>
            <View style={styles.progressBlock}>
              <WaveProgress />
              <View style={styles.progressInfo}>
                <Status />
              </View>
            </View>
          </View>
        )}

        {/* 右栏：歌名/歌手 + 歌词 + 播控 */}
        <View style={[styles.right, isLyricFullScreen && styles.rightFullScreen]}>
          {!isLyricFullScreen && (
            <View style={styles.titleBlock}>
              <Text style={styles.title} size={30} numberOfLines={1} color="#FFFFFF">{musicInfo.name}</Text>
              <Text style={styles.artist} size={15} numberOfLines={1} color="rgba(255,255,255,0.7)">{musicInfo.singer}</Text>
            </View>
          )}
          <View style={styles.lyricWrap}>
            <Lyric fullScreen={isLyricFullScreen} align={isLyricFullScreen ? undefined : 'left'} />
          </View>
          {!isLyricFullScreen && (
            <View style={styles.controlsRow}>
              <Text style={styles.timeText} size={14} color="rgba(255,255,255,0.85)">
                {nowPlayTimeStr} / {maxPlayTimeStr}
              </Text>
              <ControlBtn />
            </View>
          )}
        </View>
      </View>
    </>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0A1B26',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  left: {
    flex: 1,
    width: '44%',
    paddingLeft: 30,
    paddingRight: 18,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacer: {
    flex: 1,
  },
  coverWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBlock: {
    paddingBottom: 18,
  },
  progressInfo: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  right: {
    flex: 1,
    width: '56%',
    paddingRight: 40,
    paddingLeft: 24,
    justifyContent: 'center',
  },
  rightFullScreen: {
    width: '100%',
    paddingLeft: 60,
    paddingRight: 60,
  },
  titleBlock: {
    marginBottom: 10,
  },
  title: {
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  artist: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.7)',
  },
  lyricWrap: {
    flex: 1,
    maxHeight: 640,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingTop: 10,
  },
  timeText: {
    color: 'rgba(255,255,255,0.85)',
  },
})
