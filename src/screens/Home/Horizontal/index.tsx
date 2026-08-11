import { useEffect } from 'react'
import { View, BackHandler, ToastAndroid } from 'react-native'
import NavBar from './NavBar'
import PlayPanel from './PlayPanel'
import StatusBar from '@/components/common/StatusBar'
import Header from './Header'
import Main from './Main'
import { createStyle } from '@/utils/tools'
import { moveTaskToBack } from '@/utils/nativeModules/utils'
import { exitApp } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { useNavActiveId } from '@/store/common/hook'
import { pop } from '@/navigation'
import commonState from '@/store/common/state'

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
})

let lastBackPressed = 0

export default () => {
  const backPressAction = useSettingValue('common.backPressAction')
  const navActiveId = useNavActiveId()

  useEffect(() => {
    lastBackPressed = 0
    const backAction = () => {
      // 播放详情页在前时，一次返回键先关闭播放详情页回到主页
      if (commonState.componentIds.playDetail) {
        void pop(commonState.componentIds.playDetail)
        return true
      }
      const now = Date.now()
      if (now - lastBackPressed < 2000) {
        if (backPressAction == 'exit') {
          exitApp('Back Press Exit')
        } else {
          moveTaskToBack()
        }
        return true
      }
      lastBackPressed = now
      ToastAndroid.show(backPressAction == 'exit' ? '再按一次退出应用' : '再按一次返回后台播放', ToastAndroid.SHORT)
      return true
    }

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction)
    return () => {
      backHandler.remove()
    }
  }, [backPressAction])

  return (
    <>
      <StatusBar />
      <View style={styles.container}>
        <NavBar />
        <View style={styles.body}>
          { navActiveId == 'nav_setting' ? null : <PlayPanel /> }
          <View style={styles.content}>
            <Header />
            <Main />
          </View>
        </View>
      </View>
    </>
  )
}
