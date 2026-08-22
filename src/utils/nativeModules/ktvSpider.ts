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

export const mvSingers = async(gender: number | string): Promise<string> => ensure().singers(Number(gender))
export const mvSongs = async(keyword: string, page: string | number = 1): Promise<string> => ensure().songs(keyword, Number(page))
export const mvSearch = async(keyword: string): Promise<string> => ensure().search(keyword)
export const mvPlayer = async(id: string): Promise<string> => ensure().player(id)
export const mvSingerAvatar = async(name: string): Promise<string> => ensure().singerAvatar(name)
