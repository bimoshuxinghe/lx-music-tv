import { useCallback, useEffect, useRef, useState } from 'react'
import { View, TextInput, ScrollView, type NativeSyntheticEvent, type TextInputSubmitEditingEventData } from 'react-native'
import Video from 'react-native-video'
import { FocusableTouchableOpacity as TouchableOpacity } from '@/components/tv/FocusableTouchableOpacity'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { initKtvSpider, ktvHome, ktvCategory, ktvSearch, ktvDetail, ktvPlayer } from '@/utils/nativeModules/ktvSpider'

// catvod 标准返回里的歌曲条目
interface KtvItem {
  vod_id: string
  vod_name: string
  vod_singer?: string
  vod_actor?: string
  vod_pic?: string
  vod_remarks?: string
}
interface KtvClass {
  type_id: string
  type_name: string
}
// react-native-video 的 onAudioTracks 回调里的单条音轨信息
interface KtvAudioTrack {
  index: number
  title: string
  language: string
  type: string
  bitrate: number
  selected: boolean
}
interface KtvPlayerInfo {
  url: string
  name: string
  singer: string
  headers?: Record<string, string>
}

// 把音轨 title/language 翻译成 原唱 / 伴唱（麦动风格）
const getTrackLabel = (t: KtvAudioTrack): string => {
  const s = `${t.title || ''} ${t.language || ''}`.toLowerCase()
  if (s.includes('原唱') || s.includes('vocal') || s.includes('orig') || s.includes('with')) return '原唱'
  if (s.includes('伴奏') || s.includes('伴唱') || s.includes('accomp') || s.includes('inst') || s.includes('kara') || s.includes('minus')) return '伴唱'
  return t.title || `音轨${t.index + 1}`
}

// catvod playerContent 常带 header 字符串（防盗链），转成 ExoPlayer 需要的对象
const parseHeaders = (raw: unknown): Record<string, string> | undefined => {
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  const headers: Record<string, string> = {}
  for (const part of raw.split(/[\n|]/)) {
    const idx = part.indexOf(':')
    if (idx <= 0) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k && v) headers[k] = v
  }
  return Object.keys(headers).length ? headers : undefined
}

