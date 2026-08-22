import { NativeModules } from 'react-native'

const { MiguSpider } = NativeModules

/**
 * KTV 桥接模块（咪咕爱唱纯 Java 实现）
 *
 * 底层由安卓原生 MiguSpiderModule 直连 tv.ising.migu.cn（咪咕爱唱 TV 版 API），
 * 不依赖任何 spider.jar / wexguard 加壳 / TVBox 运行时。协议（TripleDES + md5
 * 签名 + multipart）由 Python 实测验证可用。
 *
 * 暴露的标准 catvod 方法（返回 catvod JSON 字符串）：
 *   - initSpider()       初始化（无实际加载动作）
 *   - homeContent()      首页（推荐歌曲列表）
 *   - categoryContent()  分类列表（recommend 推荐 / rank 榜单 / songlist 歌单）
 *   - searchContent(kw)  搜索歌曲
 *   - detailContent(ids) 歌曲详情（解析播放地址）
 *   - playerContent(...) 取播放地址
 */

const ensure = () => {
  if (!MiguSpider) throw new Error('MiguSpider 原生模块不可用，请检查安卓原生代码是否已编译进 App')
  return MiguSpider
}

export const initKtvSpider = (): Promise<string> => ensure().initSpider()
export const ktvHome = (): Promise<string> => ensure().homeContent()
export const ktvCategory = (tid: string, page: string | number = 1): Promise<string> => ensure().categoryContent(String(tid), String(page))
export const ktvSearch = (keyword: string): Promise<string> => ensure().searchContent(keyword)
export const ktvDetail = (ids: string[]): Promise<string> => ensure().detailContent(ids)
export const ktvPlayer = (flag: string, id: string, urls: string[]): Promise<string> => ensure().playerContent(flag, id, urls)
export const ktvDestroy = (): Promise<string> => ensure().destroy()
