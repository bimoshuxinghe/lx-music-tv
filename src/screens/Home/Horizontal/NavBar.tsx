import { FocusableTouchableOpacity as TouchableOpacity } from '@/components/tv/FocusableTouchableOpacity'
import { memo } from 'react'
import { ScrollView, View } from 'react-native'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { NAV_MENUS } from '@/config/constant'
import type { InitState } from '@/store/common/state'
import { setNavActiveId } from '@/core/common'
import { BorderWidths } from '@/theme'

type IdType = Exclude<InitState['navActiveId'], 'nav_setting'>

const NavItem = ({ id, icon, onPress, isFirst }: {
  id: IdType
  icon: string
  onPress: (id: IdType) => void
  isFirst?: boolean
}) => {
  const t = useI18n()
  const activeId = useNavActiveId()
  const theme = useTheme()
  const active = activeId == id

  return (
    <TouchableOpacity
      style={{ ...styles.navItem, ...(active ? { backgroundColor: theme['c-primary'], borderRadius: 6 } : {}) }}
      onPress={() => { onPress(id) }}
      hasTVPreferredFocus={isFirst}
    >
      <View style={styles.iconContent}>
        <Icon name={icon} size={20} color={active ? '#FFFFFF' : theme['c-font-label']} />
      </View>
      <Text style={styles.text} size={16} color={active ? '#FFFFFF' : theme['c-font-label']}>{t(id)}</Text>
    </TouchableOpacity>
  )
}

const SettingBtn = () => {
  const t = useI18n()
  const theme = useTheme()
  const activeId = useNavActiveId()
  const active = activeId == 'nav_setting'

  return (
    <TouchableOpacity
      style={{ ...styles.navItem, ...(active ? { backgroundColor: theme['c-primary'], borderRadius: 6 } : {}) }}
      onPress={() => { setNavActiveId('nav_setting') }}
      activeOpacity={0.5}
    >
      <View style={styles.iconContent}>
        <Icon name="setting" size={20} color={active ? '#FFFFFF' : theme['c-font-label']} />
      </View>
      <Text style={styles.text} size={16} color={active ? '#FFFFFF' : theme['c-font-label']}>{t('nav_setting')}</Text>
    </TouchableOpacity>
  )
}

export default memo(() => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  const handlePress = (id: IdType) => {
    setNavActiveId(id)
  }

  return (
    <View
      style={{
        ...styles.container,
        borderBottomColor: theme['c-border-background'],
        paddingTop: statusBarHeight,
      }}
    >
      <View style={styles.header}>
        <Icon name="logo" color={theme['c-primary-dark-100-alpha-300']} size={24} />
        <Text style={styles.headerText} size={15} color={theme['c-primary-dark-100-alpha-300']}>XH music</Text>
      </View>
      <View style={styles.right}>
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps={'always'} style={styles.navScroll}>
          <View style={styles.navList}>
            {NAV_MENUS.filter(m => m.id != 'nav_setting').map((menu, i) => (
              <NavItem key={menu.id} id={menu.id as IdType} icon={menu.icon} onPress={handlePress} isFirst={i === 0} />
            ))}
            <SettingBtn />
          </View>
        </ScrollView>
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: BorderWidths.normal,
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 6,
  },
  headerText: {
    textAlign: 'center',
    marginLeft: 8,
  },
  right: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  navScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  navList: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 14,
    paddingRight: 14,
    marginRight: 10,
  },
  iconContent: {
    width: 22,
    alignItems: 'center',
  },
  text: {
    paddingLeft: 6,
  },
})
