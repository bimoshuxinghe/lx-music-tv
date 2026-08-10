import { useMemo } from 'react'

import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import styles from './style'
import CheckBox from '@/components/common/CheckBox'
import { LRC_COLOR_LIST, type LrcColor } from '../../lrcColor'

const useActive = (id: LrcColor) => {
  const x = useSettingValue('playDetail.style.lrcColor')
  const isActive = useMemo(() => x == id, [x, id])
  return isActive
}

const Item = ({ id, name, change }: {
  id: LrcColor
  name: string
  change: (id: LrcColor) => void
}) => {
  const isActive = useActive(id)
  return <CheckBox marginBottom={3} check={isActive} label={name} onChange={() => { change(id) }} need />
}

export default () => {
  const t = useI18n()
  const list = useMemo(() => {
    return LRC_COLOR_LIST.map(id => ({ id, name: t(`play_detail_setting_lrc_color_${id}`) }))
  }, [t])

  const setColor = (id: LrcColor) => {
    updateSetting({ 'playDetail.style.lrcColor': id })
  }

  return (
    <View style={styles.container}>
      <Text>{t('play_detail_setting_lrc_color')}</Text>
      <View style={styles.content}>
        <View style={styles.list}>
          {
            list.map(({ id, name }) => <Item name={name} id={id} key={id} change={setColor} />)
          }
        </View>
      </View>
    </View>
  )
}
