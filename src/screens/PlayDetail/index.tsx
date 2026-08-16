import { useEffect } from 'react'
import { BackHandler } from 'react-native'
// import { View, StyleSheet } from 'react-native'
import { useHorizontalMode } from '@/utils/hooks'

import Vertical from './Vertical'
import Horizontal from './Horizontal'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import { setComponentId, updateSetting } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import settingState from '@/store/setting/state'

export default ({ componentId }: { componentId: string }) => {
  const isHorizontalMode = useHorizontalMode()

  useEffect(() => {
    setComponentId(COMPONENT_IDS.playDetail, componentId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // 全屏歌词模式下按返回键先切回普通歌词，再按返回才退出播放详情页
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (settingState.setting['playDetail.style.lyricFullScreen']) {
        updateSetting({ 'playDetail.style.lyricFullScreen': false })
        return true
      }
      return false
    })
    return () => handler.remove()
  }, [])

  return (
    <PageContent>
      <StatusBar />
      {
        isHorizontalMode
          ? <Horizontal componentId={componentId} />
          : <Vertical componentId={componentId} />
      }
    </PageContent>
  )
}
