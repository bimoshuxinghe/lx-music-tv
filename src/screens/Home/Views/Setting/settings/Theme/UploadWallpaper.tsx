import { memo, useCallback, useRef } from 'react'
import { View } from 'react-native'

import Button from '../../components/Button'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { getTheme } from '@/theme/themes'
import { applyTheme } from '@/core/theme'
import { createStyle } from '@/utils/tools'
import { selectFile, unlink, mkdir, moveFile, existsFile, extname, privateStorageDirectoryPath } from '@/utils/fs'
import { TEMP_FILE_PATH, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { log } from '@/utils/log'

const WALLPAPER_EXT_TYPES = ['jpg', 'jpeg', 'png', 'webp', 'bmp']
const WALLPAPER_DIR = `${privateStorageDirectoryPath}/theme_images`
const WALLPAPER_TEMP_PATH = `${TEMP_FILE_PATH}_wallpaper`

const refreshTheme = () => {
  void getTheme().then(applyTheme)
}

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const customBgImage = useSettingValue('theme.customBgImage')
  const isUploading = useRef(false)

  const handleUploadWallpaper = useCallback(async() => {
    if (isUploading.current) return
    isUploading.current = true
    try {
      const file = await selectFile({
        extTypes: WALLPAPER_EXT_TYPES,
        toPath: WALLPAPER_TEMP_PATH,
      })
      const filePath = file?.data
      if (!filePath) return
      if (!WALLPAPER_EXT_TYPES.some(ext => filePath.toLowerCase().endsWith('.' + ext))) {
        toast(t('setting_basic_theme_upload_wallpaper_type_tip'), 'long')
        void unlink(filePath).catch(() => {})
        return
      }
      if (!await existsFile(WALLPAPER_DIR)) await mkdir(WALLPAPER_DIR)
      const targetPath = `${WALLPAPER_DIR}/wallpaper_${Date.now()}.${extname(filePath)}`
      await moveFile(filePath, targetPath)
      updateSetting({ 'theme.customBgImage': targetPath })
      toast(t('setting_basic_theme_upload_wallpaper_success'), 'short')
      requestAnimationFrame(refreshTheme)
    } catch (err: any) {
      log.warn('upload wallpaper failed: ' + err.message)
      void unlink(WALLPAPER_TEMP_PATH).catch(() => {})
      toast(t('setting_basic_theme_upload_wallpaper_failed', { message: err.message ?? String(err) }), 'long')
    } finally {
      isUploading.current = false
    }
  }, [t])

  const handleClearWallpaper = useCallback(async() => {
    if (customBgImage) {
      void unlink(customBgImage).catch(() => {})
    }
    updateSetting({ 'theme.customBgImage': '' })
    requestAnimationFrame(refreshTheme)
  }, [customBgImage])

  return (
    <View style={styles.content}>
      <Text size={13} color={theme['c-font-label']}>{t('setting_basic_theme_upload_wallpaper_tip')}</Text>
      <View style={styles.btnGroup}>
        <Button onPress={() => { void handleUploadWallpaper() }}>{t('setting_basic_theme_upload_wallpaper')}</Button>
        {
          customBgImage
            ? <Button onPress={() => { void handleClearWallpaper() }}>{t('setting_basic_theme_clear_wallpaper')}</Button>
            : null
        }
      </View>
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
})
