import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import styles from './style'
import CheckBox from '@/components/common/CheckBox'

export default () => {
  const t = useI18n()
  const isFull = useSettingValue('playDetail.style.lyricFullScreen')
  const setMode = (full: boolean) => {
    updateSetting({ 'playDetail.style.lyricFullScreen': full })
  }

  return (
    <View style={styles.container}>
      <Text>{t('play_detail_setting_lyric_mode')}</Text>
      <View style={styles.content}>
        <View style={styles.list}>
          <CheckBox marginBottom={3} check={!isFull} label={t('play_detail_setting_lyric_mode_normal')} onChange={() => setMode(false)} />
          <CheckBox marginBottom={3} check={isFull} label={t('play_detail_setting_lyric_mode_full')} onChange={() => setMode(true)} />
        </View>
      </View>
    </View>
  )
}
