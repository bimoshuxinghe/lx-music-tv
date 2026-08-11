import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import Popup, { type PopupType } from '@/components/common/Popup'
import { useI18n } from '@/lang'
import SettingHorizontal from '@/screens/Home/Views/Setting/Horizontal'

export interface SettingMenuPopupType {
  show: () => void
}

export default forwardRef<SettingMenuPopupType, {}>((props, ref) => {
  const [visible, setVisible] = useState(false)
  const popupRef = useRef<PopupType>(null)
  const t = useI18n()

  useImperativeHandle(ref, () => ({
    show() {
      if (visible) popupRef.current?.setVisible(true)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          popupRef.current?.setVisible(true)
        })
      }
    },
  }))

  return (
    visible
      ? (
        <Popup ref={popupRef} title={t('nav_setting')} position="right" closeBtn>
          <SettingHorizontal />
        </Popup>
        )
      : null
  )
})
