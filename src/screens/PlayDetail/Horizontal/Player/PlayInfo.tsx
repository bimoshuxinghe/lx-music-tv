import { View } from 'react-native'

import Progress from '@/components/player/Progress'
import Status from './Status'
import { useProgress } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useBufferProgress } from '@/plugins/player'

export default () => {
  const theme = useTheme()
  const { maxPlayTimeStr, nowPlayTimeStr, progress, maxPlayTime } = useProgress()
  const buffered = useBufferProgress()

  return (
    <View style={styles.container}>
      {/* 进度条独立成行：更厚、圆角，可聚焦并用左右键步进 */}
      <View style={styles.progressWrap}>
        <Progress progress={progress} duration={maxPlayTime} buffered={buffered} />
      </View>
      {/* 时间与播放状态分列两端，信息层级更清晰 */}
      <View style={styles.infoRow}>
        <Text size={12} color={theme['c-500']}>{nowPlayTimeStr}</Text>
        <View style={styles.status}>
          <Status />
        </View>
        <Text size={12} color={theme['c-500']}>{maxPlayTimeStr}</Text>
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    marginVertical: 6,
  },
  progressWrap: {
    height: 10,
    justifyContent: 'center',
  },
  infoRow: {
    marginTop: 6,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    flexGrow: 1,
    flexShrink: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
})
