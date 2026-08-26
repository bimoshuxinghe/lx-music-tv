import { initSetting, updateSetting } from '@/core/common'
import registerPlaybackService from '@/plugins/player/service'
import initTheme from './theme'
import initI18n from './i18n'
import initUserApi from './userApi'
import initPlayer from './player'
import dataInit from './dataInit'
import initSync from './sync'
import initCommonState from './common'
import { initDeeplink } from './deeplink'
import { initAISharjeck } from '@/core/aiSharjeck'
import { setApiSource } from '@/core/apiSource'
import commonActions from '@/store/common/action'
import settingState from '@/store/setting/state'
import { checkUpdate } from '@/core/version'
import { bootLog } from '@/utils/bootLog'
import { cheatTip } from '@/utils/tools'
import { setFocusBorderColor } from '@/utils/nativeModules/utils'

let isFirstPush = true
const handlePushedHomeScreen = async() => {
  await cheatTip()
  // TV 版默认同意协议，不弹许可弹窗（电视遥控器操作不便）
  if (!settingState.setting['common.isAgreePact']) {
    updateSetting({ 'common.isAgreePact': true })
  }
  if (isFirstPush) {
    isFirstPush = false
    void checkUpdate()
    void initDeeplink()
    void initAISharjeck()
  }
}

let isInited = false
export default async() => {
  if (isInited) return handlePushedHomeScreen
  bootLog('Initing...')
  commonActions.setFontSize(global.lx.fontSize)
  bootLog('Font size changed.')
  const setting = await initSetting()
  bootLog('Setting inited.')

  await initTheme(setting)
  bootLog('Theme inited.')
  await initI18n(setting)
  bootLog('I18n inited.')

  // 应用用户自定义焦点框颜色
  const focusBorderColor = settingState.setting['theme.focusBorderColor']
  if (focusBorderColor) setFocusBorderColor(focusBorderColor)
  bootLog('Focus border color applied.')

  await initUserApi(setting)
  bootLog('User Api inited.')

  setApiSource(settingState.setting['common.apiSource'])
  bootLog('Api inited.')

  registerPlaybackService()
  bootLog('Playback Service Registered.')
  await initPlayer(setting)
  bootLog('Player inited.')
  await dataInit(setting)
  bootLog('Data inited.')
  await initCommonState(setting)
  bootLog('Common State inited.')

  void initSync(setting)
  bootLog('Sync inited.')

  // syncSetting()

  isInited ||= true

  return handlePushedHomeScreen
}
