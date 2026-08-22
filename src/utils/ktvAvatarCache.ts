import { temporaryDirectoryPath, existsFile, readFile, writeFile, unlink } from '@/utils/fs'
import { mvSingerAvatar } from '@/utils/nativeModules/ktvSpider'

/**
 * KTV 歌手头像缓存：磁盘缓存 + 并发池 + 预取。
 *
 * 背景：歌手列表动辄几十人，逐个串行请求酷我搜索接口（每个 300ms-1s+），
 * 首次进入时大量并发请求会造成 UI 卡顿、返回键无响应。本模块：
 *  - 磁盘缓存：头像 URL 落到 CacheDir 的 json 文件，二次进入秒读，不重复请求；
 *  - 并发池：同时最多 3 个请求，避免请求风暴；
 *  - 失败静默：请求失败返回空，不抛错不阻塞。
 */

const CACHE_FILE = temporaryDirectoryPath + '/ktv_singer_avatar.json'

/** 内存缓存（避免每次读磁盘） */
let memCache: Record<string, string> | null = null
/** 磁盘缓存读写互斥 */
let diskIo: Promise<void> = Promise.resolve()

/** 并发池：同时最多 3 个请求 */
const CONCURRENCY = 3
let active = 0
const waitQueue: Array<() => void> = []

const acquire = async(): Promise<void> => new Promise((resolve) => {
  if (active < CONCURRENCY) {
    active += 1
    resolve()
  } else {
    waitQueue.push(resolve)
  }
})

const release = () => {
  active -= 1
  const next = waitQueue.shift()
  if (next) next()
}

const loadDiskCache = async(): Promise<Record<string, string>> => {
  if (memCache) return memCache
  let loaded: Record<string, string> = {}
  try {
    if (await existsFile(CACHE_FILE)) {
      const raw = await readFile(CACHE_FILE, 'utf8')
      const parsed = JSON.parse(raw) as Record<string, string>
      if (parsed && typeof parsed == 'object') loaded = parsed
    }
  } catch (e) {
    // 缓存损坏/不可读：忽略，走内存空缓存
  }
  memCache = loaded // eslint-disable-line require-atomic-updates
  return memCache
}

const saveDiskCache = () => {
  if (!memCache) return
  diskIo = diskIo.then(async() => {
    try {
      await writeFile(CACHE_FILE, JSON.stringify(memCache), 'utf8')
    } catch (e) {
      // 写缓存失败不影响功能
    }
  })
}

/** 清除磁盘缓存（头像接口失效时可调用） */
export const clearAvatarCache = async() => {
  memCache = null
  try {
    if (await existsFile(CACHE_FILE)) await unlink(CACHE_FILE)
  } catch (e) {
    // ignore
  }
}

/**
 * 获取歌手头像 URL：优先内存 → 磁盘缓存 → 网络请求（并发池）。
 * 网络请求成功结果会写入内存+磁盘缓存。
 */
export const getSingerAvatar = async(name: string): Promise<string> => {
  if (!name) return ''
  const cache = await loadDiskCache()
  if (cache[name]) return cache[name]

  await acquire()
  try {
    // 双重检查：排队期间可能已被其他请求写入
    if (memCache?.[name]) return memCache[name]
    const url = await mvSingerAvatar(name)
    if (url && memCache) {
      memCache[name] = url
      saveDiskCache()
    }
    return url ?? ''
  } catch (e) {
    return ''
  } finally {
    release()
  }
}

/** 预取一批歌手头像（进入歌手 Tab 时调用，逐步填充缓存） */
export const preloadSingerAvatars = async(names: string[]) => {
  const seen: Record<string, boolean> = {}
  // 用空闲时间分片预取，避免一次性占满并发池影响用户操作
  for (const name of names) {
    if (seen[name]) continue
    seen[name] = true
    if (memCache?.[name]) continue
    void getSingerAvatar(name)
  }
}
