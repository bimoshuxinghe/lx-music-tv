import { readMetadata } from '@/utils/localMediaMetadata'
import { handleImportList } from '@/screens/Home/Views/Setting/settings/Backup/actions'
import { handleImportLocalFile } from '@/screens/Home/Views/Setting/settings/Basic/UserApiEditModal/action'
import { type FileType } from '@/utils/fs'
import playerState from '@/store/player/state'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { LIST_IDS } from '@/config/constant'
import { playNext } from '@/core/player/player'
import { buildLocalMusicInfo, buildLocalMusicInfoByFilePath } from '@/screens/Home/Views/Mylist/MyList/listAction'


export const handleFileLXMCAction = async(file: FileType) => {
  handleImportList(file.path)
}

export const handleFileMusicAction = async(file: FileType) => {
  const info = await readMetadata(file.path)
  const isPlaying = !!playerState.playMusicInfo.musicInfo
  const musicInfo = info ? buildLocalMusicInfo(file.path, info) : buildLocalMusicInfoByFilePath(file)
  console.log(musicInfo)
  addTempPlayList([{ listId: LIST_IDS.PLAY_LATER, musicInfo, isTop: true }])
  if (isPlaying) void playNext()
}

export const handleFileJSAction = async(file: FileType) => {
  handleImportLocalFile(file.path)
}
