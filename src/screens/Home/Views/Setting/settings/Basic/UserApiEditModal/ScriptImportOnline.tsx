import { useRef, useImperativeHandle, forwardRef, useState, useEffect, memo } from 'react'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import Text from '@/components/common/Text'
import { View } from 'react-native'
import Input, { type InputType } from '@/components/common/Input'
import Button from '@/components/common/Button'
import { createStyle, toast, TEMP_FILE_PATH } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { httpFetch } from '@/utils/request'
import { handleImportScript } from './action'
import { selectFile, unlink } from '@/utils/fs'
import { decodeQrFromFile } from '@/utils/qrDecode'
import { getWIFIIPV4Address } from '@/utils/nativeModules/utils'
import { startSourcePushServer, stopSourcePushServer, onSourcePushed } from '@/utils/nativeModules/sourcePush'
import qrcode from 'qrcode-generator'
import { log } from '@/utils/log'

interface UrlInputType {
  setText: (text: string) => void
  getText: () => string
  focus: () => void
}
const UrlInput = forwardRef<UrlInputType, {}>((props, ref) => {
  const theme = useTheme()
  const [text, setText] = useState('')
  const [placeholder, setPlaceholder] = useState('')
  const inputRef = useRef<InputType>(null)

  useImperativeHandle(ref, () => ({
    getText() {
      return text.trim()
    },
    setText(text) {
      setText(text)
      setPlaceholder(global.i18n.t('user_api_btn_import_online_input_tip'))
    },
    focus() {
      inputRef.current?.focus()
    },
  }))

  return (
    <Input
      ref={inputRef}
      placeholder={placeholder}
      value={text}
      onChangeText={setText}
      style={{ ...styles.input, backgroundColor: theme['c-primary-input-background'] }}
    />
  )
})

