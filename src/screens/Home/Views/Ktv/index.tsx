import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, TextInput, ScrollView, Modal, useWindowDimensions, type NativeSyntheticEvent, type TextInputSubmitEditingEventData } from 'react-native'
import Video, { SelectedTrackType } from 'react-native-video'
import { FocusableTouchableOpacity as TouchableOpacity } from '@/components/tv/FocusableTouchableOpacity'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { initKtvSpider, ktvCategory, ktvSearch, ktvDetail, ktvPlayer } from '@/utils/nativeModules/ktvSpider'

// ============ 类型 ============
// 咪咕列表项（catvod JSON），vod_id = resourceno@@name@@path@@lrc
interface KtvMiguSong {
  vod_id: string
  vod_name: string
  vod_pic?: string
  vod_remarks?: string
}
interface KtvAudioTrack {
  index: number
  title?: string
  language?: string
  type?: string
  bitrate?: number
  selected?: boolean
}
interface KtvPlayerInfo {
  url: string
  name: string
  singer: string
  headers?: Record<string, string>
}

// 咪咕分类 tab：recommend 推荐 / rank 榜单 / songlist 歌单
const MIGU_TABS: { id: string, name: string }[] = [
  { id: 'recommend', name: '推荐' },
  { id: 'rank', name: '榜单' },
  { id: 'songlist', name: '歌单' },
]

// ============ 工具 ============
// 音轨标题 -> 原唱 / 伴唱
const getTrackLabel = (t: KtvAudioTrack): string => {
  const s = `${t.title || ''} ${t.language || ''}`.toLowerCase()
  if (s.includes('原唱') || s.includes('vocal') || s.includes('orig') || s.includes('with')) return '原唱'
  if (s.includes('伴奏') || s.includes('伴唱') || s.includes('accomp') || s.includes('inst') || s.includes('kara') || s.includes('minus')) return '伴唱'
  return t.title || `音轨${t.index + 1}`
}
// catvod playerContent 的 header 字符串 -> 对象
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

