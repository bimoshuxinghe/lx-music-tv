import { memo } from 'react'
import { View } from 'react-native'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { createStyle } from '@/utils/tools'
import Image from '@/components/common/Image'

/**
 * 播放页封面：大尺寸圆角方图（参考主流播放器封面版式）
 * @param size 正方形边长，由父级容器实测后传入，保证永不溢出容器
 */
export default memo(({ size }: { size: number }) => {
  const musicInfo = usePlayerMusicInfo()
  if (size <= 0) return null

  return (
    <View style={{ ...styles.cover, width: size, height: size, borderRadius: size * 0.07 }}>
      <Image
        url={musicInfo.pic}
        nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
        style={{ width: '100%', height: '100%', borderRadius: size * 0.07 }}
      />
    </View>
  )
})

const styles = createStyle({
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
