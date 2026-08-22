import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, TextInput, ScrollView, Modal, Image, useWindowDimensions, type NativeSyntheticEvent, type TextInputSubmitEditingEventData } from 'react-native'
import Video from 'react-native-video'
import { FocusableTouchableOpacity as TouchableOpacity } from '@/components/tv/FocusableTouchableOpacity'
import Text from '@/components/common/Text'
import { Icon, IconMaterial } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { mvSingers, mvSongs, mvSearch, mvPlayer } from '@/utils/nativeModules/ktvSpider'

// ============ 类型 ============
interface MvSong {
  vod_id: string
  vod_name: string
  vod_pic?: string
  vod_remarks?: string
}

// 一级页面 Tab
const MAIN_TABS = [
  { id: 'singer', name: '歌手' },
  { id: 'song', name: '歌曲' },
  { id: 'search', name: '搜索' },
] as const
type MainTab = typeof MAIN_TABS[number]['id']

// 歌手 Tab：男/女
const SINGER_GENDERS = [
  { id: 1, name: '男歌手' },
  { id: 2, name: '女歌手' },
]

// 一次展示的条数（300 首分批渲染）
const BATCH = 40

const GOLD = '#F5BE59'
const ACCENT_RED = '#FD3359'

export default () => {
  const theme = useTheme()
  const { width: winW, height: winH } = useWindowDimensions()
  const landscape = winW > winH

  // ===== 界面状态 =====
  const [visible, setVisible] = useState(true)

  // 一级 Tab
  const [activeTab, setActiveTab] = useState<MainTab>('singer')
  // 歌手 Tab
  const [gender, setGender] = useState(1)
  const [singers, setSingers] = useState<MvSong[]>([])
  const [singersShow, setSingersShow] = useState(BATCH)
  // 歌曲 Tab
  const [songs, setSongs] = useState<MvSong[]>([])
  const [songsShow, setSongsShow] = useState(BATCH)
  const [songsKeyword, setSongsKeyword] = useState('') // 当前歌曲列表主题（歌手名/歌单id/空=热门）
  // 搜索
  const [keyword, setKeyword] = useState('')
  const [searchResult, setSearchResult] = useState<MvSong[]>([])
  const [searchShow, setSearchShow] = useState(BATCH)
  // 通用状态
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // ===== 二级播放界面状态 =====
  const [playingSinger, setPlayingSinger] = useState('') // 非空表示进入二级
  const [mvList, setMvList] = useState<MvSong[]>([])
  const [mvShow, setMvShow] = useState(BATCH)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [player, setPlayer] = useState<{ url: string, name: string, pic?: string } | null>(null)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState({ time: 0, duration: 0 })

  const searchInputRef = useRef<TextInput>(null)
  const loadingRef = useRef(false)

  // ===== 歌手列表 =====
  const loadSingers = useCallback(async() => {
    setStatus('loading')
    try {
      const json = JSON.parse(await mvSingers(gender))
      const arr: MvSong[] = Array.isArray(json.list) ? json.list : []
      setSingers(arr)
      setSingersShow(BATCH)
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setErrorMsg((err as Error).message ?? String(err))
    }
  }, [gender])

  useEffect(() => { void loadSingers() }, [loadSingers])

  // ===== 歌曲列表 =====
  const loadSongs = useCallback(async(kw: string, title: string) => {
    setStatus('loading')
    try {
      const json = JSON.parse(await mvSongs(kw, 1))
      const arr: MvSong[] = Array.isArray(json.list) ? json.list : []
      setSongs(arr)
      setSongsShow(BATCH)
      setSongsKeyword(kw)
      setStatus('idle')
      if (title) setSearchResult([]) // 歌曲 Tab 不占用搜索结果
    } catch (err) {
      setStatus('error')
      setErrorMsg((err as Error).message ?? String(err))
    }
  }, [])

  // ===== 搜索 =====
  const doSearch = useCallback(async(kw: string) => {
    const k = kw.trim()
    if (!k) return
    setStatus('loading')
    try {
      const json = JSON.parse(await mvSearch(k))
      const arr: MvSong[] = Array.isArray(json.list) ? json.list : []
      setSearchResult(arr)
      setSearchShow(BATCH)
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setErrorMsg((err as Error).message ?? String(err))
    }
  }, [])

  const onSubmitSearch = (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    void doSearch(e.nativeEvent.text)
  }

  // ===== 进入二级：加载该歌手全部 MV =====
  const loadMvListForSinger = useCallback(async(singer: string): Promise<MvSong[]> => {
    try {
      const json = JSON.parse(await mvSongs(singer, 1))
      const arr: MvSong[] = Array.isArray(json.list) ? json.list : []
      return arr
    } catch (err) {
      toast(`加载失败：${(err as Error).message ?? err}`)
      return []
    }
  }, [])

  const openSinger = useCallback(async(singer: string) => {
    setPlayingSinger(singer)
    setMvList([])
    setMvShow(BATCH)
    setCurrentIndex(-1)
    setPlayer(null)
    setPaused(false)
    setProgress({ time: 0, duration: 0 })
    const arr = await loadMvListForSinger(singer)
    setMvList(arr)
  }, [loadMvListForSinger])

  // 二级界面点某首 MV
  const playAt = useCallback(async(list: MvSong[], index: number) => {
    if (index < 0 || index >= list.length) return
    if (loadingRef.current) return
    loadingRef.current = true
    setCurrentIndex(index)
    const item = list[index]
    try {
      const json = JSON.parse(await mvPlayer(item.vod_id))
      const url: string = json.url ?? ''
      if (!url) { toast('无法获取播放地址'); return }
      setPaused(false)
      setProgress({ time: 0, duration: 0 })
      setPlayer({ url, name: item.vod_name, pic: item.vod_pic })
    } catch (err) {
      toast(`播放失败：${(err as Error).message ?? err}`)
    } finally {
      loadingRef.current = false
    }
  }, [])

  const playNext = useCallback(() => { playAt(mvList, currentIndex + 1).catch(() => {}) }, [mvList, currentIndex, playAt])
  const playPrev = useCallback(() => { playAt(mvList, currentIndex - 1).catch(() => {}) }, [mvList, currentIndex, playAt])

  const onEnd = useCallback(() => { playNext() }, [playNext])

  // 从名称提取歌手名：优先 '歌手 - 歌名'，其次 '歌手 歌名'（搜索提示）
  const getSingerFromName = useCallback((name: string): string => {
    const m = name.split(' - ')[0]?.trim()
    if (m && m.length > 0 && m != name) return m
    return name.split(' ')[0]?.trim() ?? ''
  }, [])

  // 从一级 MV 列表直接进入并播放
  const openMv = useCallback(async(song: MvSong) => {
    const singerName = getSingerFromName(song.vod_name)
    if (!singerName) return
    setPlayingSinger(singerName)
    setMvList([])
    setMvShow(BATCH)
    setCurrentIndex(-1)
    setPlayer(null)
    setPaused(false)
    setProgress({ time: 0, duration: 0 })
    const arr = await loadMvListForSinger(singerName)
    setMvList(arr)
    const idx = arr.findIndex(i => i.vod_id === song.vod_id)
    void playAt(arr, Math.max(0, idx))
  }, [loadMvListForSinger, playAt, getSingerFromName])

  const close = useCallback(() => {
    if (playingSinger) { setPlayingSinger(''); setPlayer(null); return }
    setVisible(false)
  }, [playingSinger])

  const videoSource = useMemo(() => {
    if (!player) return null
    return { uri: player.url }
  }, [player])

  const progressPct = progress.duration > 0 ? Math.min(100, (progress.time / progress.duration) * 100) : 0
  const fmt = (s: number) => {
    s = Math.max(0, Math.floor(s))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  // ===== 视频区（二级界面）=====
  const renderVideo = () => (
    <View style={styles.videoBox}>
      {player && videoSource ? (
        <Video
          key={player.url}
          source={videoSource}
          style={styles.video}
          resizeMode="contain"
          controls={false}
          paused={paused}
          onLoad={(e: any) => { setProgress({ time: 0, duration: e?.duration ?? 0 }) }}
          onProgress={(e: any) => { setProgress(p => ({ ...p, time: e?.currentTime ?? p.time })) }}
          onEnd={onEnd}
          onError={(e: any) => { toast(`播放出错：${e?.error?.localizedDescription || e?.error || ''}`) }}
        />
      ) : (
        <View style={styles.videoPlaceholder}>
          <IconMaterial name="video-library" size={52} color={theme['c-font-label']} />
          <Text style={styles.videoPlaceholderText} size={14}>选择一首 MV 开始播放</Text>
        </View>
      )}

      {player && (
        <View style={styles.videoTopBar}>
          <Text style={styles.videoTitle} size={16} numberOfLines={1}>{player.name}</Text>
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
            <IconMaterial name="skip-previous" size={20} color="#FFFFFF" />
            <Text style={styles.ctrlText} size={12}>上一首</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => { setPaused(p => !p) }}>
            <IconMaterial name={paused ? 'play-arrow' : 'pause'} size={20} color="#FFFFFF" />
            <Text style={styles.ctrlText} size={12}>{paused ? '播放' : '暂停'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={playNext}>
            <IconMaterial name="skip-next" size={20} color="#FFFFFF" />
            <Text style={styles.ctrlText} size={12}>下一首</Text>
          </TouchableOpacity>
          <Text style={styles.ctrlTime} size={12}>{fmt(progress.time)}{progress.duration > 0 ? ` / ${fmt(progress.duration)}` : ''}</Text>
        </View>
      )}
    </View>
  )

  // ===== MV 列表（二级界面右侧，分批渲染）=====
  const renderMvList = () => (
    <ScrollView
      style={styles.listScroll}
      onScroll={({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 60 && mvShow < mvList.length) {
          setMvShow(s => Math.min(mvList.length, s + BATCH))
        }
      }}
      scrollEventThrottle={200}
    >
      {mvList.slice(0, mvShow).map((item, index) => {
        const active = index == currentIndex
        return (
          <TouchableOpacity
            key={`${item.vod_id}_${index}`}
            style={{ ...styles.songItem, ...(active ? { borderLeftColor: GOLD, borderLeftWidth: 3 } : {}) }}
            onPress={() => { void playAt(mvList, index) }}
            hasTVPreferredFocus={index == 0}
          >
            {item.vod_pic ? <View style={styles.songPicWrap}><ImageUrl uri={item.vod_pic} /></View> : <IconMaterial name="movie" size={16} color={theme['c-primary']} />}
            <View style={styles.songText}>
              <Text style={styles.songName} size={13} numberOfLines={1}>{item.vod_name}</Text>
              {item.vod_remarks ? <Text style={styles.songSinger} size={11} numberOfLines={1}>{item.vod_remarks}</Text> : null}
            </View>
            {active && <Text style={styles.orderedTag} size={11}>播放中</Text>}
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )

  // ===== 二级界面（播放 + 歌手全部 MV）=====
  const renderPlayPage = () => (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { setPlayingSinger(''); setPlayer(null) }}>
          <Icon name="back-2" size={20} color="#FFFFFF" />
          <Text style={styles.backText} size={14}>返回</Text>
        </TouchableOpacity>
        <IconMaterial name="video-library" size={22} color={ACCENT_RED} />
        <Text style={styles.brand} size={20}>{playingSinger}</Text>
        <View style={styles.orderBtn}><Text style={styles.orderBtnText} size={13}>共 {mvList.length} 首</Text></View>
      </View>

      {landscape ? (
        <View style={styles.splitRow}>
          <View style={styles.leftCol}>
            {renderVideo()}
          </View>
          <View style={styles.rightCol}>
            <Text style={styles.listTitle} size={12} color="#FFFFFF88">{playingSinger} 的 MV</Text>
            {renderMvList()}
          </View>
        </View>
      ) : (
        <View style={styles.portraitCol}>
          {renderVideo()}
          <View style={styles.portraitContent}>
            <Text style={styles.listTitle} size={12} color="#FFFFFF88">{playingSinger} 的 MV</Text>
            {renderMvList()}
          </View>
        </View>
      )}
    </View>
  )

  // ===== 歌手 Tab（网格）=====
  const renderSingerTab = () => (
    <View style={styles.contentCol}>
      <View style={styles.subTabBar}>
        {SINGER_GENDERS.map(g => (
          <TouchableOpacity key={g.id} style={{ ...styles.subTabItem, ...(gender == g.id ? styles.tabItemActive : {}) }} onPress={() => { setGender(g.id) }}>
            <Text style={styles.tabText} size={13} color={gender == g.id ? '#FFFFFF' : theme['c-font-label']}>{g.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.listWrap}>
        <ScrollView
          style={styles.gridScroll}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 60 && singersShow < singers.length) {
              setSingersShow(s => Math.min(singers.length, s + BATCH))
            }
          }}
          scrollEventThrottle={200}
        >
          <View style={styles.grid}>
            {singers.slice(0, singersShow).map((singer, index) => (
              <TouchableOpacity
                key={`${singer.vod_id}_${index}`}
                style={styles.gridItem}
                onPress={() => { void openSinger(singer.vod_name) }}
                hasTVPreferredFocus={index == 0}
              >
                <Text style={styles.gridText} size={13} numberOfLines={1}>{singer.vod_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  )

  // ===== 歌曲 Tab（MV 列表）=====
  const renderSongTab = () => (
    <View style={styles.contentCol}>
      <View style={styles.subTabBar}>
        <TouchableOpacity style={[styles.subTabItem, !songsKeyword ? styles.tabItemActive : {}]} onPress={() => { setSongsKeyword(''); void loadSongs('', '热门') }}>
          <Text style={styles.tabText} size={13} color={!songsKeyword ? '#FFFFFF' : theme['c-font-label']}>热门</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.listWrap}>
        <ScrollView
          style={styles.listScroll}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 60 && songsShow < songs.length) {
              setSongsShow(s => Math.min(songs.length, s + BATCH))
            }
          }}
          scrollEventThrottle={200}
        >
          {songs.slice(0, songsShow).map((song, index) => (
            <TouchableOpacity
              key={`${song.vod_id}_${index}`}
              style={styles.songItem}
              onPress={() => { void openMv(song) }}
              hasTVPreferredFocus={index == 0}
            >
              {song.vod_pic ? <View style={styles.songPicWrap}><ImageUrl uri={song.vod_pic} /></View> : <IconMaterial name="movie" size={16} color={theme['c-primary']} />}
              <View style={styles.songText}>
                <Text style={styles.songName} size={13} numberOfLines={1}>{song.vod_name}</Text>
                {song.vod_remarks ? <Text style={styles.songSinger} size={11} numberOfLines={1}>{song.vod_remarks}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  )

  // ===== 搜索 Tab =====
  const renderSearchTab = () => (
    <View style={styles.contentCol}>
      <View style={styles.listWrap}>
        <ScrollView
          style={styles.listScroll}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 60 && searchShow < searchResult.length) {
              setSearchShow(s => Math.min(searchResult.length, s + BATCH))
            }
          }}
          scrollEventThrottle={200}
        >
          {searchResult.length == 0 && <Text style={styles.tip} size={14}>输入歌手或歌名搜索 MV</Text>}
          {searchResult.slice(0, searchShow).map((item, index) => (
            <TouchableOpacity
              key={`${item.vod_id}_${index}`}
              style={styles.songItem}
              onPress={() => { void openMv(item) }}
              hasTVPreferredFocus={index == 0}
            >
              <IconMaterial name="search" size={16} color={theme['c-primary']} />
              <View style={styles.songText}>
                <Text style={styles.songName} size={13} numberOfLines={1}>{item.vod_name}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  )

  // ===== 一级界面 =====
  const renderHome = () => (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={close}>
          <Icon name="back-2" size={20} color="#FFFFFF" />
          <Text style={styles.backText} size={14}>返回</Text>
        </TouchableOpacity>
        <IconMaterial name="video-library" size={22} color={ACCENT_RED} />
        <Text style={styles.brand} size={20}>MV</Text>
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="搜索歌手 / 歌名"
          placeholderTextColor={theme['c-font-label']}
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={onSubmitSearch}
          returnKeyType="search"
        />
      </View>

      <View style={styles.tabBar}>
        {MAIN_TABS.map(({ id, name }, tabIndex) => (
          <TouchableOpacity key={id} style={{ ...styles.tabItem, ...(activeTab == id ? styles.tabItemActive : {}) }} onPress={() => {
            setActiveTab(id)
            if (id == 'singer') void loadSingers()
            if (id == 'song' && songs.length == 0) void loadSongs('', '热门')
          }} hasTVPreferredFocus={tabIndex == 0}>
            <Text style={styles.tabText} size={13} color={activeTab == id ? '#FFFFFF' : theme['c-font-label']}>{name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.body}>
        {status == 'loading' && <Text style={styles.tip} size={15}>加载中…</Text>}
        {status == 'error' && <Text style={styles.tip} size={15} color="#FF6B6B">加载失败：{errorMsg}</Text>}
        {status == 'idle' && (
          <>
            {activeTab == 'singer' && renderSingerTab()}
            {activeTab == 'song' && renderSongTab()}
            {activeTab == 'search' && renderSearchTab()}
          </>
        )}
      </View>
    </View>
  )

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={close}
      supportedOrientations={['portrait', 'landscape']}
    >
      {playingSinger ? renderPlayPage() : renderHome()}
    </Modal>
  )
}

// 简易图片组件（RN Image，带占位背景）
const ImageUrl = ({ uri }: { uri: string }) => (
  <Image
    source={{ uri }}
    style={styles.songPic}
    resizeMode="cover"
  />
)

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
    flexShrink: 1,
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
  // Tab
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
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
  subTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subTabItem: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: '#33333388',
  },
  tabText: {},
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  contentCol: {
    flex: 1,
    flexDirection: 'column',
  },
  listWrap: {
    flex: 1,
  },
  listScroll: {
    flex: 1,
  },
  gridScroll: {
    flex: 1,
  },
  listTitle: {
    marginBottom: 8,
  },
  tip: {
    paddingVertical: 20,
  },
  // 歌手网格
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '25%',
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 6,
    backgroundColor: '#FFFFFF0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  // 歌曲列表
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
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
  songPicWrap: {
    width: 44,
    height: 26,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#222831',
  },
  songPic: {
    width: 44,
    height: 26,
  },
  orderedTag: {
    marginLeft: 10,
    color: GOLD,
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
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 46,
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
  ctrlText: {
    marginLeft: 6,
    color: '#FFFFFF',
  },
  ctrlTime: {
    marginLeft: 4,
    color: '#FFFFFFAA',
  },
})
