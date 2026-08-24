import { temporaryDirectoryPath, existsFile, readFile, writeFile } from '@/utils/fs'
import { mvSingerAvatar } from '@/utils/nativeModules/ktvSpider'

/**
 * KTV 歌手头像缓存：内存 Map + 磁盘持久化 + 高并发预取。
 *
 * 策略：
 *  - 内存 Map：app 运行期间常驻，命中率极高；
 *  - 磁盘持久化：app 重启后直接读本地 json，无需再请求接口；
 *  - 并发池 8 路：首次进入几十名歌手并行加载，不再串行卡顿。
 */

const CACHE_FILE = temporaryDirectoryPath + '/ktv_singer_avatar.json'
const CONCURRENCY = 4

// ---- 内存缓存 ----
let memCache: Record<string, string> | null = null

// ---- 磁盘 IO 互斥 ----
let diskIo: Promise<void> = Promise.resolve()

// ---- 并发池 ----
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

// ---- 磁盘读写 ----
const loadDiskCache = async(): Promise<Record<string, string>> => {
  if (memCache !== null) return memCache
  try {
    if (await existsFile(CACHE_FILE)) {
      const raw = await readFile(CACHE_FILE, 'utf8')
      const parsed = JSON.parse(raw) as Record<string, string>
      if (parsed && typeof parsed === 'object') {
        // eslint-disable-next-line require-atomic-updates
        memCache = parsed
        return memCache
      }
    }
  } catch (e) {
    // 缓存损坏忽略
  }
  // eslint-disable-next-line require-atomic-updates
  memCache = {}
  return memCache
}

const saveDiskCache = () => {
  if (memCache === null || Object.keys(memCache).length === 0) return
  diskIo = diskIo.then(async() => {
    try {
      await writeFile(CACHE_FILE, JSON.stringify(memCache), 'utf8')
    } catch (e) { /* ignore */ }
  })
}

/** 清除所有缓存（接口失效时调用） */
export const clearAvatarCache = async(): Promise<void> => {
  memCache = null
}

/** 获取歌手头像 URL，走内存→磁盘→网络三级查找 */
export const getSingerAvatar = async(name: string): Promise<string> => {
  if (!name) return ''
  // 1. 内存命中
  const cached = memCache?.[name]
  if (cached) return cached
  // 2. 确保磁盘已加载
  const cache = await loadDiskCache()
  if (cache[name]) return cache[name]
  // 3. 网络请求（并发池）
  await acquire()
  try {
    // 双重检查
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

/** 批量预取歌手头像（进入歌手 Tab 时调用，异步不阻塞 UI） */
export const preloadSingerAvatars = async(names: string[]) => {
  if (!names?.length) return
  await loadDiskCache()
  const pending: string[] = []
  for (const name of names) {
    if (!name) continue
    if (memCache?.[name]) continue
    pending.push(name)
  }
  pending.forEach(name => { void getSingerAvatar(name).catch(() => {}) })
}
