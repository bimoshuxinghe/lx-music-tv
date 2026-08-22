import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import {
  View,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type TextInputSubmitEditingEventData,
} from 'react-native'
import Video from 'react-native-video'
import { FocusableTouchableOpacity as TouchableOpacity } from '@/components/tv/FocusableTouchableOpacity'
import Text from '@/components/common/Text'
import { IconMaterial } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import Input, { type InputType } from '@/components/common/Input'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast, isHorizontalMode } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { BorderWidths } from '@/theme'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import commonState from '@/store/common/state'
import { setNavActiveId } from '@/core/common'
import { mvSingers, mvSongs, mvSearch, mvPlayer, mvSingerAvatar } from '@/utils/nativeModules/ktvSpider'

// ============ 类型 ============
interface MvSong {
  vod_id: string
  vod_name: string
  vod_pic?: string
  vod_remarks?: string
}

// 一级页面 Tab（歌手=男歌手，女歌手独立）
const MAIN_TABS = [
  { id: 'singer', name: '歌手' },
  { id: 'female', name: '女歌手' },
  { id: 'song', name: '歌曲' },
  { id: 'search', name: '搜索' },
] as const
type MainTab = typeof MAIN_TABS[number]['id']

const GOLD = '#F5BE59'
const ACCENT_RED = '#FD3359'

/**
 * 歌手头像：cfss 歌手接口不返回图片，调用酷我搜索接口拿该歌手头像。
 * 加载完成前显示 person 占位图标。
 */
const SingerAvatar = ({ name, loadedRef, theme }: {
  name: string
  loadedRef: MutableRefObject<Record<string, boolean>>
  theme: ReturnType<typeof useTheme>
}) => {
  const [pic, setPic] = useState('')

  useEffect(() => {
    if (!name || loadedRef.current[name]) return
    loadedRef.current[name] = true
    let alive = true
    void mvSingerAvatar(name).then((url) => {
      if (!alive) return
      if (url) setPic(url)
    }).catch(() => { /* ignore */ })
    return () => { alive = false }
  }, [name, loadedRef])

  return (
    <View style={{ ...styles.singerAvatar, backgroundColor: theme['c-primary-light-900-alpha-200'] }}>
      {pic
        ? <Image url={pic} style={styles.singerAvatarImg} resizeMode="cover" />
        : <IconMaterial name="person" size={40} color={theme['c-primary-light-400-alpha-400']} />}
    </View>
  )
}

