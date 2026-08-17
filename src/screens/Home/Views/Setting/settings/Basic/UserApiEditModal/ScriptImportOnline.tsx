import { useRef, useImperativeHandle, forwardRef, useState, useEffect, memo } from 'react'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import Text from '@/components/common/Text'
import { View } from 'react-native'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { handleImportScript } from './action'
import { getIPV4Address } from '@/utils/nativeModules/utils'
import { startSourcePushServer, stopSourcePushServer, onSourcePushed } from '@/utils/nativeModules/sourcePush'
import qrcode from 'qrcode-generator'
import { log } from '@/utils/log'

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
  const dialogRef = useRef<DialogType>(null)
  const isStarting = useRef(false)
  const [visible, setVisible] = useState(false)
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    const handleImportContent = (script: string) => {
      if (script.length > 9_000_000) {
        toast(t('user_api_import_failed_tip', { message: 'Too large script' }), 'long')
        return
      }
      void handleImportScript(script, true)
      setTimeout(() => {
        dialogRef.current?.setVisible(false)
      }, 800)
    }
    const remove = onSourcePushed(({ script, url }) => {
      if (script) {
        handleImportContent(script)
      } else if (url) {
        void fetch(url).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.text()
        }).then(handleImportContent).catch((err: any) => {
          toast(t('user_api_import_failed_tip', { message: err.message ?? String(err) }), 'long')
        })
      }
    })
    return () => {
      remove()
      stopSourcePushServer()
    }
  }, [t])

  const handleCloseQr = () => {
    stopSourcePushServer()
  }

  const handleShow = async() => {
    if (isStarting.current) return
    isStarting.current = true
    try {
      const ip = await getIPV4Address()
      if (!ip || ip == '0.0.0.0') {
        toast(t('user_api_btn_import_online_qr_no_wifi'), 'long')
        return
      }
      const port = await startSourcePushServer()
      setQrUrl(`http://${ip}:${port}/`)
      if (visible) dialogRef.current?.setVisible(true)
      else {
        setVisible(true)
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
  useImperativeHandle(ref, () => ({
    show() {
      void handleShow()
    },
  }))

  return (
    <>
      {visible
        ? <Dialog ref={dialogRef} title={t('user_api_btn_import_online')} onHide={handleCloseQr}>
            <View style={styles.content}>
              <View style={styles.qrWrap}>
                {qrUrl ? <SourceQRCode url={qrUrl} /> : null}
              </View>
              <Text style={styles.tip} size={13} color={theme['c-font-label']}>{t('user_api_btn_import_online_qr_push_tip')}</Text>
              <Text style={styles.tip} size={12} color={theme['c-600']}>{t('user_api_qr_address')}{qrUrl}</Text>
            </View>
          </Dialog>
        : null}
    </>
  )
})


const styles = createStyle({
  content: {
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
})
