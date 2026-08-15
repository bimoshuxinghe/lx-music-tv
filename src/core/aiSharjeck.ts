import { toast } from '@/utils/tools'
import { getOtherSource } from '@/core/music/utils'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { playNext } from '@/core/player/player'
import playerState from '@/store/player/state'
import { LIST_IDS } from '@/config/constant'
import { getPendingCommand, onAISearch, registerAISharjeck, type AISearchCommand } from '@/utils/nativeModules/aiSharjeck'

/**
 * 解析夏杰语音搜索指令：
 * 优先使用 singerName + songName；
 * 否则按 "歌手 - 歌名" 拆分 keyword，无法拆分时整个 keyword 当作歌名。
 */
const parseSearchCommand = (command: AISearchCommand): { name: string, singer: string } => {
  const songName = (command.songName || '').trim()
  const singerName = (command.singerName || '').trim()
  if (songName) return { name: songName, singer: singerName }
  const keyword = (command.keyword || '').trim()
  if (!keyword) return { name: '', singer: '' }
  const sepIndex = keyword.indexOf('-')
  if (sepIndex > -1) {
    const singer = keyword.substring(0, sepIndex).trim()
    const name = keyword.substring(sepIndex + 1).trim()
    if (name) return { name, singer }
  }
  return { name: keyword, singer: singerName }
}

/**
 * 处理语音点歌指令：跨音源搜索歌名，命中后直接播放第一首结果
 */
export const handleSearchPlay = async(command: AISearchCommand) => {
  const { name, singer } = parseSearchCommand(command)
  if (!name) return
  try {
    const musicList = await getOtherSource({
      name,
      singer,
      interval: '',
      meta: { albumName: '' },
      source: 'local',
      id: `ai_${name}_s${singer}`,
    })
    if (!musicList.length) {
      toast(global.i18n.t('ai_search_not_found', { name: name.length > 20 ? `${name.slice(0, 20)}…` : name }))
      return
    }
    const musicInfo = musicList[0]
    const isPlaying = !!playerState.playMusicInfo.musicInfo
    addTempPlayList([{ listId: LIST_IDS.PLAY_LATER, musicInfo, isTop: true }])
    if (isPlaying) playNext()
  } catch (err) {
    console.error(err)
  }
}

let inited = false
/**
 * 初始化夏杰语音对接：
 *  - 向夏杰语音注册
 *  - 拉取应用被杀后重启时暂存的待处理指令
 *  - 监听实时语音点歌指令
 */
export const initAISharjeck = async() => {
  if (inited) return
  inited = true
  try {
    registerAISharjeck()
  } catch (err) {
    console.error(err)
  }
  onAISearch(command => {
    void handleSearchPlay(command)
    void getPendingCommand().catch(() => null)
  })
  const pending = await getPendingCommand().catch(() => null)
  if (pending && (pending.songName || pending.keyword)) {
    void handleSearchPlay(pending)
  }
}
