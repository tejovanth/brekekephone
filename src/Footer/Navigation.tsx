import { observer } from 'mobx-react'
import React from 'react'
import { StyleSheet, View } from 'react-native'

import chatStore from '../global/chatStore'
import { RnIcon, RnText, RnTouchableOpacity } from '../Rn'
import { menus } from '../shared/navigationConfig'
import g from '../variables'

export const css = StyleSheet.create({
  Navigation: {
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  Btn: {
    flex: 1,
    padding: 4,
    alignItems: 'center',
  },
  BtnBg: {
    paddingVertical: 8,
    width: '100%',
  },
  BtnBg__active: {
    borderRadius: 22,
    backgroundColor: g.colors.primaryFn(0.5),
  },
  UnreadOuter: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    flex: 1,
    alignItems: 'center',
  },
  Unread: {
    left: 15,
    width: 20,
    height: 15,
    borderRadius: g.borderRadius,
    paddingTop: 3,
    backgroundColor: g.colors.danger,
    overflow: 'hidden',
  },
  UnreadText: {
    fontSize: g.fontSizeSmall - 2,
    lineHeight: g.fontSizeSmall - 2,
  },
})

const Navigation = ({ menu }) => (
  <View style={css.Navigation}>
    {menus().map(m => {
      const active = m.key === menu
      const totalUnreadChat = chatStore.unreadCount
      const showUnreadChat = !!totalUnreadChat && m.key === 'contact' && !active
      return (
        <RnTouchableOpacity
          key={m.key}
          onPress={active ? undefined : m.navFn}
          style={css.Btn}
        >
          <View style={[css.BtnBg, active && css.BtnBg__active]}>
            <RnIcon path={m.icon} />
          </View>
          {showUnreadChat && (
            <View style={css.UnreadOuter}>
              <View style={css.Unread}>
                <RnText style={css.UnreadText} bold white center>
                  {totalUnreadChat}
                </RnText>
              </View>
            </View>
          )}
        </RnTouchableOpacity>
      )
    })}
  </View>
)

export default observer(Navigation)
