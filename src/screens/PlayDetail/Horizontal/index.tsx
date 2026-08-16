import { memo, useEffect, useRef } from 'react'
import { View, AppState } from 'react-native'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import StatusBar from '@/components/common/StatusBar'
import MoreBtn from './MoreBtn'

import Header from './components/Header'
import Btn from './components/Btn'
import SettingPopup, { type SettingPopupType } from '../components/SettingPopup'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import PageContent from '@/components/PageContent'

import Pic from './Pic'
// import ControlBtn from './ControlBtn'
import Lyric from './Lyric'
import Player from './Player'
import { createStyle } from '@/utils/tools'
import { marginLeftRaw } from './constant'
import { useStatusbarHeight } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'
// import MoreBtn from './MoreBtn2'

export default memo(({ componentId }: { componentId: string }) => {
  const statusBarHeight = useStatusbarHeight()
  const isLyricFullScreen = useSettingValue('playDetail.style.lyricFullScreen')
  const popupRef = useRef<SettingPopupType>(null)

  const showSetting = () => {
    popupRef.current?.show()
  }

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
      <View style={{ ...styles.container, paddingTop: statusBarHeight }}>
        {!isLyricFullScreen && (
          <View style={styles.left}>
            <Header />
            <View style={styles.leftContent}>
              <MoreBtn />
              <Pic componentId={componentId} />
            </View>
            <Player />
            {/* <View style={styles.controlBtn} nativeID="pageIndicator">
              <MoreBtn />
              <ControlBtn />
            </View> */}
          </View>
        )}
        <View style={[styles.right, isLyricFullScreen && styles.rightFullScreen]}>
          <Lyric fullScreen={isLyricFullScreen} />
        </View>
        {isLyricFullScreen && (
          <>
            <View style={{ ...styles.fullScreenBtnWrap, top: statusBarHeight }}>
              <Btn icon="slider" onPress={showSetting} />
            </View>
            <SettingPopup ref={popupRef} position="left" direction="horizontal" />
          </>
        )}
      </View>
    </PageContent>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  left: {
    flex: 1,
    width: '45%',
    paddingBottom: 10,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  leftContent: {
    flexShrink: 1,
    flexGrow: 0,
    marginLeft: marginLeftRaw,
    // flexDirection: 'row',
    // backgroundColor: 'rgba(0,0,0,0.1)',
    // alignItems: 'center',
  },
  right: {
    width: '55%',
    flexGrow: 0,
    flexShrink: 0,
  },
  rightFullScreen: {
    width: '100%',
  },
  fullScreenBtnWrap: {
    position: 'absolute',
    right: 8,
    zIndex: 10,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // backgroundColor: '#eee',
  },
})