// 麦动 KTV 配色
const GOLD = '#F5BE59'
const ACCENT_RED = '#FD3359'

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const [keyword, setKeyword] = useState('')
  const [classes, setClasses] = useState<KtvClass[]>([])
  const [list, setList] = useState<KtvItem[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // 已点队列（点歌机核心）：queue 为歌曲列表，currentIndex 为正在播放位置
  const [queue, setQueue] = useState<KtvItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [showQueue, setShowQueue] = useState(false)

  // 播放器状态（视频走 ExoPlayer / react-native-video）
  const [player, setPlayer] = useState<KtvPlayerInfo | null>(null)
  const [paused, setPaused] = useState(false)
  const [audioTracks, setAudioTracks] = useState<KtvAudioTrack[]>([])
  const [trackPos, setTrackPos] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [progress, setProgress] = useState({ time: 0, duration: 0 })

  const searchInputRef = useRef<TextInput>(null)
  const videoRef = useRef<any>(null)
  const initedRef = useRef(false)
  const loadingRef = useRef(false)

  const ensureInit = useCallback(async() => {
    if (initedRef.current) return
    initedRef.current = true
    try {
      await initKtvSpider()
    } catch (err) {
      initedRef.current = false
      throw err
    }
  }, [])

  const loadHome = useCallback(async() => {
    setStatus('loading')
    try {
      await ensureInit()
      const json = JSON.parse(await ktvHome())
      setClasses(Array.isArray(json.class) ? json.class : [])
      setList(Array.isArray(json.list) ? json.list : [])
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setErrorMsg((err as Error).message ?? String(err))
    }
  }, [ensureInit])

  const loadCategory = useCallback(async(tid: string) => {
    setStatus('loading')
    try {
      await ensureInit()
      const json = JSON.parse(await ktvCategory(tid, 1))
      setList(Array.isArray(json.list) ? json.list : [])
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setErrorMsg((err as Error).message ?? String(err))
    }
  }, [ensureInit])

  const doSearch = useCallback(async(kw: string) => {
    const k = kw.trim()
    if (!k) return
    setStatus('loading')
    try {
      await ensureInit()
      const json = JSON.parse(await ktvSearch(k))
      setList(Array.isArray(json.list) ? json.list : [])
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setErrorMsg((err as Error).message ?? String(err))
    }
  }, [ensureInit])

  // 取一首歌的播放地址
  // catvod 多源格式：vod_play_from 各源名用 $$$ 分隔；vod_play_url 对应源地址同样用 $$$ 分隔、源内多集用 # 分隔
  // playerContent(flag, id, vodUrls) 的 id 必须是【选中那一集的播放地址】，而非 vod_id
  const fetchPlayer = useCallback(async(item: KtvItem): Promise<KtvPlayerInfo | null> => {
    const detailJson = JSON.parse(await ktvDetail([item.vod_id]))
    const detail = Array.isArray(detailJson.list) ? detailJson.list[0] : null
    if (!detail) return null
    const fromParts: string[] = String(detail.vod_play_from ?? '').split('$$$').filter(Boolean)
    const urlParts: string[] = String(detail.vod_play_url ?? '').split('$$$').filter(Boolean)
    const from: string = fromParts[0] ?? ''
    const firstSourceUrls: string[] = (urlParts[0] ?? '').split('#').filter(Boolean)
    if (!firstSourceUrls.length) return null
    const playerJson = JSON.parse(await ktvPlayer(from, firstSourceUrls[0], firstSourceUrls))
    const url: string = playerJson.url ?? playerJson.playUrl ?? ''
    if (!url) return null
    return {
      url,
      name: item.vod_name || '未知歌曲',
      singer: item.vod_singer || item.vod_actor || '',
      headers: parseHeaders(playerJson.header),
    }
  }, [])

  // 播放队列中第 index 首
  const playAt = useCallback(async(index: number) => {
    if (index < 0 || index >= queue.length) return
    if (loadingRef.current) return
    loadingRef.current = true
    setCurrentIndex(index)
    const item = queue[index]
    try {
      const info = await fetchPlayer(item)
      if (!info) {
        toast('无法获取播放地址')
        return
      }
      setAudioTracks([])
      setTrackPos(0)
      setPaused(false)
      setProgress({ time: 0, duration: 0 })
      setPlayer(info)
    } catch (err) {
      toast(`播放失败：${(err as Error).message ?? err}`)
    } finally {
      loadingRef.current = false
    }
  }, [queue, fetchPlayer])

  // 点歌：加入已点队列（去重）并立即播放
  const orderSong = useCallback(async(item: KtvItem) => {
    setQueue(q => {
      const exists = q.findIndex(i => i.vod_id === item.vod_id)
      if (exists >= 0) {
        void playAt(exists)
        return q
      }
      const next = [...q, item]
      void playAt(next.length - 1)
      return next
    })
  }, [playAt])

  const playNext = useCallback(() => {
    if (currentIndex < queue.length - 1) void playAt(currentIndex + 1)
  }, [currentIndex, queue.length, playAt])

  const playPrev = useCallback(() => {
    if (currentIndex > 0) void playAt(currentIndex - 1)
  }, [currentIndex, playAt])

  const replay = useCallback(() => {
    videoRef.current?.seek(0)
  }, [])

  // ExoPlayer 上报可用音轨（原唱/伴唱）
  const handleAudioTracks = useCallback(({ audioTracks }: { audioTracks: KtvAudioTrack[] }) => {
    const tracks = Array.isArray(audioTracks) ? audioTracks : []
    setAudioTracks(tracks)
    setTrackPos(0)
  }, [])

  // 切换音轨（原唱 <-> 伴唱），通过 selectedAudioTrack 告诉 ExoPlayer
  const switchTrack = useCallback(() => {
    if (audioTracks.length < 2) return
    setTrackPos(p => (p + 1) % audioTracks.length)
  }, [audioTracks.length])

  const onEnd = useCallback(() => {
    if (currentIndex < queue.length - 1) void playAt(currentIndex + 1)
  }, [currentIndex, queue.length, playAt])

  const removeFromQueue = useCallback((vodId: string) => {
    setQueue(q => {
      const idx = q.findIndex(i => i.vod_id === vodId)
      if (idx < 0) return q
      const next = q.filter(i => i.vod_id !== vodId)
      // 修正当前播放指针
      if (idx < currentIndex) setCurrentIndex(currentIndex - 1)
      else if (idx === currentIndex) {
        if (next.length === 0) { setPlayer(null); setCurrentIndex(-1) }
        else setCurrentIndex(Math.min(currentIndex, next.length - 1))
      }
      return next
    })
  }, [currentIndex])

  useEffect(() => {
    void loadHome()
  }, [loadHome])

  const currentTrackIndex = audioTracks.length ? (audioTracks[trackPos]?.index ?? 0) : 0
  const currentTrackLabel = audioTracks.length ? getTrackLabel(audioTracks[trackPos]) : ''
  const progressPct = progress.duration > 0 ? Math.min(100, (progress.time / progress.duration) * 100) : 0
  const fmt = (s: number) => {
    s = Math.max(0, Math.floor(s))
    const m = Math.floor(s / 60)
    const ss = String(s % 60).padStart(2, '0')
    return `${m}:${ss}`
  }

  const onSubmitSearch = (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    void doSearch(e.nativeEvent.text)
  }

  // ===== 视频窗口（小窗 / 全屏共用同一 Video 实例）=====
  const renderVideo = () => (
    <View style={fullscreen ? styles.videoBoxFull : styles.videoBoxSmall}>
      {player ? (
        <Video
          ref={videoRef}
          source={{ uri: player.url, ...(player.headers ? { headers: player.headers } : {}) }}
          style={styles.video}
          resizeMode="contain"
          controls={false}
          paused={paused}
          selectedAudioTrack={{ type: 'index', value: currentTrackIndex }}
          onAudioTracks={handleAudioTracks}
          onLoad={(e: any) => setProgress({ time: 0, duration: e?.duration ?? 0 })}
          onProgress={(e: any) => setProgress(p => ({ ...p, time: e?.currentTime ?? p.time }))}
          onEnd={onEnd}
          onError={(e: any) => { toast(`播放出错：${e?.error?.localizedDescription || e?.error || ''}`) }}
        />
      ) : (
        <View style={styles.videoPlaceholder}>
          <Icon name="add-music" size={48} color={theme['c-font-label']} />
          <Text style={styles.videoPlaceholderText} size={14}>点一首歌，开始 K 歌</Text>
        </View>
      )}

      {/* 顶部：歌名 + 歌手 + 原伴唱角标 */}
      {player && (
        <View style={styles.videoTopBar}>
          <Text style={styles.videoTitle} size={16} numberOfLines={1}>{player.name}</Text>
          {player.singer ? <Text style={styles.videoSinger} size={12} numberOfLines={1}>{player.singer}</Text> : null}
          {audioTracks.length > 1 && (
            <View style={styles.vocalBadge}><Text style={styles.vocalBadgeText} size={11}>{currentTrackLabel}</Text></View>
          )}
        </View>
      )}

      {/* 进度条 */}
      {player && (
        <View style={styles.progressTrack}>
          <View style={{ ...styles.progressFill, width: `${progressPct}%` }} />
        </View>
      )}

      {/* 底部控制条（麦动风格）*/}
      {player && (
        <View style={styles.videoControls}>
          <TouchableOpacity style={styles.ctrlBtn} onPress={playPrev}>
            <Icon name="prevMusic" size={18} color="#FFFFFF" />
            <Text style={styles.ctrlText} size={12}>上一首</Text>
          </TouchableOpacity>
          {audioTracks.length > 1 ? (
            <TouchableOpacity style={{ ...styles.ctrlBtn, backgroundColor: ACCENT_RED }} onPress={switchTrack}>
              <Icon name="music_time" size={18} color="#FFFFFF" />
              <Text style={styles.ctrlText} size={12}>{currentTrackLabel}</Text>
            </TouchableOpacity>
          ) : <View style={styles.ctrlBtnDisabled}><Text style={styles.ctrlTextDim} size={12}>原伴唱</Text></View>}
          <TouchableOpacity style={styles.ctrlBtn} onPress={replay}>
            <Icon name="single-loop" size={18} color="#FFFFFF" />
            <Text style={styles.ctrlText} size={12}>重唱</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={playNext}>
            <Icon name="nextMusic" size={18} color="#FFFFFF" />
            <Text style={styles.ctrlText} size={12}>下一首</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => setFullscreen(f => !f)} hasTVPreferredFocus={fullscreen}>
            {fullscreen && <Icon name="exit2" size={18} color="#FFFFFF" />}
            <Text style={styles.ctrlText} size={12}>{fullscreen ? '退出' : '全屏'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => setPaused(p => !p)}>
            <Icon name={paused ? 'play' : 'pause'} size={18} color="#FFFFFF" />
            <Text style={styles.ctrlText} size={12}>{paused ? '播放' : '暂停'}</Text>
          </TouchableOpacity>
          <Text style={styles.ctrlTime} size={12}>{fmt(progress.time)}{progress.duration > 0 ? ` / ${fmt(progress.duration)}` : ''}</Text>
        </View>
      )}
    </View>
  )

  // ===== 已点面板 =====
  const renderQueuePanel = () => (
    <View style={styles.queuePanel}>
      <View style={styles.queueHeader}>
        <Text style={styles.queueTitle} size={16}>已点（{queue.length}）</Text>
        <TouchableOpacity style={styles.queueClose} onPress={() => setShowQueue(false)}>
          <Icon name="close" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.queueScroll}>
        {queue.length == 0 && <Text style={styles.queueEmpty} size={13}>还没有已点歌曲</Text>}
        {queue.map((item, i) => (
          <View key={`q_${item.vod_id}_${i}`} style={{ ...styles.queueItem, ...(i == currentIndex ? { borderLeftColor: GOLD, borderLeftWidth: 3 } : {}) }}>
            <TouchableOpacity style={{ flexGrow: 1, flexShrink: 1 }} onPress={() => { void playAt(i) }}>
              <Text style={styles.queueName} size={14} numberOfLines={1}>{i == currentIndex ? '▶ ' : `${i + 1}. `}{item.vod_name}</Text>
              {(item.vod_singer || item.vod_actor) && <Text style={styles.queueSinger} size={11} numberOfLines={1}>{item.vod_singer || item.vod_actor}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.queueRemove} onPress={() => removeFromQueue(item.vod_id)}>
              <Icon name="close" size={14} color="#FFFFFF99" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  )

  // ===== 主体：左视频 + 右内容（点歌机分栏）=====
  return (
    <View style={styles.container}>
      {/* 顶部栏 */}
      <View style={styles.topBar}>
        <Icon name="add-music" size={22} color={ACCENT_RED} />
        <Text style={styles.brand} size={20}>{t('nav_ktv')}</Text>
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="搜索歌曲 / 歌手"
          placeholderTextColor={theme['c-font-label']}
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={onSubmitSearch}
          returnKeyType="search"
        />
        <View style={{ flexGrow: 1 }} />
        <TouchableOpacity style={styles.orderBtn} onPress={() => setShowQueue(s => !s)}>
          <Icon name="list-order" size={16} color="#FFFFFF" />
          <Text style={styles.orderBtnText} size={13}>已点 {queue.length}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.splitRow}>
        {/* 左列：视频小窗 + 当前歌信息 */}
        <View style={styles.leftCol}>
          {renderVideo()}
          {player && (
            <View style={styles.nowPlaying}>
              <Text style={styles.nowPlayingName} size={15} numberOfLines={1}>{player.name}</Text>
              <Text style={styles.nowPlayingSinger} size={12} numberOfLines={1}>{player.singer}{audioTracks.length > 1 ? ` · ${currentTrackLabel}` : ''}</Text>
            </View>
          )}
        </View>

        {/* 右列：分类 + 歌单 */}
        <View style={styles.rightCol}>
          {classes.length > 0 && (
            <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.classScroll}>
              <View style={styles.classList}>
                <TouchableOpacity style={{ ...styles.classItem, ...(activeClass == '' ? { backgroundColor: theme['c-primary'] } : {}) }} onPress={() => { setActiveClass(''); void loadHome() }}>
                  <Text style={styles.classText} size={13} color={activeClass == '' ? '#FFFFFF' : theme['c-font-label']}>推荐</Text>
                </TouchableOpacity>
                {classes.map(cls => (
                  <TouchableOpacity key={cls.type_id} style={{ ...styles.classItem, ...(activeClass == cls.type_id ? { backgroundColor: theme['c-primary'] } : {}) }} onPress={() => { setActiveClass(cls.type_id); void loadCategory(cls.type_id) }}>
                    <Text style={styles.classText} size={13} color={activeClass == cls.type_id ? '#FFFFFF' : theme['c-font-label']}>{cls.type_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          <View style={styles.listWrap}>
            {status == 'loading' && <Text style={styles.tip} size={15}>加载中…</Text>}
            {status == 'error' && <Text style={styles.tip} size={15} color="#FF6B6B">加载失败：{errorMsg}</Text>}
            {status == 'idle' && list.length == 0 && <Text style={styles.tip} size={15}>暂无内容，试试搜索或切换分类</Text>}
            <ScrollView style={styles.listScroll} keyboardShouldPersistTaps={'always'}>
              {list.map((item, index) => {
                const ordered = queue.some(i => i.vod_id === item.vod_id)
                return (
                  <TouchableOpacity
                    key={`${item.vod_id}_${index}`}
                    style={{ ...styles.songItem, ...(ordered ? { borderLeftColor: GOLD, borderLeftWidth: 3 } : {}) }}
                    onPress={() => { void orderSong(item) }}
                    hasTVPreferredFocus={index == 0}
                  >
                    <Icon name="add-music" size={15} color={ordered ? GOLD : theme['c-primary']} />
                    <View style={styles.songText}>
                      <Text style={styles.songName} size={14} numberOfLines={1}>{item.vod_name}</Text>
                      {(item.vod_singer || item.vod_actor) && <Text style={styles.songSinger} size={11} numberOfLines={1}>{item.vod_singer || item.vod_actor}</Text>}
                    </View>
                    {ordered && <Text style={styles.orderedTag} size={11}>已点</Text>}
                    {item.vod_remarks ? <Text style={styles.songRemark} size={11}>{item.vod_remarks}</Text> : null}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </View>

      {showQueue && renderQueuePanel()}
    </View>
  )
}

const styles = createStyle({
  container: {
    width: '100%',
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#0A0C10',
    paddingTop: 6,
  },
  // 顶部栏
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  brand: {
    marginLeft: 8,
    marginRight: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  searchInput: {
    width: 320,
    height: 38,
    borderRadius: 6,
    borderWidth: BorderWidths.normal,
    borderColor: '#88888888',
    paddingHorizontal: 12,
    color: '#FFFFFF',
    backgroundColor: '#00000033',
  },
  orderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#2A6BE0',
  },
  orderBtnText: {
    marginLeft: 6,
    color: '#FFFFFF',
  },
  // 分栏
  splitRow: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  leftCol: {
    width: '38%',
    paddingRight: 14,
  },
  rightCol: {
    flex: 1,
    flexDirection: 'column',
  },
  // 视频窗口
  videoBoxSmall: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  videoBoxFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    backgroundColor: '#000000',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholderText: {
    marginTop: 10,
    color: '#FFFFFF77',
  },
  videoTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#00000066',
  },
  videoTitle: {
    color: GOLD,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  videoSinger: {
    marginLeft: 12,
    color: '#FFFFFFCC',
  },
  vocalBadge: {
    marginLeft: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: ACCENT_RED,
  },
  vocalBadgeText: {
    color: '#FFFFFF',
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 56,
    height: 3,
    backgroundColor: '#FFFFFF33',
  },
  progressFill: {
    height: 3,
    backgroundColor: GOLD,
  },
  videoControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#00000099',
    flexWrap: 'wrap',
  },
  ctrlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: '#161F2A',
  },
  ctrlBtnDisabled: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: '#222831',
  },
  ctrlText: {
    marginLeft: 6,
    color: '#FFFFFF',
  },
  ctrlTextDim: {
    marginLeft: 6,
    color: '#FFFFFF77',
  },
  ctrlTime: {
    marginLeft: 4,
    color: '#FFFFFFAA',
  },
  nowPlaying: {
    marginTop: 10,
    paddingHorizontal: 4,
  },
  nowPlayingName: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  nowPlayingSinger: {
    marginTop: 2,
    color: '#FFFFFF99',
  },
  // 右列
  classScroll: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 46,
    marginBottom: 8,
  },
  classList: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classItem: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: '#44444488',
  },
  classText: {},
  listWrap: {
    flex: 1,
  },
  listScroll: {
    flex: 1,
  },
  tip: {
    paddingVertical: 20,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 6,
    backgroundColor: '#FFFFFF0D',
  },
  songText: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 12,
  },
  songName: {
    color: '#FFFFFF',
  },
  songSinger: {
    marginTop: 2,
    color: '#FFFFFF99',
  },
  songRemark: {
    marginLeft: 12,
    color: '#FFFFFF77',
  },
  orderedTag: {
    marginLeft: 10,
    color: GOLD,
  },
  // 已点面板
  queuePanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '40%',
    zIndex: 60,
    backgroundColor: '#0D1117EE',
    borderLeftWidth: 1,
    borderLeftColor: '#FFFFFF22',
    padding: 14,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  queueTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  queueClose: {
    padding: 6,
  },
  queueScroll: {
    flex: 1,
  },
  queueEmpty: {
    color: '#FFFFFF77',
    paddingVertical: 20,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 6,
    backgroundColor: '#FFFFFF0D',
  },
  queueName: {
    color: '#FFFFFF',
  },
  queueSinger: {
    marginTop: 2,
    color: '#FFFFFF99',
  },
  queueRemove: {
    padding: 6,
    marginLeft: 8,
  },
})
