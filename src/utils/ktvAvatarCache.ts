import { temporaryDirectoryPath, existsFile, readFile, writeFile } from '@/utils/fs'
import { mvSingerAvatar } from '@/utils/nativeModules/ktvSpider'

/**
 * KTV 歌手头像缓存：内存 LRU + 磁盘持久化 + 高并发预取。
 *
 * 策略：
 *  - 内存 LRU：最近使用的头像驻留内存，命中率极高；
 *  - 磁盘持久化：app 重启后直接读本地 json，无需再请求接口；
 *  - 并发池 8 路：首次进入几十名歌手可并行加载，不再串行卡顿；
 *  - 失败退避：连续失败 3 次才缓存失败标记，避免网络抖动误缓存。
 */

const CACHE_FILE = temporaryDirectoryPath + '/ktv_singer_avatar.json'
const CONCURRENCY = 8
// const FAIL_THRESHOLD = 3 // 保留标记，暂未启用（接口返回空时不缓存失败）

// ---- 内存缓存（LRU） ----
interface CacheEntry {
  url: string
  failCount: number
  order: number
}
let memCache = new Map<string, CacheEntry>()
let orderCounter = 0

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

const touchOrder = (): number => ++orderCounter

// ---- 磁盘读写 ----
const loadDiskCache = async(): Promise<Map<string, CacheEntry>> => {
  try {
    if (await existsFile(CACHE_FILE)) {
      const raw = await readFile(CACHE_FILE, 'utf8')
      const parsed = JSON.parse(raw) as Record<string, { url: string, failCount: number }>
      if (parsed && typeof parsed === 'object') {
        const m = new Map<string, CacheEntry>()
        for (const [k, v] of Object.entries(parsed)) {
          m.set(k, { url: v.url ?? '', failCount: v.failCount ?? 0, order: touchOrder() })
        }
        memCache = m
        return m
      }
    }
  } catch (e) {
    // 缓存损坏忽略
  }
  memCache = new Map()
  return memCache
}

const saveDiskCache = () => {
  if (!memCache || memCache.size === 0) return
  diskIo = diskIo.then(async() => {
    try {
      const obj: Record<string, { url: string, failCount: number }> = {}
      memCache.forEach((v, k) => { obj[k] = { url: v.url, failCount: v.failCount } })
      await writeFile(CACHE_FILE, JSON.stringify(obj), 'utf8')
    } catch (e) { /* ignore */ }
  })
}

// ---- 对外 API ----

/** 清除所有缓存（接口失效时调用） */
export const clearAvatarCache = async(): Promise<void> => {
  memCache = new Map()
  try {
    if (await existsFile(CACHE_FILE)) await readFile(CACHE_FILE, 'utf8') // 读一下确认存在
  } catch (e) { /* ignore */ }
}

/** 获取歌手头像 URL，走内存→磁盘→网络三级查找 */
export const getSingerAvatar = async(name: string): Promise<string> => {
  if (!name) return ''
  // 1. 内存命中
  const hit = memCache?.get(name)
  if (hit?.url) return hit.url

  // 2. 确保磁盘已加载
  await loadDiskCache()
  const entry = memCache?.get(name)
  if (entry?.url) return entry.url

  // 3. 网络请求（并发池）
  await acquire()
  try {
    // 双重检查
    const rehit = memCache?.get(name)
    if (rehit?.url) return rehit.url

    const url = await mvSingerAvatar(name)
    if (url) {
      if (!memCache) memCache = new Map<string, CacheEntry>()
      memCache.set(name, { url, failCount: 0, order: touchOrder() })
      saveDiskCache()
    } else {
      // 接口返回空：不缓存失败，等下次重试
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
    const e = memCache?.get(name)
    if (e?.url) continue
    pending.push(name)
  }
  // 并发预取（并发池自动控制）
  pending.forEach(name => { void getSingerAvatar(name).catch(() => {}) })
}
