import { connectServer } from '@/plugins/sync'
import { updateSetting } from '@/core/common'
import { getSyncHost } from '@/plugins/sync/data'


export default async(setting: LX.AppSetting) => {
  if (!setting['sync.enable']) return

  const host = await getSyncHost()
  if (!host) {
    updateSetting({ 'sync.enable': false })
    return
  }
  void connectServer(host)
}
