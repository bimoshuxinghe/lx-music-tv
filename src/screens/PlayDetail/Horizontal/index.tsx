import { memo, useEffect, useMemo, useState } from 'react'
import { View, AppState, StyleSheet } from 'react-native'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import StatusBar from '@/components/common/StatusBar'
import MoreBtn from './MoreBtn'

import Header from './components/Header'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import PageContent from '@/components/PageContent'

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

  return (
    <PageContent>
      <StatusBar />
      <View style={styles.container}>
        <GradientBg colors={gradient} />

        {isLyricFullScreen ? (
          <View style={[styles.fullScreenLyric, { paddingTop: statusBarHeight }]}>
            <Lyric fullScreen />
          </View>
        ) : (
          <>
            {/* 顶栏：返回 + 更多操作 */}
            <View style={[styles.topBar, { paddingTop: statusBarHeight }]}>
              <Header />
              <View style={styles.spacer} />
              <MoreBtn />
            </View>

            {/* 主体：左封面 / 右标题 + 歌词 */}
            <View style={styles.body}>
              <View style={styles.left}>
                <Pic />
              </View>
              <View style={styles.right}>
                <Text style={styles.title} size={32} numberOfLines={1} color="#FFFFFF">{musicInfo.name}</Text>
                <Text style={styles.artist} size={16} numberOfLines={1} color="rgba(255,255,255,0.72)">{musicInfo.singer}</Text>
                <View style={styles.lyricWrap}>
                  <Lyric align="left" />
                </View>
              </View>
            </View>

            {/* 底部：波形进度条 + 时间 + 播控 */}
            <View style={styles.bottomBar}>
              <WaveProgress />
              <View style={styles.bottomRow}>
                <View style={styles.statusWrap}>
                  <Status />
                </View>
                <View style={styles.spacer} />
                <Text style={styles.timeText} size={14} color="rgba(255,255,255,0.85)">
                  {nowPlayTimeStr} / {maxPlayTimeStr}
                </Text>
                <ControlBtn />
              </View>
            </View>
          </>
        )}
      </View>
    </PageContent>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0A1B26',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  spacer: {
    flex: 1,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 30,
  },
  left: {
    width: '42%',
    justifyContent: 'center',
  },
  right: {
    flex: 1,
    paddingLeft: 40,
    justifyContent: 'center',
  },
  title: {
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  artist: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.72)',
  },
  lyricWrap: {
    flex: 1,
    marginTop: 20,
  },
  bottomBar: {
    paddingHorizontal: 34,
    paddingBottom: 26,
  },
  bottomRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  statusWrap: {
    flexShrink: 1,
  },
  timeText: {
    color: 'rgba(255,255,255,0.85)',
  },
  fullScreenLyric: {
    flex: 1,
  },
})