const GOLD = '#F5BE59'
const ACCENT_RED = '#FD3359'

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const { width: winW, height: winH } = useWindowDimensions()
  const landscape = winW > winH

  // ===== KTV 页面状态 =====
  const [visible, setVisible] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // 咪咕分类 tab
  const [activeMiguTab, setActiveMiguTab] = useState('recommend')

  // 推荐 / 通用歌曲列表（咪咕返回）
  const [list, setList] = useState<KtvMiguSong[]>([])
  const [listTitle, setListTitle] = useState('')
  const [pagecount, setPagecount] = useState(1)

  // 已点队列
  const [queue, setQueue] = useState<KtvMiguSong[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [showQueue, setShowQueue] = useState(false)

  // 播放器
  const [player, setPlayer] = useState<KtvPlayerInfo | null>(null)
  const [paused, setPaused] = useState(false)
  const [audioTracks, setAudioTracks] = useState<KtvAudioTrack[]>([])
  const [trackPos, setTrackPos] = useState(0)
  const [progress, setProgress] = useState({ time: 0, duration: 0 })

  const searchInputRef = useRef<TextInput>(null)
  const videoRef = useRef<any>(null)
  const spiderInitedRef = useRef(false)
  const loadingRef = useRef(false)
  const pageRef = useRef(1)

  // 确保 spider 初始化（纯 Java 咪咕，无实际加载动作，但保留幂等）
  const ensureSpider = useCallback(async() => {
    if (spiderInitedRef.current) return
    spiderInitedRef.current = true
    try { await initKtvSpider() } catch (err) { spiderInitedRef.current = false; throw err }
  }, [])

  // ===== 数据加载（咪咕 API）=====
  const loadList = useCallback(async(fn: () => Promise<string>, title: string) => {
    setStatus('loading')
    try {
      await ensureSpider()
      const json = JSON.parse(await fn())
      const arr: KtvMiguSong[] = Array.isArray(json.list) ? json.list : []
      setList(arr)
      setPagecount(Number(json.pagecount) || 1)
      setListTitle(title)
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setErrorMsg((err as Error).message ?? String(err))
    }
  }, [ensureSpider])

  const loadMiguTab = useCallback(async(tid: string, page: number) => {
    pageRef.current = page
    const name = MIGU_TABS.find(t => t.id === tid)?.name ?? tid
    await loadList(() => ktvCategory(tid, page), page > 1 ? `${name} · 第${page}页` : name)
  }, [loadList])

  // 初始加载推荐列表
  useEffect(() => { void loadMiguTab('recommend', 1) }, [loadMiguTab])

  const doSearch = useCallback(async(kw: string) => {
    const k = kw.trim()
    if (!k) return
    await loadList(() => ktvSearch(k), `搜索 "${k}"`)
  }, [loadList])

  const loadMore = useCallback(async() => {
    const next = pageRef.current + 1
    if (next > pagecount) return
    await loadMiguTab(activeMiguTab, next)
  }, [activeMiguTab, pagecount, loadMiguTab])

  // ===== 播放 =====
  // 咪咕 vod_id = resourceno@@name@@path@@lrc；detail 已带 path 则直接播
  const fetchPlayer = useCallback(async(item: KtvMiguSong): Promise<KtvPlayerInfo | null> => {
    await ensureSpider()
    const detailJson = JSON.parse(await ktvDetail([item.vod_id]))
    const detail = Array.isArray(detailJson.list) ? detailJson.list[0] : null
    if (!detail) return null
    const urlParts: string[] = String(detail.vod_play_url ?? '').split('$$$').filter(Boolean)
    const firstSourceUrls: string[] = (urlParts[0] ?? '').split('#').filter(Boolean)
    if (!firstSourceUrls.length) return null
    const playerJson = JSON.parse(await ktvPlayer('咪咕', firstSourceUrls[0], firstSourceUrls))
    const url: string = playerJson.url ?? playerJson.playUrl ?? ''
    if (!url) return null
    return {
      url,
      name: item.vod_name || '未知歌曲',
      singer: item.vod_remarks || '',
      headers: parseHeaders(playerJson.header),
    }
  }, [ensureSpider])

  const playAt = useCallback(async(list: KtvMiguSong[], index: number) => {
    if (index < 0 || index >= list.length) return
    if (loadingRef.current) return
    loadingRef.current = true
    setCurrentIndex(index)
    const item = list[index]
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
  }, [fetchPlayer])

  // 点歌：去重入队 + 立即播放
  const orderSong = useCallback(async(item: KtvMiguSong) => {
    const exists = queue.findIndex(i => i.vod_id === item.vod_id)
    if (exists >= 0) { void playAt(queue, exists); return }
    const next = [...queue, item]
    setQueue(next)
    void playAt(next, next.length - 1)
  }, [queue, playAt])

  const playNext = useCallback(() => { void playAt(queue, currentIndex + 1) }, [queue, currentIndex, playAt])
  const playPrev = useCallback(() => { void playAt(queue, currentIndex - 1) }, [queue, currentIndex, playAt])
  const replay = useCallback(() => { videoRef.current?.seek(0) }, [])

  const handleAudioTracks = useCallback(({ audioTracks }: { audioTracks: KtvAudioTrack[] }) => {
    const tracks = Array.isArray(audioTracks) ? audioTracks : []
    setAudioTracks(tracks)
    setTrackPos(0)
  }, [])

  const switchTrack = useCallback(() => {
    if (audioTracks.length < 2) return
    setTrackPos(p => {
      const next = (p + 1) % audioTracks.length
      toast(`已切换：${getTrackLabel(audioTracks[next])}`)
      return next
    })
  }, [audioTracks])

  const onEnd = useCallback(() => { void playAt(queue, currentIndex + 1) }, [queue, currentIndex, playAt])

  const removeFromQueue = useCallback((vodId: string) => {
    const idx = queue.findIndex(i => i.vod_id === vodId)
    if (idx < 0) return
    const next = queue.filter(i => i.vod_id !== vodId)
    if (idx < currentIndex) setCurrentIndex(currentIndex - 1)
    else if (idx === currentIndex) {
      if (next.length === 0) { setPlayer(null); setCurrentIndex(-1) }
      else setCurrentIndex(Math.min(currentIndex, next.length - 1))
    }
    setQueue(next)
  }, [queue, currentIndex])

  const currentTrackIndex = audioTracks.length ? (audioTracks[trackPos]?.index ?? 0) : 0
  const currentTrackLabel = audioTracks.length ? getTrackLabel(audioTracks[trackPos]) : ''
  // 稳定引用，避免进度刷新导致 ExoPlayer 反复重载
  const videoSource = useMemo(() => {
    if (!player) return null
    return { uri: player.url, ...(player.headers ? { headers: player.headers } : {}) }
  }, [player])
  const selectedTrack = useMemo(() => ({ type: SelectedTrackType.INDEX, value: currentTrackIndex }), [currentTrackIndex])
  const progressPct = progress.duration > 0 ? Math.min(100, (progress.time / progress.duration) * 100) : 0
  const fmt = (s: number) => {
    s = Math.max(0, Math.floor(s))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  const onSubmitSearch = (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => { void doSearch(e.nativeEvent.text) }

  // ===== 退出全屏 =====
  const close = useCallback(() => setVisible(false), [])

  // ===== 视频窗口（控制条叠在上方）=====
  const renderVideo = () => (
    <View style={styles.videoBox}>
      {player && videoSource ? (
        <Video
          ref={videoRef}
          source={videoSource}
          style={styles.video}
          resizeMode="contain"
          controls={false}
          paused={paused}
          selectedAudioTrack={selectedTrack}
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

      {player && (
        <View style={styles.videoTopBar}>
          <Text style={styles.videoTitle} size={16} numberOfLines={1}>{player.name}</Text>
          {player.singer ? <Text style={styles.videoSinger} size={12} numberOfLines={1}>{player.singer}</Text> : null}
          {audioTracks.length > 1 && (
            <View style={styles.vocalBadge}><Text style={styles.vocalBadgeText} size={11}>{currentTrackLabel}</Text></View>
          )}
        </View>
      )}

      {player && (
        <View style={styles.progressTrack}>
          <View style={{ ...styles.progressFill, width: `${progressPct}%` }} />
        </View>
      )}

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
            <TouchableOpacity style={{ flexGrow: 1, flexShrink: 1 }} onPress={() => { void playAt(queue, i) }}>
              <Text style={styles.queueName} size={14} numberOfLines={1}>{i == currentIndex ? '▶ ' : `${i + 1}. `}{item.vod_name}</Text>
              {item.vod_remarks && <Text style={styles.queueSinger} size={11} numberOfLines={1}>{item.vod_remarks}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.queueRemove} onPress={() => removeFromQueue(item.vod_id)}>
              <Icon name="close" size={14} color="#FFFFFF99" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  )

  // ===== 顶栏 =====
  const renderTopBar = () => (
    <View style={styles.topBar}>
      <TouchableOpacity style={styles.backBtn} onPress={close} hasTVPreferredFocus>
        <Icon name="back-2" size={20} color="#FFFFFF" />
        <Text style={styles.backText} size={14}>返回</Text>
      </TouchableOpacity>
      <Icon name="add-music" size={22} color={ACCENT_RED} />
      <Text style={styles.brand} size={20}>{t('nav_ktv')}</Text>
      <TextInput
        ref={searchInputRef}
        style={styles.searchInput}
        placeholder="搜索歌曲 / 拼音 / 歌手"
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
  )

  // ===== 咪咕分类 Tab =====
  const renderTabs = () => (
    <View style={styles.tabBar}>
      {MIGU_TABS.map(({ id, name }) => (
        <TouchableOpacity key={id} style={{ ...styles.tabItem, ...(activeMiguTab == id ? styles.tabItemActive : {}) }} onPress={() => { setActiveMiguTab(id); void loadMiguTab(id, 1) }}>
          <Text style={styles.tabText} size={13} color={activeMiguTab == id ? '#FFFFFF' : theme['c-font-label']}>{name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )

  // ===== 内容区 =====
  const renderContent = () => (
    <View style={styles.contentCol}>
      {renderTabs()}

      <View style={styles.listWrap}>
        {status == 'loading' && <Text style={styles.tip} size={15}>加载中…</Text>}
        {status == 'error' && <Text style={styles.tip} size={15} color="#FF6B6B">加载失败：{errorMsg}</Text>}

        {/* 歌曲列表 */}
        {status == 'idle' && (
          <>
            {listTitle ? <Text style={styles.listTitle} size={12} color="#FFFFFF88">{listTitle}</Text> : null}
            {status == 'idle' && list.length == 0 && <Text style={styles.tip} size={15}>暂无内容，试试搜索或切换分类</Text>}
            <ScrollView style={styles.listScroll} keyboardShouldPersistTaps={'always'} onScroll={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent
              if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 60) void loadMore()
            }} scrollEventThrottle={200}>
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
                      {item.vod_remarks && <Text style={styles.songSinger} size={11} numberOfLines={1}>{item.vod_remarks}</Text>}
                    </View>
                    {ordered && <Text style={styles.orderedTag} size={11}>已点</Text>}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  )

  // ===== 全屏二级界面 =====
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={close}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={styles.container}>
        {renderTopBar()}

        {landscape ? (
          // 横屏：左视频 + 右列表
          <View style={styles.splitRow}>
            <View style={styles.leftCol}>
              {renderVideo()}
              {player && (
                <View style={styles.nowPlaying}>
                  <Text style={styles.nowPlayingName} size={15} numberOfLines={1}>{player.name}</Text>
                  <Text style={styles.nowPlayingSinger} size={12} numberOfLines={1}>{player.singer}{audioTracks.length > 1 ? ` · ${currentTrackLabel}` : ''}</Text>
                </View>
              )}
            </View>
            <View style={styles.rightCol}>
              {renderContent()}
            </View>
          </View>
        ) : (
          // 竖屏：上视频 + 下列表
          <View style={styles.portraitCol}>
            {renderVideo()}
            {player && (
              <View style={styles.nowPlaying}>
                <Text style={styles.nowPlayingName} size={15} numberOfLines={1}>{player.name}</Text>
                <Text style={styles.nowPlayingSinger} size={12} numberOfLines={1}>{player.singer}{audioTracks.length > 1 ? ` · ${currentTrackLabel}` : ''}</Text>
              </View>
            )}
            <View style={styles.portraitContent}>
              {renderContent()}
            </View>
          </View>
        )}

        {showQueue && renderQueuePanel()}
      </View>
    </Modal>
  )
}

// ============ 样式 ============
const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#0A0C10',
  },
  // 顶栏
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF14',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#44444488',
    marginRight: 12,
  },
  backText: {
    marginLeft: 4,
    color: '#FFFFFF',
  },
  brand: {
    marginLeft: 8,
    marginRight: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  searchInput: {
    width: 300,
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
  // 横屏分栏
  splitRow: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  leftCol: {
    width: '40%',
    paddingRight: 14,
  },
  rightCol: {
    flex: 1,
    flexDirection: 'column',
  },
  // 竖屏
  portraitCol: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  portraitContent: {
    flex: 1,
    marginTop: 10,
  },
  // 视频
  videoBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
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
  // 内容列
  contentCol: {
    flex: 1,
    flexDirection: 'column',
  },
  // 主 Tab
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tabItem: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: '#44444488',
  },
  tabItemActive: {
    backgroundColor: '#2A6BE0',
  },
  tabText: {},
  // 列表
  listWrap: {
    flex: 1,
  },
  listScroll: {
    flex: 1,
  },
  listTitle: {
    marginBottom: 6,
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
  // 曲库下载界面
  dbLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  dbLoadingTitle: {
    marginTop: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  dbLoadingSub: {
    marginTop: 6,
    textAlign: 'center',
  },
  dbProgressTrack: {
    marginTop: 18,
    width: '60%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF22',
    overflow: 'hidden',
  },
  dbProgressFill: {
    height: 6,
    backgroundColor: GOLD,
  },
  dbProgressText: {
    marginTop: 8,
    color: '#FFFFFFAA',
  },
  dbRetry: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: '#2A6BE0',
  },
  dbRetryText: {
    color: '#FFFFFF',
  },
})