const QR_CELL_SIZE = 6
const QR_MARGIN = 10
const SourceQRCode = memo(({ url }: { url: string }) => {
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

export interface ScriptImportOnlineType {
  show: () => void
}


export default forwardRef<ScriptImportOnlineType, {}>((props, ref) => {
  const t = useI18n()
  const theme = useTheme()
  const alertRef = useRef<ConfirmAlertType>(null)
  const dialogRef = useRef<DialogType>(null)
  const urlInputRef = useRef<UrlInputType>(null)
  const isStarting = useRef(false)
  const [alertVisible, setAlertVisible] = useState(false)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [btn, setBtn] = useState({ disabled: false, text: t('user_api_btn_import_online_input_confirm') })

  useEffect(() => {
    const remove = onSourcePushed(script => {
      if (script.length > 9_000_000) {
        toast(t('user_api_import_failed_tip', { message: 'Too large script' }), 'long')
        return
      }
      void handleImportScript(script, true)
      setTimeout(() => {
        dialogRef.current?.setVisible(false)
      }, 800)
    })
    return () => {
      remove()
      stopSourcePushServer()
    }
  }, [t])

  const handleCloseQr = () => {
    stopSourcePushServer()
  }

  const handleShowQr = async() => {
    if (isStarting.current) return
    isStarting.current = true
    try {
      const ip = await getWIFIIPV4Address()
      if (!ip || ip == '0.0.0.0') {
        toast(t('user_api_btn_import_online_qr_no_wifi'), 'long')
        return
      }
      const port = await startSourcePushServer()
      setQrUrl(`http://${ip}:${port}/`)
      if (dialogVisible) dialogRef.current?.setVisible(true)
      else {
        setDialogVisible(true)
        requestAnimationFrame(() => {
          dialogRef.current?.setVisible(true)
        })
      }
    } catch (err: any) {
      log.warn('start source push server failed: ' + err.message)
      stopSourcePushServer()
      toast(t('user_api_btn_import_online_qr_start_failed', { message: err.message ?? String(err) }), 'long')
    } finally {
      isStarting.current = false
    }
  }

  const handleShowUrl = () => {
    if (alertVisible) alertRef.current?.setVisible(true)
    else {
      setAlertVisible(true)
      requestAnimationFrame(() => {
        alertRef.current?.setVisible(true)
      })
    }
    setBtn({ disabled: false, text: t('user_api_btn_import_online_input_confirm') })
    requestAnimationFrame(() => {
      urlInputRef.current?.setText('')
      setTimeout(() => {
        urlInputRef.current?.focus()
      }, 300)
    })
  }
  useImperativeHandle(ref, () => ({
    show() {
      void handleShowQr()
    },
  }))

  const doImport = async(url: string) => {
    setBtn({ disabled: true, text: t('user_api_btn_import_online_input_loading') })
    let script: string
    try {
      script = await httpFetch(url).promise.then(resp => resp.body) as string
    } catch (err: any) {
      toast(t('user_api_import_failed_tip', { message: err.message }), 'long')
      return
    } finally {
      setBtn({ disabled: false, text: t('user_api_btn_import_online_input_confirm') })
    }
    if (script.length > 9_000_000) {
      toast(t('user_api_import_failed_tip', { message: 'Too large script' }), 'long')
      return
    }
    void handleImportScript(script)

    alertRef.current?.setVisible(false)
  }

  const handleImport = async() => {
    let url = urlInputRef.current?.getText() ?? ''
    if (!/^https?:\/\//.test(url)) {
      url = ''
      urlInputRef.current?.setText('')
    }
    if (!url.length) return
    await doImport(url)
  }

  // 本地图片识别二维码（TV 设备没有摄像头时可以用其他设备截图后导入）
  const handleLocalImageQr = async() => {
    try {
      const file = await selectFile({
        extTypes: ['jpg', 'jpeg', 'png', 'webp', 'bmp'],
        toPath: TEMP_FILE_PATH + '_qr',
      })
      if (!file?.data) return
      try {
        const decoded = await decodeQrFromFile(file.data)
        if (!decoded) {
          toast(t('user_api_btn_import_online_qr_scan_no_url'), 'long')
          return
        }
        let url = decoded.trim()
        const urlMatch = url.match(/https?:\/\/[^\s"'<>]+/)
        if (urlMatch) url = urlMatch[0]
        if (!/^https?:\/\//.test(url)) {
          toast(t('user_api_btn_import_online_qr_scan_no_url'), 'long')
          return
        }
        urlInputRef.current?.setText(url)
        toast(t('user_api_btn_import_online_qr_scan_success'), 'short')
      } catch (err: any) {
        toast(t('user_api_btn_import_online_qr_scan_failed', { message: err.message ?? String(err) }), 'long')
      } finally {
        void unlink(file.data).catch(() => {})
      }
    } catch (err: any) {
      // 用户取消选择文件，不提示
    }
  }

  return (
    <>
      {dialogVisible
        ? <Dialog ref={dialogRef} title={t('user_api_btn_import_online')} onHide={handleCloseQr}>
            <View style={styles.qrContent}>
              <View style={styles.qrWrap}>
                {qrUrl ? <SourceQRCode url={qrUrl} /> : null}
              </View>
              <Text style={styles.tip} size={13} color={theme['c-font-label']}>{t('user_api_btn_import_online_qr_push_tip')}</Text>
              <Text style={styles.tip} size={12} color={theme['c-600']}>{t('user_api_qr_address')}{qrUrl}</Text>
              <View style={styles.btnRow}>
                <Button
                  style={{ ...styles.qrBtn, backgroundColor: theme['c-button-background'], borderColor: theme['c-primary-light-300-alpha-400'] }}
                  onPress={handleShowUrl}
                >
                  <Text size={13} color={theme['c-button-font']}>{t('user_api_btn_import_online_url_import')}</Text>
                </Button>
              </View>
            </View>
          </Dialog>
        : null}
      {alertVisible
        ? <ConfirmAlert
            ref={alertRef}
            onConfirm={handleImport}
            disabledConfirm={btn.disabled}
            confirmText={btn.text}
          >
            <View style={styles.reurlContent}>
              <Text style={{ marginBottom: 5 }}>{ t('user_api_btn_import_online')}</Text>
              <UrlInput ref={urlInputRef} />
              <View style={styles.btnRow}>
                <Button
                  style={{ ...styles.qrBtn, backgroundColor: theme['c-button-background'], borderColor: theme['c-primary-light-300-alpha-400'] }}
                  onPress={handleLocalImageQr}
                >
                  <Text size={13} color={theme['c-button-font']}>{t('user_api_btn_import_online_qr_local')}</Text>
                </Button>
                <Button
                  style={{ ...styles.qrBtn, backgroundColor: theme['c-button-background'], borderColor: theme['c-primary-light-300-alpha-400'] }}
                  onPress={() => {
                    alertRef.current?.setVisible(false)
                    void handleShowQr()
                  }}
                >
                  <Text size={13} color={theme['c-button-font']}>{t('user_api_btn_import_online_qr_push')}</Text>
                </Button>
              </View>
            </View>
          </ConfirmAlert>
        : null}
    </>
  )
})


const styles = createStyle({
  reurlContent: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'column',
  },
  qrContent: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'column',
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
  btnRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  qrBtn: {
    flex: 1,
    padding: 6,
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 290,
    borderRadius: 4,
  },
})
