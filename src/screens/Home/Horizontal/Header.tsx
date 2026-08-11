import { View } from 'react-native'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { createStyle } from '@/utils/tools'
import StatusBar from '@/components/common/StatusBar'
import { useSettingValue } from '@/store/setting/hook'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT } from '@/config/constant'
import { type InitState as CommonState } from '@/store/common/state'
import SearchTypeSelector from '@/screens/Home/Views/Search/SearchTypeSelector'

const headerComponents: Partial<Record<CommonState['navActiveId'], React.ReactNode>> = {
  nav_search: <SearchTypeSelector />,
}

const HEADER_HEIGHT = _HEADER_HEIGHT * 0.8

const Header = () => {
  const id = useNavActiveId()
  const statusBarHeight = useStatusbarHeight()
  const drawerLayoutPosition = useSettingValue('common.drawerLayoutPosition')

  return (
    <>
      <StatusBar />
      <View style={{
        ...styles.container,
        height: drawerLayoutPosition == 'left' ? scaleSizeH(HEADER_HEIGHT) : scaleSizeH(HEADER_HEIGHT) + statusBarHeight,
        paddingTop: drawerLayoutPosition == 'left' ? 0 : statusBarHeight,
      }}>
        {headerComponents[id] ?? null}
      </View>
    </>
  )
}

const styles = createStyle({
  container: {
    paddingRight: 5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
})

export default Header
