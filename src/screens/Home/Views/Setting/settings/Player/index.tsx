import { memo } from 'react'

import Section from '../../components/Section'
import IsSavePlayTime from './IsSavePlayTime'
import PlayHighQuality from './PlayHighQuality'
import LrcAnimatedStyle from './LrcAnimatedStyle'
import BackPressAction from './BackPressAction'
import { useI18n } from '@/lang'


export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_player')}>
      <PlayHighQuality />
      <IsSavePlayTime />
      <LrcAnimatedStyle />
      <BackPressAction />
    </Section>
  )
})
