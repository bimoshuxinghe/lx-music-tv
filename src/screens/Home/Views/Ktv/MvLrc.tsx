import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text as RNText, View, useWindowDimensions } from 'react-native'
import Lyric, { type Lines } from 'lrc-file-parser'
import { getLyricInfo } from '@/core/music'
import musicSdk, { findMusic } from '@/utils/musicSdk'
import { toNewMusicInfo } from '@/utils'

/**
 * MV 卡拉OK歌词（经典 KTV 双行样式，逐字扫过）
 *
 * - 与音乐播放页歌词（plugins/lyric 全局状态）完全隔离：
 *   组件内部持有独立的 lrc-file-parser 实例与解析逻辑，
 *   MV 播放不会污染/覆盖音乐播放页的歌词状态。
 * - 歌词注入：MV 的 vod_id 不是音源歌曲 id，直接取歌词必然失败，
 *   因此先用「歌名 + 歌手」在酷狗搜到真实歌曲（拿到 hash 才能命中
 *   KRC 逐字歌词），搜不到再跨音源 findMusic 兜底。
 * - 样式对齐 KTV 大屏：底部两行，上行白色（上一句），
 *   下行当前句逐字蓝色渐亮（COLOR_SUNG，蓝色而非红色），大字号黑色描边。
 */

export interface MvLrcMusicInfo {
  id: string
  name: string
  singer: string
  source: string
  interval?: string | null
  meta?: any
}

interface Word {
  text: string
  time: number
  duration: number
}

/** 逐字扫过的颜色：蓝色（KTV 高亮色，非红色） */
const COLOR_SUNG = '#4D9BFF'
const COLOR_UNSONG = '#FFFFFF'

const timeExp = /\d{1,3}(:\d{1,3}){0,2}(?:\.\d{1,3})/g
const msTimeRxp = /\[\d{1,3}(:\d{1,3}){0,2}\.\d{3}]/
const lineTimeFieldExp = /^(?:\[[\d:.]+\])+/

const formatTimeLabel = (label: string) => {
  return label.replace(/^0+(\d+)/, '$1')
    .replace(/:0+(\d+)/g, ':$1')
    .replace(/\.0+(\d+)/, '.$1')
}

const parseTimeLabel = (label: string, isMsTime: boolean) => {
  const timeArr = formatTimeLabel(label).split(':')
  if (timeArr.length > 3) return -1
  if (timeArr.length < 3) for (let i = 3 - timeArr.length; i--;) timeArr.unshift('0')
  if (timeArr[2].includes('.')) timeArr.splice(2, 1, ...timeArr[2].split('.'))
  const msTime = timeArr[3] || '0'
  return parseInt(timeArr[0]) * 60 * 60 * 1000 +
    parseInt(timeArr[1]) * 60 * 1000 +
    parseInt(timeArr[2]) * 1000 +
    parseInt(isMsTime ? msTime : msTime.padEnd(3, '0'))
}

// 解析逐字歌词 lxlrc：[mm:ss.ms]字<起始ms,持续ms>字<起始ms,持续ms>...
// 返回 Map<行起始时间ms, 逐字数组>；字时间为相对行起始的偏移
const parseWordLines = (lxlrc: string): Map<number, Word[]> => {
  const map = new Map<number, Word[]>()
  if (!lxlrc) return map
  const isMsTime = msTimeRxp.test(lxlrc)
  const lines = lxlrc.split(/\r\n|\n|\r/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    const field = lineTimeFieldExp.exec(line)
    if (!field) continue
    const timeLabel = field[0].match(timeExp)?.[0]
    if (!timeLabel) continue
    const lineTime = parseTimeLabel(timeLabel, isMsTime)
    if (lineTime < 0) continue
    const content = line.slice(field[0].length)
    if (!content.includes('<')) continue
    const wordTimeRe = /<(\d+),(\d+)>/g
    const tags: Array<{ start: number, dur: number, index: number, length: number }> = []
    let m
    while ((m = wordTimeRe.exec(content)) !== null) {
      tags.push({ start: parseInt(m[1]), dur: parseInt(m[2]), index: m.index, length: m[0].length })
    }
    if (!tags.length) continue
    const words: Word[] = []
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i]
      const nextIndex = i + 1 < tags.length ? tags[i + 1].index : content.length
      const text = content.slice(tag.index + tag.length, nextIndex)
      if (text) words.push({ text, time: tag.start, duration: tag.dur })
    }
    if (!words.length) continue
    // 归一化绝对时间（如酷狗源）为相对行偏移
    if (words[0].time >= lineTime) {
      for (const w of words) w.time = Math.max(w.time - lineTime, 0)
    }
    map.set(lineTime, words)
  }
  return map
}

