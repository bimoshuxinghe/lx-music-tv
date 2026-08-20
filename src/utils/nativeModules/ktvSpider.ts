import { NativeModules, type Promise } from 'react-native'

const { KtvSpider } = NativeModules

/**
 * KTV 桥接模块
 *
 * 底层由安卓原生 KtvSpiderModule 加载你提供的 spider（catvod 框架 + wexguard 保护）
 * 中的 com.github.catvod.spider.MusicAiIKtv 类，并把标准 catvod 方法暴露给 JS：
 *   - initSpider()       首次使用时初始化（加载 dex、解密并实例化 MusicAiIKtv）
 *   - homeContent()      首页（分类 + 推荐列表）
 *   - categoryContent()  某个分类下的列表
 *   - searchContent(kw)  搜索歌曲
 *   - detailContent(ids) 歌曲详情
 *   - playerContent(...) 取播放地址
 *
 * 返回的都是 catvod 标准 JSON 字符串，调用方自行 JSON.parse。
 */

const ensure = () => {
  if (!KtvSpider) throw new Error('KtvSpider 原生模块不可用，请检查安卓原生代码是否已编译进 App')
  return KtvSpider
}

export const initKtvSpider = (): Promise<string> => ensure().initSpider()
export const ktvHome = (): Promise<string> => ensure().homeContent()
export const ktvCategory = (tid: string, page: string | number = 1): Promise<string> => ensure().categoryContent(String(tid), String(page))
export const ktvSearch = (keyword: string): Promise<string> => ensure().searchContent(keyword)
export const ktvDetail = (ids: string[]): Promise<string> => ensure().detailContent(ids)
export const ktvPlayer = (flag: string, id: string, urls: string[]): Promise<string> => ensure().playerContent(flag, id, urls)
export const ktvDestroy = (): Promise<string> => ensure().destroy()
