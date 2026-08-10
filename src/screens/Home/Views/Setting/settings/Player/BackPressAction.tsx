import { memo, useMemo } from 'react'

import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'

const BACK_PRESS_ACTIONS: Array<LX.AppSetting['common.backPressAction']> = ['background', 'exit']

const useActive = (id: LX.AppSetting['common.backPressAction']) => {
  const q = useSettingValue('common.backPressAction')
  const isActive = useMemo(() => q == id, [q, id])
  return isActive
}

const Item = ({ id, name }: {
  id: LX.AppSetting['common.backPressAction']
  name: string
}) => {
  const isActive = useActive(id)
  return <CheckBox marginRight={8} check={isActive} label={name} onChange={() => { updateSetting({ 'common.backPressAction': id }) }} need />
}

export default memo(() => {
  const t = useI18n()
  const list = useMemo(() => {
    return BACK_PRESS_ACTIONS.map((id) => ({ id, name: t(`back_press_action_${id}`) }))
  }, [t])

  return (
    <SubTitle title={t('setting_player_back_press_action')}>
      <View style={styles.list}>
        {
          list.map(({ id, name }) => <Item name={name} id={id} key={id} />)
        }
      </View>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
