import { memo } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { getTheme } from '@/theme/themes'
import { applyTheme } from '@/core/theme'

export const FONT_COLOR_LIST = [
  'default',
  'white',
  'black',
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'purple',
  'pink',
] as const

export type FontColor = typeof FONT_COLOR_LIST[number]

const FONT_COLORS: Record<FontColor, string> = {
  default: '',
  white: '#FFFFFF',
  black: '#000000',
  red: '#E53935',
  orange: '#FB8C00',
  yellow: '#FDD835',
  green: '#43A047',
  cyan: '#00BCD4',
  blue: '#1E88E5',
  purple: '#8E24AA',
  pink: '#EC407A',
}

const refreshTheme = () => {
  void getTheme().then(applyTheme)
}

const useActive = (id: FontColor) => {
  const x = useSettingValue('theme.fontColor')
  const isActive = id === 'default' ? !x : x == FONT_COLORS[id]
  return isActive
}

const Item = ({ id, change }: {
  id: FontColor
  change: (id: FontColor) => void
  key?: React.Key
}) => {
  const t = useI18n()
  const theme = useTheme()
  const isActive = useActive(id)
  return (
    <View style={styles.item}>
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 1.5,
          borderColor: isActive ? theme['c-primary'] : theme['c-border-background'],
          backgroundColor: FONT_COLORS[id] || theme['c-font'],
        }}
      />
      <CheckBox marginBottom={3} check={isActive} label={t(`setting_basic_theme_font_color_${id}`)} onChange={() => { change(id) }} need />
    </View>
  )
}

export default memo(() => {
  const t = useI18n()
  const setColor = (id: FontColor) => {
    updateSetting({ 'theme.fontColor': FONT_COLORS[id] })
    requestAnimationFrame(refreshTheme)
  }

  return (
    <View style={styles.content}>
      <Text size={14}>{t('setting_basic_theme_font_color')}</Text>
      <View style={styles.list}>
        {
          FONT_COLOR_LIST.map(id => <Item id={id} key={id} change={setColor} />)
        }
      </View>
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 10,
    marginBottom: 15,
  },
  list: {
    marginTop: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
})