export default () => {
  const theme = useTheme()
  const { width: winW, height: winH } = useWindowDimensions()
  const horizontalMode = isHorizontalMode(winW, winH)

  // ===== 界面状态 =====
  // 歌手头像缓存标记（避免重复请求该歌手封面）
  const avatarLoadedRef = useRef<Record<string, boolean>>({})

  // 一级 Tab
  const [activeTab, setActiveTab] = useState<MainTab>('singer')
  // 歌手 Tab（gender: 1=男 2=女，由 activeTab 决定）
  const [singers, setSingers] = useState<MvSong[]>([])
  // 歌曲 Tab
  const [songs, setSongs] = useState<MvSong[]>([])
  // 搜索
  const [keyword, setKeyword] = useState('')
  const [searchResult, setSearchResult] = useState<MvSong[]>([])
  // 通用状态
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // ===== 二级（歌手全部 MV 列表页） =====
  const [playingSinger, setPlayingSinger] = useState('') // 非空表示进入二级
  const [mvList, setMvList] = useState<MvSong[]>([])

  // ===== 全屏播放 =====
  const [fullScreen, setFullScreen] = useState(false) // 全屏播放中
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [player, setPlayer] = useState<{ url: string, name: string, pic?: string } | null>(null)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState({ time: 0, duration: 0 })
  const [showControls, setShowControls] = useState(false) // 控制条显隐
  const [menuVisible, setMenuVisible] = useState(false) // 歌曲选择菜单

  const searchInputRef = useRef<InputType>(null)
  const loadingRef = useRef(false)
  const [singerGridW, setSingerGridW] = useState(0)
  const [mvGridW, setMvGridW] = useState(0)

  const gender = activeTab == 'female' ? 2 : 1

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

  // ===== 加载歌手全部 MV =====
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

  // 从名称提取歌手名：优先 '歌手 - 歌名'，其次 '歌手 歌名'（搜索提示）
  const getSingerFromName = useCallback((name: string): string => {
    const m = name.split(' - ')[0]?.trim()
    if (m && m.length > 0 && m != name) return m
    return name.split(' ')[0]?.trim() ?? ''
  }, [])

  // 点击歌手 → 进入二级（歌手全部 MV 列表，不自动播放）
  const openSinger = useCallback(async(singer: string) => {
    setPlayingSinger(singer)
    setMvList([])
    setFullScreen(false)
    setPlayer(null)
    setCurrentIndex(-1)
    setPaused(false)
    setProgress({ time: 0, duration: 0 })
    setShowControls(false)
    setMenuVisible(false)
    const arr = await loadMvListForSinger(singer)
    setMvList(arr)
  }, [loadMvListForSinger])

  // 播放指定 index
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
      setFullScreen(true)
      setShowControls(false)
      setMenuVisible(false)
    } catch (err) {
      toast(`播放失败：${(err as Error).message ?? err}`)
    } finally {
      loadingRef.current = false
    }
  }, [])

  // 点击 MV（二级列表或搜索/歌曲结果）→ 进入二级并全屏播放
  const openMv = useCallback(async(song: MvSong) => {
    const singerName = getSingerFromName(song.vod_name)
    if (!singerName) return
    setPlayingSinger(singerName)
    setMvList([])
    const arr = await loadMvListForSinger(singerName)
    setMvList(arr)
    const idx = arr.findIndex(i => i.vod_id === song.vod_id)
    void playAt(arr, Math.max(0, idx))
  }, [loadMvListForSinger, playAt, getSingerFromName])

  const playNext = useCallback(() => { playAt(mvList, currentIndex + 1).catch(() => {}) }, [mvList, currentIndex, playAt])
  const playPrev = useCallback(() => { playAt(mvList, currentIndex - 1).catch(() => {}) }, [mvList, currentIndex, playAt])

  const onEnd = useCallback(() => { playNext() }, [playNext])

  // 返回键（遥控器返回）：菜单 → 全屏 → 二级 → 退出 Ktv 回上一个导航
  const handleBack = useCallback((): boolean => {
    if (menuVisible) { setMenuVisible(false); return true }
    if (fullScreen) { setFullScreen(false); setPlayer(null); setShowControls(false); return true }
    if (playingSinger) { setPlayingSinger(''); setMvList([]); return true }
    if (commonState.navActiveId == 'nav_ktv' && commonState.lastNavActiveId != 'nav_ktv') {
      setNavActiveId(commonState.lastNavActiveId)
      return true
    }
    return false
  }, [menuVisible, fullScreen, playingSinger])

  useBackHandler(useCallback(() => handleBack(), [handleBack]))

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

  const singerCols = useMemo(() => calcCols(singerGridW, scaleSizeW(150)), [calcCols, singerGridW])
  const singerItemWidth = useMemo(() => {
    if (singerGridW <= 0) return scaleSizeW(150)
    return Math.floor((singerGridW - 12) / singerCols)
  }, [singerGridW, singerCols])

  const mvCols = useMemo(() => calcCols(mvGridW, scaleSizeW(200)), [calcCols, mvGridW])
  const mvItemWidth = useMemo(() => {
    if (mvGridW <= 0) return scaleSizeW(200)
    return Math.floor((mvGridW - 12) / mvCols)
  }, [mvGridW, mvCols])

  // ============ 全屏播放页 ============
  const renderFullScreen = () => (
    <View style={styles.fullScreenContainer}>
      {player && videoSource ? (
        <Video
          key={player.url}
          source={videoSource}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          controls={false}
          paused={paused}
          onLoad={(e: any) => { setProgress({ time: 0, duration: e?.duration ?? 0 }) }}
          onProgress={(e: any) => { setProgress(p => ({ ...p, time: e?.currentTime ?? p.time })) }}
          onEnd={onEnd}
          onError={(e: any) => { toast(`播放出错：${e?.error?.localizedDescription || e?.error || ''}`) }}
        />
      ) : (
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.videoPlaceholder}>
            <IconMaterial name="video-library" size={64} color="#FFFFFF44" />
            <Text style={styles.videoPlaceholderText} size={16} color="#FFFFFF66">加载中…</Text>
          </View>
        </View>
      )}

      {/* 居中播放/暂停按钮：常驻焦点目标，OK 切换暂停；暂停时显示播放图标 */}
      <TouchableOpacity
        style={styles.fsCenterBtn}
        focusStyle={styles.fsCenterFocus}
        hasTVPreferredFocus
        onPress={() => { setPaused(p => !p); setShowControls(false) }}
        onFocus={() => { setShowControls(false) }}
      >
        <IconMaterial name={paused ? 'play-arrow' : 'pause'} size={72} color="#FFFFFF" />
      </TouchableOpacity>

      {/* 顶栏：仅控制条显示时出现（不再常驻占位） */}
      {showControls && (
        <View style={styles.fsTopBar}>
          <IconMaterial name="person" size={18} color={ACCENT_RED} />
          <Text style={styles.fsSinger} size={15} color="#FFFFFFCC" numberOfLines={1}>{playingSinger}</Text>
          <Text style={styles.fsTitle} size={15} color="#FFFFFF" numberOfLines={1}>{player?.name}</Text>
        </View>
      )}

      {/* 进度条：仅控制条显示时出现 */}
      {showControls && player && (
        <View style={styles.progressTrack}>
          <View style={{ ...styles.progressFill, width: `${progressPct}%` }} />
        </View>
      )}

      {/* 控制条：下键聚焦时显示 */}
      {showControls && (
        <View style={styles.fsControls}>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => { playPrev() }} onFocus={() => { setShowControls(true) }} focusStyle={styles.ctrlFocus}>
            <IconMaterial name="skip-previous" size={24} color="#FFFFFF" />
            <Text style={styles.ctrlText} size={13}>上一首</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => { setPaused(p => !p) }} onFocus={() => { setShowControls(true) }} focusStyle={styles.ctrlFocus}>
            <IconMaterial name={paused ? 'play-arrow' : 'pause'} size={30} color="#FFFFFF" />
            <Text style={styles.ctrlText} size={13}>{paused ? '播放' : '暂停'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => { playNext() }} onFocus={() => { setShowControls(true) }} focusStyle={styles.ctrlFocus}>
            <IconMaterial name="skip-next" size={24} color="#FFFFFF" />
            <Text style={styles.ctrlText} size={13}>下一首</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ ...styles.ctrlBtn, ...styles.ctrlBtnMenu }} onPress={() => { setMenuVisible(true); setShowControls(false) }} onFocus={() => { setShowControls(true) }} focusStyle={styles.ctrlFocus}>
            <IconMaterial name="queue-music" size={24} color="#FFFFFF" />
            <Text style={styles.ctrlText} size={13}>菜单</Text>
          </TouchableOpacity>
          <Text style={styles.ctrlTime} size={13} color="#FFFFFFAA">{fmt(progress.time)}{progress.duration > 0 ? ` / ${fmt(progress.duration)}` : ''}</Text>
        </View>
      )}

      {/* 歌曲选择菜单 */}
      {menuVisible && (
        <View style={styles.menuPanel}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle} size={15} color="#FFFFFF">{playingSinger} 的全部歌曲</Text>
          </View>
          <FlatList
            style={styles.menuList}
            data={mvList}
            keyExtractor={(item, index) => `${item.vod_id}_${index}`}
            renderItem={({ item, index }) => {
              const active = index == currentIndex
              return (
                <TouchableOpacity
                  style={{ ...styles.menuRow, ...(active ? styles.menuRowActive : {}) }}
                  focusStyle={styles.rowFocus}
                  onPress={() => { setMenuVisible(false); void playAt(mvList, index) }}
                  hasTVPreferredFocus={index == currentIndex || index == 0}
                >
                  <Text style={styles.menuIdx} size={12} color={active ? GOLD : '#FFFFFF77'}>{index + 1}</Text>
                  <Text style={styles.menuRowName} size={14} color={active ? GOLD : '#FFFFFF'} numberOfLines={1}>{item.vod_name}</Text>
                  {item.vod_remarks ? <Text style={styles.menuRowDur} size={12} color="#FFFFFF77">{item.vod_remarks}</Text> : null}
                  {active ? <IconMaterial name="equalizer" size={14} color={GOLD} /> : null}
                </TouchableOpacity>
              )
            }}
            maxToRenderPerBatch={12}
            windowSize={8}
            initialNumToRender={20}
          />
        </View>
      )}
    </View>
  )

  // ============ 二级界面（歌手全部 MV 列表，全屏网格） ============
  const renderPlayPage = () => (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <IconMaterial name="person" size={20} color={ACCENT_RED} />
        <Text style={styles.brand} size={18} numberOfLines={1}>{playingSinger}</Text>
        <View style={styles.orderBtn}><Text style={styles.orderBtnText} size={13} color="#FFFFFF">共 {mvList.length} 首</Text></View>
      </View>
      <View style={styles.body}>
        <FlatList
          key={`mv_${mvCols}`}
          style={styles.gridList}
          data={mvList}
          numColumns={mvCols}
          keyExtractor={(item, index) => `${item.vod_id}_${index}`}
          renderItem={({ item, index }) => (
            <View style={{ ...styles.mvCard, width: mvItemWidth }}>
              <TouchableOpacity style={styles.mvCardTouch} focusStyle={styles.cardFocus} onPress={() => { void playAt(mvList, index) }} hasTVPreferredFocus={index == 0}>
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

  // ============ 歌手卡片（宫格，含头像懒加载） ============
  const renderSingerItem = ({ item, index }: { item: MvSong, index: number }) => {
    return (
      <View style={{ ...styles.singerCard, width: singerItemWidth }}>
        <TouchableOpacity
          style={styles.singerCardTouch}
          focusStyle={styles.cardFocus}
          onPress={() => { void openSinger(item.vod_name) }}
        >
          <SingerAvatar name={item.vod_name} loadedRef={avatarLoadedRef} theme={theme} />
          <Text style={styles.singerName} size={13} color={theme['c-font']} numberOfLines={1}>{item.vod_name}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const renderSingerTab = () => (
    <View style={styles.contentCol}>
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
              if (id == 'singer' || id == 'female') void loadSingers()
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
            {(activeTab == 'singer' || activeTab == 'female') && renderSingerTab()}
            {activeTab == 'song' && renderSongTab()}
            {activeTab == 'search' && renderSearchTab()}
          </>
        )}
      </View>
    </View>
  )

  return fullScreen
    ? renderFullScreen()
    : (playingSinger ? renderPlayPage() : renderHome())
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
  brand: {
    marginLeft: 10,
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
  subTabFocus: {
    backgroundColor: '#2A6BE0',
    borderColor: '#FFFFFF',
    borderWidth: 3,
    transform: [{ scale: 1.06 }],
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
  singerAvatarImg: {
    width: '100%',
    height: '100%',
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
  // 全屏播放
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholderText: {
    marginTop: 12,
  },
  fsTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  fsSinger: {
    marginLeft: 8,
    marginRight: 14,
  },
  fsTitle: {
    flexShrink: 1,
    fontWeight: 'bold',
  },
  fsCenterBtn: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 2,
    borderColor: '#FFFFFF55',
  },
  fsCenterFocus: {
    backgroundColor: 'rgba(42,107,224,0.85)',
    borderColor: '#FFFFFF',
    borderWidth: 4,
    transform: [{ scale: 1.12 }],
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 58,
    height: 3,
    backgroundColor: '#FFFFFF33',
  },
  progressFill: {
    height: 3,
    backgroundColor: GOLD,
  },
  fsControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  ctrlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: '#161F2A',
  },
  ctrlBtnMenu: {
    marginLeft: 'auto',
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
    marginLeft: 8,
  },
  // 歌曲选择菜单
  menuPanel: {
    position: 'absolute',
    right: 16,
    top: 56,
    bottom: 56,
    width: 420,
    borderRadius: 10,
    backgroundColor: 'rgba(18,20,26,0.97)',
    borderWidth: BorderWidths.normal,
    borderColor: '#FFFFFF22',
    overflow: 'hidden',
  },
  menuHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: BorderWidths.normal,
    borderBottomColor: '#FFFFFF14',
  },
  menuTitle: {
    fontWeight: 'bold',
  },
  menuList: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: '#161A22',
  },
  menuRowActive: {
    backgroundColor: '#1E2A3A',
  },
  menuIdx: {
    width: 28,
    textAlign: 'center',
  },
  menuRowName: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 6,
    marginRight: 8,
  },
  menuRowDur: {
    marginRight: 8,
  },
})
