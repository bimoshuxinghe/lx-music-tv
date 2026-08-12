import { useEffect, useState } from 'react'
import Lyric, { type Lines } from 'lrc-file-parser'
// import { getStore, subscribe } from '@/store'
export type Line = Lines[number]
type PlayHook = (line: number, text: string) => void
type SetLyricHook = (lines: Lines) => void

export type Word = { text: string, time: number, duration: number }

const timeExp = /\d{1,3}(:\d{1,3}){0,2}(?:\.\d{1,3})/g
const msTimeRxp = /\[\d{1,3}(:\d{1,3}){0,2}\.\d{3}]/
const lineTimeFieldExp = /^(?:\[[\d:.]+\])+/

const formatTimeLabel = (label: string) => {
  return label.replace(/^0+(\d+)/, '$1')
    .replace(/:0+(\d+)/g, ':$1')
    .replace(/\.0+(\d+)/, '.$1')
}

// 与 lrc-file-parser 的 time 解析逻辑保持一致，确保行时间匹配
const parseTimeLabel = (label: string, isMsTime: boolean) => {
  const timeArr = formatTimeLabel(label).split(':')
  if (timeArr.length > 3) return -1
  if (timeArr.length < 3) for (let i = 3 - timeArr.length; i--;) timeArr.unshift('0')
  if (timeArr[2].includes('.')) timeArr.splice(2, 1, ...timeArr[2].split('.'))
  const msTime = timeArr[3] || '0'
  return parseInt(timeArr[0]) * 60 * 60 * 1000
    + parseInt(timeArr[1]) * 60 * 1000
    + parseInt(timeArr[2]) * 1000
    + parseInt(isMsTime ? msTime : msTime.padEnd(3, '0'))
}

// 解析逐字歌词 lxlrc：格式为 [mm:ss.ms]字<起始ms,持续ms>字<起始ms,持续ms>...
const parseLxlyric = (lxlrc: string): Map<number, Word[]> => {
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
    const tags: { start: number, dur: number, index: number, length: number }[] = []
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

const lrcTools = {
  isInited: false,
  lrc: null as Lyric | null,
  currentLineData: { line: 0, text: '' },
  currentLines: [] as Lines,
  playHooks: [] as PlayHook[],
  setLyricHooks: [] as SetLyricHook[],
  isPlay: false,
  isShowTranslation: false,
  isShowRoma: false,
  lyricText: '',
  translationText: '' as string | null | undefined,
  romaText: '' as string | null | undefined,
  wordLinesMap: new Map<number, Word[]>(),
  init() {
    if (this.isInited) return
    this.isInited = true
    this.lrc = new Lyric({
      onPlay: this.onPlay.bind(this),
      onSetLyric: this.onSetLyric.bind(this),
      offset: 100, // offset time(ms), default is 150 ms
    })
  },
  onPlay(line: number, text: string) {
    this.currentLineData.line = line
    // console.log(line)
    this.currentLineData.text = text
    for (const hook of this.playHooks) hook(line, text)
  },
  onSetLyric(lines: Lines) {
    this.currentLines = lines
    this.currentLineData.line = 0
    this.currentLineData.text = ''
    for (const hook of this.playHooks) hook(-1, '')
    for (const hook of this.setLyricHooks) hook(lines)
  },
  addPlayHook(hook: PlayHook) {
    this.playHooks.push(hook)
    hook(this.currentLineData.line, this.currentLineData.text)
  },
  removePlayHook(hook: PlayHook) {
    this.playHooks.splice(this.playHooks.indexOf(hook), 1)
  },
  addSetLyricHook(hook: SetLyricHook) {
    this.setLyricHooks.push(hook)
    hook(this.currentLines)
  },
  removeSetLyricHook(hook: SetLyricHook) {
    this.setLyricHooks.splice(this.setLyricHooks.indexOf(hook), 1)
  },
  setLyric() {
    const extendedLyrics = [] as string[]
    if (this.isShowTranslation && this.translationText) extendedLyrics.push(this.translationText)
    if (this.isShowRoma && this.romaText) extendedLyrics.push(this.romaText)
    this.lrc!.setLyric(this.lyricText, extendedLyrics)
  },
}


export const init = async() => {
  lrcTools.init()
}

export const setLyric = (lyric: string, translation?: string, romalrc?: string, lxlrc?: string) => {
  lrcTools.isPlay = false
  lrcTools.lyricText = lyric
  lrcTools.translationText = translation
  lrcTools.romaText = romalrc
  lrcTools.wordLinesMap = parseLxlyric(lxlrc ?? '')
  lrcTools.setLyric()
}
export const setPlaybackRate = (playbackRate: number) => {
  lrcTools.lrc!.setPlaybackRate(playbackRate)
}
export const toggleTranslation = (isShow: boolean) => {
  lrcTools.isShowTranslation = isShow
  if (!lrcTools.lyricText) return
  lrcTools.setLyric()
}
export const toggleRoma = (isShow: boolean) => {
  lrcTools.isShowRoma = isShow
  if (!lrcTools.lyricText) return
  lrcTools.setLyric()
}
export const play = (time: number) => {
  // console.log(time)
  lrcTools.isPlay = true
  lrcTools.lrc!.play(time)
}
export const pause = () => {
  // console.log('pause')
  lrcTools.isPlay = false
  lrcTools.lrc!.pause()
}

// on lyric play hook
export const useLrcPlay = (autoUpdate = true) => {
  const [lrcInfo, setLrcInfo] = useState(lrcTools.currentLineData)
  useEffect(() => {
    if (!autoUpdate) return
    const setLrcCallback: SetLyricHook = () => {
      setLrcInfo({ line: 0, text: '' })
    }
    const playCallback: PlayHook = (line, text) => {
      setLrcInfo({ line, text })
    }
    lrcTools.addSetLyricHook(setLrcCallback)
    lrcTools.addPlayHook(playCallback)
    setLrcInfo(lrcTools.currentLineData)
    return () => {
      lrcTools.removeSetLyricHook(setLrcCallback)
      lrcTools.removePlayHook(playCallback)
    }
  }, [autoUpdate])

  return lrcInfo
}

// on lyric set hook
export const useLrcSet = () => {
  const [lines, setLines] = useState<Lines>(lrcTools.currentLines)
  useEffect(() => {
    const callback = (lines: Lines) => {
      setLines(lines)
    }
    lrcTools.addSetLyricHook(callback)
    return () => { lrcTools.removeSetLyricHook(callback) }
  }, [])

  return lines
}

// 逐字歌词数据 hook：返回按行时间索引的逐字数据
export const useLrcWords = () => {
  const [wordLinesMap, setWordLinesMap] = useState<Map<number, Word[]>>(lrcTools.wordLinesMap)
  useEffect(() => {
    const callback: SetLyricHook = () => {
      setWordLinesMap(new Map(lrcTools.wordLinesMap))
    }
    lrcTools.addSetLyricHook(callback)
    return () => { lrcTools.removeSetLyricHook(callback) }
  }, [])

  return wordLinesMap
}

