import { useCallback, useRef } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import Button, { type BtnType } from '@/components/common/Button'
import { createStyle } from '@/utils/tools'
import { type BoardItem } from '@/store/leaderboard/state'
import { Icon } from '@/components/common/Icon'

// index={index}
// longPressIndex={longPressIndex}
// activeId={activeId}
// showMenu={showMenu}
// onBoundChange={handleBoundChange}
export interface ListItemProps {
  item: BoardItem
  index: number
  longPressIndex: number
  activeId: string
  onShowMenu: (id: string, name: string, index: number, position: { x: number, y: number, w: number, h: number }) => void
  onBoundChange: (item: BoardItem) => void
}

export default ({ item, activeId, index, longPressIndex, onBoundChange, onShowMenu }: ListItemProps) => {
  const theme = useTheme()
  const buttonRef = useRef<BtnType>(null)

  const setPosition = useCallback(() => {
    if (buttonRef.current?.measure) {
      buttonRef.current.measure((fx, fy, width, height, px, py) => {
        // console.log(fx, fy, width, height, px, py)
        onShowMenu(item.id, item.name, index, { x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) })
      })
    }
  }, [index, item, onShowMenu])

  const active = activeId == item.id

  return (
    <View style={styles.item}>
      <Button
        ref={buttonRef}
        style={{ ...styles.button, backgroundColor: index == longPressIndex ? theme['c-button-background-active'] : undefined }}
        key={item.id} onLongPress={setPosition}
        onPress={() => { onBoundChange(item) }}
      >
        {
          active
            ? <Icon style={styles.listActiveIcon} name="chevron-right" size={12} color={theme['c-primary-font']} />
            : null
        }
        <Text style={styles.listName} size={14} textBreakStrategy="simple" color={active ? theme['c-primary-font-active'] : theme['c-font']} numberOfLines={1}>{item.name}</Text>
      </Button>
      <Button style={styles.moreButton} onPress={setPosition}>
        <Icon name="dots-vertical" color={theme['c-350']} size={12} />
      </Button>
    </View>
  )
}

const styles = createStyle({
  item: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  button: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 5,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listActiveIcon: {
    // width: 18,
    marginLeft: 3,
    // paddingRight: 5,
    textAlign: 'center',
  },
  listName: {
    justifyContent: 'center',
    paddingLeft: 6,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  moreButton: {
    paddingLeft: 16,
    paddingRight: 16,
    justifyContent: 'center',
  },
})
