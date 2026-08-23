import { NativeModules } from 'react-native'

const { CfssSpider } = NativeModules

/**
 * MV 桥接模块（初心娱乐 cfss.cc 纯 Java 实现）
 *
 * 底层由安卓原生 CfssSpiderModule 直连 cfss.cc/mv，返回 catvod JSON：
 *   - singers(gender)          歌手列表（1=男 2=女）
 *   - songs(keyword, page)     MV 列表（歌手名/歌曲单id/空=热门），每页300首
 *   - search(keyword)          搜索提示（歌手/歌名）
 *   - player(id)               播放地址（跟随 302 返回 kugou 直链）
 */

const ensure = () => {
  if (!CfssSpider) throw new Error('CfssSpider 原生模块不可用，请检查安卓原生代码是否已编译进 App')
  return CfssSpider
}

// 请求超时（毫秒）
const TIMEOUT = 15000

/** 包装原始请求，添加超时保护，避免阻塞 JS 线程导致界面卡死 */
const withTimeout = <T>(fn: () => Promise<T>, ms: number = TIMEOUT): Promise<T> => {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`请求超时(${ms}ms)`)), ms)
    ),
  ])
}

export const mvSingers = async(gender: number | string): Promise<string> =>
  withTimeout(() => ensure().singers(Number(gender)))

export const mvSongs = async(keyword: string, page: string | number = 1): Promise<string> =>
  withTimeout(() => ensure().songs(keyword, Number(page)))

export const mvSearch = async(keyword: string): Promise<string> =>
  withTimeout(() => ensure().search(keyword))

export const mvPlayer = async(id: string): Promise<string> =>
  withTimeout(() => ensure().player(id))

export const mvSingerAvatar = async(name: string): Promise<string> =>
  withTimeout(() => ensure().singerAvatar(name))