// 黑色描边（模拟 KTV 字幕描边效果）
const strokeStyle = {
  textShadowColor: '#000000',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const

type WordStatus = 'unSong' | 'active' | 'sung'

/**
 * 把 MV 播放信息解析成可取歌词的真实音乐信息。
 * MV 的 vod_id 不是音源歌曲 id：先用「歌名+歌手」在酷狗搜到真实歌曲
 * （有 hash 才能命中 KRC 逐字歌词），搜不到再跨音源 findMusic 兜底，
 * 最后退回原始 musicInfo（可能命中本地歌词缓存）。
 */
const resolveMusicInfo = async(musicInfo: MvLrcMusicInfo): Promise<LX.Music.MusicInfoOnline> => {
  const keyword = `${musicInfo.name} ${musicInfo.singer}`.trim()
  if (keyword) {
    try {
      const result = await musicSdk.kg.musicSearch.search(keyword, 1, 8)
      const hit = result?.list?.[0]
      if (hit) return toNewMusicInfo(hit) as LX.Music.MusicInfoOnline
    } catch { /* 忽略，继续兜底 */ }
    try {
      const hit = (await findMusic({
        name: musicInfo.name,
        singer: musicInfo.singer,
        albumName: '',
        interval: '',
        source: 'kg',
      }))?.[0]
      if (hit) return toNewMusicInfo(hit) as LX.Music.MusicInfoOnline
    } catch { /* 忽略，退回原信息 */ }
  }
  return musicInfo as unknown as LX.Music.MusicInfoOnline
}

/**
 * 逐字组件：双层文字 + 宽度裁切。底层白色（未唱），顶层蓝色按字时长从左到右展开。
 */
const MvLrcWord = memo(({ word, status, size, lineHeight }: {
  word: Word
  status: WordStatus
  size: number
  lineHeight: number
}) => {
  const anim = useRef(new Animated.Value(0)).current
  const [wordWidth, setWordWidth] = useState(0)

  useEffect(() => {
    if (status == 'sung') {
      anim.stopAnimation()
      anim.setValue(1)
      return
    }
    if (status == 'active') {
      anim.setValue(0)
      const duration = word.duration > 0 ? Math.min(Math.max(word.duration, 120), 800) : 300
      Animated.timing(anim, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start()
      return () => { anim.stopAnimation() }
    }
    anim.setValue(0)
  }, [status, anim, word.duration])

  const clipWidth = anim.interpolate({ inputRange: [0, 1], outputRange: [0, wordWidth] })

  return (
    <View>
      <RNText
        numberOfLines={1}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width
          if (w > 0 && Math.abs(w - wordWidth) > 0.5) setWordWidth(w)
        }}
        style={{
          fontSize: size,
          lineHeight,
          color: COLOR_UNSONG,
          fontWeight: 'bold',
          ...strokeStyle,
        }}
      >{word.text}</RNText>
      {wordWidth > 0 && (
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: clipWidth, overflow: 'hidden' }}>
          <RNText
            numberOfLines={1}
            style={{
              fontSize: size,
              lineHeight,
              color: COLOR_SUNG,
              fontWeight: 'bold',
              ...strokeStyle,
            }}
          >{word.text}</RNText>
        </Animated.View>
      )}
    </View>
  )
})

