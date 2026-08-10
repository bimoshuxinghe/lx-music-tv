import { memo, useMemo } from 'react'

import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'

const ANIMATED_STYLES: Array<LX.AppSetting['playDetail.style.lrcAnimatedStyle']> = ['none', 'zoom', 'bounce', 'fade', 'random']

const useActive = (id: LX.AppSetting['playDetail.style.lrcAnimatedStyle']) => {
  const q = useSettingValue('playDetail.style.lrcAnimatedStyle')
  const isActive = useMemo(() => q == id, [q, id])
  return isActive
}

const Item = ({ id, name }: {
  id: LX.AppSetting['playDetail.style.lrcAnimatedStyle']
  name: string
}) => {
  const isActive = useActive(id)
  return <CheckBox marginRight={8} check={isActive} label={name} onChange={() => { updateSetting({ 'playDetail.style.lrcAnimatedStyle': id }) }} need />
}

export default memo(() => {
  const t = useI18n()
  const list = useMemo(() => {
    return ANIMATED_STYLES.map((id) => ({ id, name: t(`lrc_animated_style_${id}`) }))
  }, [t])

  return (
    <SubTitle title={t('setting_player_lrc_animated_style')}>
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
