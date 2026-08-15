import { USER_API_SOURCE_FILE_EXT_RXP } from '@/config/constant'
import { forwardRef, useImperativeHandle } from 'react'
import { handleImportLocalFile } from './action'
import { selectFile, unlink } from '@/utils/fs'
import { toast, TEMP_FILE_PATH } from '@/utils/tools'
import { useI18n } from '@/lang'
import { log } from '@/utils/log'
import { useUnmounted } from '@/utils/hooks'

// export interface ScriptImportExportProps {
//   // onRename: (listInfo: LX.List.UserListInfo) => void
//   // onImport: (index: number) => void
//   // onExport: (listInfo: LX.List.MyListInfo) => void
//   // onSync: (listInfo: LX.List.UserListInfo) => void
//   // onRemove: (listInfo: LX.List.MyListInfo) => void
// }
export interface ScriptImportExportType {
  import: () => void
  // export: (listInfo: LX.List.MyListInfo, index: number) => void
}

export default forwardRef<ScriptImportExportType, {}>((props, ref) => {
  const t = useI18n()
  const isUnmounted = useUnmounted()

  useImperativeHandle(ref, () => ({
    import() {
      void selectFile({
        extTypes: USER_API_SOURCE_FILE_EXT_RXP,
        toPath: TEMP_FILE_PATH,
      }).then((file) => {
        if (!file) return
        if (!USER_API_SOURCE_FILE_EXT_RXP.some(ext => file.data.toLowerCase().endsWith('.' + ext))) {
          toast(t('storage_file_no_match'), 'long')
          void unlink(file.data)
          return
        }
        handleImportLocalFile(file.data)
      }).catch(err => {
        if (isUnmounted.current) return
        log.warn('open document failed: ' + err.message)
        toast(t('storage_file_no_select_file_failed_tip'), 'long')
      })
    },
  }))

  return null
})
