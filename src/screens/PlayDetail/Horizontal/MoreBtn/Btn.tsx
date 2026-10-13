
import { FocusableTouchableOpacity as TouchableOpacity } from '@/components/tv/FocusableTouchableOpacity'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeW } from '@/utils/pixelRatio'

export const BTN_WIDTH = scaleSizeW(32)
export const BTN_ICON_SIZE = 20

export default ({ icon, color, onPress }: {
  icon: string
  color?: string
  onPress: () => void
}) => {
  const theme = useTheme()
  return (
    <TouchableOpacity
      style={{ ...styles.cotrolBtn, width: BTN_WIDTH, height: BTN_WIDTH }}
      activeOpacity={0.5}
      onPress={onPress}
      focusStyle={styles.btnFocus}
    >
      <Icon name={icon} color={color ?? theme['c-font-label']} size={BTN_ICON_SIZE} />
    </TouchableOpacity>
  )
}

const styles = createStyle({
  cotrolBtn: {
    marginBottom: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BTN_WIDTH / 2,
    backgroundColor: 'rgba(127,127,127,0.14)',
  },
  btnFocus: {
    borderWidth: 0,
    transform: [{ scale: 1.1 }],
  },
})
