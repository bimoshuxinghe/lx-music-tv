import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'

import Button from '../../components/Button'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import Slider, { type SliderProps } from '@/components/common/Slider'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { getTheme } from '@/theme/themes'
import { applyTheme } from '@/core/theme'
import { createStyle, toast } from '@/utils/tools'
import { unlink, mkdir, existsFile, privateStorageDirectoryPath } from '@/utils/fs'
import { useTheme } from '@/store/theme/hook'
import { getWIFIIPV4Address } from '@/utils/nativeModules/utils'
import { startWallpaperServer, stopWallpaperServer, onWallpaperUploaded } from '@/utils/nativeModules/wallpaper'
import qrcode from 'qrcode-generator'
import { log } from '@/utils/log'

const WALLPAPER_DIR = `${privateStorageDirectoryPath}/theme_images`
const QR_CELL_SIZE = 6
const QR_MARGIN = 10

const refreshTheme = () => {
  void getTheme().then(applyTheme)
}

const WallpaperQRCode = memo(({ url }: { url: string }) => {
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()
  const count = qr.getModuleCount()
  const cells = []
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      cells.push(<View key={`${row}_${col}`} style={{
        width: QR_CELL_SIZE,
        height: QR_CELL_SIZE,
        backgroundColor: qr.isDark(row, col) ? '#000' : '#FFF',
      }} />)
    }
  }
  return (
    <View style={{
      backgroundColor: '#FFF',
      padding: QR_MARGIN,
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: QR_CELL_SIZE * count + QR_MARGIN * 2,
    }}>
      {cells}
    </View>
  )
})

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const customBgImage = useSettingValue('theme.customBgImage')
  const isStarting = useRef(false)
  const dialogRef = useRef<DialogType>(null)
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    const remove = onWallpaperUploaded(path => {
      updateSetting({ 'theme.customBgImage': path })
      toast(t('setting_basic_theme_upload_wallpaper_success'), 'short')
      requestAnimationFrame(refreshTheme)
      stopWallpaperServer()
      setTimeout(() => {
        dialogRef.current?.setVisible(false)
      }, 1000)
    })
    return () => {
      remove()
      stopWallpaperServer()
    }
  }, [t])

  const handleCloseQR = useCallback(() => {
    stopWallpaperServer()
    dialogRef.current?.setVisible(false)
  }, [])

  const handlePushWallpaper = useCallback(async() => {
    if (isStarting.current) return
    isStarting.current = true
    try {
      const ip = await getWIFIIPV4Address()
      if (!ip || ip == '0.0.0.0') {
        toast(t('setting_basic_theme_upload_wallpaper_no_wifi'), 'long')
        return
      }
      if (!await existsFile(WALLPAPER_DIR)) await mkdir(WALLPAPER_DIR)
      const port = await startWallpaperServer(WALLPAPER_DIR)
      setQrUrl(`http://${ip}:${port}/`)
      dialogRef.current?.setVisible(true)
    } catch (err: any) {
      log.warn('start wallpaper server failed: ' + err.message)
      stopWallpaperServer()
      toast(t('setting_basic_theme_upload_wallpaper_start_failed', { message: err.message ?? String(err) }), 'long')
    } finally {
      isStarting.current = false
    }
  }, [t])

  const handleClearWallpaper = useCallback(async() => {
    if (customBgImage) {
      void unlink(customBgImage).catch(() => {})
    }
    updateSetting({ 'theme.customBgImage': '' })
    requestAnimationFrame(refreshTheme)
  }, [customBgImage])

  const handleApplyWallpaper = useCallback(() => {
    requestAnimationFrame(refreshTheme)
    toast(t('setting_basic_theme_apply_wallpaper_success'), 'short')
  }, [t])

  const maskOpacity = useSettingValue('theme.wallpaperMask')
  const [sliderMask, setSliderMask] = useState(maskOpacity)
  const [isSliding, setSliding] = useState(false)
  const handleSlidingStart: SliderProps['onSlidingStart'] = () => {
    setSliding(true)
  }
  const handleMaskChange: SliderProps['onValueChange'] = value => {
    setSliderMask(value)
  }
  const handleMaskComplete: SliderProps['onSlidingComplete'] = value => {
    setSliding(false)
    if (maskOpacity == value) return
    updateSetting({ 'theme.wallpaperMask': value })
    requestAnimationFrame(refreshTheme)
  }

  return (
    <View style={styles.content}>
      <Text size={13} color={theme['c-font-label']}>{t('setting_basic_theme_upload_wallpaper_tip')}</Text>
      {
        customBgImage
          ? (
              <>
                <View style={styles.previewWrap}>
                  <Image url={customBgImage} style={styles.preview} resizeMode="cover" />
                </View>
                <View style={styles.maskWrap}>
                  <Text size={13} color={theme['c-font-label']}>{t('setting_basic_theme_wallpaper_mask')}: {isSliding ? sliderMask : maskOpacity}</Text>
                  <View style={styles.maskSlider}>
                    <Slider
                      minimumValue={0}
                      maximumValue={100}
                      onSlidingComplete={handleMaskComplete}
                      onValueChange={handleMaskChange}
                      onSlidingStart={handleSlidingStart}
                      step={1}
                      value={maskOpacity}
                    />
                  </View>
                  <Text size={12} color={theme['c-600']}>{t('setting_basic_theme_wallpaper_mask_tip')}</Text>
                </View>
              </>
            )
          : null
      }
      <View style={styles.btnGroup}>
        <Button onPress={() => { void handlePushWallpaper() }}>{t('setting_basic_theme_upload_wallpaper')}</Button>
        {
          customBgImage
            ? (
                <>
                  <Button onPress={handleApplyWallpaper}>{t('setting_basic_theme_apply_wallpaper')}</Button>
                  <Button onPress={() => { void handleClearWallpaper() }}>{t('setting_basic_theme_clear_wallpaper')}</Button>
                </>
              )
            : null
        }
      </View>
      <Dialog ref={dialogRef} title={t('setting_basic_theme_upload_wallpaper')} onHide={handleCloseQR}>
        <View style={styles.modalContent}>
          <ScrollView>
            <View style={styles.qrWrap}>
              {
                qrUrl
                  ? <WallpaperQRCode url={qrUrl} />
                  : null
              }
            </View>
            <Text style={styles.tip} size={13} color={theme['c-font-label']}>{t('setting_basic_theme_upload_wallpaper_scan_tip')}</Text>
            <Text style={styles.tip} size={13} color={theme['c-font-label']}>{t('setting_basic_theme_upload_wallpaper_scan_tip2')}</Text>
            <Text style={styles.tip} size={13} color={theme['c-600']}>{t('setting_basic_theme_upload_wallpaper_url')}: {qrUrl}</Text>
          </ScrollView>
        </View>
      </Dialog>
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
  btnGroup: {
    flexDirection: 'row',
    marginTop: 8,
  },
  previewWrap: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  preview: {
    width: 240,
    height: 135,
    borderRadius: 4,
  },
  maskWrap: {
    marginTop: 8,
  },
  maskSlider: {
    marginTop: 4,
  },
  modalContent: {
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: 10,
    paddingBottom: 10,
  },
  qrWrap: {
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 10,
  },
  tip: {
    marginTop: 4,
    textAlign: 'center',
  },
})
