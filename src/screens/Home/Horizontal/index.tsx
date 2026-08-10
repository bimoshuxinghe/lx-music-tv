import { useEffect } from 'react'
import { View, BackHandler, ToastAndroid } from 'react-native'
import Aside from './Aside'
import PlayerBar from '@/components/player/PlayerBar'
import StatusBar from '@/components/common/StatusBar'
import Header from './Header'
import Main from './Main'
import { createStyle } from '@/utils/tools'
import { moveTaskToBack } from '@/utils/nativeModules/utils'
import { useSettingValue } from '@/store/setting/hook'

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
})

let lastBackPressed = 0

export default () => {
  const backPressAction = useSettingValue('common.backPressAction')

  useEffect(() => {
    lastBackPressed = 0
    const backAction = () => {
      const now = Date.now()
      if (now - lastBackPressed < 2000) {
        if (backPressAction == 'exit') {
          BackHandler.exitApp()
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
        <Aside />
        <View style={styles.content}>
          <Header />
          <Main />
          <PlayerBar isHome />
        </View>
      </View>
    </>
  )
}
