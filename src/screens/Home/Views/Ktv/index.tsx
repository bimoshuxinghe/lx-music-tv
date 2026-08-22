import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Modal,
  FlatList,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type TextInputSubmitEditingEventData,
} from 'react-native'
import Video from 'react-native-video'
import { FocusableTouchableOpacity as TouchableOpacity } from '@/components/tv/FocusableTouchableOpacity'
import Text from '@/components/common/Text'
import { Icon, IconMaterial } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import Input, { type InputType } from '@/components/common/Input'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast, isHorizontalMode } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
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

const GOLD = '#F5BE59'
const ACCENT_RED = '#FD3359'

export default () => {
  const theme = useTheme()
  const { width: winW, height: winH } = useWindowDimensions()
  const landscape = winW > winH
  const horizontalMode = isHorizontalMode(winW, winH)

  // ===== 界面状态 =====
  const [visible, setVisible] = useState(true)

  // 一级 Tab
  const [activeTab, setActiveTab] = useState<MainTab>('singer')
  // 歌手 Tab
  const [gender, setGender] = useState(1)
  const [singers, setSingers] = useState<MvSong[]>([])
  // 歌曲 Tab
  const [songs, setSongs] = useState<MvSong[]>([])
  const [songsTitle, setSongsTitle] = useState('')
  // 搜索
  const [keyword, setKeyword] = useState('')
  const [searchResult, setSearchResult] = useState<MvSong[]>([])
  // 通用状态
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // ===== 二级播放界面状态 =====
  const [playingSinger, setPlayingSinger] = useState('') // 非空表示进入二级
  const [mvList, setMvList] = useState<MvSong[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [player, setPlayer] = useState<{ url: string, name: string, pic?: string } | null>(null)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState({ time: 0, duration: 0 })

  const searchInputRef = useRef<InputType>(null)
  const loadingRef = useRef(false)
  const [singerGridW, setSingerGridW] = useState(0)
  const [mvGridW, setMvGridW] = useState(0)

  // ===== 歌手列表 =====
  const loadSingers = useCallback(async() => {
    setStatus('loading')
    try {
      const json = JSON.parse(await mvSingers(gender))
      const arr: MvSong[] = Array.isArray(json.list) ? json.list : []
      setSingers(arr)
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
      setSongsTitle(title)
      setStatus('idle')
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
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setErrorMsg((err as Error).message ?? String(err))
    }
  }, [])

  const onSubmitSearch = (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    void doSearch(e.nativeEvent.text)
  }

  const onSearchBtnPress = () => {
    void doSearch(keyword)
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

  // ============ 网格列数（自适应） ============
  const calcCols = useCallback((containerWidth: number, cardMinW: number): number => {
    if (containerWidth <= 0) return horizontalMode ? 6 : 3
    return Math.max(1, Math.floor(containerWidth / cardMinW))
  }, [horizontalMode])

  // 歌手网格：列数与卡片宽由实际布局宽决定
  const singerCols = useMemo(() => calcCols(singerGridW, scaleSizeW(150)), [calcCols, singerGridW])
  const singerItemWidth = useMemo(() => {
    if (singerGridW <= 0) return scaleSizeW(150)
    return Math.floor((singerGridW - 12) / singerCols)
  }, [singerGridW, singerCols])

  // MV 网格：横屏二级右侧 58% 宽，竖屏全宽
  const mvCols = useMemo(() => calcCols(mvGridW, scaleSizeW(190)), [calcCols, mvGridW])
  const mvItemWidth = useMemo(() => {
    if (mvGridW <= 0) return scaleSizeW(190)
    return Math.floor((mvGridW - 12) / mvCols)
  }, [mvGridW, mvCols])

  // ============ 视频区（二级界面） ============
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
          <IconMaterial name="video-library" size={56} color="#FFFFFF44" />
          <Text style={styles.videoPlaceholderText} size={15} color="#FFFFFF66">选择一首 MV 开始播放</Text>
        </View>
      )}

      {player && (
        <View style={styles.videoTopBar}>
          <Text style={styles.videoTitle} size={16} numberOfLines={1}>{player.name}</Text>
          {player.pic ? <Image url={player.pic} style={styles.videoMiniPic} /> : null}
        </View>
      )}

      {player && (
        <View style={styles.progressTrack}>
          <View style={{ ...styles.progressFill, width: `${progressPct}%` }} />
        </View>
      )}

      {player && (
        <View style={styles.videoControls}>
          <TouchableOpacity style={styles.ctrlBtn} onPress={playPrev} focusStyle={styles.ctrlFocus}>
            <IconMaterial name="skip-previous" size={22} color="#FFFFFF" />
            <Text style={styles.ctrlText} size={13}>上一首</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => { setPaused(p => !p) }} focusStyle={styles.ctrlFocus}>
            <IconMaterial name={paused ? 'play-arrow' : 'pause'} size={26} color="#FFFFFF" />
            <Text style={styles.ctrlText} size={13}>{paused ? '播放' : '暂停'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={playNext} focusStyle={styles.ctrlFocus}>
            <IconMaterial name="skip-next" size={22} color="#FFFFFF" />
            <Text style={styles.ctrlText} size={13}>下一首</Text>
          </TouchableOpacity>
          <Text style={styles.ctrlTime} size={13} color="#FFFFFFAA">{fmt(progress.time)}{progress.duration > 0 ? ` / ${fmt(progress.duration)}` : ''}</Text>
        </View>
      )}
    </View>
  )

  // ============ MV 卡片（FlatList 网格，原生自动滚动） ============
  const renderMvItem = ({ item, index }: { item: MvSong, index: number }) => {
    const active = index == currentIndex
    return (
      <View style={{ ...styles.mvCard, width: mvItemWidth }}>
        <TouchableOpacity
          style={styles.mvCardTouch}
          focusStyle={styles.cardFocus}
          onPress={() => { void playAt(mvList, index) }}
          hasTVPreferredFocus={index == 0}
        >
          <View style={{ ...styles.mvThumb, backgroundColor: theme['c-primary-light-900-alpha-200'] }}>
            {item.vod_pic ? <Image url={item.vod_pic} style={styles.mvThumbImg} resizeMode="cover" /> : <IconMaterial name="movie" size={30} color={theme['c-primary-light-400-alpha-300']} />}
            {active ? (
              <View style={styles.playingBadge}>
                <IconMaterial name="equalizer" size={14} color={GOLD} />
                <Text style={styles.playingBadgeText} size={10} color={GOLD}>播放中</Text>
              </View>
            ) : null}
            {item.vod_remarks ? <Text style={styles.mvDuration} size={11} color="#FFFFFF">{item.vod_remarks}</Text> : null}
          </View>
          <Text style={styles.mvName} size={12} color={active ? GOLD : theme['c-font']} numberOfLines={1}>{item.vod_name}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // MV 网格列宽（由容器宽度与列数决定，先按估算渲染）
  const renderMvGrid = () => (
    <FlatList
      key={`mv_${mvCols}`}
      style={styles.gridList}
      data={mvList}
      numColumns={mvCols}
      keyExtractor={(item, index) => `${item.vod_id}_${index}`}
      renderItem={renderMvItem}
      columnWrapperStyle={styles.gridRow}
      maxToRenderPerBatch={6}
      windowSize={6}
      removeClippedSubviews={true}
      onLayout={(e) => { setMvGridW(e.nativeEvent.layout.width) }}
      initialNumToRender={12}
    />
  )

  // ============ 二级界面（播放 + 歌手全部 MV） ============
  const renderPlayPage = () => (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { setPlayingSinger(''); setPlayer(null) }}>
          <Icon name="back-2" size={20} color="#FFFFFF" />
          <Text style={styles.backText} size={14}>返回</Text>
        </TouchableOpacity>
        <IconMaterial name="person" size={20} color={ACCENT_RED} />
        <Text style={styles.brand} size={18} numberOfLines={1}>{playingSinger}</Text>
        <View style={styles.orderBtn}><Text style={styles.orderBtnText} size={13} color="#FFFFFF">共 {mvList.length} 首</Text></View>
      </View>

      {landscape ? (
        <View style={styles.splitRow}>
          <View style={styles.leftCol}>
            {renderVideo()}
          </View>
          <View style={styles.rightCol}>
            <Text style={styles.listTitle} size={12} color="#FFFFFF88">{playingSinger} 的全部 MV</Text>
            {renderMvGrid()}
          </View>
        </View>
      ) : (
        <View style={styles.portraitCol}>
          {renderVideo()}
          <View style={styles.portraitContent}>
            <Text style={styles.listTitle} size={12} color="#FFFFFF88">{playingSinger} 的全部 MV</Text>
            {renderMvGrid()}
          </View>
        </View>
      )}
    </View>
  )

  // ============ 歌手卡片（宫格） ============
  const renderSingerItem = ({ item, index }: { item: MvSong, index: number }) => {
    const initial = item.vod_name.charAt(0) || '?'
    return (
      <View style={{ ...styles.singerCard, width: singerItemWidth }}>
        <TouchableOpacity
          style={styles.singerCardTouch}
          focusStyle={styles.cardFocus}
          onPress={() => { void openSinger(item.vod_name) }}
        >
          <View style={{ ...styles.singerAvatar, backgroundColor: theme['c-primary-light-900-alpha-200'] }}>
            <Text style={styles.singerAvatarText} size={22} color={theme['c-primary-light-400-alpha-400']}>{initial}</Text>
          </View>
          <Text style={styles.singerName} size={13} color={theme['c-font']} numberOfLines={1}>{item.vod_name}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const renderSingerTab = () => (
    <View style={styles.contentCol}>
      <View style={styles.subTabBar}>
        {SINGER_GENDERS.map(g => (
          <TouchableOpacity key={g.id} style={{ ...styles.subTabItem, ...(gender == g.id ? styles.subTabItemActive : {}) }} onPress={() => { setGender(g.id) }} focusStyle={styles.subTabFocus}>
            <Text style={styles.tabText} size={13} color={gender == g.id ? '#FFFFFF' : '#FFFFFFAA'}>{g.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.listWrap}>
        <FlatList
          key={`singer_${gender}_${singerCols}`}
          style={styles.gridList}
          data={singers}
          numColumns={singerCols}
          keyExtractor={(item, index) => `${item.vod_id}_${index}`}
          renderItem={renderSingerItem}
          columnWrapperStyle={styles.gridRow}
          maxToRenderPerBatch={12}
          windowSize={8}
          removeClippedSubviews={true}
          onLayout={(e) => { setSingerGridW(e.nativeEvent.layout.width) }}
          initialNumToRender={24}
          ListEmptyComponent={<Text style={styles.tip} size={14} color="#FFFFFF77">暂无歌手</Text>}
        />
      </View>
    </View>
  )

  // ============ 歌曲 Tab（热门 MV 宫格） ============
  const renderSongTab = () => (
    <View style={styles.contentCol}>
      <View style={styles.subTabBar}>
        <View style={styles.sectionLabel}><Text size={13} color={GOLD}>热门 MV</Text></View>
        {songsTitle ? <Text style={styles.sectionSub} size={12} color="#FFFFFF88">{songsTitle}</Text> : null}
      </View>
      <View style={styles.listWrap}>
        <FlatList
          key={`songs_${mvCols}`}
          style={styles.gridList}
          data={songs}
          numColumns={mvCols}
          keyExtractor={(item, index) => `${item.vod_id}_${index}`}
          renderItem={({ item, index }) => (
            <View style={{ ...styles.mvCard, width: mvItemWidth }}>
              <TouchableOpacity style={styles.mvCardTouch} focusStyle={styles.cardFocus} onPress={() => { void openMv(item) }}>
                <View style={{ ...styles.mvThumb, backgroundColor: theme['c-primary-light-900-alpha-200'] }}>
                  {item.vod_pic ? <Image url={item.vod_pic} style={styles.mvThumbImg} resizeMode="cover" /> : <IconMaterial name="movie" size={30} color={theme['c-primary-light-400-alpha-300']} />}
                  {item.vod_remarks ? <Text style={styles.mvDuration} size={11} color="#FFFFFF">{item.vod_remarks}</Text> : null}
                </View>
                <Text style={styles.mvName} size={12} color={theme['c-font']} numberOfLines={1}>{item.vod_name}</Text>
              </TouchableOpacity>
            </View>
          )}
          columnWrapperStyle={styles.gridRow}
          maxToRenderPerBatch={6}
          windowSize={6}
          removeClippedSubviews={true}
          onLayout={(e) => { setMvGridW(e.nativeEvent.layout.width) }}
          initialNumToRender={12}
          ListEmptyComponent={<Text style={styles.tip} size={14} color="#FFFFFF77">暂无 MV</Text>}
        />
      </View>
    </View>
  )

  // ============ 搜索 Tab ============
  const renderSearchTab = () => (
    <View style={styles.contentCol}>
      <View style={styles.searchBar}>
        <Input
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="输入歌手或歌名"
          placeholderTextColor="#FFFFFF88"
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={onSubmitSearch}
          returnKeyType="search"
          hasTVPreferredFocus
          clearBtn
        />
        <TouchableOpacity style={styles.searchBtn} onPress={onSearchBtnPress} focusStyle={styles.subTabFocus}>
          <IconMaterial name="search" size={18} color="#FFFFFF" />
          <Text style={styles.tabText} size={13} color="#FFFFFF">搜索</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.listWrap}>
        <FlatList
          style={styles.gridList}
          data={searchResult}
          keyExtractor={(item, index) => `${item.vod_id}_${index}`}
          renderItem={({ item, index }) => (
            <TouchableOpacity style={styles.searchRow} focusStyle={styles.rowFocus} onPress={() => { void openMv(item) }}>
              <IconMaterial name="music-note" size={16} color={GOLD} />
              <Text style={styles.searchRowText} size={14} color="#FFFFFF" numberOfLines={1}>{item.vod_name}</Text>
              <IconMaterial name="chevron-right" size={16} color="#FFFFFF66" />
            </TouchableOpacity>
          )}
          maxToRenderPerBatch={10}
          windowSize={8}
          removeClippedSubviews={true}
          ListEmptyComponent={<Text style={styles.tip} size={14} color="#FFFFFF77">输入关键词搜索歌手 / MV</Text>}
        />
      </View>
    </View>
  )

  // ============ 一级界面 ============
  const renderHome = () => (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={close}>
          <Icon name="back-2" size={20} color="#FFFFFF" />
          <Text style={styles.backText} size={14}>返回</Text>
        </TouchableOpacity>
        <IconMaterial name="video-library" size={22} color={ACCENT_RED} />
        <Text style={styles.brand} size={20}>MV</Text>
      </View>

      <View style={styles.tabBar}>
        {MAIN_TABS.map(({ id, name }, tabIndex) => (
          <TouchableOpacity
            key={id}
            style={{ ...styles.tabItem, ...(activeTab == id ? styles.tabItemActive : {}) }}
            onPress={() => {
              setActiveTab(id)
              if (id == 'singer') void loadSingers()
              if (id == 'song' && songs.length == 0) void loadSongs('', '热门')
            }}
            hasTVPreferredFocus={tabIndex == 0}
            focusStyle={styles.tabFocus}
          >
            <Text style={styles.tabText} size={14} color={activeTab == id ? '#FFFFFF' : '#FFFFFFAA'}>{name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.body}>
        {status == 'loading' && <Text style={styles.tip} size={15} color="#FFFFFFAA">加载中…</Text>}
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: BorderWidths.normal,
    borderBottomColor: '#FFFFFF14',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#333A48',
    marginRight: 14,
  },
  backText: {
    marginLeft: 4,
    color: '#FFFFFF',
  },
  brand: {
    marginLeft: 10,
    marginRight: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  orderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#2A6BE0',
  },
  orderBtnText: {},
  // Tab
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  tabItem: {
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#22262F',
  },
  tabItemActive: {
    backgroundColor: ACCENT_RED,
  },
  tabFocus: {
    backgroundColor: ACCENT_RED,
    borderColor: '#FFFFFF',
    borderWidth: 3,
    transform: [{ scale: 1.06 }],
  },
  subTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },
  subTabItem: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#22262F',
  },
  subTabItemActive: {
    backgroundColor: '#2A6BE0',
  },
  subTabFocus: {
    backgroundColor: '#2A6BE0',
    borderColor: '#FFFFFF',
    borderWidth: 3,
    transform: [{ scale: 1.06 }],
  },
  sectionLabel: {
    paddingRight: 8,
  },
  sectionSub: {
    paddingRight: 10,
  },
  tabText: {},
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  contentCol: {
    flex: 1,
    flexDirection: 'column',
  },
  listWrap: {
    flex: 1,
  },
  tip: {
    paddingVertical: 30,
    textAlign: 'center',
  },
  // 网格
  gridList: {
    flex: 1,
  },
  gridRow: {
    justifyContent: 'flex-start',
  },
  // 歌手卡片
  singerCard: {
    paddingHorizontal: 6,
    paddingBottom: 14,
  },
  singerCardTouch: {
    alignItems: 'center',
    padding: 10,
  },
  cardFocus: {
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
    borderWidth: 3,
    borderRadius: 10,
    transform: [{ scale: 1.08 }],
  },
  singerAvatar: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  singerAvatarText: {
    fontWeight: 'bold',
  },
  singerName: {
    marginTop: 8,
    textAlign: 'center',
  },
  // MV 卡片
  mvCard: {
    paddingHorizontal: 6,
    paddingBottom: 14,
  },
  mvCardTouch: {
    width: '100%',
  },
  mvThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mvThumbImg: {
    width: '100%',
    height: '100%',
  },
  mvName: {
    marginTop: 6,
  },
  mvDuration: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  playingBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  playingBadgeText: {
    marginLeft: 3,
  },
  // 搜索
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchInput: {
    height: 40,
    borderRadius: 8,
    backgroundColor: '#22262F',
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#2A6BE0',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#161A22',
  },
  rowFocus: {
    backgroundColor: '#2A6BE0',
    borderColor: '#FFFFFF',
    borderWidth: 3,
    transform: [{ scale: 1.02 }],
  },
  searchRowText: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  // 横屏分栏
  splitRow: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  leftCol: {
    width: '42%',
    paddingRight: 16,
  },
  rightCol: {
    flex: 1,
    flexDirection: 'column',
  },
  listTitle: {
    marginBottom: 8,
  },
  // 竖屏
  portraitCol: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  portraitContent: {
    flex: 1,
    marginTop: 12,
  },
  // 视频
  videoBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderRadius: 10,
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
    marginTop: 12,
  },
  videoTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  videoTitle: {
    color: GOLD,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  videoMiniPic: {
    width: 48,
    height: 28,
    borderRadius: 4,
    marginLeft: 10,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 52,
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
    backgroundColor: 'rgba(0,0,0,0.55)',
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
  ctrlFocus: {
    backgroundColor: '#2A6BE0',
    borderColor: '#FFFFFF',
    borderWidth: 3,
    transform: [{ scale: 1.06 }],
  },
  ctrlText: {
    marginLeft: 6,
    color: '#FFFFFF',
  },
  ctrlTime: {
    marginLeft: 4,
  },
})
