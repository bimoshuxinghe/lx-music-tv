import { NativeModules, NativeEventEmitter, type EmitterSubscription } from 'react-native'

const { KtvDb } = NativeModules
const emitter = KtvDb ? new NativeEventEmitter(KtvDb) : null

/**
 * KTV 曲库数据库桥接模块
 *
 * 底层由安卓原生 KtvDbModule 管理：
 *   - ensureDb(url, force) 从服务器下载 ktv_song.db.xz（约 19MB）并解压到 App 私有目录
 *   - 查询接口基于本地 SQLite，返回 WritableMap/Array（JS 侧直接拿到对象/数组）
 *
 * 数据来源 song.db（点歌机曲库）：
 *   - song 表字段：id / name / singer / number / acronym(拼音) / format /
 *     mtvOrVcd(双音轨标记) / languageId / typeId / temperature
 */

const ensure = () => {
  if (!KtvDb) throw new Error('KtvDb 原生模块不可用，请检查安卓原生代码是否已编译进 App')
  return KtvDb
}

/** 曲库压缩包下载地址 */
export const KTV_DB_DOWNLOAD_URL = 'http://52xinghe.top/ktv_song.db.xz'

export type KtvDbSong = {
  id: number
  name: string
  singer: string
  number: number
  acronym: string
  format: string
  mtvOrVcd: string
  languageId: number
  typeId: number
  temperature: number
}

export type KtvDbCategory = { id: number, name: string, types: { id: number, name: string }[] }
export type KtvDbSinger = { id: number, name: string, acronym: string, formId: number, regionId: number }

export type KtvDbStatus = { exists: boolean, size: number, downloading: boolean }

/** 订阅下载进度事件，返回取消订阅函数 */
export const onKtvDbProgress = (cb: (p: { progress: number, downloading: boolean }) => void): EmitterSubscription => {
  if (!emitter) return { remove: () => {} } as unknown as EmitterSubscription
  return emitter.addListener('KtvDbDownloadProgress', cb)
}

export const ensureKtvDb = (url: string = KTV_DB_DOWNLOAD_URL, force = false): Promise<KtvDbStatus> => ensure().ensureDb(url, force)
export const getKtvDbStatus = (): Promise<KtvDbStatus> => ensure().getDbStatus()
export const clearKtvDb = (): Promise<KtvDbStatus> => ensure().clearDb()
export const searchKtvSongs = (keyword: string): Promise<KtvDbSong[]> => ensure().searchSongs(keyword)
export const getHotKtvSongs = (page = 1): Promise<KtvDbSong[]> => ensure().getHotSongs(page)
export const getKtvSongsByType = (typeId: number, page = 1): Promise<KtvDbSong[]> => ensure().getSongsByType(typeId, page)
export const getKtvSongsBySinger = (singer: string, page = 1): Promise<KtvDbSong[]> => ensure().getSongsBySinger(singer, page)
export const getKtvSongByNumber = (number: number): Promise<KtvDbSong | null> => ensure().getSongByNumber(number)
export const getKtvSingers = (letter = ''): Promise<KtvDbSinger[]> => ensure().getSingers(letter)
export const getKtvCategories = (): Promise<KtvDbCategory[]> => ensure().getCategories()
export const getKtvLanguages = (): Promise<{ id: number, name: string }[]> => ensure().getLanguages()
export const getKtvSongsByLanguage = (languageId: number, page = 1): Promise<KtvDbSong[]> => ensure().getSongsByLanguage(languageId, page)
export const getKtvSingerForms = (): Promise<{ id: number, name: string }[]> => ensure().getSingerForms()
export const getKtvSingerRegions = (): Promise<{ id: number, name: string }[]> => ensure().getSingerRegions()
