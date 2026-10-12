import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, View } from 'react-native'
// import { useLayout } from '@/utils/hooks'
import { usePlayerMusicInfo, useIsPlay } from '@/store/player/hook'
import { useWindowSize } from '@/utils/hooks'
import { useNavigationComponentDidAppear } from '@/navigation'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { createStyle } from '@/utils/tools'
import { HEADER_HEIGHT } from './components/Header'
import { BTN_WIDTH } from './MoreBtn/Btn'
import { marginLeft } from './constant'
import Image from '@/components/common/Image'
import { useStatusbarHeight } from '@/store/common/hook'
import commonState from '@/store/common/state'


export default memo(({ componentId }: { componentId: string }) => {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const { width: winWidth, height: winHeight } = useWindowSize()
  const statusBarHeight = useStatusbarHeight()

  const [animated, setAnimated] = useState(!!commonState.componentIds.playDetail)
  const [pic, setPic] = useState(musicInfo.pic)
  useEffect(() => {
    if (animated) setPic(musicInfo.pic)
  }, [musicInfo.pic, animated])

  useNavigationComponentDidAppear(componentId, () => {
    setAnimated(true)
  })

  // 旋转动画：播放时旋转，暂停时停止
  const rotateAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!isPlay) return
    rotateAnim.setValue(0)
    const animation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    animation.start()
    return () => {
      animation.stop()
    }
  }, [isPlay, rotateAnim])

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  let imgWidth = Math.min((winWidth * 0.45 - marginLeft - BTN_WIDTH) * 0.76, (winHeight - statusBarHeight - HEADER_HEIGHT) * 0.62)
  imgWidth -= imgWidth * (global.lx.fontSize - 1) * 0.3
  let contentHeight = (winHeight - statusBarHeight - HEADER_HEIGHT) * 0.66
  contentHeight -= contentHeight * (global.lx.fontSize - 1) * 0.2
  const discHoleSize = imgWidth * 0.13

  return (
    <View style={{ ...styles.container, height: contentHeight }}>
      <View style={styles.content}>
        {/* 黑胶唱片造型：深色盘面 + 封面 + 中心轴孔，播放时整体旋转 */}
        <Animated.View style={{ width: imgWidth, height: imgWidth, transform: [{ rotate }] }}>
          <View style={{ ...styles.disc, width: imgWidth, height: imgWidth, borderRadius: imgWidth / 2 }}>
            <Image
              url={pic}
              nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
              style={{
                width: imgWidth * 0.9,
                height: imgWidth * 0.9,
                borderRadius: imgWidth * 0.45,
              }}
            />
            <View style={{
              ...styles.discHole,
              width: discHoleSize,
              height: discHoleSize,
              borderRadius: discHoleSize / 2,
              left: (imgWidth - discHoleSize) / 2,
              top: (imgWidth - discHoleSize) / 2,
            }} />
          </View>
        </Animated.View>
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexShrink: 1,
    flexGrow: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  content: {
    backgroundColor: 'rgba(0,0,0,0)',
    borderRadius: 4,
  },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,22,28,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  discHole: {
    position: 'absolute',
    backgroundColor: 'rgba(10,12,16,0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
})
