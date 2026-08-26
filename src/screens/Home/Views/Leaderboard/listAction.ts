import { createList, setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { getListDetail, getListDetailAll } from '@/core/leaderboard'
import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'
import syncSourceList from '@/core/syncSourceList'
import { toMD5, toast } from '@/utils/tools'


const getListId = (id: string) => `board__${id}`

export const handlePlay = async(id: string, list?: LX.Music.MusicInfoOnline[], index = 0) => {
  let isPlayingList = false
  const listId = getListId(id)
  if (!list?.length) list = (await getListDetail(id, 1)).list
  if (list?.length) {
    await setTempList(listId, [...list])
    void playList(LIST_IDS.TEMP, index)
    isPlayingList = true
  }
  const fullList = await getListDetailAll(id)
  if (!fullList.length) return
  if (isPlayingList) {
    if (listState.tempListMeta.id == listId) {
      await setTempList(listId, [...fullList])
    }
  } else {
    await setTempList(listId, [...fullList])
    void playList(LIST_IDS.TEMP, index)
  }
}

export const handleCollect = async(id: string, name: string, source: LX.OnlineSource) => {
  const listId = getListId(id)
  const targetList = listState.userList.find(l => l.sourceListId == listId)
  if (targetList) {
    void syncSourceList(targetList)
    return
  }

  const list = await getListDetailAll(id)
  await createList({
    name,
    id: `${source}_${toMD5(listId)}`,
    list,
    source,
    sourceListId: listId,
  })
  toast(global.i18n.t('collect_success'))
}