const MvLrc = memo(({ musicInfo, playing, currentTime, showControls }: {
  musicInfo: MvLrcMusicInfo | null
  playing: boolean
  currentTime: number
  showControls: boolean
}) => {
  const { width: winW } = useWindowDimensions()
  const [lines, setLines] = useState<Lines>([])
  const [wordMap, setWordMap] = useState<Map<number, Word[]>>(new Map())
  const [activeLine, setActiveLine] = useState(-1)

  // 独立的歌词解析器实例（与音乐播放页的 plugins/lyric 隔离）
  const parserRef = useRef<Lyric | null>(null)
  const getParser = useCallback(() => {
    parserRef.current ??= new Lyric({
      onPlay: (line: number) => { setActiveLine(line) },
      onSetLyric: (ls: Lines) => {
        setLines(ls)
        setActiveLine(-1)
      },
      offset: 100,
    })
    return parserRef.current
  }, [])

  // 歌词加载：musicInfo 变化时拉取歌词并载入独立解析器
  useEffect(() => {
    // 切歌立即清空旧歌词，避免旧内容残留
    setLines([])
    setWordMap(new Map())
    setActiveLine(-1)
    parserRef.current?.pause()
    if (!musicInfo) return
    let alive = true
    const load = async() => {
      // 注入 LRC：先把 MV 播放信息解析成音源上的真实歌曲，再取其歌词（含逐字 lxlyric）
      const target = await resolveMusicInfo(musicInfo)
      if (!alive) return
      const lyricInfo = await getLyricInfo({ musicInfo: target })
      if (!alive) return
      const lyric = lyricInfo.lyric ?? ''
      if (!lyric) return
      setWordMap(parseWordLines(lyricInfo.lxlyric ?? ''))
      getParser().setLyric(lyric, [])
      getParser().pause()
    }
    void load().catch(() => {})
    return () => {
      alive = false
    }
  }, [musicInfo, getParser])

  // 上次与解析器同步的时间（ms），用于检测 seek 跳变
  const syncTimeRef = useRef(0)
  const wasPlayingRef = useRef(false)
  const timeRef = useRef(0)
  timeRef.current = currentTime

  // 播放/暂停：恢复播放或检测到 seek 跳变时，把解析器重新对齐到当前播放位置
  useEffect(() => {
    const parser = parserRef.current
    if (!parser || lines.length === 0) return
    const timeMs = timeRef.current * 1000
    if (playing) {
      const isResume = !wasPlayingRef.current
      const drift = Math.abs(timeMs - syncTimeRef.current)
      if (isResume || drift > 1500) {
        syncTimeRef.current = timeMs
        parser.play(timeMs)
      }
    } else {
      parser.pause()
      syncTimeRef.current = timeMs
    }
    wasPlayingRef.current = playing
  }, [playing, lines.length, currentTime])

  // 歌词重载后按当前位置重新对齐
  useEffect(() => {
    if (lines.length === 0) return
    const parser = parserRef.current
    if (!parser) return
    const timeMs = timeRef.current * 1000
    syncTimeRef.current = timeMs
    if (playing) parser.play(timeMs)
  }, [lines]) // eslint-disable-line react-hooks/exhaustive-deps

  if (lines.length === 0) return null

  // 间奏/前奏（activeLine=-1）时预显示即将唱的第一行
  const idleLine = activeLine < 0 ? lines[0] ?? null : null
  const prevLine = activeLine > 0 ? lines[activeLine - 1] : null
  const curLine = activeLine >= 0 ? lines[activeLine] : null
  const nextTime = activeLine + 1 < lines.length ? lines[activeLine + 1].time : Number.MAX_SAFE_INTEGER

  // 当前行内进度（ms），用于计算逐字状态与无逐字数据时的整行扫色
  const elapsed = currentTime * 1000 - (curLine?.time ?? 0)
  const lineDuration = curLine ? Math.max(nextTime - curLine.time, 1) : 1
  const linePct = curLine ? Math.min(Math.max(elapsed / lineDuration, 0), 1) : 0

  const words = curLine ? wordMap.get(curLine.time) ?? [] : []
  const prevFontSize = Math.max(18, winW * 0.026)
  const curFontSize = Math.max(24, winW * 0.034)
  const prevLineHeight = prevFontSize * 1.35
  const curLineHeight = curFontSize * 1.35

  return (
    <View pointerEvents="none" style={[styles.overlay, { bottom: showControls ? 170 : 60 }]}>
      {(prevLine ?? idleLine) && (
        <View style={styles.line}>
          <RNText
            numberOfLines={1}
            style={{ fontSize: prevFontSize, lineHeight: prevLineHeight, color: COLOR_UNSONG, fontWeight: 'bold', ...strokeStyle }}
          >{(prevLine ?? idleLine)!.text}</RNText>
        </View>
      )}
      {curLine && (
        <View style={styles.line}>
          {words.length > 0
            ? words.map((word, wi) => {
                const status: WordStatus = elapsed >= word.time + word.duration
                  ? 'sung'
                  : elapsed >= word.time ? 'active' : 'unSong'
                return (
                  <MvLrcWord key={wi} word={word} status={status} size={curFontSize} lineHeight={curLineHeight} />
                )
              })
            : (
                // 无逐字数据：整行扫色（底层白，顶层蓝随行进度展开）
                <View>
                  <RNText
                    numberOfLines={1}
                    style={{ fontSize: curFontSize, lineHeight: curLineHeight, color: COLOR_UNSONG, fontWeight: 'bold', ...strokeStyle }}
                  >{curLine.text}</RNText>
                  <View style={[styles.lineFillClip, { width: `${linePct * 100}%` }]} pointerEvents="none">
                    <RNText
                      numberOfLines={1}
                      style={{ fontSize: curFontSize, lineHeight: curLineHeight, color: COLOR_SUNG, fontWeight: 'bold', ...strokeStyle }}
                    >{curLine.text}</RNText>
                  </View>
                </View>
              )}
        </View>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 40,
    right: 40,
    alignItems: 'center',
    gap: 6,
  },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  lineFillClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
})

export default MvLrc
