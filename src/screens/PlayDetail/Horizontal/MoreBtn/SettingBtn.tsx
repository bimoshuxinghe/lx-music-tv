import { memo, useRef } from 'react'
import SettingPopup, { type SettingPopupType } from '../../components/SettingPopup'
import Btn from './Btn'

export default memo(() => {
  const popupRef = useRef<SettingPopupType>(null)

  const showSetting = () => {
    popupRef.current?.show()
  }

  return (
    <>
      <Btn icon="slider" onPress={showSetting} />
      <SettingPopup ref={popupRef} position="left" direction="horizontal" />
    </>
  )
})
