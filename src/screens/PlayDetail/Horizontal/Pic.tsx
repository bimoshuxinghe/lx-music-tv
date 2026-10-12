import { memo } from 'react'
import { View } from 'react-native'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useWindowSize } from '@/utils/hooks'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { createStyle } from '@/utils/tools'
import Image from '@/components/common/Image'

/**
 * 播放页封面：大尺寸圆角方图（参考主流 MV/音乐播放器的封面版式）
 */
export default memo(() => {
  const musicInfo = usePlayerMusicInfo()
  const { width: winWidth, height: winHeight } = useWindowSize()

  const coverSize = Math.min(winWidth * 0.32, winHeight * 0.5)

  return (
    <View style={styles.container}>
      <View style={{ ...styles.cover, width: coverSize, height: coverSize, borderRadius: coverSize * 0.07 }}>
        <Image
          url={musicInfo.pic}
          nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
          style={{ width: '100%', height: '100%', borderRadius: coverSize * 0.07 }}
        />
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cover: {
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.2)',
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
})
