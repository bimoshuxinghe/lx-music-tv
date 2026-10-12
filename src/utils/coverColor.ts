import jpeg from 'jpeg-js'

/**
 * 专辑封面取色（播放页背景渐变用）
 *
 * 下载封面 → jpeg-js 解码 → 网格采样求主色 → 归一化亮度后推出渐变色。
 * 任一环节失败（网络/格式/超时）都返回 null，由调用方回退到主题色。
 */

const CACHE = new Map<string, string | null>()
const CACHE_MAX = 20

const xhrArrayBuffer = (url: string, timeout = 8000): Promise<ArrayBuffer> => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', url, true)
  xhr.responseType = 'arraybuffer'
  xhr.timeout = timeout
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as ArrayBuffer)
    else reject(new Error('http ' + xhr.status))
  }
  xhr.onerror = () => reject(new Error('network error'))
  xhr.ontimeout = () => reject(new Error('timeout'))
  xhr.send()
})

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const toHex2 = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0')

const rgbToHex = (r: number, g: number, b: number) => `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`

// hex / rgb() → [r,g,b] 0-255，解析失败返回 null
const parseColor = (color: string): [number, number, number] | null => {
  const hexMatch = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (hexMatch) {
    let hex = hexMatch[1]
    if (hex.length == 3) hex = hex.split('').map(c => c + c).join('')
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
  }
  const rgbMatch = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(color)
  if (rgbMatch) return [parseFloat(rgbMatch[1]), parseFloat(rgbMatch[2]), parseFloat(rgbMatch[3])]
  return null
}

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b); const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max == min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max == r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max == g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h / 6, s, l]
}

const hue2rgb = (p: number, q: number, t: number) => {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  if (s == 0) { const v = l * 255; return [v, v, v] }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255,
  ]
}

/** 颜色线性混合：t=0 返回 a，t=1 返回 b */
export const mixHex = (a: string, b: string, t: number): string => {
  const ca = parseColor(a); const cb = parseColor(b)
  if (!ca || !cb) return b
  return rgbToHex(ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t)
}

/**
 * 由任意主色推出上下渐变的两色：
 * - 限制饱和度在舒适区间（太灰/太艳都不好看）
 * - 限制亮度在 0.18~0.45，保证白色标题与歌词始终可读
 */
export const deriveGradient = (color: string): [string, string] => {
  const rgb = parseColor(color)
  if (!rgb) return ['#1B4B63', '#0A1B26']
  const [, s0, l0] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  const s = clamp(s0, 0.22, 0.58)
  const l = clamp(l0, 0.28, 0.42)
  const [r, g, b] = hslToRgb(rgbToHsl(rgb[0], rgb[1], rgb[2])[0], s, l)
  const [dr, dg, db] = hslToRgb(rgbToHsl(rgb[0], rgb[1], rgb[2])[0], clamp(s + 0.06, 0, 0.7), Math.max(0.14, l - 0.2))
  return [rgbToHex(r, g, b), rgbToHex(dr, dg, db)]
}

/** 取封面主色并推出渐变两色；失败返回 null */
export const getCoverGradient = async(url: string): Promise<[string, string] | null> => {
  if (!url) return null
  if (CACHE.has(url)) return CACHE.get(url) ?? null
  try {
    const buffer = await xhrArrayBuffer(url)
    const img = jpeg.decode(Buffer.from(buffer), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 512 })
    if (!img?.data?.length) throw new Error('decode failed')
    // 网格采样：跳过近黑/近白/近灰的像素，只统计有色彩倾向的像素
    const step = Math.max(2, Math.floor(Math.min(img.width, img.height) / 28))
    let r = 0; let g = 0; let b = 0; let n = 0
    for (let y = 0; y < img.height; y += step) {
      for (let x = 0; x < img.width; x += step) {
        const i = (y * img.width + x) * 4
        const pr = img.data[i]; const pg = img.data[i + 1]; const pb = img.data[i + 2]
        const max = Math.max(pr, pg, pb); const min = Math.min(pr, pg, pb)
        if (max < 36 || (max - min) < 14) continue
        r += pr; g += pg; b += pb; n++
      }
    }
    if (!n) throw new Error('no color')
    const result = deriveGradient(rgbToHex(r / n, g / n, b / n))
    if (CACHE.size > CACHE_MAX) CACHE.clear()
    CACHE.set(url, result)
    return result
  } catch {
    if (CACHE.size > CACHE_MAX) CACHE.clear()
    CACHE.set(url, null)
    return null
  }
}
