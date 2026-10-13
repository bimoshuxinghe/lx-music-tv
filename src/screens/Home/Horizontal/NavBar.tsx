import { FocusableTouchableOpacity as TouchableOpacity } from '@/components/tv/FocusableTouchableOpacity'
import { memo } from 'react'
import { View } from 'react-native'
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
  const theme = useTheme()
  const activeId = useNavActiveId()
  const active = activeId == id

  return (
    <TouchableOpacity
      style={styles.navItem}
      focusStyle={{ ...styles.navItemFocus, backgroundColor: theme['c-primary-alpha-900'] }}
      onPress={() => { onPress(id) }}
      hasTVPreferredFocus={isFirst}
    >
      <View style={styles.iconContent}>
        <Icon name={icon} size={18} color={active ? theme['c-primary'] : theme['c-font-label']} />
      </View>
      <Text style={styles.text} size={14} color={active ? theme['c-primary'] : theme['c-font-label']}>{t(id)}</Text>
      {/* 酷狗TV风格：激活项底部主题色指示条 */}
      <View style={styles.indicatorWrap}>
        <View style={{ ...styles.indicator, backgroundColor: active ? theme['c-primary'] : 'transparent' }} />
      </View>
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
      style={styles.navItem}
      focusStyle={{ ...styles.navItemFocus, backgroundColor: theme['c-primary-alpha-900'] }}
      onPress={() => { setNavActiveId('nav_setting') }}
      activeOpacity={0.5}
    >
      <View style={styles.iconContent}>
        <Icon name="setting" size={18} color={active ? theme['c-primary'] : theme['c-font-label']} />
      </View>
      <Text style={styles.text} size={14} color={active ? theme['c-primary'] : theme['c-font-label']}>{t('nav_setting')}</Text>
      <View style={styles.indicatorWrap}>
        <View style={{ ...styles.indicator, backgroundColor: active ? theme['c-primary'] : 'transparent' }} />
      </View>
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
        <Icon name="logo" color={theme['c-primary-dark-100-alpha-300']} size={22} />
        <Text style={styles.headerText} size={15} color={theme['c-primary-dark-100-alpha-300']}>星河音乐</Text>
      </View>
      <View style={styles.right}>
        {/* 导航按钮单行排布（已缩小，无需横向滚动） */}
        <View style={styles.navList}>
          {NAV_MENUS.filter(m => m.id != 'nav_setting').map((menu, i) => (
            <NavItem key={menu.id} id={menu.id} icon={menu.icon} onPress={handlePress} isFirst={i === 0} />
          ))}
          <SettingBtn />
        </View>
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
    paddingBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 10,
  },
  headerText: {
    textAlign: 'center',
    marginLeft: 7,
  },
  right: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  navList: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 11,
    paddingRight: 11,
    marginRight: 4,
    borderRadius: 8,
  },
  navItemFocus: {
    borderWidth: 0,
    borderRadius: 8,
  },
  iconContent: {
    width: 20,
    alignItems: 'center',
  },
  text: {
    paddingLeft: 5,
  },
  indicatorWrap: {
    position: 'absolute',
    bottom: 1,
    left: 11,
    right: 11,
    alignItems: 'center',
  },
  indicator: {
    width: 18,
    height: 2.5,
    borderRadius: 2,
  },
})
