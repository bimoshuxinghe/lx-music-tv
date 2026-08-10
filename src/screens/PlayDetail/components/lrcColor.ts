export type LrcColor = LX.AppSetting['playDetail.style.lrcColor']

export const LRC_COLOR_LIST = [
  'white',
  'cyan',
  'pink',
  'green',
  'orange',
] as const

export const LRC_ACTIVE_COLORS: Record<LrcColor, string> = {
  white: '#FFFFFF',
  cyan: '#00E5FF',
  pink: '#FF80AB',
  green: '#69F0AE',
  orange: '#FFAB40',
}
